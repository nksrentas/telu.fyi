use crate::planning::models::{PlannedMeeting, PlannedMeetingInput, PlanningError};
use crate::planning::repository;
use crate::state::AppState;
use chrono::{DateTime, Utc};

#[tauri::command]
pub async fn planning_create(
    state: tauri::State<'_, AppState>,
    title: String,
    start_utc: Option<String>,
    purpose: String,
) -> Result<PlannedMeeting, String> {
    let input = PlannedMeetingInput {
        title,
        start_utc,
        purpose,
    };
    repository::create(state.db_manager.pool(), input, Utc::now())
        .await
        .map_err(error_code)
}

#[tauri::command]
pub async fn planning_list_upcoming(
    state: tauri::State<'_, AppState>,
    today_start_utc: String,
) -> Result<Vec<PlannedMeeting>, String> {
    let today_start = DateTime::parse_from_rfc3339(&today_start_utc)
        .map_err(|_| error_code(PlanningError::InvalidDay))?
        .with_timezone(&Utc);
    repository::list_upcoming(state.db_manager.pool(), today_start)
        .await
        .map_err(error_code)
}

#[tauri::command]
pub async fn planning_get(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<PlannedMeeting, String> {
    repository::get(state.db_manager.pool(), &id)
        .await
        .map_err(error_code)
}

#[tauri::command]
pub async fn planning_update(
    state: tauri::State<'_, AppState>,
    id: String,
    title: String,
    start_utc: Option<String>,
    purpose: String,
) -> Result<PlannedMeeting, String> {
    let input = PlannedMeetingInput {
        title,
        start_utc,
        purpose,
    };
    repository::update(state.db_manager.pool(), &id, input, Utc::now())
        .await
        .map_err(error_code)
}

#[tauri::command]
pub async fn planning_delete(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    repository::delete(state.db_manager.pool(), &id)
        .await
        .map_err(error_code)
}

fn error_code(error: PlanningError) -> String {
    error.code().to_string()
}
