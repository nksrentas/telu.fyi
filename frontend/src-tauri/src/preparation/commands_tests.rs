use super::*;
use crate::documents::ingest::ingest_text;
use crate::knowledge::test_support::migrated_pool;
use crate::planning::models::PlannedMeetingInput;
use crate::planning::repository as planning;
use crate::preparation::context::ContextPiece;
use crate::trust::provider_route::{Capability, RouteValidationState};
use tokio::sync::Notify;

const BUDGET: Budget = Budget {
    per_source_tokens: 1_000,
    total_tokens: 2_000,
};

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
        .expect("test timestamp")
        .with_timezone(&Utc)
}

fn route(origin: &str) -> EffectiveRoute {
    EffectiveRoute {
        capability: Capability::Summary,
        provider_id: "ollama".to_string(),
        model_id: "llama3".to_string(),
        location_class: Some(LocationClass::Local),
        sanitized_origin: Some(origin.to_string()),
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

async fn select_pasted(pool: &SqlitePool, plan: &str, texts: &[&str]) -> Vec<SelectedSource> {
    let mut sources = Vec::new();
    for (index, text) in texts.iter().enumerate() {
        let version = ingest_text(pool, &format!("Source {index}"), text, now())
            .await
            .expect("document");
        sources.push(SelectedSource::Document {
            version_id: version.id,
        });
    }
    selection::select(pool, plan, sources.clone())
        .await
        .expect("selection");
    sources
}

struct Gate {
    called: Arc<Notify>,
    release: Arc<Notify>,
}

impl Gate {
    fn new() -> Self {
        Self {
            called: Arc::new(Notify::new()),
            release: Arc::new(Notify::new()),
        }
    }

    fn completer(
        &self,
        reply: String,
    ) -> impl FnMut(
        String,
        String,
    ) -> std::pin::Pin<Box<dyn Future<Output = Result<String, String>> + Send>> {
        let called = Arc::clone(&self.called);
        let release = Arc::clone(&self.release);
        move |_, _| {
            let called = Arc::clone(&called);
            let release = Arc::clone(&release);
            let reply = reply.clone();
            Box::pin(async move {
                called.notify_one();
                release.notified().await;
                Ok(reply)
            })
        }
    }
}

async fn first_passage_ref(pool: &SqlitePool, plan: &str) -> String {
    let app_data = tempfile::tempdir().expect("app data");
    let context = current_context(pool, app_data.path(), plan, BUDGET)
        .await
        .expect("context");
    match &context.pieces[0] {
        ContextPiece::Passage { ordinal, .. } => format!("S1#{ordinal}"),
        ContextPiece::Knowledge { .. } => panic!("expected a passage"),
    }
}

async fn count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await
        .expect("count")
}

fn spawn_execute(
    pool: &SqlitePool,
    run: PreparationRun,
    token: CancellationToken,
    complete: impl FnMut(
            String,
            String,
        ) -> std::pin::Pin<Box<dyn Future<Output = Result<String, String>> + Send>>
        + Send
        + 'static,
) -> tokio::task::JoinHandle<RunStatus> {
    let pool = pool.clone();
    tokio::spawn(async move {
        let app_data = tempfile::tempdir().expect("app data");
        execute(&pool, app_data.path(), &run, BUDGET, &token, complete).await
    })
}

#[tokio::test]
async fn a_second_generate_while_one_runs_is_refused() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    let (first, _token) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("first run");
    assert_eq!(first.status, RunStatus::Running);
    assert_eq!(first.location_class, "local");

    let second = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await;

    assert_eq!(second.unwrap_err(), "PREP_ALREADY_RUNNING");
    assert_eq!(count(&pool, "preparation_runs").await, 1);
    runs::release(&plan, &first.id);
    let (third, _) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("a run after release");
    let runs: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, status, failure_code FROM preparation_runs ORDER BY started_utc, rowid",
    )
    .fetch_all(&pool)
    .await
    .expect("runs");
    assert_eq!(
        runs,
        vec![
            (
                first.id,
                "cancelled".to_string(),
                Some("INTERRUPTED".to_string())
            ),
            (third.id, "running".to_string(), None),
        ]
    );
}

#[tokio::test]
async fn a_changed_route_is_refused_before_any_run() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;

    let result = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("192.168.1.20:11434"),
        now(),
    )
    .await;

    assert_eq!(result.unwrap_err(), "PROVIDER_ROUTE_MATERIALLY_CHANGED");
    assert_eq!(count(&pool, "preparation_runs").await, 0);
    assert!(!runs::cancel(&plan));
}

#[tokio::test]
async fn an_unknown_planned_meeting_is_refused() {
    let pool = migrated_pool().await;
    let unknown = Uuid::new_v4().to_string();

    let result = begin(
        &pool,
        &unknown,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await;

    assert_eq!(result.unwrap_err(), "PLANNED_MEETING_NOT_FOUND");
    assert!(!runs::cancel(&unknown));
}

#[tokio::test]
async fn a_completed_run_is_returned_with_its_briefing() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    select_pasted(&pool, &plan, &["Alpha ships in May."]).await;
    let source = first_passage_ref(&pool, &plan).await;
    let reply = serde_json::json!({
        "statements": [{"text": "Alpha ships in May.", "source": source, "quote": "ships in May"}],
        "questions": [{"text": "Is May still realistic?", "rationale": "The date is fixed.", "source": source, "quote": "May"}]
    })
    .to_string();
    let (run, token) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("run");
    let gate = Gate::new();
    gate.release.notify_one();

    let status = spawn_execute(&pool, run.clone(), token, gate.completer(reply))
        .await
        .expect("join");

    assert_eq!(status, RunStatus::Completed);
    let view = get_briefing(&pool, &plan).await.expect("view");
    let latest = view.run.expect("latest run");
    let briefing = view.briefing.expect("briefing");
    assert_eq!(
        (latest.id.as_str(), latest.status),
        (run.id.as_str(), RunStatus::Completed)
    );
    assert_eq!(latest.briefing_id.as_deref(), Some(briefing.id.as_str()));
    assert_eq!(briefing.claims.len(), 1);
    assert_eq!(briefing.claims[0].quote, "ships in May");
    assert_eq!(briefing.questions.len(), 1);
    assert_eq!(briefing.questions[0].rationale, "The date is fixed.");
    assert_eq!(briefing.manifest[0]["status"], "included");
    assert!(runs::register(&plan, "next").is_some());
}

#[tokio::test]
async fn changing_the_selection_mid_run_stores_no_briefing_and_marks_the_run_stale() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    let sources = select_pasted(&pool, &plan, &["Alpha ships in May.", "Bravo is late."]).await;
    let source = first_passage_ref(&pool, &plan).await;
    let reply = serde_json::json!({
        "statements": [{"text": "Alpha ships in May.", "source": source, "quote": "ships in May"}]
    })
    .to_string();
    let (run, token) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("run");
    let gate = Gate::new();
    let handle = spawn_execute(&pool, run.clone(), token, gate.completer(reply));
    gate.called.notified().await;

    selection::select(&pool, &plan, sources[..1].to_vec())
        .await
        .expect("narrowed selection");
    gate.release.notify_one();

    assert_eq!(handle.await.expect("join"), RunStatus::Stale);
    assert_eq!(count(&pool, "briefings").await, 0);
    assert_eq!(count(&pool, "briefing_claims").await, 0);
    let view = get_briefing(&pool, &plan).await.expect("view");
    let latest = view.run.expect("latest run");
    assert_eq!(latest.status, RunStatus::Stale);
    assert_eq!(latest.failure_code.as_deref(), Some("SELECTION_CHANGED"));
    assert!(latest.finished_utc.is_some());
    assert_eq!(view.briefing, None);
}

#[tokio::test]
async fn cancel_marks_the_run_cancelled_with_no_claims_stored() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    select_pasted(&pool, &plan, &["Alpha ships in May."]).await;
    let source = first_passage_ref(&pool, &plan).await;
    let reply = serde_json::json!({
        "statements": [{"text": "Alpha ships in May.", "source": source, "quote": "ships in May"}]
    })
    .to_string();
    let (run, token) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("run");
    let gate = Gate::new();
    let handle = spawn_execute(&pool, run.clone(), token, gate.completer(reply));
    gate.called.notified().await;

    assert!(runs::cancel(&plan));

    assert_eq!(handle.await.expect("join"), RunStatus::Cancelled);
    assert_eq!(count(&pool, "briefings").await, 0);
    assert_eq!(count(&pool, "briefing_claims").await, 0);
    let latest = runs::latest(&pool, &plan)
        .await
        .expect("read")
        .expect("run");
    assert_eq!(latest.status, RunStatus::Cancelled);
    assert!(!runs::cancel(&plan));
}

#[tokio::test]
async fn a_model_failure_marks_the_run_failed_with_its_code() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    select_pasted(&pool, &plan, &["Alpha ships in May."]).await;
    let (run, token) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("run");
    let app_data = tempfile::tempdir().expect("app data");

    let status = execute(&pool, app_data.path(), &run, BUDGET, &token, |_, _| {
        std::future::ready(Err::<String, String>("offline".to_string()))
    })
    .await;

    assert_eq!(status, RunStatus::Failed);
    let latest = runs::latest(&pool, &plan)
        .await
        .expect("read")
        .expect("run");
    assert_eq!(latest.failure_code.as_deref(), Some("PREP_MODEL_FAILED"));
}

#[test]
fn the_budget_leaves_room_for_the_reply_and_splits_per_source() {
    assert_eq!(budget_for(8_000).total_tokens, 6_000);
    assert_eq!(budget_for(8_000).per_source_tokens, 3_000);
    assert_eq!(budget_for(100_000).total_tokens, 12_000);
    assert_eq!(budget_for(500).total_tokens, 1_000);
}

#[tokio::test]
async fn deleting_a_selected_document_mid_run_marks_the_run_stale() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    let sources = select_pasted(&pool, &plan, &["Alpha ships in May."]).await;
    let source = first_passage_ref(&pool, &plan).await;
    let reply = serde_json::json!({
        "statements": [{"text": "Alpha ships in May.", "source": source, "quote": "ships in May"}]
    })
    .to_string();
    let SelectedSource::Document { version_id } = &sources[0] else {
        panic!("expected a document");
    };
    let document_id: String =
        sqlx::query_scalar("SELECT document_id FROM document_versions WHERE id = ?")
            .bind(version_id)
            .fetch_one(&pool)
            .await
            .expect("document id");
    let (run, token) = begin(
        &pool,
        &plan,
        &route("This device"),
        &route("This device"),
        now(),
    )
    .await
    .expect("run");
    let gate = Gate::new();
    let handle = spawn_execute(&pool, run, token, gate.completer(reply));
    gate.called.notified().await;

    let app_data = tempfile::tempdir().expect("app data");
    crate::documents::commands::delete(&pool, app_data.path(), &document_id)
        .await
        .expect("delete");
    gate.release.notify_one();

    assert_eq!(handle.await.expect("join"), RunStatus::Stale);
    assert_eq!(count(&pool, "briefings").await, 0);
}

#[tokio::test]
async fn save_refuses_a_briefing_whose_selection_changed_after_the_last_check() {
    let pool = migrated_pool().await;
    let plan = planned_meeting(&pool).await;
    let sources = select_pasted(&pool, &plan, &["Alpha ships in May.", "Bravo is late."]).await;
    let app_data = tempfile::tempdir().expect("app data");
    let context = current_context(&pool, app_data.path(), &plan, BUDGET)
        .await
        .expect("context");
    let draft = briefing::compose(&context, |_, _| {
        std::future::ready(Ok::<String, String>(r#"{"statements":[]}"#.to_string()))
    })
    .await
    .expect("draft");
    selection::select(&pool, &plan, sources[1..].to_vec())
        .await
        .expect("narrowed selection");

    let saved = briefing::save(&pool, &plan, &context, draft, now()).await;

    assert_eq!(saved.unwrap_err(), BriefingError::SelectionChanged);
    assert_eq!(count(&pool, "briefings").await, 0);
}
