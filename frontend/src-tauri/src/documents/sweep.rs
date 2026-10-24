use crate::documents::import::DOCUMENTS_DIR;
use crate::state::AppState;
use anyhow::Result;
use sqlx::SqlitePool;
use std::collections::HashSet;
use std::io::ErrorKind;
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime};

pub fn sweep_on_startup<R: Runtime>(app: &AppHandle<R>) {
    let Ok(app_data_dir) = app.path().app_data_dir() else {
        log::warn!("documents sweep skipped: no app data folder");
        return;
    };
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let pool = state.db_manager.pool().clone();
    match tauri::async_runtime::block_on(sweep_managed_files(&pool, &app_data_dir)) {
        Ok(removed) => log::info!("documents sweep removed {removed} managed files"),
        Err(error) => log::warn!("documents sweep failed: {error}"),
    }
}

pub async fn sweep_managed_files(pool: &SqlitePool, app_data_dir: &Path) -> Result<usize> {
    let root = app_data_dir.join(DOCUMENTS_DIR);
    let mut folders = match tokio::fs::read_dir(&root).await {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(0),
        result => result?,
    };
    let live = live_managed_paths(pool).await?;
    let mut removed = 0;
    while let Some(folder) = folders.next_entry().await? {
        if !folder.file_type().await?.is_dir() {
            continue;
        }
        let prefix = format!("{DOCUMENTS_DIR}/{}", folder.file_name().to_string_lossy());
        match sweep_folder(&folder.path(), &prefix, &live).await {
            Ok(count) => removed += count,
            Err(error) => log::warn!("documents sweep skipped a managed folder: {error}"),
        }
    }
    Ok(removed)
}

async fn sweep_folder(folder: &Path, prefix: &str, live: &HashSet<String>) -> Result<usize> {
    let mut files = tokio::fs::read_dir(folder).await?;
    let mut removed = 0;
    let mut kept = 0;
    while let Some(file) = files.next_entry().await? {
        let managed_path = format!("{prefix}/{}", file.file_name().to_string_lossy());
        if live.contains(&managed_path) || !file.file_type().await?.is_file() {
            kept += 1;
            continue;
        }
        tokio::fs::remove_file(file.path()).await?;
        removed += 1;
    }
    if kept == 0 {
        tokio::fs::remove_dir(folder).await?;
    }
    Ok(removed)
}

async fn live_managed_paths(pool: &SqlitePool) -> Result<HashSet<String>, sqlx::Error> {
    let paths: Vec<String> = sqlx::query_scalar(
        "SELECT v.managed_path FROM document_versions v
         JOIN documents d ON d.id = v.document_id
         WHERE d.availability = 'available' AND v.managed_path IS NOT NULL",
    )
    .fetch_all(pool)
    .await?;
    Ok(paths.into_iter().collect())
}
