use crate::agenda::{counts, list_day, list_review, parse_range, AgendaCounts, AgendaError, AgendaMeeting};
use crate::state::AppState;
use tracing::info;

#[tauri::command]
pub async fn agenda_list_day(
    state: tauri::State<'_, AppState>,
    from_utc: String,
    to_utc: String,
) -> Result<Vec<AgendaMeeting>, String> {
    let (from, to) = parse_range(&from_utc, &to_utc).map_err(error_code)?;
    let meetings = list_day(state.db_manager.pool(), from, to)
        .await
        .map_err(error_code)?;
    info!(meeting_count = meetings.len(), "agenda day listed");
    Ok(meetings)
}

#[tauri::command]
pub async fn agenda_list_review(state: tauri::State<'_, AppState>) -> Result<Vec<AgendaMeeting>, String> {
    let meetings = list_review(state.db_manager.pool()).await.map_err(error_code)?;
    info!(meeting_count = meetings.len(), "agenda review listed");
    Ok(meetings)
}

#[tauri::command]
pub async fn agenda_counts(
    state: tauri::State<'_, AppState>,
    from_utc: String,
    to_utc: String,
) -> Result<AgendaCounts, String> {
    let (from, to) = parse_range(&from_utc, &to_utc).map_err(error_code)?;
    counts(state.db_manager.pool(), from, to).await.map_err(error_code)
}

fn error_code(error: AgendaError) -> String {
    error.code().to_string()
}
