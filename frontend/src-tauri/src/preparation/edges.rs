use crate::documents::commands::delete;
use crate::documents::import::import_file;
use crate::documents::ingest::ingest_text;
use crate::knowledge::test_support::migrated_pool;
use crate::planning::models::PlannedMeetingInput;
use crate::planning::repository as planning;
use crate::preparation::commands::{begin, execute, get_briefing, StoredBriefing};
use crate::preparation::context::Budget;
use crate::preparation::models::SelectedSource;
use crate::preparation::runs::RunStatus;
use crate::preparation::selection;
use crate::trust::provider_route::{
    Capability, EffectiveRoute, LocationClass, RouteValidationState,
};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

const BUDGET: Budget = Budget {
    per_source_tokens: 1_000,
    total_tokens: 2_000,
};
const IMPORTED_TEXT: &str = "Atlas ships on Friday.";
const PASTED_TEXT: &str = "Budget review moves to March.";

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
        .expect("test timestamp")
        .with_timezone(&Utc)
}

fn route() -> EffectiveRoute {
    EffectiveRoute {
        capability: Capability::Summary,
        provider_id: "ollama".to_string(),
        model_id: "llama3".to_string(),
        location_class: Some(LocationClass::Local),
        sanitized_origin: Some("This device".to_string()),
        encrypted: false,
        validation_state: RouteValidationState::Validated,
        resolved_addresses: Vec::new(),
    }
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

async fn pasted(pool: &SqlitePool) -> (String, SelectedSource) {
    let version = ingest_text(pool, "Pasted", PASTED_TEXT, now())
        .await
        .expect("pasted");
    let source = SelectedSource::Document {
        version_id: version.id,
    };
    (version.document_id, source)
}

async fn imported_then_removed(pool: &SqlitePool, app_data: &Path) -> SelectedSource {
    let source_dir = tempfile::tempdir().expect("source dir");
    let file = source_dir.path().join("atlas.md");
    std::fs::write(&file, IMPORTED_TEXT).expect("source file");
    let version = import_file(pool, app_data, &file, now())
        .await
        .expect("imported");
    std::fs::remove_file(app_data.join(version.managed_path.expect("managed path")))
        .expect("removed outside Telu");
    SelectedSource::Document {
        version_id: version.id,
    }
}

async fn prepare(
    pool: &SqlitePool,
    app_data: &Path,
    plan: &str,
    reply: Value,
) -> (RunStatus, Vec<String>, StoredBriefing) {
    let (run, token): (_, CancellationToken) = begin(pool, plan, &route(), &route(), now())
        .await
        .expect("run");
    let prompts = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&prompts);
    let status = execute(pool, app_data, &run, BUDGET, &token, move |_, user| {
        seen.lock().expect("prompts").push(user);
        let reply = reply.to_string();
        async move { Ok(reply) }
    })
    .await;
    let briefing = get_briefing(pool, plan)
        .await
        .expect("briefing view")
        .briefing
        .expect("stored briefing");
    let prompts = prompts.lock().expect("prompts").clone();
    (status, prompts, briefing)
}

fn manifest_statuses(briefing: &StoredBriefing) -> Vec<(String, String)> {
    briefing
        .manifest
        .as_array()
        .expect("manifest entries")
        .iter()
        .map(|entry| {
            (
                entry["status"].as_str().expect("status").to_string(),
                entry["reason"].as_str().expect("reason").to_string(),
            )
        })
        .collect()
}

fn citing(source_ref: &str, quote: &str) -> Value {
    json!({
        "statements": [{ "text": "Atlas ships Friday.", "source": source_ref, "quote": quote }],
        "questions": [{
            "text": "Is Friday still realistic?",
            "rationale": "The source names Friday.",
            "source": source_ref,
            "quote": quote
        }]
    })
}

async fn count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await
        .expect("count")
}

#[tokio::test]
async fn prepare_with_nothing_selected_is_refused() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    let (_, source) = pasted(&pool).await;
    selection::select(&pool, &plan, vec![source])
        .await
        .expect("selected");
    selection::select(&pool, &plan, Vec::new())
        .await
        .expect("cleared");

    let result = begin(&pool, &plan, &route(), &route(), now()).await;

    assert_eq!(result.unwrap_err(), "PREP_NO_SOURCES");
    assert_eq!(count(&pool, "preparation_runs").await, 0);
    assert_eq!(count(&pool, "briefings").await, 0);
}

#[tokio::test]
async fn a_selection_with_every_source_gone_says_nothing_could_be_used() {
    let pool = migrated_pool().await;
    let app_data = tempfile::tempdir().expect("app data");
    let plan = planned_meeting(&pool).await;
    let (deleted_id, deleted) = pasted(&pool).await;
    let missing = imported_then_removed(&pool, app_data.path()).await;
    selection::select(&pool, &plan, vec![deleted, missing])
        .await
        .expect("selected");
    delete(&pool, app_data.path(), &deleted_id)
        .await
        .expect("deleted");

    let (status, prompts, briefing) =
        prepare(&pool, app_data.path(), &plan, citing("S2#0", IMPORTED_TEXT)).await;

    assert_eq!(status, RunStatus::Completed);
    assert!(prompts.is_empty(), "no model call without usable sources");
    assert!(briefing.nothing_used);
    assert!(briefing.claims.is_empty());
    assert!(briefing.questions.is_empty());
    assert_eq!(
        manifest_statuses(&briefing),
        vec![
            ("deleted".to_string(), "DOCUMENT_DELETED".to_string()),
            ("missing".to_string(), "MANAGED_FILE_MISSING".to_string()),
        ]
    );
    assert_eq!(count(&pool, "briefing_claims").await, 0);
}

#[tokio::test]
async fn a_managed_file_deleted_outside_telu_is_missing_and_never_cited() {
    let pool = migrated_pool().await;
    let app_data = tempfile::tempdir().expect("app data");
    let plan = planned_meeting(&pool).await;
    let missing = imported_then_removed(&pool, app_data.path()).await;
    let (_, kept) = pasted(&pool).await;
    selection::select(&pool, &plan, vec![missing, kept])
        .await
        .expect("selected");

    let (status, prompts, briefing) =
        prepare(&pool, app_data.path(), &plan, citing("S1#0", IMPORTED_TEXT)).await;

    assert_eq!(status, RunStatus::Completed);
    assert_eq!(prompts.len(), 1);
    assert!(!prompts[0].contains(IMPORTED_TEXT));
    assert!(prompts[0].contains(PASTED_TEXT));
    assert!(!briefing.nothing_used);
    assert!(briefing.claims.is_empty());
    assert!(briefing.questions.is_empty());
    assert_eq!(briefing.dropped_count, 1);
    assert_eq!(briefing.dropped_question_count, 1);
    assert_eq!(
        manifest_statuses(&briefing),
        vec![
            ("missing".to_string(), "MANAGED_FILE_MISSING".to_string()),
            ("included".to_string(), "WITHIN_BUDGET".to_string()),
        ]
    );
    assert_eq!(count(&pool, "briefing_claims").await, 0);
}
