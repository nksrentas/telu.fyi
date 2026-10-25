use crate::documents::limits::{ensure_passage_count, ensure_source_chars};
use crate::documents::models::{ExtractionStatus, NewPassage};
use anyhow::{bail, Result};

const EXTRACTION_FAILED: &str = "EXTRACTION_FAILED";

pub(super) struct Extraction {
    pub char_count: usize,
    pub passages: Vec<NewPassage>,
    pub status: ExtractionStatus,
    pub failure_code: Option<String>,
    pub normalised: Option<String>,
}

pub(super) fn extract(bytes: &[u8], split: impl Fn(&str) -> Vec<NewPassage>) -> Result<Extraction> {
    let Some(text) = decode(bytes) else {
        return Ok(Extraction {
            char_count: 0,
            passages: Vec::new(),
            status: ExtractionStatus::Failed,
            failure_code: Some(EXTRACTION_FAILED.to_string()),
            normalised: None,
        });
    };
    let normalised = normalise(text);
    let char_count = normalised.chars().count();
    ensure_source_chars(char_count)?;
    let passages = split(&normalised);
    if passages.is_empty() {
        bail!("EMPTY_SOURCE");
    }
    ensure_passage_count(passages.len())?;
    Ok(Extraction {
        char_count,
        passages,
        status: ExtractionStatus::Extracted,
        failure_code: None,
        normalised: Some(normalised),
    })
}

fn decode(bytes: &[u8]) -> Option<&str> {
    std::str::from_utf8(bytes)
        .ok()
        .filter(|text| !text.contains('\0'))
}

pub(super) fn normalise(text: &str) -> String {
    text.strip_prefix('\u{feff}')
        .unwrap_or(text)
        .replace("\r\n", "\n")
        .replace('\r', "\n")
}

#[cfg(test)]
mod tests {
    use crate::documents::import::{import_file, import_file_into};
    use crate::documents::ingest::ingest_text;
    use crate::documents::models::{DocumentVersion, ExtractionStatus};
    use crate::documents::repository::get_document;
    use crate::documents::repository::list_passages;
    use crate::knowledge::test_support::migrated_pool;
    use chrono::Utc;
    use serde_json::Value;
    use sqlx::SqlitePool;
    use tempfile::TempDir;

    const GREEK: &str = "Καλημέρα κόσμε";
    const EMOJI: &str = "Launch 🚀👩‍💻 today";
    const COMBINING: &str = "Cafe\u{301} nai\u{308}ve";
    const TURKISH: &str = "İstanbul ıi İI";

    async fn assert_locators_slice_back(
        pool: &SqlitePool,
        version: &DocumentVersion,
        normalised: &str,
    ) {
        let passages = list_passages(pool, &version.id).await.expect("passages");
        assert!(!passages.is_empty());
        for passage in &passages {
            let locator: Value = serde_json::from_str(&passage.locator_json).unwrap();
            let start = locator["start"].as_u64().unwrap() as usize;
            let end = locator["end"].as_u64().unwrap() as usize;
            let slice: String = normalised.chars().skip(start).take(end - start).collect();
            assert_eq!(slice, passage.text);
        }
        assert_eq!(version.char_count, normalised.chars().count() as i64);
    }

    fn texts(passages: &[crate::documents::models::Passage]) -> Vec<&str> {
        passages.iter().map(|p| p.text.as_str()).collect()
    }

    fn import_source(dir: &TempDir, name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = dir.path().join(name);
        std::fs::write(&path, bytes).expect("write source");
        path
    }

    #[tokio::test]
    async fn encoding_paste_keeps_character_locators_for_each_script() {
        let pool = migrated_pool().await;
        for sample in [GREEK, EMOJI, COMBINING, TURKISH] {
            let text = format!("Intro {sample}\n\n{sample} {sample}\n\nEnd {sample}");
            let version = ingest_text(&pool, "Sample", &text, Utc::now())
                .await
                .expect("paste");
            assert_locators_slice_back(&pool, &version, &text).await;
            let passages = list_passages(&pool, &version.id).await.unwrap();
            let last: Value = serde_json::from_str(&passages[2].locator_json).unwrap();
            assert_eq!(
                last["start"].as_u64().unwrap() as usize,
                text.chars().count() - format!("End {sample}").chars().count()
            );
        }
    }

    #[tokio::test]
    async fn encoding_import_strips_the_bom_and_normalises_crlf_and_lone_cr() {
        let pool = migrated_pool().await;
        let dir = TempDir::new().unwrap();
        let raw = format!("\u{feff}# {GREEK}\r\n{EMOJI}\r{COMBINING}\r\r{TURKISH}\r\n\r\nLast");
        let normalised = format!("# {GREEK}\n{EMOJI}\n{COMBINING}\n\n{TURKISH}\n\nLast");
        let source = import_source(&dir, "mixed.md", raw.as_bytes());

        let version = import_file(&pool, dir.path(), &source, Utc::now())
            .await
            .expect("import");

        assert_eq!(version.extraction_status, ExtractionStatus::Extracted);
        assert_locators_slice_back(&pool, &version, &normalised).await;
        let passages = list_passages(&pool, &version.id).await.unwrap();
        assert_eq!(
            texts(&passages),
            vec![format!("{EMOJI}\n{COMBINING}").as_str(), TURKISH, "Last"]
        );
        assert!(passages
            .iter()
            .all(|p| !p.text.contains(['\r', '\u{feff}'])));
    }

    #[tokio::test]
    async fn encoding_paste_normalises_lone_cr_into_paragraphs() {
        let pool = migrated_pool().await;
        let version = ingest_text(&pool, "Notes", "\u{feff}One\rtwo\r\rThree", Utc::now())
            .await
            .expect("paste");
        assert_locators_slice_back(&pool, &version, "One\ntwo\n\nThree").await;
        let passages = list_passages(&pool, &version.id).await.unwrap();
        assert_eq!(texts(&passages), vec!["One\ntwo", "Three"]);
    }

    #[tokio::test]
    async fn encoding_invalid_utf8_or_nul_marks_the_import_failed_without_passages() {
        let pool = migrated_pool().await;
        let dir = TempDir::new().unwrap();
        let cases: [(&str, &[u8]); 3] = [
            ("latin1.txt", b"Caf\xe9 agenda"),
            ("truncated.md", b"# Plan\n\nemoji \xf0\x9f\x9a"),
            ("nul.txt", b"Before\0after"),
        ];
        for (name, bytes) in cases {
            let source = import_source(&dir, name, bytes);
            let version = import_file(&pool, dir.path(), &source, Utc::now())
                .await
                .expect("stored as failed");
            assert_eq!(
                version.extraction_status,
                ExtractionStatus::Failed,
                "{name}"
            );
            assert_eq!(version.failure_code.as_deref(), Some("EXTRACTION_FAILED"));
            assert_eq!(version.byte_size, bytes.len() as i64);
            assert!(list_passages(&pool, &version.id).await.unwrap().is_empty());
            let managed = dir.path().join(version.managed_path.as_deref().unwrap());
            assert_eq!(std::fs::read(managed).unwrap(), bytes);
        }
    }

    #[tokio::test]
    async fn encoding_replacing_with_invalid_utf8_adds_a_failed_version_and_keeps_the_first() {
        let pool = migrated_pool().await;
        let dir = TempDir::new().unwrap();
        let good = import_source(&dir, "plan.txt", b"First plan");
        let first = import_file(&pool, dir.path(), &good, Utc::now())
            .await
            .unwrap();
        let document = get_document(&pool, &first.document_id)
            .await
            .unwrap()
            .unwrap();
        let bad = import_source(&dir, "plan-v2.txt", b"Second \xff plan");

        let second = import_file_into(&pool, dir.path(), &document, &bad, Utc::now())
            .await
            .expect("stored as failed");

        assert_eq!(
            (second.version, second.extraction_status),
            (2, ExtractionStatus::Failed)
        );
        assert!(list_passages(&pool, &second.id).await.unwrap().is_empty());
        let kept = list_passages(&pool, &first.id).await.unwrap();
        assert_eq!(texts(&kept), vec!["First plan"]);
    }

    #[tokio::test]
    async fn encoding_pasted_nul_marks_the_version_failed_without_passages() {
        let pool = migrated_pool().await;
        let version = ingest_text(&pool, "Notes", "Before\0after\n\nMore", Utc::now())
            .await
            .expect("stored as failed");
        assert_eq!(version.extraction_status, ExtractionStatus::Failed);
        assert_eq!(version.failure_code.as_deref(), Some("EXTRACTION_FAILED"));
        assert!(list_passages(&pool, &version.id).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn encoding_empty_and_whitespace_only_sources_are_refused() {
        let pool = migrated_pool().await;
        let dir = TempDir::new().unwrap();
        let cases: [(&str, &[u8]); 3] = [
            ("zero.txt", b""),
            ("blank.md", " \r\n\t\r\u{3000}\n".as_bytes()),
            ("bom.txt", "\u{feff}".as_bytes()),
        ];
        for (name, bytes) in cases {
            let source = import_source(&dir, name, bytes);
            let error = import_file(&pool, dir.path(), &source, Utc::now())
                .await
                .expect_err("refused");
            assert_eq!(error.to_string(), "EMPTY_SOURCE", "{name}");
        }
        for text in ["", " \r\n\t\r\u{a0}\n", "\u{feff}"] {
            let error = ingest_text(&pool, "Blank", text, Utc::now())
                .await
                .expect_err("refused");
            assert_eq!(error.to_string(), "EMPTY_SOURCE", "{text:?}");
        }
        let documents: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM documents")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(documents, 0);
        let folder = dir.path().join("documents");
        assert!(!folder.exists() || std::fs::read_dir(&folder).unwrap().next().is_none());
    }
}
