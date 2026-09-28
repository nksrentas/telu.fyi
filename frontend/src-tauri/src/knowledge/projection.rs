use crate::knowledge::models::{
    EvidenceLinkView, EvidenceRole, EvidenceStatus, FieldSupport, KnowledgeDeletionImpact,
    KnowledgeError, KnowledgeItemHistory, KnowledgeItemView, KnowledgeRunView, KnowledgeType,
    MeetingKnowledgeView, OriginalProposalView, ReviewEventView, ReviewState, RevisionView, Support,
};
use crate::knowledge::repository::{storage_error, validate_meeting_id, KnowledgeRepository, RUN_COLUMNS};
use crate::knowledge::span_verifier::{normalize_with_map, sha256_hex};
use sqlx::{FromRow, SqlitePool};
use std::collections::HashMap;

#[derive(FromRow)]
struct CurrentItemRow {
    item_id: String,
    meeting_id: String,
    origin_run_id: String,
    item_type: KnowledgeType,
    text: String,
    owner_text: Option<String>,
    due_text: Option<String>,
    original_owner_text: Option<String>,
    original_owner_support: Support,
    original_due_text: Option<String>,
    original_due_support: Support,
    review_state: ReviewState,
    latest_revision_id: Option<String>,
    corrected: bool,
    created_at_utc: String,
}

#[derive(FromRow)]
struct LinkRow {
    link_id: String,
    item_id: String,
    evidence_id: String,
    role: EvidenceRole,
    quote_text: String,
    normalized_quote: String,
    evidence_text_sha256: String,
    raw_start: i64,
    raw_end: i64,
    segment_capture_incomplete: bool,
    sequence: Option<i64>,
    audio_start_time: Option<f64>,
    audio_end_time: Option<f64>,
    current_text: Option<String>,
}

#[derive(FromRow)]
struct OriginalRow {
    origin_run_id: String,
    text: String,
    owner_text: Option<String>,
    due_text: Option<String>,
    created_at_utc: String,
    run_started_at_utc: String,
}

struct LinkState {
    view: EvidenceLinkView,
    status: EvidenceStatus,
}

impl KnowledgeRepository {
    pub async fn meeting_view(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<MeetingKnowledgeView, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        let views = load_item_views(pool, meeting_id, None).await?;
        let latest_run = Self::latest_run(pool, meeting_id).await?;
        let count_state = |state: ReviewState| views.iter().filter(|item| item.review_state == state).count() as i64;
        let pending_count = count_state(ReviewState::Proposed);
        let accepted_count = count_state(ReviewState::Accepted);
        let (rejected, items): (Vec<_>, Vec<_>) = views
            .into_iter()
            .partition(|item| item.review_state == ReviewState::Rejected);
        Ok(MeetingKnowledgeView {
            meeting_id: meeting_id.to_string(),
            skipped_count: latest_run.as_ref().map_or(0, |run| run.skipped_count),
            latest_run,
            items,
            rejected,
            pending_count,
            accepted_count,
        })
    }

    pub async fn item_view(
        pool: &SqlitePool,
        meeting_id: &str,
        item_id: &str,
    ) -> Result<KnowledgeItemView, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        load_item_views(pool, meeting_id, Some(item_id))
            .await?
            .into_iter()
            .next()
            .ok_or(KnowledgeError::ItemNotFound)
    }

    pub async fn list_eligible_items(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<KnowledgeItemView>, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        Ok(load_item_views(pool, meeting_id, None)
            .await?
            .into_iter()
            .filter(|item| item.eligibility)
            .collect())
    }

    pub async fn item_history(
        pool: &SqlitePool,
        meeting_id: &str,
        item_id: &str,
    ) -> Result<KnowledgeItemHistory, KnowledgeError> {
        let evidence = Self::item_view(pool, meeting_id, item_id).await?.evidence;
        let original = load_original(pool, item_id).await?;
        let revisions = sqlx::query_as::<_, RevisionView>(
            "SELECT revision_id, based_on_revision_id, text, owner_text, due_text, created_at_utc
             FROM knowledge_revisions WHERE item_id = ?",
        )
        .bind(item_id)
        .fetch_all(pool)
        .await
        .map_err(|error| storage_error("item_history", item_id, error))?;
        let reviews = sqlx::query_as::<_, ReviewEventView>(
            "SELECT review_id, sequence, action, revision_id, created_at_utc
             FROM knowledge_reviews WHERE item_id = ? ORDER BY sequence",
        )
        .bind(item_id)
        .fetch_all(pool)
        .await
        .map_err(|error| storage_error("item_history", item_id, error))?;
        Ok(KnowledgeItemHistory {
            item_id: item_id.to_string(),
            origin_run_id: original.origin_run_id,
            run_started_at_utc: original.run_started_at_utc,
            original: OriginalProposalView {
                text: original.text,
                owner_text: original.owner_text,
                due_text: original.due_text,
                created_at_utc: original.created_at_utc,
            },
            revisions: chain_order(revisions),
            reviews,
            evidence,
        })
    }

    pub async fn list_runs(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<KnowledgeRunView>, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        sqlx::query_as::<_, KnowledgeRunView>(&format!(
            "SELECT {RUN_COLUMNS} FROM knowledge_runs
             WHERE meeting_id = ?
             ORDER BY started_at_utc DESC, rowid DESC"
        ))
        .bind(meeting_id)
        .fetch_all(pool)
        .await
        .map_err(|error| storage_error("list_runs", meeting_id, error))
    }

    pub async fn deletion_impact(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<KnowledgeDeletionImpact, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        let (accepted, suggestions, rejected, runs): (i64, i64, i64, i64) = sqlx::query_as(
            "SELECT
                COALESCE(SUM(review_state = 'accepted'), 0),
                COALESCE(SUM(review_state = 'proposed'), 0),
                COALESCE(SUM(review_state = 'rejected'), 0),
                (SELECT COUNT(*) FROM knowledge_runs WHERE meeting_id = ?1)
             FROM knowledge_item_current WHERE meeting_id = ?1",
        )
        .bind(meeting_id)
        .fetch_one(pool)
        .await
        .map_err(|error| storage_error("deletion_impact", meeting_id, error))?;
        Ok(KnowledgeDeletionImpact {
            accepted,
            suggestions,
            rejected,
            runs,
        })
    }
}

async fn load_item_views(
    pool: &SqlitePool,
    meeting_id: &str,
    item_id: Option<&str>,
) -> Result<Vec<KnowledgeItemView>, KnowledgeError> {
    let rows = sqlx::query_as::<_, CurrentItemRow>(
        "SELECT item_id, meeting_id, origin_run_id, item_type, text, owner_text, due_text,
                original_owner_text, original_owner_support, original_due_text,
                original_due_support, review_state, latest_revision_id, corrected, created_at_utc
         FROM knowledge_item_current
         WHERE meeting_id = ?1 AND (?2 IS NULL OR item_id = ?2)",
    )
    .bind(meeting_id)
    .bind(item_id)
    .fetch_all(pool)
    .await
    .map_err(|error| storage_error("load_item_views", meeting_id, error))?;
    let links = sqlx::query_as::<_, LinkRow>(
        "SELECT l.link_id, l.item_id, l.evidence_id, l.role, l.quote_text, l.normalized_quote,
                l.evidence_text_sha256, l.raw_start, l.raw_end, l.segment_capture_incomplete,
                e.sequence, e.audio_start_time, e.audio_end_time, e.transcript AS current_text
         FROM knowledge_evidence_links l
         LEFT JOIN transcript_evidence e ON e.evidence_id = l.evidence_id
         WHERE l.meeting_id = ?1 AND (?2 IS NULL OR l.item_id = ?2)
         ORDER BY COALESCE(e.sequence, 9223372036854775807), l.raw_start, l.link_id",
    )
    .bind(meeting_id)
    .bind(item_id)
    .fetch_all(pool)
    .await
    .map_err(|error| storage_error("load_item_views", meeting_id, error))?;
    Ok(assemble(rows, links))
}

async fn load_original(pool: &SqlitePool, item_id: &str) -> Result<OriginalRow, KnowledgeError> {
    sqlx::query_as::<_, OriginalRow>(
        "SELECT i.origin_run_id, i.text, i.owner_text, i.due_text, i.created_at_utc,
                r.started_at_utc AS run_started_at_utc
         FROM knowledge_items i
         JOIN knowledge_runs r ON r.run_id = i.origin_run_id
         WHERE i.item_id = ?",
    )
    .bind(item_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| storage_error("load_original", item_id, error))?
    .ok_or(KnowledgeError::ItemNotFound)
}

fn assemble(rows: Vec<CurrentItemRow>, links: Vec<LinkRow>) -> Vec<KnowledgeItemView> {
    let mut links_by_item: HashMap<String, Vec<LinkState>> = HashMap::new();
    for link in links {
        links_by_item
            .entry(link.item_id.clone())
            .or_default()
            .push(link_state(link));
    }
    let mut views: Vec<KnowledgeItemView> = rows
        .into_iter()
        .map(|row| {
            let links = links_by_item.remove(&row.item_id).unwrap_or_default();
            item_view(row, links)
        })
        .collect();
    views.sort_by_key(item_order_key);
    views
}

fn item_order_key(item: &KnowledgeItemView) -> (i64, i64, String) {
    item.evidence
        .iter()
        .find(|link| link.role == EvidenceRole::Claim)
        .map(|link| (link.sequence, link.raw_start, item.item_id.clone()))
        .unwrap_or((i64::MAX, i64::MAX, item.item_id.clone()))
}

fn link_state(link: LinkRow) -> LinkState {
    let status = link_status(&link);
    LinkState {
        status,
        view: EvidenceLinkView {
            link_id: link.link_id,
            evidence_id: link.evidence_id,
            role: link.role,
            quote_text: link.quote_text,
            raw_start: link.raw_start,
            raw_end: link.raw_end,
            sequence: link.sequence.unwrap_or(i64::MAX),
            audio_start_time: link.audio_start_time.unwrap_or(0.0),
            audio_end_time: link.audio_end_time.unwrap_or(0.0),
            segment_capture_incomplete: link.segment_capture_incomplete,
        },
    }
}

fn link_status(link: &LinkRow) -> EvidenceStatus {
    match &link.current_text {
        None => EvidenceStatus::Missing,
        Some(text) if sha256_hex(text) == link.evidence_text_sha256 => EvidenceStatus::Valid,
        Some(text) if normalize_with_map(text).0.contains(&link.normalized_quote) => EvidenceStatus::Valid,
        Some(_) => EvidenceStatus::Changed,
    }
}

fn item_view(row: CurrentItemRow, links: Vec<LinkState>) -> KnowledgeItemView {
    let evidence_status = links
        .iter()
        .filter(|link| link.view.role == EvidenceRole::Claim)
        .map(|link| link.status)
        .max()
        .unwrap_or(EvidenceStatus::Missing);
    let owner_support = field_support(row.original_owner_support, &row.original_owner_text, &row.owner_text);
    let due_support = field_support(row.original_due_support, &row.original_due_text, &row.due_text);
    let accepted = row.review_state == ReviewState::Accepted;
    KnowledgeItemView {
        item_id: row.item_id,
        meeting_id: row.meeting_id,
        origin_run_id: row.origin_run_id,
        item_type: row.item_type,
        text: row.text,
        owner_text: row.owner_text,
        owner_support,
        due_text: row.due_text,
        due_support,
        review_state: row.review_state,
        eligibility: accepted && evidence_status == EvidenceStatus::Valid,
        evidence_status,
        corrected: row.corrected,
        latest_revision_id: row.latest_revision_id,
        unresolved: accepted
            && (owner_support == FieldSupport::NotStated || due_support == FieldSupport::NotStated),
        created_at_utc: row.created_at_utc,
        evidence: links.into_iter().map(|link| link.view).collect(),
    }
}

fn field_support(original_support: Support, original: &Option<String>, current: &Option<String>) -> FieldSupport {
    if original == current {
        return match original_support {
            Support::Stated => FieldSupport::Stated,
            Support::NotStated => FieldSupport::NotStated,
        };
    }
    if current.is_some() {
        FieldSupport::User
    } else {
        FieldSupport::NotStated
    }
}

fn chain_order(revisions: Vec<RevisionView>) -> Vec<RevisionView> {
    let mut by_base: HashMap<Option<String>, RevisionView> = revisions
        .into_iter()
        .map(|revision| (revision.based_on_revision_id.clone(), revision))
        .collect();
    let mut ordered = Vec::new();
    let mut base: Option<String> = None;
    while let Some(next) = by_base.remove(&base) {
        base = Some(next.revision_id.clone());
        ordered.push(next);
    }
    ordered
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::models::{CaptureCompleteness, TranscriptEvidenceInput};
    use crate::database::repositories::transcript::TranscriptsRepository;
    use crate::knowledge::models::{CorrectionInput, ReviewAction};
    use crate::knowledge::review::{append_review, correct_item};
    use crate::knowledge::test_support::{migrated_pool, seed_items, MEETING_ID};

    const OTHER_MEETING: &str = "018f5e27-2f68-7e27-9c90-7c7212314601";

    async fn rewrite_evidence(pool: &SqlitePool, text: &str) {
        let evidence_id: String = sqlx::query_scalar("SELECT evidence_id FROM transcript_evidence WHERE meeting_id = ?")
            .bind(MEETING_ID)
            .fetch_one(pool)
            .await
            .expect("seeded evidence id");
        TranscriptsRepository::upsert_final_evidence(
            pool,
            &TranscriptEvidenceInput {
                evidence_id,
                meeting_id: MEETING_ID.to_string(),
                source_track: "mixed".to_string(),
                source_segment_key: "segment-0".to_string(),
                sequence: 0,
                transcript: text.to_string(),
                audio_start_time: 0.0,
                audio_end_time: 4.0,
                capture_completeness: CaptureCompleteness::Complete,
            },
        )
        .await
        .expect("evidence rewrite");
    }

    async fn view(pool: &SqlitePool, item_id: &str) -> KnowledgeItemView {
        KnowledgeRepository::item_view(pool, MEETING_ID, item_id)
            .await
            .expect("item view")
    }

    fn correction(text: &str, owner: Option<&str>, based_on: Option<String>) -> CorrectionInput {
        CorrectionInput {
            text: text.to_string(),
            owner_text: owner.map(str::to_string),
            due_text: None,
            based_on_revision_id: based_on,
        }
    }

    #[tokio::test]
    async fn knowledge_eligibility_tracks_evidence_changes() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        assert_eq!((view(&pool, &items[0]).await.evidence_status, view(&pool, &items[0]).await.eligibility), (EvidenceStatus::Valid, true));

        rewrite_evidence(&pool, "We postponed everything.").await;
        let changed = view(&pool, &items[0]).await;
        rewrite_evidence(&pool, "Okay. So we ship the beta later.").await;
        let moved = view(&pool, &items[0]).await;

        assert_eq!((changed.evidence_status, changed.eligibility), (EvidenceStatus::Changed, false));
        assert_eq!((moved.evidence_status, moved.eligibility), (EvidenceStatus::Valid, true));
    }

    #[tokio::test]
    async fn knowledge_eligibility_reports_missing_evidence_rows() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        sqlx::query("PRAGMA foreign_keys = OFF").execute(&pool).await.expect("fk off");
        sqlx::query("DELETE FROM transcript_evidence").execute(&pool).await.expect("evidence removed");

        let missing = view(&pool, &items[0]).await;

        assert_eq!((missing.evidence_status, missing.eligibility), (EvidenceStatus::Missing, false));
    }

    #[tokio::test]
    async fn knowledge_list_eligible_items_returns_only_accepted_valid_items() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta", "Write the notes", "Drop the launch"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        append_review(&pool, MEETING_ID, &items[2], ReviewAction::Reject).await.expect("reject");

        let eligible = KnowledgeRepository::list_eligible_items(&pool, MEETING_ID)
            .await
            .expect("eligible items");

        assert_eq!(eligible.iter().map(|item| item.item_id.as_str()).collect::<Vec<_>>(), vec![items[0].as_str()]);
    }

    #[tokio::test]
    async fn knowledge_meeting_view_splits_rejected_and_counts_states() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta", "Write the notes", "Drop the launch"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        append_review(&pool, MEETING_ID, &items[2], ReviewAction::Reject).await.expect("reject");

        let meeting = KnowledgeRepository::meeting_view(&pool, MEETING_ID)
            .await
            .expect("meeting view");
        let accepted = meeting.items.iter().find(|item| item.item_id == items[0]).expect("accepted item");

        assert_eq!(meeting.items.len(), 2);
        assert_eq!(meeting.rejected.len(), 1);
        assert_eq!((meeting.pending_count, meeting.accepted_count), (1, 1));
        assert!(accepted.unresolved);
        assert_eq!(meeting.latest_run.map(|run| run.proposed_count), Some(3));
    }

    #[tokio::test]
    async fn knowledge_item_history_lists_original_revisions_and_reviews_in_order() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        correct_item(&pool, MEETING_ID, &items[0], &correction("Ship the beta Monday", None, None))
            .await
            .expect("first correction");
        let first = view(&pool, &items[0]).await.latest_revision_id;
        correct_item(&pool, MEETING_ID, &items[0], &correction("Ship the beta Tuesday", Some("Maria"), first.clone()))
            .await
            .expect("second correction");

        let history = KnowledgeRepository::item_history(&pool, MEETING_ID, &items[0])
            .await
            .expect("history");
        let corrected = view(&pool, &items[0]).await;

        assert_eq!(history.original.text, "Ship the beta");
        assert_eq!(
            history.revisions.iter().map(|revision| revision.text.as_str()).collect::<Vec<_>>(),
            vec!["Ship the beta Monday", "Ship the beta Tuesday"]
        );
        assert_eq!(history.revisions[1].based_on_revision_id, first);
        assert_eq!(history.reviews.iter().map(|review| review.sequence).collect::<Vec<_>>(), vec![1, 2]);
        assert_eq!(history.evidence.len(), 1);
        assert!(corrected.corrected);
        assert_eq!(corrected.owner_support, FieldSupport::User);
    }

    #[tokio::test]
    async fn knowledge_deletion_impact_counts_one_meeting_only() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta", "Write the notes", "Drop the launch"]).await;
        seed_items(&pool, OTHER_MEETING, &["Other meeting item"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        append_review(&pool, MEETING_ID, &items[2], ReviewAction::Reject).await.expect("reject");

        let impact = KnowledgeRepository::deletion_impact(&pool, MEETING_ID)
            .await
            .expect("deletion impact");

        assert_eq!(
            impact,
            KnowledgeDeletionImpact {
                accepted: 1,
                suggestions: 1,
                rejected: 1,
                runs: 1,
            }
        );
    }
}
