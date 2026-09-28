use crate::database::models::{MeetingCompleteness, TranscriptEvidence};
use crate::database::repositories::{
    meeting::MeetingsRepository, setting::SettingsRepository, transcript::TranscriptsRepository,
};
use crate::knowledge::extraction::{
    check_extraction_gate, input_fingerprint, run_extraction, PROMPT_VERSION,
};
use crate::knowledge::models::{
    EvidenceSegmentView, KnowledgeError, KnowledgeRunView, KnowledgeUpdatedEvent,
    MeetingKnowledgeView, RunStatus, TriggerKind,
};
use crate::knowledge::repository::{KnowledgeRepository, NewRun};
use crate::state::AppState;
use crate::summary::llm_client::generate_summary;
use crate::summary::service::{resolve_summary_dispatch, SummaryDispatch};
use crate::trust::provider_route::{validate_route_contract, EffectiveRoute, LocationClass};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tracing::{info, warn};
use uuid::Uuid;

const KNOWLEDGE_UPDATED_EVENT: &str = "knowledge-updated";

pub struct StartContext {
    meeting_id: String,
    completeness: MeetingCompleteness,
    evidence: Vec<TranscriptEvidence>,
}

pub async fn load_start_context(
    pool: &SqlitePool,
    meeting_id: &str,
    trigger: TriggerKind,
) -> Result<StartContext, KnowledgeError> {
    Uuid::parse_str(meeting_id).map_err(|_| KnowledgeError::InvalidRequest)?;
    let meeting = MeetingsRepository::get_meeting_metadata(pool, meeting_id)
        .await
        .map_err(|error| storage_failure("load_meeting", meeting_id, error))?
        .ok_or(KnowledgeError::MeetingNotFound)?;
    let evidence = TranscriptsRepository::list_evidence_by_meeting(pool, meeting_id)
        .await
        .map_err(|error| storage_failure("load_evidence", meeting_id, error))?;
    check_extraction_gate(meeting.lifecycle, meeting.completeness, evidence.len(), trigger)?;
    Ok(StartContext {
        meeting_id: meeting_id.to_string(),
        completeness: meeting.completeness,
        evidence,
    })
}

pub async fn begin_run(
    pool: &SqlitePool,
    context: &StartContext,
    expected_route: &EffectiveRoute,
    fresh_route: &EffectiveRoute,
    trigger: TriggerKind,
) -> Result<KnowledgeRunView, KnowledgeError> {
    validate_route_contract(expected_route, fresh_route)
        .map_err(|route_error| KnowledgeError::Route(route_error.code))?;
    let location_class = location_label(fresh_route)?;
    let run = NewRun {
        run_id: Uuid::new_v4().to_string(),
        meeting_id: context.meeting_id.clone(),
        trigger_kind: trigger,
        provider_id: fresh_route.provider_id.clone(),
        model_id: fresh_route.model_id.clone(),
        location_class: location_class.to_string(),
        sanitized_origin: fresh_route.sanitized_origin.clone().unwrap_or_default(),
        prompt_version: PROMPT_VERSION.to_string(),
        meeting_completeness_at_start: context.completeness.as_str().to_string(),
        input_evidence_count: context.evidence.len() as i64,
        input_fingerprint: input_fingerprint(&context.evidence),
    };
    KnowledgeRepository::insert_running_run(pool, &run).await
}

#[tauri::command]
pub async fn knowledge_start_extraction<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    expected_route: EffectiveRoute,
    trigger: TriggerKind,
) -> Result<KnowledgeRunView, String> {
    let pool = state.db_manager.pool().clone();
    let context = load_start_context(&pool, &meeting_id, trigger)
        .await
        .map_err(error_code)?;
    let dispatch = resolve_configured_dispatch(&pool).await.map_err(error_code)?;
    let run = begin_run(&pool, &context, &expected_route, &dispatch.route, trigger)
        .await
        .map_err(error_code)?;
    info!(
        meeting_id = %meeting_id,
        run_id = %run.run_id,
        evidence_count = context.evidence.len(),
        "knowledge extraction started"
    );
    spawn_extraction(app, pool, context, dispatch, run.run_id.clone());
    Ok(run)
}

#[tauri::command]
pub async fn knowledge_get_meeting(
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<MeetingKnowledgeView, String> {
    let pool = state.db_manager.pool();
    let latest_run = KnowledgeRepository::latest_run(pool, &meeting_id)
        .await
        .map_err(error_code)?;
    let items = KnowledgeRepository::list_meeting_items(pool, &meeting_id)
        .await
        .map_err(error_code)?;
    Ok(MeetingKnowledgeView {
        meeting_id,
        latest_run,
        items,
    })
}

#[tauri::command]
pub async fn knowledge_list_evidence(
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<Vec<EvidenceSegmentView>, String> {
    let evidence = TranscriptsRepository::list_evidence_by_meeting(state.db_manager.pool(), &meeting_id)
        .await
        .map_err(|error| error_code(storage_failure("list_evidence", &meeting_id, error)))?;
    Ok(evidence.into_iter().map(evidence_view).collect())
}

async fn resolve_configured_dispatch(pool: &SqlitePool) -> Result<SummaryDispatch, KnowledgeError> {
    let setting = SettingsRepository::get_model_config(pool)
        .await
        .map_err(|_| KnowledgeError::Route("PROVIDER_ROUTE_CONFIG_UNAVAILABLE".to_string()))?
        .ok_or_else(|| KnowledgeError::Route("PROVIDER_ROUTE_UNAVAILABLE".to_string()))?;
    resolve_summary_dispatch(pool, &setting.provider, &setting.model)
        .await
        .map_err(|message| KnowledgeError::Route(route_code(&message)))
}

fn spawn_extraction<R: Runtime>(
    app: AppHandle<R>,
    pool: SqlitePool,
    context: StartContext,
    dispatch: SummaryDispatch,
    run_id: String,
) {
    tauri::async_runtime::spawn(async move {
        let app_data_dir = app.path().app_data_dir().ok();
        let client = reqwest::Client::new();
        let meeting_id = context.meeting_id.clone();
        let complete = move |system_prompt: String, user_prompt: String| async move {
            generate_summary(
                &client,
                Some(meeting_id.as_str()),
                &dispatch.provider,
                &dispatch.model_name,
                &dispatch.api_key,
                &system_prompt,
                &user_prompt,
                dispatch.ollama_endpoint.as_deref(),
                dispatch.custom_openai_endpoint.as_deref(),
                dispatch.max_tokens,
                dispatch.temperature,
                dispatch.top_p,
                app_data_dir.as_ref(),
                None,
            )
            .await
            .map(|completion| completion.content)
        };
        let status = match run_extraction(&pool, &context.meeting_id, &run_id, &context.evidence, complete).await {
            Ok(outcome) => outcome.status,
            Err(error) => {
                warn!(run_id = %run_id, code = error.code(), "knowledge extraction failed");
                RunStatus::Failed
            }
        };
        let event = KnowledgeUpdatedEvent {
            meeting_id: context.meeting_id.clone(),
            run_id: run_id.clone(),
            status,
        };
        if app.emit(KNOWLEDGE_UPDATED_EVENT, event).is_err() {
            warn!(run_id = %run_id, "knowledge-updated event could not be emitted");
        }
    });
}

fn location_label(route: &EffectiveRoute) -> Result<&'static str, KnowledgeError> {
    match route.location_class {
        Some(LocationClass::Local) => Ok("local"),
        Some(LocationClass::Lan) => Ok("lan"),
        Some(LocationClass::Remote) => Ok("remote"),
        None => Err(KnowledgeError::Route("PROVIDER_ROUTE_UNAVAILABLE".to_string())),
    }
}

fn route_code(message: &str) -> String {
    if message.starts_with("PROVIDER_ROUTE_") {
        message.to_string()
    } else {
        "PROVIDER_ROUTE_UNAVAILABLE".to_string()
    }
}

fn evidence_view(row: TranscriptEvidence) -> EvidenceSegmentView {
    EvidenceSegmentView {
        evidence_id: row.evidence_id,
        sequence: row.sequence,
        text: row.transcript,
        audio_start_time: row.audio_start_time,
        audio_end_time: row.audio_end_time,
        capture_completeness: row.capture_completeness,
    }
}

fn storage_failure(operation: &'static str, meeting_id: &str, error: sqlx::Error) -> KnowledgeError {
    warn!(operation, meeting_id, error = %error, "knowledge storage read failed");
    KnowledgeError::Storage
}

fn error_code(error: KnowledgeError) -> String {
    error.code().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};
    use crate::trust::provider_route::{Capability, RouteValidationState};

    fn validated_route(origin: &str) -> EffectiveRoute {
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

    async fn pool_with_meeting(lifecycle: &str, completeness: &str, evidence_rows: usize) -> SqlitePool {
        let pool = migrated_pool().await;
        insert_meeting(&pool, MEETING_ID, lifecycle, completeness).await;
        let ids = [
            "018f5e27-2f68-7e27-9c90-7c72123141b1",
            "018f5e27-2f68-7e27-9c90-7c72123141b2",
        ];
        for (sequence, evidence_id) in ids.iter().take(evidence_rows).enumerate() {
            insert_evidence(&pool, MEETING_ID, evidence_id, sequence as i64, "We ship the beta on Friday.").await;
        }
        pool
    }

    async fn run_count(pool: &SqlitePool) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM knowledge_runs")
            .fetch_one(pool)
            .await
            .expect("run count")
    }

    #[tokio::test]
    async fn knowledge_start_rejects_meetings_without_evidence_or_not_ready() {
        let empty = pool_with_meeting("complete", "complete", 0).await;
        let recording = pool_with_meeting("recording", "pending", 2).await;
        let incomplete = pool_with_meeting("incomplete", "incomplete", 2).await;

        let no_evidence = load_start_context(&empty, MEETING_ID, TriggerKind::User).await;
        let not_ready = load_start_context(&recording, MEETING_ID, TriggerKind::User).await;
        let auto_on_incomplete = load_start_context(&incomplete, MEETING_ID, TriggerKind::Auto).await;
        let user_on_incomplete = load_start_context(&incomplete, MEETING_ID, TriggerKind::User).await;

        assert_eq!(no_evidence.err(), Some(KnowledgeError::NoEvidence));
        assert_eq!(not_ready.err(), Some(KnowledgeError::MeetingNotReady));
        assert_eq!(auto_on_incomplete.err(), Some(KnowledgeError::MeetingNotReady));
        assert!(user_on_incomplete.is_ok());
        assert_eq!(run_count(&empty).await, 0);
    }

    #[tokio::test]
    async fn knowledge_start_rejects_a_second_run_while_one_is_running() {
        let pool = pool_with_meeting("complete", "complete", 2).await;
        let context = load_start_context(&pool, MEETING_ID, TriggerKind::User)
            .await
            .expect("ready meeting");
        let route = validated_route("This device");

        let first = begin_run(&pool, &context, &route, &route, TriggerKind::User)
            .await
            .expect("first run");
        let second = begin_run(&pool, &context, &route, &route, TriggerKind::User).await;

        assert_eq!(first.status, RunStatus::Running);
        assert_eq!(first.input_evidence_count, 2);
        assert_eq!(second.err(), Some(KnowledgeError::RunInProgress));
    }

    #[tokio::test]
    async fn knowledge_start_fails_on_a_changed_route_before_any_run_or_dispatch() {
        let pool = pool_with_meeting("complete", "complete", 2).await;
        let context = load_start_context(&pool, MEETING_ID, TriggerKind::User)
            .await
            .expect("ready meeting");

        let result = begin_run(
            &pool,
            &context,
            &validated_route("This device"),
            &validated_route("192.168.1.20:11434"),
            TriggerKind::User,
        )
        .await;

        assert_eq!(
            result.err(),
            Some(KnowledgeError::Route("PROVIDER_ROUTE_MATERIALLY_CHANGED".to_string()))
        );
        assert_eq!(run_count(&pool).await, 0);
    }
}
