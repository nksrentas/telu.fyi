use crate::documents::import::{import_file, import_file_into, managed_folder, pick_source};
use crate::documents::ingest::{ingest_text, ingest_text_into};
use crate::documents::models::{
    Availability, Document, DocumentFormat, DocumentSummary, DocumentVersion, Passage,
};
use crate::documents::repository;
use crate::state::AppState;
use anyhow::anyhow;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

const STORAGE_FAILED: &str = "DOCUMENT_STORAGE_FAILED";

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ReplaceSource {
    Paste { text: String },
    Import,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVersionView {
    pub document: Document,
    pub version: DocumentVersion,
    pub latest_version: i64,
    pub passages: Vec<Passage>,
}

#[tauri::command]
pub async fn documents_paste(
    state: tauri::State<'_, AppState>,
    title: String,
    text: String,
) -> Result<DocumentVersion, String> {
    paste(state.db_manager.pool(), &title, &text).await
}

#[tauri::command]
pub async fn documents_import<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
) -> Result<Option<DocumentVersion>, String> {
    let app_data_dir = app_data_dir(&app)?;
    let Some(source) = pick(app).await? else {
        return Ok(None);
    };
    import(state.db_manager.pool(), &app_data_dir, &source)
        .await
        .map(Some)
}

#[tauri::command]
pub async fn documents_list(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DocumentSummary>, String> {
    list(state.db_manager.pool()).await
}

#[tauri::command]
pub async fn documents_get_version(
    state: tauri::State<'_, AppState>,
    version_id: String,
) -> Result<DocumentVersionView, String> {
    get_version(state.db_manager.pool(), &version_id).await
}

#[tauri::command]
pub async fn documents_replace<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    document_id: String,
    source: ReplaceSource,
) -> Result<Option<DocumentVersion>, String> {
    let pool = state.db_manager.pool();
    match source {
        ReplaceSource::Paste { text } => {
            replace_with_text(pool, &document_id, &text).await.map(Some)
        }
        ReplaceSource::Import => {
            let app_data_dir = app_data_dir(&app)?;
            available_document(pool, &document_id).await?;
            let Some(path) = pick(app).await? else {
                return Ok(None);
            };
            replace_with_file(pool, &app_data_dir, &document_id, &path)
                .await
                .map(Some)
        }
    }
}

#[tauri::command]
pub async fn documents_delete<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    document_id: String,
) -> Result<(), String> {
    let app_data_dir = app_data_dir(&app)?;
    delete(state.db_manager.pool(), &app_data_dir, &document_id).await
}

async fn paste(pool: &SqlitePool, title: &str, text: &str) -> Result<DocumentVersion, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("DOCUMENT_TITLE_REQUIRED".to_string());
    }
    ingest_text(pool, title, text, Utc::now())
        .await
        .map_err(error_code)
}

async fn import(
    pool: &SqlitePool,
    app_data_dir: &Path,
    source: &Path,
) -> Result<DocumentVersion, String> {
    import_file(pool, app_data_dir, source, Utc::now())
        .await
        .map_err(error_code)
}

async fn list(pool: &SqlitePool) -> Result<Vec<DocumentSummary>, String> {
    repository::list_summaries(pool)
        .await
        .map_err(|error| error_code(error.into()))
}

async fn get_version(pool: &SqlitePool, version_id: &str) -> Result<DocumentVersionView, String> {
    let version = repository::get_version(pool, version_id)
        .await
        .map_err(|error| error_code(error.into()))?
        .ok_or_else(|| "DOCUMENT_VERSION_NOT_FOUND".to_string())?;
    let load = async {
        let document = repository::get_document(pool, &version.document_id)
            .await?
            .ok_or_else(|| anyhow!(STORAGE_FAILED))?;
        let latest_version = repository::latest_version_number(pool, &document.id).await?;
        let passages = repository::list_passages(pool, &version.id).await?;
        anyhow::Ok((document, latest_version, passages))
    };
    let (document, latest_version, passages) = load.await.map_err(error_code)?;
    Ok(DocumentVersionView {
        document,
        version,
        latest_version,
        passages,
    })
}

async fn replace_with_text(
    pool: &SqlitePool,
    document_id: &str,
    text: &str,
) -> Result<DocumentVersion, String> {
    if available_document(pool, document_id).await?.format != DocumentFormat::Text {
        return Err("DOCUMENT_FORMAT_MISMATCH".to_string());
    }
    ingest_text_into(pool, document_id, text, Utc::now())
        .await
        .map_err(error_code)
}

async fn replace_with_file(
    pool: &SqlitePool,
    app_data_dir: &Path,
    document_id: &str,
    source: &Path,
) -> Result<DocumentVersion, String> {
    let document = available_document(pool, document_id).await?;
    import_file_into(pool, app_data_dir, &document, source, Utc::now())
        .await
        .map_err(error_code)
}

pub async fn delete(
    pool: &SqlitePool,
    app_data_dir: &Path,
    document_id: &str,
) -> Result<(), String> {
    let deleted = repository::mark_deleted(pool, document_id)
        .await
        .map_err(|error| error_code(error.into()))?;
    if !deleted {
        return Err("DOCUMENT_NOT_FOUND".to_string());
    }
    match tokio::fs::remove_dir_all(managed_folder(app_data_dir, document_id)).await {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
            log::warn!("documents delete: could not remove a managed folder: {error}");
        }
        _ => {}
    }
    Ok(())
}

async fn available_document(pool: &SqlitePool, document_id: &str) -> Result<Document, String> {
    repository::get_document(pool, document_id)
        .await
        .map_err(|error| error_code(error.into()))?
        .filter(|document| document.availability == Availability::Available)
        .ok_or_else(|| "DOCUMENT_NOT_FOUND".to_string())
}

async fn pick<R: Runtime>(app: AppHandle<R>) -> Result<Option<PathBuf>, String> {
    tokio::task::spawn_blocking(move || pick_source(&app))
        .await
        .map_err(|error| error_code(error.into()))?
        .map_err(error_code)
}

fn app_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| error_code(error.into()))
}

fn error_code(error: anyhow::Error) -> String {
    let message = error.to_string();
    if is_error_code(&message) {
        return message;
    }
    log::error!("documents command failed: {error:#}");
    STORAGE_FAILED.to_string()
}

fn is_error_code(message: &str) -> bool {
    message.starts_with(|c: char| c.is_ascii_uppercase())
        && message
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_' || c == ':')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::models::ExtractionStatus;
    use crate::knowledge::test_support::migrated_pool;
    use tempfile::TempDir;

    fn write_source(dir: &TempDir, name: &str, text: &str) -> PathBuf {
        let path = dir.path().join(name);
        std::fs::write(&path, text).expect("source");
        path
    }

    #[tokio::test]
    async fn paste_stores_version_one_and_refuses_a_blank_title() {
        let pool = migrated_pool().await;

        let version = paste(&pool, "  Notes  ", "First paragraph.\n\nSecond.")
            .await
            .expect("paste");
        let document = repository::get_document(&pool, &version.document_id)
            .await
            .unwrap()
            .unwrap();

        assert_eq!((version.version, document.title.as_str()), (1, "Notes"));
        assert_eq!(
            paste(&pool, "   ", "Text").await.unwrap_err(),
            "DOCUMENT_TITLE_REQUIRED"
        );
        assert_eq!(
            paste(&pool, "Empty", " \n\n ").await.unwrap_err(),
            "EMPTY_SOURCE"
        );
    }

    #[tokio::test]
    async fn import_stores_a_markdown_file_and_refuses_other_formats() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().unwrap();
        let sources = TempDir::new().unwrap();
        let markdown = write_source(&sources, "Plan.md", "# Goals\n\nShip it.");

        let version = import(&pool, app_data.path(), &markdown)
            .await
            .expect("import");

        assert_eq!(version.parser_version, "import-markdown-1");
        let pdf = write_source(&sources, "Plan.pdf", "%PDF");
        assert_eq!(
            import(&pool, app_data.path(), &pdf).await.unwrap_err(),
            "UNSUPPORTED_FORMAT"
        );
        let missing = sources.path().join("gone.md");
        assert_eq!(
            import(&pool, app_data.path(), &missing).await.unwrap_err(),
            "SOURCE_UNREADABLE"
        );
    }

    #[tokio::test]
    async fn list_reports_each_documents_latest_version() {
        let pool = migrated_pool().await;
        let first = paste(&pool, "Agenda", "Version one.").await.unwrap();
        replace_with_text(&pool, &first.document_id, "Version two, longer.")
            .await
            .unwrap();

        let summaries = list(&pool).await.expect("list");

        assert_eq!(summaries.len(), 1);
        let summary = &summaries[0];
        assert_eq!(
            (
                summary.title.as_str(),
                summary.latest_version,
                summary.byte_size,
                summary.availability,
                summary.extraction_status,
            ),
            (
                "Agenda",
                2,
                "Version two, longer.".len() as i64,
                Availability::Available,
                ExtractionStatus::Extracted,
            )
        );
    }

    #[tokio::test]
    async fn get_version_returns_passages_and_refuses_an_unknown_id() {
        let pool = migrated_pool().await;
        let first = paste(&pool, "Agenda", "Alpha.\n\nBeta.").await.unwrap();
        replace_with_text(&pool, &first.document_id, "Gamma.")
            .await
            .unwrap();

        let view = get_version(&pool, &first.id).await.expect("view");

        let texts: Vec<&str> = view.passages.iter().map(|p| p.text.as_str()).collect();
        assert_eq!(texts, vec!["Alpha.", "Beta."]);
        assert_eq!((view.version.version, view.latest_version), (1, 2));
        assert_eq!(view.document.title, "Agenda");
        assert_eq!(
            get_version(&pool, "no-such-version").await.unwrap_err(),
            "DOCUMENT_VERSION_NOT_FOUND"
        );
    }

    #[tokio::test]
    async fn replace_by_paste_adds_a_version_and_refuses_an_unknown_document() {
        let pool = migrated_pool().await;
        let first = paste(&pool, "Agenda", "Old.").await.unwrap();

        let second = replace_with_text(&pool, &first.document_id, "New.")
            .await
            .expect("replace");

        assert_eq!(
            (second.document_id.as_str(), second.version),
            (first.document_id.as_str(), 2)
        );
        let app_data = TempDir::new().unwrap();
        let sources = TempDir::new().unwrap();
        let markdown = import(
            &pool,
            app_data.path(),
            &write_source(&sources, "Plan.md", "# A\n\nOne."),
        )
        .await
        .unwrap();
        assert_eq!(
            replace_with_text(&pool, &markdown.document_id, "Two.")
                .await
                .unwrap_err(),
            "DOCUMENT_FORMAT_MISMATCH"
        );
        assert_eq!(
            replace_with_text(&pool, "no-such-document", "New.")
                .await
                .unwrap_err(),
            "DOCUMENT_NOT_FOUND"
        );
    }

    #[tokio::test]
    async fn replace_by_import_adds_a_version_and_keeps_the_format() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().unwrap();
        let sources = TempDir::new().unwrap();
        let first = import(
            &pool,
            app_data.path(),
            &write_source(&sources, "Plan.md", "# A\n\nOne."),
        )
        .await
        .unwrap();

        let second = replace_with_file(
            &pool,
            app_data.path(),
            &first.document_id,
            &write_source(&sources, "Plan v2.md", "# A\n\nTwo."),
        )
        .await
        .expect("replace");

        assert_eq!(second.version, 2);
        for version in [&first, &second] {
            let path = app_data.path().join(version.managed_path.as_ref().unwrap());
            assert!(path.exists(), "{path:?}");
        }
        let text = write_source(&sources, "Plan.txt", "Three.");
        assert_eq!(
            replace_with_file(&pool, app_data.path(), &first.document_id, &text)
                .await
                .unwrap_err(),
            "DOCUMENT_FORMAT_MISMATCH"
        );
        assert_eq!(list(&pool).await.unwrap()[0].latest_version, 2);
    }

    #[tokio::test]
    async fn delete_marks_the_document_deleted_and_removes_passages_and_files() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().unwrap();
        let sources = TempDir::new().unwrap();
        let version = import(
            &pool,
            app_data.path(),
            &write_source(&sources, "Plan.md", "# A\n\nSecret line."),
        )
        .await
        .unwrap();

        delete(&pool, app_data.path(), &version.document_id)
            .await
            .expect("delete");

        let view = get_version(&pool, &version.id).await.expect("view");
        assert_eq!(view.document.availability, Availability::Deleted);
        assert!(view.passages.is_empty());
        assert!(!managed_folder(app_data.path(), &version.document_id).exists());
        assert_eq!(
            delete(&pool, app_data.path(), &version.document_id)
                .await
                .unwrap_err(),
            "DOCUMENT_NOT_FOUND"
        );
        assert_eq!(
            replace_with_text(&pool, &version.document_id, "Back.")
                .await
                .unwrap_err(),
            "DOCUMENT_NOT_FOUND"
        );
    }

    #[test]
    fn error_code_passes_codes_through_and_hides_other_errors() {
        assert_eq!(
            error_code(anyhow!("SOURCE_TOO_LARGE:MAX_SOURCE_BYTES")),
            "SOURCE_TOO_LARGE:MAX_SOURCE_BYTES"
        );
        assert_eq!(
            error_code(anyhow!("UNIQUE constraint failed: documents.id")),
            STORAGE_FAILED
        );
    }
}
