use crate::preparation::briefing::PREP_PROMPT_VERSION;
use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, sqlx::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(rename_all = "lowercase")]
pub enum RunStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
    Stale,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PreparationRun {
    pub id: String,
    pub planned_meeting_id: String,
    pub status: RunStatus,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: String,
    pub sanitized_origin: String,
    pub prompt_version: String,
    pub briefing_id: Option<String>,
    pub failure_code: Option<String>,
    pub started_utc: String,
    pub finished_utc: Option<String>,
}

pub struct NewRun {
    pub id: String,
    pub planned_meeting_id: String,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: &'static str,
    pub sanitized_origin: String,
}

pub struct Finish<'a> {
    pub status: RunStatus,
    pub briefing_id: Option<&'a str>,
    pub failure_code: Option<&'a str>,
}

struct Registered {
    run_id: String,
    token: CancellationToken,
}

static ACTIVE_RUNS: LazyLock<Mutex<HashMap<String, Registered>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn active() -> MutexGuard<'static, HashMap<String, Registered>> {
    ACTIVE_RUNS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub fn register(planned_meeting_id: &str, run_id: &str) -> Option<CancellationToken> {
    let mut runs = active();
    if runs.contains_key(planned_meeting_id) {
        return None;
    }
    let token = CancellationToken::new();
    runs.insert(
        planned_meeting_id.to_string(),
        Registered {
            run_id: run_id.to_string(),
            token: token.clone(),
        },
    );
    Some(token)
}

pub fn release(planned_meeting_id: &str, run_id: &str) {
    let mut runs = active();
    if runs
        .get(planned_meeting_id)
        .is_some_and(|registered| registered.run_id == run_id)
    {
        runs.remove(planned_meeting_id);
    }
}

pub fn cancel(planned_meeting_id: &str) -> bool {
    match active().get(planned_meeting_id) {
        Some(registered) => {
            registered.token.cancel();
            true
        }
        None => false,
    }
}

pub async fn start(
    pool: &SqlitePool,
    run: NewRun,
    now: DateTime<Utc>,
) -> Result<PreparationRun, sqlx::Error> {
    let now = timestamp(now);
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "UPDATE preparation_runs
         SET status = 'cancelled', failure_code = 'INTERRUPTED', finished_utc = ?
         WHERE planned_meeting_id = ? AND status = 'running'",
    )
    .bind(&now)
    .bind(&run.planned_meeting_id)
    .execute(&mut *transaction)
    .await?;
    let inserted = sqlx::query_as::<_, PreparationRun>(
        "INSERT INTO preparation_runs
         (id, planned_meeting_id, status, provider_id, model_id, location_class,
          sanitized_origin, prompt_version, started_utc)
         VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?)
         RETURNING *",
    )
    .bind(&run.id)
    .bind(&run.planned_meeting_id)
    .bind(&run.provider_id)
    .bind(&run.model_id)
    .bind(run.location_class)
    .bind(&run.sanitized_origin)
    .bind(PREP_PROMPT_VERSION)
    .bind(&now)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(inserted)
}

pub async fn finish(
    pool: &SqlitePool,
    run_id: &str,
    finish: Finish<'_>,
    now: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE preparation_runs
         SET status = ?, briefing_id = ?, failure_code = ?, finished_utc = ?
         WHERE id = ? AND status = 'running'",
    )
    .bind(finish.status)
    .bind(finish.briefing_id)
    .bind(finish.failure_code)
    .bind(timestamp(now))
    .bind(run_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn latest(
    pool: &SqlitePool,
    planned_meeting_id: &str,
) -> Result<Option<PreparationRun>, sqlx::Error> {
    sqlx::query_as::<_, PreparationRun>(
        "SELECT * FROM preparation_runs WHERE planned_meeting_id = ?
         ORDER BY started_utc DESC, rowid DESC LIMIT 1",
    )
    .bind(planned_meeting_id)
    .fetch_optional(pool)
    .await
}

fn timestamp(now: DateTime<Utc>) -> String {
    now.to_rfc3339_opts(SecondsFormat::Millis, true)
}
