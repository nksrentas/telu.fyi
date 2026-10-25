use crate::documents::encoding::extract;
use crate::documents::ingest::{paragraph_passages, passage, sha256_hex};
use crate::documents::limits::{ensure_source_bytes, split_span};
use crate::documents::models::{Document, DocumentFormat, DocumentVersion, NewPassage, NewVersion};
use crate::documents::repository;
use anyhow::{anyhow, bail, Result};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::{Sqlite, SqlitePool, Transaction};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

pub(super) const DOCUMENTS_DIR: &str = "documents";
const IMPORT_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];
const MARKDOWN_PARSER_VERSION: &str = "import-markdown-1";
const TEXT_PARSER_VERSION: &str = "import-text-1";
const FENCE_CHARS: [char; 2] = ['`', '~'];
const MIN_FENCE_RUN: usize = 3;

pub fn pick_source<R: Runtime>(app: &AppHandle<R>) -> Result<Option<PathBuf>> {
    let Some(picked) = app
        .dialog()
        .file()
        .add_filter("Markdown or text", &IMPORT_EXTENSIONS)
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    picked
        .into_path()
        .map(Some)
        .map_err(|_| anyhow!("SOURCE_UNREADABLE"))
}

pub async fn import_file(
    pool: &SqlitePool,
    app_data_dir: &Path,
    source: &Path,
    now: DateTime<Utc>,
) -> Result<DocumentVersion> {
    let source = read_source(source).await?;
    let mut tx = pool.begin().await?;
    let document = repository::create_document(&mut *tx, &source.title, source.format, now).await?;
    let result = store_and_extract(tx, app_data_dir, &document, &source, now).await;
    if result.is_err() {
        remove_after_failure(
            tokio::fs::remove_dir_all(managed_folder(app_data_dir, &document.id)).await,
        );
    }
    result
}

pub async fn import_file_into(
    pool: &SqlitePool,
    app_data_dir: &Path,
    document: &Document,
    source: &Path,
    now: DateTime<Utc>,
) -> Result<DocumentVersion> {
    let source = read_source(source).await?;
    if source.format != document.format {
        bail!("DOCUMENT_FORMAT_MISMATCH");
    }
    let mut tx = pool.begin().await?;
    if !repository::is_available(&mut *tx, &document.id).await? {
        bail!("DOCUMENT_NOT_FOUND");
    }
    if let Some(existing) =
        repository::find_version_by_sha256(&mut *tx, &document.id, &source.sha256).await?
    {
        return Ok(existing);
    }
    let result = store_and_extract(tx, app_data_dir, document, &source, now).await;
    if result.is_err() {
        let file = managed_folder(app_data_dir, &document.id).join(source.file_name());
        remove_after_failure(tokio::fs::remove_file(file).await);
    }
    result
}

pub fn managed_folder(app_data_dir: &Path, document_id: &str) -> PathBuf {
    app_data_dir.join(DOCUMENTS_DIR).join(document_id)
}

fn remove_after_failure(result: std::io::Result<()>) {
    if let Err(error) = result {
        log::warn!("documents import: could not remove a managed file: {error}");
    }
}

struct Source {
    format: DocumentFormat,
    extension: String,
    title: String,
    sha256: String,
    bytes: Vec<u8>,
}

impl Source {
    fn file_name(&self) -> String {
        format!("{}.{}", self.sha256, self.extension)
    }
}

async fn read_source(source: &Path) -> Result<Source> {
    let (format, extension) = source_format(source)?;
    let metadata = tokio::fs::metadata(source)
        .await
        .map_err(|_| anyhow!("SOURCE_UNREADABLE"))?;
    ensure_source_bytes(metadata.len())?;
    let bytes = tokio::fs::read(source)
        .await
        .map_err(|_| anyhow!("SOURCE_UNREADABLE"))?;
    ensure_source_bytes(bytes.len() as u64)?;
    let title = source
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.trim().is_empty())
        .unwrap_or("Imported document")
        .to_string();
    Ok(Source {
        format,
        extension,
        title,
        sha256: sha256_hex(&bytes),
        bytes,
    })
}

fn source_format(source: &Path) -> Result<(DocumentFormat, String)> {
    let extension = source
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .filter(|extension| IMPORT_EXTENSIONS.contains(&extension.as_str()))
        .ok_or_else(|| anyhow!("UNSUPPORTED_FORMAT"))?;
    let format = if extension == "txt" {
        DocumentFormat::Text
    } else {
        DocumentFormat::Markdown
    };
    Ok((format, extension))
}

async fn store_and_extract(
    mut tx: Transaction<'_, Sqlite>,
    app_data_dir: &Path,
    document: &Document,
    source: &Source,
    now: DateTime<Utc>,
) -> Result<DocumentVersion> {
    let file_name = source.file_name();
    let folder = managed_folder(app_data_dir, &document.id);
    tokio::fs::create_dir_all(&folder).await?;
    tokio::fs::write(folder.join(&file_name), &source.bytes).await?;
    let (split, parser_version): (fn(&str) -> Vec<NewPassage>, _) = match document.format {
        DocumentFormat::Markdown => (markdown_passages, MARKDOWN_PARSER_VERSION),
        DocumentFormat::Text => (paragraph_passages, TEXT_PARSER_VERSION),
    };
    let extraction = extract(&source.bytes, split)?;
    let new = NewVersion {
        sha256: source.sha256.clone(),
        byte_size: source.bytes.len() as i64,
        char_count: extraction.char_count as i64,
        parser_version: parser_version.to_string(),
        extraction_status: extraction.status,
        failure_code: extraction.failure_code,
        managed_path: Some(format!("{DOCUMENTS_DIR}/{}/{file_name}", document.id)),
    };
    let version =
        repository::create_version(&mut tx, &document.id, new, extraction.passages, now).await?;
    tx.commit().await?;
    Ok(version)
}

fn markdown_passages(text: &str) -> Vec<NewPassage> {
    let mut sections = Sections::new(text);
    let mut fence: Option<(char, usize)> = None;
    let mut offset = 0;
    for line in text.split('\n') {
        let line_end = offset + line.chars().count();
        match (fence, atx_heading(line)) {
            (None, Some((level, title))) => sections.enter(level, title),
            (None, None) if line.trim().is_empty() => sections.flush(),
            _ => {
                sections.extend(offset, line_end);
                fence = next_fence(fence, line);
            }
        }
        offset = line_end + 1;
    }
    sections.flush();
    sections.passages
}

struct Sections {
    chars: Vec<char>,
    headings: Vec<(usize, String)>,
    paragraph: usize,
    current: Option<(usize, usize)>,
    passages: Vec<NewPassage>,
}

impl Sections {
    fn new(text: &str) -> Self {
        Self {
            chars: text.chars().collect(),
            headings: Vec::new(),
            paragraph: 0,
            current: None,
            passages: Vec::new(),
        }
    }

    fn enter(&mut self, level: usize, title: String) {
        self.flush();
        self.headings.retain(|(open, _)| *open < level);
        self.headings.push((level, title));
        self.paragraph = 0;
    }

    fn extend(&mut self, start: usize, end: usize) {
        self.current = Some((self.current.map_or(start, |(open, _)| open), end));
    }

    fn flush(&mut self) {
        let Some((start, end)) = self.current.take() else {
            return;
        };
        let heading_path: Vec<&str> = self
            .headings
            .iter()
            .map(|(_, title)| title.as_str())
            .collect();
        for (start, end) in split_span(&self.chars, start, end) {
            let locator = json!({
                "kind": "section",
                "heading_path": heading_path,
                "paragraph": self.paragraph,
                "start": start,
                "end": end,
            });
            self.passages
                .push(passage(&self.chars, locator, start, end));
            self.paragraph += 1;
        }
    }
}

fn atx_heading(line: &str) -> Option<(usize, String)> {
    let rest = line.trim_start_matches(' ');
    if line.len() - rest.len() > 3 {
        return None;
    }
    let after = rest.trim_start_matches('#');
    let level = rest.len() - after.len();
    if !(1..=6).contains(&level) || !(after.is_empty() || after.starts_with([' ', '\t'])) {
        return None;
    }
    let content = after.trim();
    let without_closing = content.trim_end_matches('#');
    let title = if without_closing.is_empty() || without_closing.ends_with([' ', '\t']) {
        without_closing.trim_end()
    } else {
        content
    };
    Some((level, title.to_string()))
}

fn next_fence(fence: Option<(char, usize)>, line: &str) -> Option<(char, usize)> {
    let rest = line.trim_start_matches(' ');
    if line.len() - rest.len() > 3 {
        return fence;
    }
    let Some(marker) = rest.chars().next() else {
        return fence;
    };
    let run = rest.chars().take_while(|c| *c == marker).count();
    match fence {
        None if FENCE_CHARS.contains(&marker)
            && run >= MIN_FENCE_RUN
            && !(marker == '`' && rest[run..].contains('`')) =>
        {
            Some((marker, run))
        }
        Some((open, length))
            if marker == open && run >= length && rest[run..].trim().is_empty() =>
        {
            None
        }
        open => open,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::repository::list_passages;
    use crate::knowledge::test_support::migrated_pool;
    use serde_json::Value;
    use tempfile::TempDir;

    fn fixture(name: &str) -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/documents")
            .join(name)
    }

    fn locator(passage: &NewPassage) -> Value {
        serde_json::from_str(&passage.locator_json).expect("locator json")
    }

    fn slice_chars(text: &str, start: &Value, end: &Value) -> String {
        let (start, end) = (
            start.as_u64().unwrap() as usize,
            end.as_u64().unwrap() as usize,
        );
        text.chars().skip(start).take(end - start).collect()
    }

    async fn table_count(pool: &SqlitePool, table: &str) -> i64 {
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .expect("count")
    }

    #[tokio::test]
    async fn import_markdown_gives_section_locators_and_a_managed_copy() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        let source = fixture("two-headings.md");
        let raw = std::fs::read(&source).expect("fixture");

        let version = import_file(&pool, app_data.path(), &source, Utc::now())
            .await
            .expect("import");

        assert_eq!(version.parser_version, "import-markdown-1");
        assert_eq!(version.sha256, sha256_hex(&raw));
        assert_eq!(version.byte_size, raw.len() as i64);
        let expected_path = format!("documents/{}/{}.md", version.document_id, version.sha256);
        assert_eq!(
            version.managed_path.as_deref(),
            Some(expected_path.as_str())
        );
        let managed = std::fs::read(app_data.path().join(&expected_path)).expect("managed copy");
        assert_eq!(sha256_hex(&managed), version.sha256);

        let format: String = sqlx::query_scalar("SELECT format FROM documents WHERE id = ?")
            .bind(&version.document_id)
            .fetch_one(&pool)
            .await
            .expect("format");
        assert_eq!(format, "markdown");

        let passages = list_passages(&pool, &version.id).await.expect("passages");
        let text = String::from_utf8(raw).unwrap();
        let shape: Vec<(Value, i64, String)> = passages
            .iter()
            .map(|p| {
                let loc: Value = serde_json::from_str(&p.locator_json).unwrap();
                assert_eq!(loc["kind"], "section");
                assert_eq!(slice_chars(&text, &loc["start"], &loc["end"]), p.text);
                (
                    loc["heading_path"].clone(),
                    loc["paragraph"].as_i64().unwrap(),
                    p.text.clone(),
                )
            })
            .collect();
        assert_eq!(
            shape,
            vec![
                (
                    serde_json::json!([]),
                    0,
                    "Intro line before any heading.".to_string()
                ),
                (
                    serde_json::json!(["Budget review"]),
                    0,
                    "Spend is up 4% on last quarter.\nTravel is the main driver.".to_string()
                ),
                (
                    serde_json::json!(["Budget review", "Open items"]),
                    0,
                    "Confirm the vendor list by Friday.".to_string()
                ),
                (
                    serde_json::json!(["Hiring"]),
                    0,
                    "```\n# not a heading\n\nstill the same fence\n```".to_string()
                ),
            ]
        );
    }

    #[tokio::test]
    async fn import_plain_text_uses_paragraph_locators() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        let source = app_data.path().join("notes.TXT");
        std::fs::write(&source, "\u{feff}# not markdown\r\n\r\nSecond").expect("write");

        let version = import_file(&pool, app_data.path(), &source, Utc::now())
            .await
            .expect("import");

        assert_eq!(version.parser_version, "import-text-1");
        assert!(version
            .managed_path
            .as_deref()
            .is_some_and(|path| path.ends_with(".txt")));
        let passages = list_passages(&pool, &version.id).await.expect("passages");
        let locators: Vec<Value> = passages
            .iter()
            .map(|p| serde_json::from_str(&p.locator_json).unwrap())
            .collect();
        assert_eq!(
            locators,
            vec![
                serde_json::json!({"kind": "paragraph", "index": 0, "start": 0, "end": 14}),
                serde_json::json!({"kind": "paragraph", "index": 1, "start": 16, "end": 22}),
            ]
        );
        let title: String = sqlx::query_scalar("SELECT title FROM documents")
            .fetch_one(&pool)
            .await
            .expect("title");
        assert_eq!(title, "notes");
    }

    #[tokio::test]
    async fn import_refuses_other_formats_and_writes_nothing() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        for name in ["brief.pdf", "brief.docx", "brief"] {
            let source = app_data.path().join(name);
            std::fs::write(&source, "Plain words").expect("write");
            let error = import_file(&pool, app_data.path(), &source, Utc::now())
                .await
                .expect_err("refused");
            assert_eq!(error.to_string(), "UNSUPPORTED_FORMAT");
        }
        assert_eq!(table_count(&pool, "documents").await, 0);
        assert!(!app_data.path().join("documents").exists());
    }

    #[tokio::test]
    async fn import_failing_extraction_leaves_no_rows_and_no_managed_folder() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        let empty = app_data.path().join("empty.md");
        std::fs::write(&empty, "# Only a heading\n\n").expect("write");

        let empty_error = import_file(&pool, app_data.path(), &empty, Utc::now())
            .await
            .expect_err("empty");

        assert_eq!(empty_error.to_string(), "EMPTY_SOURCE");
        assert_eq!(table_count(&pool, "documents").await, 0);
        let documents_dir = app_data.path().join("documents");
        assert!(
            !documents_dir.exists() || std::fs::read_dir(&documents_dir).unwrap().next().is_none()
        );
    }

    #[test]
    fn import_markdown_heading_levels_pop_back_to_their_parent() {
        let text = "# A\n## B\n### C\nc\n## D\nd\n#Not heading\n  # E #\ne one\n\ne two";
        let passages = markdown_passages(text);
        let shape: Vec<(Value, Value, String)> = passages
            .iter()
            .map(|p| {
                let loc = locator(p);
                assert_eq!(slice_chars(text, &loc["start"], &loc["end"]), p.text);
                (
                    loc["heading_path"].clone(),
                    loc["paragraph"].clone(),
                    p.text.clone(),
                )
            })
            .collect();
        assert_eq!(
            shape,
            vec![
                (
                    serde_json::json!(["A", "B", "C"]),
                    serde_json::json!(0),
                    "c".to_string()
                ),
                (
                    serde_json::json!(["A", "D"]),
                    serde_json::json!(0),
                    "d\n#Not heading".to_string()
                ),
                (
                    serde_json::json!(["E"]),
                    serde_json::json!(0),
                    "e one".to_string()
                ),
                (
                    serde_json::json!(["E"]),
                    serde_json::json!(1),
                    "e two".to_string()
                ),
            ]
        );
    }

    #[test]
    fn import_markdown_fences_close_only_on_a_matching_bare_run() {
        let text = "# A\n````\n```rust\n# inside\n\n```\n````\n# B\n    ```\n\n```a`b\n# C\nc";
        let shape: Vec<(Value, String)> = markdown_passages(text)
            .iter()
            .map(|p| (locator(p)["heading_path"].clone(), p.text.clone()))
            .collect();
        assert_eq!(
            shape,
            vec![
                (
                    serde_json::json!(["A"]),
                    "````\n```rust\n# inside\n\n```\n````".to_string()
                ),
                (serde_json::json!(["B"]), "    ```".to_string()),
                (serde_json::json!(["B"]), "```a`b".to_string()),
                (serde_json::json!(["C"]), "c".to_string()),
            ]
        );
    }

    #[test]
    fn import_markdown_locators_slice_back_for_generated_text() {
        let pieces = [
            "a", "é", "😀", " ", "\n", "\n\n", "# ", "## ", "#", "```", "~~~", " \n", "\t",
        ];
        let mut seed: u64 = 0x2545f4914f6cdd1d;
        for _ in 0..500 {
            let mut text = String::new();
            for _ in 0..(seed % 50) {
                seed ^= seed << 13;
                seed ^= seed >> 7;
                seed ^= seed << 17;
                text.push_str(pieces[(seed % pieces.len() as u64) as usize]);
            }
            seed = seed.wrapping_add(1);
            let mut previous_end = 0;
            for passage in markdown_passages(&text) {
                let loc = locator(&passage);
                let (start, end) = (
                    loc["start"].as_u64().unwrap() as usize,
                    loc["end"].as_u64().unwrap() as usize,
                );
                assert!(start >= previous_end && start < end, "{text:?}");
                assert_eq!(
                    slice_chars(&text, &loc["start"], &loc["end"]),
                    passage.text,
                    "{text:?}"
                );
                assert!(!passage.text.trim().is_empty(), "{text:?}");
                previous_end = end;
            }
        }
    }
}
