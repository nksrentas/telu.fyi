use log::{error, info};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use super::manager::DatabaseManager;
use super::models::{RecoveryCommandError, RecoveryErrorCode, RecoveryRequest, RecoveryResult};
use super::repositories::meeting::{MeetingsRepository, RecoveryRepositoryError};
use crate::state::AppState;
use sqlx::SqlitePool;
use uuid::Uuid;

const MAX_RECOVERY_EVIDENCE_ITEMS: usize = 10_000;
const MAX_RECOVERY_GAP_ITEMS: usize = 10_000;
const MAX_RECOVERY_TRANSCRIPT_BYTES: usize = 1_000_000;
const MAX_RECOVERY_TOTAL_TRANSCRIPT_BYTES: usize = 16_000_000;
const MAX_RECOVERY_LABEL_BYTES: usize = 256;

#[derive(Serialize)]
pub struct DatabaseCheckResult {
    pub exists: bool,
    pub size: u64,
}

async fn reconcile_meeting_with_pool(
    pool: &SqlitePool,
    request: RecoveryRequest,
) -> Result<RecoveryResult, RecoveryCommandError> {
    validate_recovery_payload(&request)?;
    MeetingsRepository::reconcile_meeting(pool, &request)
        .await
        .map_err(map_recovery_repository_error)
}

fn validate_recovery_payload(request: &RecoveryRequest) -> Result<(), RecoveryCommandError> {
    if Uuid::parse_str(&request.meeting_id).is_err()
        || request.evidence.len() > MAX_RECOVERY_EVIDENCE_ITEMS
        || request.gaps.len() > MAX_RECOVERY_GAP_ITEMS
    {
        return Err(recovery_command_error(RecoveryErrorCode::InvalidRequest));
    }

    let mut total_transcript_bytes = 0usize;
    for evidence in &request.evidence {
        if evidence.meeting_id != request.meeting_id {
            return Err(recovery_command_error(
                RecoveryErrorCode::CrossMeetingScope,
            ));
        }
        total_transcript_bytes = total_transcript_bytes
            .checked_add(evidence.transcript.len())
            .ok_or_else(|| recovery_command_error(RecoveryErrorCode::InvalidRequest))?;
        if Uuid::parse_str(&evidence.evidence_id).is_err()
            || evidence.source_track.trim().is_empty()
            || evidence.source_track.len() > MAX_RECOVERY_LABEL_BYTES
            || evidence.source_segment_key.trim().is_empty()
            || evidence.source_segment_key.len() > MAX_RECOVERY_LABEL_BYTES
            || evidence.sequence < 0
            || evidence.transcript.trim().is_empty()
            || evidence.transcript.len() > MAX_RECOVERY_TRANSCRIPT_BYTES
            || total_transcript_bytes > MAX_RECOVERY_TOTAL_TRANSCRIPT_BYTES
            || !evidence.audio_start_time.is_finite()
            || !evidence.audio_end_time.is_finite()
            || evidence.audio_start_time < 0.0
            || evidence.audio_end_time < evidence.audio_start_time
        {
            return Err(recovery_command_error(RecoveryErrorCode::InvalidRequest));
        }
    }

    for gap in &request.gaps {
        if gap.meeting_id != request.meeting_id {
            return Err(recovery_command_error(
                RecoveryErrorCode::CrossMeetingScope,
            ));
        }
        if gap.gap_id.trim().is_empty()
            || gap.gap_id.len() > MAX_RECOVERY_LABEL_BYTES
            || gap.gap_kind.trim().is_empty()
            || gap.gap_kind.len() > MAX_RECOVERY_LABEL_BYTES
            || gap.reason_code.trim().is_empty()
            || gap.reason_code.len() > MAX_RECOVERY_LABEL_BYTES
            || matches!(
                (gap.audio_start_ms, gap.audio_end_ms),
                (Some(start), Some(end)) if end < start
            )
        {
            return Err(recovery_command_error(RecoveryErrorCode::InvalidRequest));
        }
    }

    Ok(())
}

fn map_recovery_repository_error(error: RecoveryRepositoryError) -> RecoveryCommandError {
    let code = match error {
        RecoveryRepositoryError::InvalidRequest => RecoveryErrorCode::InvalidRequest,
        RecoveryRepositoryError::MeetingNotFound => RecoveryErrorCode::MeetingNotFound,
        RecoveryRepositoryError::StaleMeeting => RecoveryErrorCode::StaleMeeting,
        RecoveryRepositoryError::CrossMeetingScope => RecoveryErrorCode::CrossMeetingScope,
        RecoveryRepositoryError::IdentityConflict => RecoveryErrorCode::IdentityConflict,
        RecoveryRepositoryError::Storage(_) => RecoveryErrorCode::StorageFailure,
    };
    recovery_command_error(code)
}

fn recovery_command_error(code: RecoveryErrorCode) -> RecoveryCommandError {
    RecoveryCommandError { code }
}

#[tauri::command]
pub async fn reconcile_meeting(
    state: tauri::State<'_, AppState>,
    request: RecoveryRequest,
) -> Result<RecoveryResult, RecoveryCommandError> {
    reconcile_meeting_with_pool(state.db_manager.pool(), request).await
}

/// Check if this is the first launch (no database exists yet)
#[tauri::command]
pub async fn check_first_launch(app: AppHandle) -> Result<bool, String> {
    DatabaseManager::is_first_launch(&app)
        .await
        .map_err(|e| format!("Failed to check first launch: {}", e))
}

/// Open a dialog to select a folder or file for legacy database import
#[tauri::command]
pub async fn select_legacy_database_path(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    info!("Opening dialog to select legacy database location");

    let file_path = app
        .dialog()
        .file()
        .add_filter("Database Files", &["db"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let path_str = path.to_string();
        info!("User selected path: {}", path_str);
        Ok(Some(path_str))
    } else {
        info!("User cancelled file selection");
        Ok(None)
    }
}

/// Detect legacy database from a selected path (root repo, backend folder, or db file)
#[tauri::command]
pub async fn detect_legacy_database(selected_path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&selected_path);

    info!("Detecting legacy database from path: {}", selected_path);

    // Case 1: User selected the .db file directly
    if path.is_file() {
        if let Some(extension) = path.extension() {
            if extension == "db" {
                info!("Direct .db file selected: {}", selected_path);
                return Ok(Some(selected_path));
            }
        }
    }

    // Case 2: User selected directory containing meeting_minutes.db
    if path.is_dir() {
        let direct_db = path.join("meeting_minutes.db");
        if direct_db.exists() && direct_db.is_file() {
            let db_path = direct_db.to_string_lossy().to_string();
            info!("Found database in selected directory: {}", db_path);
            return Ok(Some(db_path));
        }

        // Case 3: User selected root repo (check backend subdirectory)
        let backend_db = path.join("backend").join("meeting_minutes.db");
        if backend_db.exists() && backend_db.is_file() {
            let db_path = backend_db.to_string_lossy().to_string();
            info!("Found database in backend subdirectory: {}", db_path);
            return Ok(Some(db_path));
        }
    }

    info!("No legacy database found at path: {}", selected_path);
    Ok(None)
}

/// Check for legacy database in the default app data directory
#[tauri::command]
pub async fn check_default_legacy_database(app: AppHandle) -> Result<Option<String>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let legacy_db = app_data_dir.join("meeting_minutes.db");
    info!("Checking for default legacy database at: {:?}", legacy_db);

    if legacy_db.exists() && legacy_db.is_file() {
        let path_str = legacy_db.to_string_lossy().to_string();
        info!("Found default legacy database: {}", path_str);
        Ok(Some(path_str))
    } else {
        info!("No default legacy database found");
        Ok(None)
    }
}

/// Check if the Homebrew database exists and return its size
/// This is specifically for detecting old Python backend installations
#[tauri::command]
pub async fn check_homebrew_database(path: String) -> Result<Option<DatabaseCheckResult>, String> {
    let db_path = PathBuf::from(&path);
    
    info!("Checking for Homebrew database at: {}", path);
    
    // Check if file exists and is a regular file
    if db_path.exists() && db_path.is_file() {
        // Get file metadata to check size
        match std::fs::metadata(&db_path) {
            Ok(metadata) => {
                let size = metadata.len();
                info!("Found Homebrew database: {} ({} bytes)", path, size);
                
                // Only consider it valid if it has content (not empty)
                if size > 0 {
                    Ok(Some(DatabaseCheckResult {
                        exists: true,
                        size,
                    }))
                } else {
                    info!("Database file exists but is empty");
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to read database metadata: {}", e);
                Ok(None)
            }
        }
    } else {
        info!("No database found at Homebrew location");
        Ok(None)
    }
}

/// Import legacy database and initialize the database manager
#[tauri::command]
pub async fn import_and_initialize_database(
    app: AppHandle,
    legacy_db_path: String,
) -> Result<(), String> {
    info!(
        "Starting import of legacy database from: {}",
        legacy_db_path
    );

    // Import and get initialized manager
    let db_manager = DatabaseManager::import_legacy_database(&app, &legacy_db_path)
        .await
        .map_err(|e| {
            error!("Failed to import legacy database: {}", e);
            format!("Failed to import database: {}", e)
        })?;

    // Update app state with the new manager
    app.manage(AppState { db_manager });

    info!("Legacy database imported and initialized successfully");

    // Emit event to notify frontend that database is ready
    app.emit("database-initialized", ())
        .map_err(|e| format!("Failed to emit database-initialized event: {}", e))?;

    Ok(())
}

/// Initialize a fresh database (for users who don't want to import)
#[tauri::command]
pub async fn initialize_fresh_database(app: AppHandle) -> Result<(), String> {
    info!("Initializing fresh database");

    let db_manager = DatabaseManager::new_from_app_handle(&app)
        .await
        .map_err(|e| {
            error!("Failed to initialize fresh database: {}", e);
            format!("Failed to initialize database: {}", e)
        })?;

    // Update app state with the new manager
    app.manage(AppState { db_manager: db_manager.clone() });

    // Set default model configuration for fresh installs
    let pool = db_manager.pool();
    
    let default_summary_model = crate::summary::summary_engine::commands::get_recommended_summary_model_for_current_system()
        .unwrap_or("qwen3.5:2b");

    // Default Summary Model: Built-in AI (Qwen recommendation for this system)
    if let Err(e) = crate::database::repositories::setting::SettingsRepository::save_model_config(
        pool,
        "builtin-ai",
        default_summary_model,
        "large-v3", // Default whisper model (unused for builtin but required)
        None,
    ).await {
        error!("Failed to set default summary model config: {}", e);
    }

    // Default Transcription Model: Parakeet
    if let Err(e) = crate::database::repositories::setting::SettingsRepository::save_transcript_config(
        pool,
        "parakeet",
        crate::config::DEFAULT_PARAKEET_MODEL,
    ).await {
        error!("Failed to set default transcription model config: {}", e);
    }

    info!("Fresh database initialized successfully with default models");

    // Emit event to notify frontend that database is ready
    app.emit("database-initialized", ())
        .map_err(|e| format!("Failed to emit database-initialized event: {}", e))?;

    Ok(())
}

/// Get the database directory path
#[tauri::command]
pub async fn get_database_directory(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    Ok(app_data_dir.to_string_lossy().to_string())
}

/// Open the database folder in the system file explorer
#[tauri::command]
pub async fn open_database_folder(app: AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure directory exists before trying to open it
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let folder_path = app_data_dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    info!("Opened database folder: {}", folder_path);
    Ok(())
}

#[cfg(test)]
mod meeting_recovery_command_tests {
    use super::*;
    use crate::database::models::{
        CaptureCompleteness, GapFact, MeetingLifecycle, TranscriptEvidenceInput,
    };
    use crate::database::repositories::meeting::MeetingsRepository;
    use sqlx::sqlite::SqlitePoolOptions;
    use uuid::Uuid;

    async fn recovery_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("command recovery database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("fresh migrations");
        pool
    }

    fn evidence(meeting_id: &str) -> TranscriptEvidenceInput {
        TranscriptEvidenceInput {
            evidence_id: Uuid::new_v4().to_string(),
            meeting_id: meeting_id.to_string(),
            source_track: "mixed".to_string(),
            source_segment_key: "command-segment".to_string(),
            sequence: 1,
            transcript: "recovered final".to_string(),
            audio_start_time: 0.5,
            audio_end_time: 1.5,
            capture_completeness: CaptureCompleteness::Complete,
        }
    }

    fn gap(meeting_id: &str, gap_id: &str, start: Option<u64>) -> GapFact {
        GapFact {
            gap_id: gap_id.to_string(),
            meeting_id: meeting_id.to_string(),
            gap_kind: "transcript_interval".to_string(),
            reason_code: "forced_cancellation".to_string(),
            audio_start_ms: start,
            audio_end_ms: start.map(|value| value + 50),
        }
    }

    #[tokio::test]
    async fn meeting_recovery_command_validates_before_mutation_and_redacts_conflicts() {
        let pool = recovery_pool().await;
        let invalid = RecoveryRequest {
            meeting_id: "../../sensitive/path".to_string(),
            evidence: Vec::new(),
            gaps: Vec::new(),
        };
        let result = reconcile_meeting_with_pool(&pool, invalid).await;
        assert_eq!(
            result.unwrap_err().code,
            RecoveryErrorCode::InvalidRequest
        );
        let meeting_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meetings")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(meeting_count, 0, "invalid input cannot mutate SQLite");

        assert_eq!(
            map_recovery_repository_error(RecoveryRepositoryError::StaleMeeting).code,
            RecoveryErrorCode::StaleMeeting
        );
        assert_eq!(
            map_recovery_repository_error(RecoveryRepositoryError::CrossMeetingScope).code,
            RecoveryErrorCode::CrossMeetingScope
        );

        let stale = MeetingsRepository::create_session(&pool, "Already complete")
            .await
            .unwrap();
        sqlx::query(
            "UPDATE meetings SET lifecycle = 'complete', completeness = 'complete' WHERE id = ?",
        )
        .bind(&stale.meeting_id)
        .execute(&pool)
        .await
        .unwrap();
        let stale_error = reconcile_meeting_with_pool(
            &pool,
            RecoveryRequest {
                meeting_id: stale.meeting_id,
                evidence: Vec::new(),
                gaps: Vec::new(),
            },
        )
        .await
        .unwrap_err();
        assert_eq!(stale_error.code, RecoveryErrorCode::StaleMeeting);

        let target = MeetingsRepository::create_session(&pool, "Scope target")
            .await
            .unwrap();
        let other = MeetingsRepository::create_session(&pool, "Scope source")
            .await
            .unwrap();
        let cross_scope_error = reconcile_meeting_with_pool(
            &pool,
            RecoveryRequest {
                meeting_id: target.meeting_id,
                evidence: vec![evidence(&other.meeting_id)],
                gaps: Vec::new(),
            },
        )
        .await
        .unwrap_err();
        assert_eq!(
            cross_scope_error.code,
            RecoveryErrorCode::CrossMeetingScope
        );
        let serialized = serde_json::to_string(&map_recovery_repository_error(
            RecoveryRepositoryError::IdentityConflict,
        ))
        .unwrap();
        assert!(!serialized.contains("path"));
        assert!(!serialized.contains("transcript"));
    }

    #[test]
    fn meeting_recovery_command_is_registered_in_the_tauri_handler() {
        let lib_source = include_str!("../lib.rs");
        assert!(
            lib_source.contains("database::commands::reconcile_meeting"),
            "the typed recovery command must be reachable through generate_handler"
        );
    }

    #[tokio::test]
    async fn meeting_recovery_command_returns_authoritative_ordered_gaps_with_explicit_unknowns() {
        let pool = recovery_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Command recovery")
            .await
            .unwrap();
        sqlx::query(
            "UPDATE meetings
             SET lifecycle = 'incomplete', completeness = 'incomplete',
                 completeness_reason = 'interrupted'
             WHERE id = ?",
        )
        .bind(&meeting.meeting_id)
        .execute(&pool)
        .await
        .unwrap();
        let request = RecoveryRequest {
            meeting_id: meeting.meeting_id.clone(),
            evidence: vec![evidence(&meeting.meeting_id)],
            gaps: vec![
                gap(&meeting.meeting_id, "gap-z", Some(100)),
                gap(&meeting.meeting_id, "gap-unknown", None),
                gap(&meeting.meeting_id, "gap-a", Some(100)),
            ],
        };

        let result = reconcile_meeting_with_pool(&pool, request)
            .await
            .expect("typed command result");
        assert_eq!(result.meeting_id, meeting.meeting_id);
        assert_eq!(result.lifecycle, MeetingLifecycle::Recovered);
        assert_eq!(result.evidence_count, 1);
        assert_eq!(result.gap_count, 3);
        assert_eq!(
            result
                .gaps
                .iter()
                .map(|gap| gap.gap_id.as_str())
                .collect::<Vec<_>>(),
            vec!["gap-a", "gap-z", "gap-unknown"]
        );
        assert_eq!(result.gaps[2].audio_start_ms, None);
        assert_eq!(result.gaps[2].audio_end_ms, None);
        let serialized = serde_json::to_value(&result).unwrap();
        assert!(serialized["gaps"][2].get("audio_start_ms").is_some());
        assert!(serialized["gaps"][2]["audio_start_ms"].is_null());
    }
}
