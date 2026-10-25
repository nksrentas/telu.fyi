use crate::documents::repository as documents;
use crate::knowledge::models::KnowledgeError;
use crate::knowledge::repository::KnowledgeRepository;
use crate::preparation::models::{
    SelectedSource, SelectionError, MAX_SELECTED_DOCUMENT_VERSIONS, MAX_SELECTED_KNOWLEDGE_ITEMS,
};
use sqlx::{SqliteConnection, SqliteExecutor, SqlitePool};
use std::collections::{HashMap, HashSet};
use tracing::warn;

type SourceRow = (String, Option<String>, Option<String>, Option<String>);

pub async fn select(
    pool: &SqlitePool,
    planned_meeting_id: &str,
    sources: Vec<SelectedSource>,
) -> Result<Vec<SelectedSource>, SelectionError> {
    ensure_bounded_and_unique(&sources)?;
    ensure_planned_meeting(pool, planned_meeting_id).await?;
    ensure_knowledge_eligible(pool, &sources).await?;

    let mut transaction = pool.begin().await.map_err(storage)?;
    ensure_versions_available(&mut transaction, &sources).await?;
    sqlx::query("DELETE FROM preparation_sources WHERE planned_meeting_id = ?")
        .bind(planned_meeting_id)
        .execute(&mut *transaction)
        .await
        .map_err(storage)?;
    for (position, source) in sources.iter().enumerate() {
        insert(&mut transaction, planned_meeting_id, position, source).await?;
    }
    transaction.commit().await.map_err(storage)?;
    Ok(sources)
}

pub async fn list(
    pool: &SqlitePool,
    planned_meeting_id: &str,
) -> Result<Vec<SelectedSource>, SelectionError> {
    ensure_planned_meeting(pool, planned_meeting_id).await?;
    saved(pool, planned_meeting_id).await
}

pub(super) async fn saved<'e, E: SqliteExecutor<'e>>(
    executor: E,
    planned_meeting_id: &str,
) -> Result<Vec<SelectedSource>, SelectionError> {
    sqlx::query_as::<_, SourceRow>(
        "SELECT kind, document_version_id, meeting_id, knowledge_item_id
         FROM preparation_sources WHERE planned_meeting_id = ? ORDER BY position",
    )
    .bind(planned_meeting_id)
    .fetch_all(executor)
    .await
    .map_err(storage)?
    .into_iter()
    .map(source_from_row)
    .collect()
}

fn ensure_bounded_and_unique(sources: &[SelectedSource]) -> Result<(), SelectionError> {
    let documents = sources
        .iter()
        .filter(|source| matches!(source, SelectedSource::Document { .. }))
        .count();
    if documents > MAX_SELECTED_DOCUMENT_VERSIONS
        || sources.len() - documents > MAX_SELECTED_KNOWLEDGE_ITEMS
    {
        return Err(SelectionError::TooLarge);
    }
    let mut seen = HashSet::new();
    if sources.iter().all(|source| seen.insert(source)) {
        Ok(())
    } else {
        Err(SelectionError::Duplicate)
    }
}

async fn ensure_planned_meeting(pool: &SqlitePool, id: &str) -> Result<(), SelectionError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM planned_meetings WHERE id = ?)")
            .bind(id)
            .fetch_one(pool)
            .await
            .map_err(storage)?;
    if exists {
        Ok(())
    } else {
        Err(SelectionError::PlannedMeetingNotFound)
    }
}

async fn ensure_knowledge_eligible(
    pool: &SqlitePool,
    sources: &[SelectedSource],
) -> Result<(), SelectionError> {
    let mut wanted: HashMap<&str, Vec<&str>> = HashMap::new();
    for source in sources {
        if let SelectedSource::Knowledge {
            meeting_id,
            item_id,
        } = source
        {
            wanted.entry(meeting_id).or_default().push(item_id);
        }
    }
    for (meeting_id, item_ids) in wanted {
        let eligible: HashSet<String> = KnowledgeRepository::list_eligible_items(pool, meeting_id)
            .await
            .map_err(|error| match error {
                KnowledgeError::Storage => SelectionError::Storage,
                _ => SelectionError::NotEligible,
            })?
            .into_iter()
            .map(|item| item.item_id)
            .collect();
        if !item_ids.iter().all(|id| eligible.contains(*id)) {
            return Err(SelectionError::NotEligible);
        }
    }
    Ok(())
}

async fn ensure_versions_available(
    connection: &mut SqliteConnection,
    sources: &[SelectedSource],
) -> Result<(), SelectionError> {
    for source in sources {
        let SelectedSource::Document { version_id } = source else {
            continue;
        };
        let version = documents::get_version(&mut *connection, version_id)
            .await
            .map_err(storage)?
            .ok_or(SelectionError::NotEligible)?;
        if !documents::is_available(&mut *connection, &version.document_id)
            .await
            .map_err(storage)?
        {
            return Err(SelectionError::NotEligible);
        }
    }
    Ok(())
}

async fn insert(
    connection: &mut SqliteConnection,
    planned_meeting_id: &str,
    position: usize,
    source: &SelectedSource,
) -> Result<(), SelectionError> {
    let (kind, version_id, meeting_id, item_id) = match source {
        SelectedSource::Document { version_id } => ("document", Some(version_id), None, None),
        SelectedSource::Knowledge {
            meeting_id,
            item_id,
        } => ("knowledge", None, Some(meeting_id), Some(item_id)),
    };
    sqlx::query(
        "INSERT INTO preparation_sources
         (planned_meeting_id, position, kind, document_version_id, meeting_id, knowledge_item_id)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(planned_meeting_id)
    .bind(position as i64)
    .bind(kind)
    .bind(version_id)
    .bind(meeting_id)
    .bind(item_id)
    .execute(connection)
    .await
    .map_err(storage)?;
    Ok(())
}

fn source_from_row(row: SourceRow) -> Result<SelectedSource, SelectionError> {
    match row {
        (kind, Some(version_id), None, None) if kind == "document" => {
            Ok(SelectedSource::Document { version_id })
        }
        (kind, None, Some(meeting_id), Some(item_id)) if kind == "knowledge" => {
            Ok(SelectedSource::Knowledge {
                meeting_id,
                item_id,
            })
        }
        _ => Err(SelectionError::Storage),
    }
}

fn storage(error: sqlx::Error) -> SelectionError {
    warn!(error = %error, "preparation selection storage failed");
    SelectionError::Storage
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::ingest::{ingest_text, ingest_text_into};
    use crate::documents::models::DocumentVersion;
    use crate::knowledge::models::ReviewAction;
    use crate::knowledge::review::append_review;
    use crate::knowledge::test_support::{migrated_pool, seed_items, MEETING_ID};
    use crate::planning::models::PlannedMeetingInput;
    use crate::planning::repository as planning;
    use chrono::{DateTime, Utc};

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
            .expect("test timestamp")
            .with_timezone(&Utc)
    }

    async fn planned_meeting(pool: &SqlitePool) -> String {
        let input = PlannedMeetingInput {
            title: "Weekly sync".to_string(),
            start_utc: None,
            purpose: String::new(),
        };
        planning::create(pool, input, now())
            .await
            .expect("planned meeting")
            .id
    }

    async fn document(pool: &SqlitePool, title: &str) -> DocumentVersion {
        ingest_text(pool, title, "First paragraph.", now())
            .await
            .expect("document")
    }

    fn pinned(version: &DocumentVersion) -> SelectedSource {
        SelectedSource::Document {
            version_id: version.id.clone(),
        }
    }

    fn knowledge(item_id: &str) -> SelectedSource {
        SelectedSource::Knowledge {
            meeting_id: MEETING_ID.to_string(),
            item_id: item_id.to_string(),
        }
    }

    #[tokio::test]
    async fn selection_pins_the_chosen_version_after_the_document_gets_version_2() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let v1 = document(&pool, "Roadmap").await;

        select(&pool, &plan, vec![pinned(&v1)])
            .await
            .expect("selected");
        let v2 = ingest_text_into(&pool, &v1.document_id, "Second draft.", now())
            .await
            .expect("version 2");

        assert_eq!(v2.version, 2);
        assert_eq!(list(&pool, &plan).await.expect("listed"), vec![pinned(&v1)]);
    }

    #[tokio::test]
    async fn selection_accepts_accepted_knowledge_and_refuses_a_proposed_item() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta", "Hire a designer"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept)
            .await
            .expect("accept");

        let proposed = select(
            &pool,
            &plan,
            vec![knowledge(&items[0]), knowledge(&items[1])],
        )
        .await;
        let accepted = select(&pool, &plan, vec![knowledge(&items[0])]).await;

        assert_eq!(proposed, Err(SelectionError::NotEligible));
        assert_eq!(SelectionError::NotEligible.code(), "SOURCE_NOT_ELIGIBLE");
        assert_eq!(accepted, Ok(vec![knowledge(&items[0])]));
    }

    #[tokio::test]
    async fn selection_refuses_knowledge_of_an_unknown_meeting() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let unknown = SelectedSource::Knowledge {
            meeting_id: "not-a-meeting".to_string(),
            item_id: "not-an-item".to_string(),
        };

        assert_eq!(
            select(&pool, &plan, vec![unknown]).await,
            Err(SelectionError::NotEligible)
        );
    }

    #[tokio::test]
    async fn selection_refuses_13_documents_and_keeps_the_previous_selection() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let mut versions = Vec::new();
        for index in 0..13 {
            versions.push(document(&pool, &format!("Doc {index}")).await);
        }
        let twelve: Vec<_> = versions[..12].iter().map(pinned).collect();
        let thirteen: Vec<_> = versions.iter().map(pinned).collect();

        select(&pool, &plan, twelve.clone())
            .await
            .expect("12 documents fit");
        let refused = select(&pool, &plan, thirteen).await;

        assert_eq!(refused, Err(SelectionError::TooLarge));
        assert_eq!(SelectionError::TooLarge.code(), "SELECTION_TOO_LARGE");
        assert_eq!(list(&pool, &plan).await.expect("listed"), twelve);
    }

    #[test]
    fn selection_caps_knowledge_at_60_items() {
        let items = |count: usize| -> Vec<SelectedSource> {
            (0..count)
                .map(|index| knowledge(&format!("item-{index}")))
                .collect()
        };

        assert_eq!(ensure_bounded_and_unique(&items(60)), Ok(()));
        assert_eq!(
            ensure_bounded_and_unique(&items(61)),
            Err(SelectionError::TooLarge)
        );
    }

    #[test]
    fn selection_refuses_the_same_source_twice() {
        assert_eq!(
            ensure_bounded_and_unique(&[knowledge("a"), knowledge("a")]),
            Err(SelectionError::Duplicate)
        );
    }

    #[tokio::test]
    async fn selection_lists_entries_in_the_saved_order() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let alpha = document(&pool, "Alpha").await;
        let beta = document(&pool, "Beta").await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept)
            .await
            .expect("accept");
        let order = vec![pinned(&beta), knowledge(&items[0]), pinned(&alpha)];

        select(&pool, &plan, order.clone()).await.expect("selected");
        let reordered = vec![pinned(&alpha), pinned(&beta)];
        select(&pool, &plan, reordered.clone())
            .await
            .expect("reselected");

        assert_eq!(list(&pool, &plan).await.expect("listed"), reordered);
        select(&pool, &plan, order.clone()).await.expect("selected");
        assert_eq!(list(&pool, &plan).await.expect("listed"), order);
    }

    #[tokio::test]
    async fn selection_refuses_a_version_of_a_deleted_or_unknown_document() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let deleted = document(&pool, "Gone").await;
        documents::mark_deleted(&pool, &deleted.document_id)
            .await
            .expect("deleted");
        let unknown = SelectedSource::Document {
            version_id: "missing".to_string(),
        };

        assert_eq!(
            select(&pool, &plan, vec![pinned(&deleted)]).await,
            Err(SelectionError::NotEligible)
        );
        assert_eq!(
            select(&pool, &plan, vec![unknown]).await,
            Err(SelectionError::NotEligible)
        );
    }

    #[tokio::test]
    async fn selection_requires_an_existing_planned_meeting_and_is_removed_with_it() {
        let pool = migrated_pool().await;
        let plan = planned_meeting(&pool).await;
        let version = document(&pool, "Roadmap").await;
        select(&pool, &plan, vec![pinned(&version)])
            .await
            .expect("selected");

        planning::delete(&pool, &plan).await.expect("plan deleted");
        let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM preparation_sources")
            .fetch_one(&pool)
            .await
            .expect("count");

        assert_eq!(rows, 0);
        assert_eq!(
            list(&pool, &plan).await,
            Err(SelectionError::PlannedMeetingNotFound)
        );
        assert_eq!(
            select(&pool, &plan, vec![pinned(&version)]).await,
            Err(SelectionError::PlannedMeetingNotFound)
        );
    }

    #[test]
    fn selected_source_uses_kind_tags_and_camel_case_fields() {
        let json = serde_json::to_value(knowledge("item")).expect("json");

        assert_eq!(
            json,
            serde_json::json!({"kind": "knowledge", "meetingId": MEETING_ID, "itemId": "item"})
        );
        let parsed: SelectedSource =
            serde_json::from_value(serde_json::json!({"kind": "document", "versionId": "v"}))
                .expect("parsed");
        assert_eq!(
            parsed,
            SelectedSource::Document {
                version_id: "v".to_string()
            }
        );
    }
}
