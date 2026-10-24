use crate::preparation::models::{SelectedSource, SelectionError};
use crate::preparation::selection;
use crate::state::AppState;

#[tauri::command]
pub async fn prep_select_sources(
    state: tauri::State<'_, AppState>,
    planned_meeting_id: String,
    sources: Vec<SelectedSource>,
) -> Result<Vec<SelectedSource>, String> {
    selection::select(state.db_manager.pool(), &planned_meeting_id, sources)
        .await
        .map_err(error_code)
}

#[tauri::command]
pub async fn prep_list_sources(
    state: tauri::State<'_, AppState>,
    planned_meeting_id: String,
) -> Result<Vec<SelectedSource>, String> {
    selection::list(state.db_manager.pool(), &planned_meeting_id)
        .await
        .map_err(error_code)
}

fn error_code(error: SelectionError) -> String {
    error.code().to_string()
}
