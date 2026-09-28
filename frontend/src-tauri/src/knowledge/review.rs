use crate::knowledge::models::{CorrectionInput, KnowledgeError, ReviewAction, ReviewState};
use chrono::Utc;
use sqlx::{Error as SqlxError, FromRow, Sqlite, SqliteConnection, SqlitePool, Transaction};
use tracing::warn;
use uuid::Uuid;

const MAX_TEXT_CHARS: usize = 400;
const MAX_FIELD_CHARS: usize = 80;

#[derive(FromRow)]
struct CurrentState {
    meeting_id: String,
    review_state: ReviewState,
    latest_revision_id: Option<String>,
    text: String,
    owner_text: Option<String>,
    due_text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CleanCorrection {
    text: String,
    owner_text: Option<String>,
    due_text: Option<String>,
}

enum Transition {
    Append,
    Unchanged,
}

pub async fn append_review(
    pool: &SqlitePool,
    meeting_id: &str,
    item_id: &str,
    action: ReviewAction,
) -> Result<(), KnowledgeError> {
    validate_ids(meeting_id, &[item_id])?;
    let mut transaction = begin_immediate(pool).await?;
    let result = apply_action(&mut transaction, meeting_id, item_id, action).await;
    finish(transaction, result).await
}

pub async fn correct_item(
    pool: &SqlitePool,
    meeting_id: &str,
    item_id: &str,
    input: &CorrectionInput,
) -> Result<(), KnowledgeError> {
    validate_ids(meeting_id, &[item_id])?;
    let correction = clean_correction(input)?;
    let based_on = input.based_on_revision_id.as_deref();
    let mut transaction = begin_immediate(pool).await?;
    let result = apply_correction(&mut transaction, meeting_id, item_id, &correction, based_on).await;
    finish(transaction, result).await
}

pub async fn accept_all(
    pool: &SqlitePool,
    meeting_id: &str,
    item_ids: &[String],
) -> Result<usize, KnowledgeError> {
    if item_ids.is_empty() {
        return Err(KnowledgeError::InvalidInput);
    }
    let ids: Vec<&str> = item_ids.iter().map(String::as_str).collect();
    validate_ids(meeting_id, &ids)?;
    let mut transaction = begin_immediate(pool).await?;
    let result = apply_accept_all(&mut transaction, meeting_id, &ids).await;
    finish(transaction, result).await
}

async fn apply_action(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_id: &str,
    action: ReviewAction,
) -> Result<(), KnowledgeError> {
    let current = load_current(connection, meeting_id, item_id).await?;
    match transition(current.review_state, action)? {
        Transition::Append => insert_review(connection, meeting_id, item_id, action, None).await,
        Transition::Unchanged => Ok(()),
    }
}

async fn apply_correction(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_id: &str,
    correction: &CleanCorrection,
    based_on: Option<&str>,
) -> Result<(), KnowledgeError> {
    let current = load_current(connection, meeting_id, item_id).await?;
    if current.review_state == ReviewState::Rejected {
        return Err(KnowledgeError::InvalidTransition);
    }
    let unchanged = correction.text == current.text
        && correction.owner_text == current.owner_text
        && correction.due_text == current.due_text;
    if unchanged {
        return match current.review_state {
            ReviewState::Accepted => Ok(()),
            _ => insert_review(connection, meeting_id, item_id, ReviewAction::Accept, None).await,
        };
    }
    if based_on != current.latest_revision_id.as_deref() {
        return Err(KnowledgeError::RevisionConflict);
    }
    let revision_id = insert_revision(
        connection,
        meeting_id,
        item_id,
        current.latest_revision_id.as_deref(),
        correction,
    )
    .await?;
    insert_review(connection, meeting_id, item_id, ReviewAction::Correct, Some(&revision_id)).await
}

async fn apply_accept_all(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_ids: &[&str],
) -> Result<usize, KnowledgeError> {
    let mut proposed = Vec::new();
    for item_id in item_ids {
        let current = load_current(connection, meeting_id, item_id).await?;
        if current.review_state == ReviewState::Proposed && !proposed.contains(item_id) {
            proposed.push(*item_id);
        }
    }
    for item_id in &proposed {
        insert_review(connection, meeting_id, item_id, ReviewAction::Accept, None).await?;
    }
    Ok(proposed.len())
}

fn transition(state: ReviewState, action: ReviewAction) -> Result<Transition, KnowledgeError> {
    use ReviewAction::{Accept, Correct, Reject, Reopen, Restore};
    use ReviewState::{Accepted, Proposed, Rejected};
    match (state, action) {
        (Proposed, Accept) | (Proposed, Reject) | (Accepted, Reject) | (Rejected, Restore) | (Accepted, Reopen) => {
            Ok(Transition::Append)
        }
        (Accepted, Accept) | (Rejected, Reject) | (Proposed, Restore) => Ok(Transition::Unchanged),
        (Rejected, Accept) | (Accepted, Restore) | (Proposed, Reopen) | (Rejected, Reopen) => {
            Err(KnowledgeError::InvalidTransition)
        }
        (_, Correct) => Err(KnowledgeError::InvalidInput),
    }
}

async fn load_current(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_id: &str,
) -> Result<CurrentState, KnowledgeError> {
    let current = sqlx::query_as::<_, CurrentState>(
        "SELECT meeting_id, review_state, latest_revision_id, text, owner_text, due_text
         FROM knowledge_item_current WHERE item_id = ?",
    )
    .bind(item_id)
    .fetch_optional(connection)
    .await
    .map_err(|error| storage("load_current", item_id, error))?;
    current
        .filter(|state| state.meeting_id == meeting_id)
        .ok_or(KnowledgeError::ItemNotFound)
}

async fn insert_review(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_id: &str,
    action: ReviewAction,
    revision_id: Option<&str>,
) -> Result<(), KnowledgeError> {
    let sequence: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sequence), 0) + 1 FROM knowledge_reviews WHERE item_id = ?",
    )
    .bind(item_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(|error| storage("next_sequence", item_id, error))?;
    sqlx::query(
        "INSERT INTO knowledge_reviews (
            review_id, meeting_id, item_id, sequence, action, revision_id, created_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(meeting_id)
    .bind(item_id)
    .bind(sequence)
    .bind(action.as_str())
    .bind(revision_id)
    .bind(Utc::now().to_rfc3339())
    .execute(connection)
    .await
    .map(|_| ())
    .map_err(|error| storage("insert_review", item_id, error))
}

async fn insert_revision(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_id: &str,
    based_on: Option<&str>,
    correction: &CleanCorrection,
) -> Result<String, KnowledgeError> {
    let revision_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO knowledge_revisions (
            revision_id, meeting_id, item_id, based_on_revision_id, text, owner_text, due_text,
            created_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&revision_id)
    .bind(meeting_id)
    .bind(item_id)
    .bind(based_on)
    .bind(&correction.text)
    .bind(&correction.owner_text)
    .bind(&correction.due_text)
    .bind(Utc::now().to_rfc3339())
    .execute(connection)
    .await
    .map_err(|error| storage("insert_revision", item_id, error))?;
    Ok(revision_id)
}

fn clean_correction(input: &CorrectionInput) -> Result<CleanCorrection, KnowledgeError> {
    let text = clean_value(&input.text);
    let text_length = text.chars().count();
    if text_length == 0 || text_length > MAX_TEXT_CHARS {
        return Err(KnowledgeError::InvalidInput);
    }
    Ok(CleanCorrection {
        text,
        owner_text: clean_field(input.owner_text.as_deref())?,
        due_text: clean_field(input.due_text.as_deref())?,
    })
}

fn clean_field(value: Option<&str>) -> Result<Option<String>, KnowledgeError> {
    let cleaned = value.map(clean_value).filter(|value| !value.is_empty());
    match cleaned {
        Some(value) if value.chars().count() > MAX_FIELD_CHARS => Err(KnowledgeError::InvalidInput),
        other => Ok(other),
    }
}

fn clean_value(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_ascii_control())
        .collect::<String>()
        .trim()
        .to_string()
}

fn validate_ids(meeting_id: &str, item_ids: &[&str]) -> Result<(), KnowledgeError> {
    let all_valid = std::iter::once(meeting_id)
        .chain(item_ids.iter().copied())
        .all(|id| Uuid::parse_str(id).is_ok());
    if all_valid {
        Ok(())
    } else {
        Err(KnowledgeError::InvalidInput)
    }
}

async fn begin_immediate(pool: &SqlitePool) -> Result<Transaction<'static, Sqlite>, KnowledgeError> {
    pool.begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(|error| storage("begin_immediate", "review", error))
}

async fn finish<T>(
    transaction: Transaction<'static, Sqlite>,
    result: Result<T, KnowledgeError>,
) -> Result<T, KnowledgeError> {
    match result {
        Ok(value) => {
            transaction
                .commit()
                .await
                .map_err(|error| storage("commit", "review", error))?;
            Ok(value)
        }
        Err(error) => {
            let _ = transaction.rollback().await;
            Err(error)
        }
    }
}

fn storage(operation: &'static str, subject_id: &str, error: SqlxError) -> KnowledgeError {
    warn!(operation, subject_id, error = %error, "knowledge review storage failed");
    KnowledgeError::Storage
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::test_support::{insert_meeting, migrated_pool, seed_items, MEETING_ID};

    const OTHER_MEETING: &str = "018f5e27-2f68-7e27-9c90-7c7212314501";

    fn correction(text: &str, based_on: Option<&str>) -> CorrectionInput {
        CorrectionInput {
            text: text.to_string(),
            owner_text: None,
            due_text: None,
            based_on_revision_id: based_on.map(str::to_string),
        }
    }

    async fn count(pool: &SqlitePool, table: &str) -> i64 {
        sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .expect("row count")
    }

    async fn state(pool: &SqlitePool, item_id: &str) -> (ReviewState, Option<String>) {
        sqlx::query_as("SELECT review_state, latest_revision_id FROM knowledge_item_current WHERE item_id = ?")
            .bind(item_id)
            .fetch_one(pool)
            .await
            .expect("current state")
    }

    #[tokio::test]
    async fn knowledge_review_accept_appends_once_and_projects_accepted() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;

        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept again");

        assert_eq!(count(&pool, "knowledge_reviews").await, 1);
        assert_eq!(state(&pool, &items[0]).await.0, ReviewState::Accepted);
    }

    #[tokio::test]
    async fn knowledge_review_correction_writes_revision_and_review_atomically() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;

        correct_item(&pool, MEETING_ID, &items[0], &correction("Ship the beta on Monday", None))
            .await
            .expect("first correction");
        let (review_state, revision) = state(&pool, &items[0]).await;
        let (action, review_revision): (String, Option<String>) =
            sqlx::query_as("SELECT action, revision_id FROM knowledge_reviews")
                .fetch_one(&pool)
                .await
                .expect("correct review");

        assert_eq!(review_state, ReviewState::Accepted);
        assert_eq!(action, "correct");
        assert_eq!(review_revision, revision);

        sqlx::query(
            "CREATE TRIGGER inject_correct_failure BEFORE INSERT ON knowledge_reviews
             WHEN NEW.action = 'correct' BEGIN SELECT RAISE(ABORT, 'injected'); END",
        )
        .execute(&pool)
        .await
        .expect("failure injection");
        let failed = correct_item(&pool, MEETING_ID, &items[0], &correction("Ship it later", revision.as_deref())).await;

        assert_eq!(failed, Err(KnowledgeError::Storage));
        assert_eq!(count(&pool, "knowledge_revisions").await, 1);
        assert_eq!(count(&pool, "knowledge_reviews").await, 1);
    }

    #[tokio::test]
    async fn knowledge_review_correction_rejects_stale_base_and_chains_revisions() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        correct_item(&pool, MEETING_ID, &items[0], &correction("Ship the beta Monday", None))
            .await
            .expect("first correction");
        let first_revision = state(&pool, &items[0]).await.1;

        let stale = correct_item(&pool, MEETING_ID, &items[0], &correction("Ship Tuesday", None)).await;
        correct_item(&pool, MEETING_ID, &items[0], &correction("Ship Tuesday", first_revision.as_deref()))
            .await
            .expect("second correction");
        let based_on: Option<String> = sqlx::query_scalar(
            "SELECT based_on_revision_id FROM knowledge_revisions WHERE text = 'Ship Tuesday'",
        )
        .fetch_one(&pool)
        .await
        .expect("second revision");

        assert_eq!(stale, Err(KnowledgeError::RevisionConflict));
        assert_eq!(based_on, first_revision);
        assert_eq!(count(&pool, "knowledge_revisions").await, 2);
    }

    #[tokio::test]
    async fn knowledge_review_unchanged_correction_accepts_without_revision() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;

        correct_item(&pool, MEETING_ID, &items[0], &correction("  Ship the beta ", None))
            .await
            .expect("unchanged correction");

        assert_eq!(count(&pool, "knowledge_revisions").await, 0);
        assert_eq!(state(&pool, &items[0]).await.0, ReviewState::Accepted);
    }

    #[tokio::test]
    async fn knowledge_review_transitions_follow_the_state_table() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta", "Write the notes"]).await;

        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept).await.expect("accept");
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Reject).await.expect("reject");
        assert_eq!(state(&pool, &items[0]).await.0, ReviewState::Rejected);
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Restore).await.expect("restore");
        assert_eq!(state(&pool, &items[0]).await.0, ReviewState::Proposed);

        let reopen_proposed = append_review(&pool, MEETING_ID, &items[1], ReviewAction::Reopen).await;
        append_review(&pool, MEETING_ID, &items[1], ReviewAction::Accept).await.expect("accept");
        let restore_accepted = append_review(&pool, MEETING_ID, &items[1], ReviewAction::Restore).await;

        assert_eq!(reopen_proposed, Err(KnowledgeError::InvalidTransition));
        assert_eq!(restore_accepted, Err(KnowledgeError::InvalidTransition));
    }

    #[tokio::test]
    async fn knowledge_review_rejects_items_outside_the_meeting() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        insert_meeting(&pool, OTHER_MEETING, "complete", "complete").await;

        let foreign = append_review(&pool, OTHER_MEETING, &items[0], ReviewAction::Accept).await;
        let mixed = accept_all(
            &pool,
            MEETING_ID,
            &[items[0].clone(), "018f5e27-2f68-7e27-9c90-7c7212314599".to_string()],
        )
        .await;
        let empty = accept_all(&pool, MEETING_ID, &[]).await;

        assert_eq!(foreign, Err(KnowledgeError::ItemNotFound));
        assert_eq!(mixed, Err(KnowledgeError::ItemNotFound));
        assert_eq!(empty, Err(KnowledgeError::InvalidInput));
        assert_eq!(count(&pool, "knowledge_reviews").await, 0);
    }

    #[tokio::test]
    async fn knowledge_review_rows_are_append_only_and_inputs_are_validated() {
        let pool = migrated_pool().await;
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        correct_item(&pool, MEETING_ID, &items[0], &correction("Ship the beta Monday", None))
            .await
            .expect("correction");

        let too_long = correct_item(&pool, MEETING_ID, &items[0], &correction(&"x".repeat(401), None)).await;
        let blank = correct_item(&pool, MEETING_ID, &items[0], &correction(" \t ", None)).await;
        let update = |table: &str| format!("UPDATE {table} SET created_at_utc = 'changed'");
        let reviews_update = sqlx::query(&update("knowledge_reviews")).execute(&pool).await;
        let revisions_update = sqlx::query(&update("knowledge_revisions")).execute(&pool).await;

        assert_eq!(too_long, Err(KnowledgeError::InvalidInput));
        assert_eq!(blank, Err(KnowledgeError::InvalidInput));
        assert!(reviews_update.is_err());
        assert!(revisions_update.is_err());
    }
}
