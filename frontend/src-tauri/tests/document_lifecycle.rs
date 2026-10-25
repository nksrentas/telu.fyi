use app_lib::documents::commands::delete;
use app_lib::documents::import::{import_file, import_file_into, managed_folder};
use app_lib::documents::ingest::ingest_text_into;
use app_lib::documents::models::{DocumentVersion, Passage};
use app_lib::documents::repository::{get_document, list_passages, mark_deleted};
use app_lib::documents::sweep::sweep_managed_files;
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use std::path::{Path, PathBuf};
use tempfile::TempDir;

const FIRST_DRAFT: &str =
    "# Budget\n\nThe marmalade forecast stays at forty.\n\n## Risks\n\nQuartz vendors may slip.\n";
const SECOND_DRAFT: &str = "# Budget\n\nThe marmalade forecast rises to fifty.\n";
const OTHER_DOCUMENT: &str = "# Hiring\n\nZephyr panel meets on Tuesday.\n";

struct Fixture {
    _root: TempDir,
    pool: SqlitePool,
    app_data: PathBuf,
    sources: PathBuf,
}

async fn fixture() -> Fixture {
    let root = TempDir::new().expect("temp dir");
    let app_data = root.path().join("app-data");
    let sources = root.path().join("sources");
    std::fs::create_dir_all(&app_data).expect("app data");
    std::fs::create_dir_all(&sources).expect("sources");
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(root.path().join("telu.sqlite"))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .expect("database");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations");
    Fixture {
        _root: root,
        pool,
        app_data,
        sources,
    }
}

impl Fixture {
    fn source(&self, name: &str, text: &str) -> PathBuf {
        let path = self.sources.join(name);
        std::fs::write(&path, text).expect("source");
        path
    }

    async fn import(&self, name: &str, text: &str) -> DocumentVersion {
        import_file(
            &self.pool,
            &self.app_data,
            &self.source(name, text),
            Utc::now(),
        )
        .await
        .expect("import")
    }

    async fn replace(&self, version: &DocumentVersion, name: &str, text: &str) -> DocumentVersion {
        let document = get_document(&self.pool, &version.document_id)
            .await
            .expect("load document")
            .expect("document");
        import_file_into(
            &self.pool,
            &self.app_data,
            &document,
            &self.source(name, text),
            Utc::now(),
        )
        .await
        .expect("replace")
    }

    async fn passages(&self, version: &DocumentVersion) -> Vec<Passage> {
        list_passages(&self.pool, &version.id)
            .await
            .expect("passages")
    }

    fn managed_file(&self, version: &DocumentVersion) -> PathBuf {
        self.app_data
            .join(version.managed_path.as_deref().expect("managed path"))
    }
}

fn snapshot(passages: &[Passage]) -> Vec<(String, i64, String, Vec<u8>, String)> {
    passages
        .iter()
        .map(|p| {
            (
                p.id.clone(),
                p.ordinal,
                p.locator_json.clone(),
                p.text.as_bytes().to_vec(),
                p.content_hash.clone(),
            )
        })
        .collect()
}

async fn text_columns_containing(pool: &SqlitePool, needle: &str) -> Vec<String> {
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await
    .expect("tables");
    let mut hits = Vec::new();
    for table in tables {
        let columns = sqlx::query(&format!("PRAGMA table_info(\"{table}\")"))
            .fetch_all(pool)
            .await
            .expect("columns");
        for column in columns {
            let name: String = column.get("name");
            let declared: String = column.get("type");
            if !declared.to_ascii_uppercase().contains("TEXT") {
                continue;
            }
            let count: i64 = sqlx::query_scalar(&format!(
                "SELECT COUNT(*) FROM \"{table}\" WHERE instr(\"{name}\", ?) > 0"
            ))
            .bind(needle)
            .fetch_one(pool)
            .await
            .expect("scan");
            if count > 0 {
                hits.push(format!("{table}.{name}"));
            }
        }
    }
    hits
}

fn files_in(folder: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(folder)
        .expect("folder")
        .map(|entry| {
            entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    names.sort();
    names
}

#[tokio::test]
async fn replace_adds_the_next_version_and_leaves_version_one_byte_identical() {
    let fx = fixture().await;
    let first = fx.import("budget.md", FIRST_DRAFT).await;
    let before = snapshot(&fx.passages(&first).await);

    let second = fx.replace(&first, "budget.md", SECOND_DRAFT).await;

    assert_eq!((first.version, second.version), (1, 2));
    assert_eq!(second.document_id, first.document_id);
    assert_eq!(snapshot(&fx.passages(&first).await), before);
    assert_eq!(
        std::fs::read(fx.managed_file(&first)).expect("version 1 file"),
        FIRST_DRAFT.as_bytes()
    );
    let texts: Vec<String> = fx
        .passages(&second)
        .await
        .into_iter()
        .map(|p| p.text)
        .collect();
    assert!(
        texts.iter().any(|t| t.contains("rises to fifty")),
        "{texts:?}"
    );
}

#[tokio::test]
async fn delete_removes_every_versions_text_from_every_table_and_the_managed_folder() {
    let fx = fixture().await;
    let first = fx.import("budget.md", FIRST_DRAFT).await;
    fx.replace(&first, "budget.md", SECOND_DRAFT).await;
    let other = fx.import("hiring.md", OTHER_DOCUMENT).await;
    for needle in ["marmalade", "Quartz", "fifty"] {
        assert!(
            !text_columns_containing(&fx.pool, needle).await.is_empty(),
            "{needle} stored"
        );
    }

    delete(&fx.pool, &fx.app_data, &first.document_id)
        .await
        .expect("delete");

    for needle in ["marmalade", "Quartz", "fifty"] {
        assert_eq!(
            text_columns_containing(&fx.pool, needle).await,
            Vec::<String>::new(),
            "{needle}"
        );
    }
    assert!(!managed_folder(&fx.app_data, &first.document_id).exists());
    assert_eq!(
        text_columns_containing(&fx.pool, "Zephyr").await,
        vec!["document_passages.text".to_string()]
    );
    assert!(fx.managed_file(&other).exists());
}

#[tokio::test]
async fn startup_sweep_removes_files_left_by_a_crash_and_keeps_live_files() {
    let fx = fixture().await;
    let crashed = fx.import("budget.md", FIRST_DRAFT).await;
    fx.replace(&crashed, "budget.md", SECOND_DRAFT).await;
    let live = fx.import("hiring.md", OTHER_DOCUMENT).await;
    assert!(mark_deleted(&fx.pool, &crashed.document_id)
        .await
        .expect("mark deleted"));
    let live_folder = managed_folder(&fx.app_data, &live.document_id);
    std::fs::write(live_folder.join("left-by-failed-import.md"), "stray").expect("stray file");

    let removed = sweep_managed_files(&fx.pool, &fx.app_data)
        .await
        .expect("sweep");

    assert_eq!(removed, 3);
    assert!(!managed_folder(&fx.app_data, &crashed.document_id).exists());
    let live_name = fx
        .managed_file(&live)
        .file_name()
        .expect("file name")
        .to_string_lossy()
        .into_owned();
    assert_eq!(files_in(&live_folder), vec![live_name]);
    assert_eq!(
        std::fs::read(fx.managed_file(&live)).expect("live file"),
        OTHER_DOCUMENT.as_bytes()
    );
}

#[tokio::test]
async fn startup_sweep_without_a_documents_folder_removes_nothing() {
    let fx = fixture().await;

    assert_eq!(
        sweep_managed_files(&fx.pool, &fx.app_data)
            .await
            .expect("sweep"),
        0
    );
}

#[tokio::test]
async fn a_deleted_document_takes_no_new_version() {
    let fx = fixture().await;
    let first = fx.import("notes.txt", "Plain paragraph.\n").await;
    delete(&fx.pool, &fx.app_data, &first.document_id)
        .await
        .expect("delete");

    let error = ingest_text_into(
        &fx.pool,
        &first.document_id,
        "Pasted after delete.",
        Utc::now(),
    )
    .await
    .expect_err("deleted document");

    assert_eq!(error.to_string(), "DOCUMENT_NOT_FOUND");
    assert!(text_columns_containing(&fx.pool, "Pasted after delete")
        .await
        .is_empty());
}

#[tokio::test]
async fn a_deleted_document_takes_no_imported_version() {
    let fx = fixture().await;
    let first = fx.import("budget.md", FIRST_DRAFT).await;
    let document = get_document(&fx.pool, &first.document_id)
        .await
        .expect("load document")
        .expect("document");
    delete(&fx.pool, &fx.app_data, &first.document_id)
        .await
        .expect("delete");

    let error = import_file_into(
        &fx.pool,
        &fx.app_data,
        &document,
        &fx.source("budget.md", SECOND_DRAFT),
        Utc::now(),
    )
    .await
    .expect_err("deleted document");

    assert_eq!(error.to_string(), "DOCUMENT_NOT_FOUND");
    assert!(text_columns_containing(&fx.pool, "fifty").await.is_empty());
    assert!(!managed_folder(&fx.app_data, &first.document_id).exists());
}
