use crate::database::repositories::setting::SettingsRepository;
use crate::knowledge::dispatch::dispatch_completer;
use crate::preparation::briefing::{self, load_claims, BriefingError, Claim, ClaimStatus};
use crate::preparation::context::{self, Budget, PackedContext};
use crate::preparation::freshness::KnowledgeNow;
use crate::preparation::models::{SelectedSource, SelectionError};
use crate::preparation::questions::{load_questions, Question};
use crate::preparation::runs::{self, Finish, NewRun, PreparationRun, RunStatus};
use crate::preparation::selection;
use crate::state::AppState;
use crate::summary::service::{resolve_summary_dispatch, summary_context_tokens, SummaryDispatch};
use crate::trust::provider_route::{validate_route_contract, EffectiveRoute, LocationClass};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio_util::sync::CancellationToken;
use tracing::warn;
use uuid::Uuid;

const PREPARATION_UPDATED_EVENT: &str = "preparation-updated";
const RESERVED_OUTPUT_TOKENS: usize = 2_000;
const MIN_CONTEXT_TOKENS: usize = 1_000;
const MAX_CONTEXT_TOKENS: usize = 12_000;
const STORAGE_FAILED: &str = "PREPARATION_STORAGE_FAILED";
const NO_SOURCES: &str = "PREP_NO_SOURCES";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparationUpdatedEvent {
    pub planned_meeting_id: String,
    pub run_id: String,
    pub status: RunStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBriefing {
    pub id: String,
    pub prompt_version: String,
    pub created_utc: String,
    pub dropped_count: i64,
    pub dropped_question_count: i64,
    pub stale: bool,
    pub nothing_used: bool,
    pub manifest: Value,
    pub claims: Vec<Claim>,
    pub questions: Vec<Question>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BriefingView {
    pub run: Option<PreparationRun>,
    pub briefing: Option<StoredBriefing>,
}

#[derive(sqlx::FromRow)]
struct BriefingRow {
    id: String,
    prompt_version: String,
    created_utc: String,
    dropped_count: i64,
    dropped_question_count: i64,
    stale: bool,
    manifest_json: String,
}

enum Generated {
    Completed(String),
    Cancelled,
    Stale,
}

pub fn budget_for(context_tokens: usize) -> Budget {
    let total_tokens = context_tokens
        .saturating_sub(RESERVED_OUTPUT_TOKENS)
        .clamp(MIN_CONTEXT_TOKENS, MAX_CONTEXT_TOKENS);
    Budget {
        per_source_tokens: total_tokens / 2,
        total_tokens,
    }
}

pub async fn begin(
    pool: &SqlitePool,
    planned_meeting_id: &str,
    expected_route: &EffectiveRoute,
    fresh_route: &EffectiveRoute,
    now: DateTime<Utc>,
) -> Result<(PreparationRun, CancellationToken), String> {
    validate_route_contract(expected_route, fresh_route).map_err(|error| error.code)?;
    let location_class = location_label(fresh_route)?;
    if selection::list(pool, planned_meeting_id)
        .await
        .map_err(selection_code)?
        .is_empty()
    {
        return Err(NO_SOURCES.to_string());
    }
    let run_id = Uuid::new_v4().to_string();
    let token = runs::register(planned_meeting_id, &run_id)
        .ok_or_else(|| "PREP_ALREADY_RUNNING".to_string())?;
    let new_run = NewRun {
        id: run_id.clone(),
        planned_meeting_id: planned_meeting_id.to_string(),
        provider_id: fresh_route.provider_id.clone(),
        model_id: fresh_route.model_id.clone(),
        location_class,
        sanitized_origin: fresh_route.sanitized_origin.clone().unwrap_or_default(),
    };
    match runs::start(pool, new_run, now).await {
        Ok(run) => Ok((run, token)),
        Err(error) => {
            runs::release(planned_meeting_id, &run_id);
            warn!(error = %error, "preparation run could not be started");
            Err(STORAGE_FAILED.to_string())
        }
    }
}

pub async fn execute<F, Fut>(
    pool: &SqlitePool,
    app_data_dir: &Path,
    run: &PreparationRun,
    budget: Budget,
    token: &CancellationToken,
    complete: F,
) -> RunStatus
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let planned_meeting_id = run.planned_meeting_id.as_str();
    let generated = generate(
        pool,
        app_data_dir,
        planned_meeting_id,
        budget,
        token,
        complete,
    )
    .await;
    let (status, briefing_id, failure_code) = match &generated {
        Ok(Generated::Completed(briefing_id)) => {
            (RunStatus::Completed, Some(briefing_id.as_str()), None)
        }
        Ok(Generated::Cancelled) => (RunStatus::Cancelled, None, None),
        Ok(Generated::Stale) => (RunStatus::Stale, None, Some("SELECTION_CHANGED")),
        Err(code) => (RunStatus::Failed, None, Some(*code)),
    };
    let finish = Finish {
        status,
        briefing_id,
        failure_code,
    };
    if let Err(error) = runs::finish(pool, &run.id, finish, Utc::now()).await {
        warn!(run_id = %run.id, error = %error, "preparation run could not be finished");
    }
    runs::release(planned_meeting_id, &run.id);
    status
}

async fn generate<F, Fut>(
    pool: &SqlitePool,
    app_data_dir: &Path,
    planned_meeting_id: &str,
    budget: Budget,
    token: &CancellationToken,
    complete: F,
) -> Result<Generated, &'static str>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let context = current_context(pool, app_data_dir, planned_meeting_id, budget).await?;
    let draft = tokio::select! {
        biased;
        _ = token.cancelled() => return Ok(Generated::Cancelled),
        draft = briefing::compose(&context, complete) => draft.map_err(BriefingError::code)?,
    };
    if token.is_cancelled() {
        return Ok(Generated::Cancelled);
    }
    if current_context(pool, app_data_dir, planned_meeting_id, budget).await? != context {
        return Ok(Generated::Stale);
    }
    match briefing::save(pool, planned_meeting_id, &context, draft, Utc::now()).await {
        Ok(outcome) => Ok(Generated::Completed(outcome.briefing_id)),
        Err(BriefingError::SelectionChanged) => Ok(Generated::Stale),
        Err(error) => Err(error.code()),
    }
}

async fn current_context(
    pool: &SqlitePool,
    app_data_dir: &Path,
    planned_meeting_id: &str,
    budget: Budget,
) -> Result<PackedContext, &'static str> {
    let sources: Vec<SelectedSource> = selection::list(pool, planned_meeting_id)
        .await
        .map_err(SelectionError::code)?;
    context::build(pool, app_data_dir, &sources, budget)
        .await
        .map_err(SelectionError::code)
}

pub async fn get_briefing(
    pool: &SqlitePool,
    planned_meeting_id: &str,
) -> Result<BriefingView, String> {
    let run = runs::latest(pool, planned_meeting_id)
        .await
        .map_err(read_failure)?;
    let row = sqlx::query_as::<_, BriefingRow>(
        "SELECT id, prompt_version, created_utc, dropped_count, dropped_question_count, manifest_json,
                EXISTS (
                    SELECT 1 FROM json_each(briefings.manifest_json) AS entry
                    JOIN document_versions built
                      ON built.id = json_extract(entry.value, '$.source.versionId')
                    JOIN document_versions newer
                      ON newer.document_id = built.document_id AND newer.version > built.version
                ) AS stale
         FROM briefings WHERE planned_meeting_id = ?
         ORDER BY created_utc DESC, rowid DESC LIMIT 1",
    )
    .bind(planned_meeting_id)
    .fetch_optional(pool)
    .await
    .map_err(read_failure)?;
    let briefing = match row {
        Some(row) => Some(stored_briefing(pool, row).await?),
        None => None,
    };
    Ok(BriefingView { run, briefing })
}

async fn stored_briefing(pool: &SqlitePool, row: BriefingRow) -> Result<StoredBriefing, String> {
    let code = |error: BriefingError| error.code().to_string();
    let manifest: Value = serde_json::from_str(&row.manifest_json).map_err(|error| {
        warn!(error = %error, "stored briefing manifest is not JSON");
        STORAGE_FAILED.to_string()
    })?;
    let claims = load_claims(pool, &row.id).await.map_err(code)?;
    let questions = load_questions(pool, &row.id).await.map_err(code)?;
    let cited: Vec<&Claim> = claims
        .iter()
        .chain(questions.iter().map(|question| &question.claim))
        .collect();
    let knowledge = KnowledgeNow::load(pool, &cited).await.map_err(code)?;
    let claims: Vec<Claim> = claims
        .into_iter()
        .map(|claim| knowledge.checked(claim))
        .collect();
    let questions: Vec<Question> = questions
        .into_iter()
        .map(|question| Question {
            claim: knowledge.checked(question.claim),
            ..question
        })
        .collect();
    let claim_stale = claims
        .iter()
        .chain(questions.iter().map(|question| &question.claim))
        .any(|claim| claim.status == ClaimStatus::Stale);
    let nothing_used = !manifest.as_array().is_some_and(|entries| {
        entries
            .iter()
            .any(|entry| matches!(entry["status"].as_str(), Some("included" | "truncated")))
    });
    Ok(StoredBriefing {
        nothing_used,
        claims,
        questions,
        id: row.id,
        prompt_version: row.prompt_version,
        created_utc: row.created_utc,
        dropped_count: row.dropped_count,
        dropped_question_count: row.dropped_question_count,
        stale: row.stale || claim_stale,
        manifest,
    })
}

#[tauri::command]
pub async fn prep_select_sources(
    state: tauri::State<'_, AppState>,
    planned_meeting_id: String,
    sources: Vec<SelectedSource>,
) -> Result<Vec<SelectedSource>, String> {
    selection::select(state.db_manager.pool(), &planned_meeting_id, sources)
        .await
        .map_err(selection_code)
}

#[tauri::command]
pub async fn prep_list_sources(
    state: tauri::State<'_, AppState>,
    planned_meeting_id: String,
) -> Result<Vec<SelectedSource>, String> {
    selection::list(state.db_manager.pool(), &planned_meeting_id)
        .await
        .map_err(selection_code)
}

#[tauri::command]
pub async fn prep_generate<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    planned_meeting_id: String,
    expected_route: EffectiveRoute,
) -> Result<PreparationRun, String> {
    let pool = state.db_manager.pool().clone();
    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        warn!(error = %error, "app data folder unavailable for preparation");
        STORAGE_FAILED.to_string()
    })?;
    let dispatch = resolve_configured_dispatch(&pool).await?;
    let (run, token) = begin(
        &pool,
        &planned_meeting_id,
        &expected_route,
        &dispatch.route,
        Utc::now(),
    )
    .await?;
    emit_updated(&app, &run, RunStatus::Running);
    spawn_generation(app, pool, app_data_dir, run.clone(), dispatch, token);
    Ok(run)
}

#[tauri::command]
pub async fn prep_cancel(planned_meeting_id: String) -> Result<bool, String> {
    Ok(runs::cancel(&planned_meeting_id))
}

#[tauri::command]
pub async fn prep_get_briefing(
    state: tauri::State<'_, AppState>,
    planned_meeting_id: String,
) -> Result<BriefingView, String> {
    get_briefing(state.db_manager.pool(), &planned_meeting_id).await
}

fn spawn_generation<R: Runtime>(
    app: AppHandle<R>,
    pool: SqlitePool,
    app_data_dir: PathBuf,
    run: PreparationRun,
    dispatch: SummaryDispatch,
    token: CancellationToken,
) {
    tauri::async_runtime::spawn(async move {
        let budget = budget_for(summary_context_tokens(&dispatch, &run.planned_meeting_id).await);
        let complete = dispatch_completer(
            Arc::new(dispatch),
            run.planned_meeting_id.clone(),
            Some(app_data_dir.clone()),
            token.clone(),
        );
        let status = execute(&pool, &app_data_dir, &run, budget, &token, complete).await;
        emit_updated(&app, &run, status);
    });
}

async fn resolve_configured_dispatch(pool: &SqlitePool) -> Result<SummaryDispatch, String> {
    let setting = SettingsRepository::get_model_config(pool)
        .await
        .map_err(|_| "PROVIDER_ROUTE_CONFIG_UNAVAILABLE".to_string())?
        .ok_or_else(|| "PROVIDER_ROUTE_UNAVAILABLE".to_string())?;
    resolve_summary_dispatch(pool, &setting.provider, &setting.model)
        .await
        .map_err(|message| {
            if message.starts_with("PROVIDER_ROUTE_") {
                message
            } else {
                "PROVIDER_ROUTE_UNAVAILABLE".to_string()
            }
        })
}

fn emit_updated<R: Runtime>(app: &AppHandle<R>, run: &PreparationRun, status: RunStatus) {
    let event = PreparationUpdatedEvent {
        planned_meeting_id: run.planned_meeting_id.clone(),
        run_id: run.id.clone(),
        status,
    };
    if app.emit(PREPARATION_UPDATED_EVENT, event).is_err() {
        warn!(run_id = %run.id, "preparation-updated event could not be emitted");
    }
}

fn location_label(route: &EffectiveRoute) -> Result<&'static str, String> {
    match route.location_class {
        Some(LocationClass::Local) => Ok("local"),
        Some(LocationClass::Lan) => Ok("lan"),
        Some(LocationClass::Remote) => Ok("remote"),
        None => Err("PROVIDER_ROUTE_UNAVAILABLE".to_string()),
    }
}

fn read_failure(error: sqlx::Error) -> String {
    warn!(error = %error, "preparation briefing read failed");
    STORAGE_FAILED.to_string()
}

fn selection_code(error: SelectionError) -> String {
    error.code().to_string()
}

#[cfg(test)]
#[path = "commands_tests.rs"]
mod tests;
