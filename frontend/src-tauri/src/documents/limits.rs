use anyhow::{bail, Result};

pub const MAX_SOURCE_BYTES: u64 = 1024 * 1024;
pub const MAX_SOURCE_CHARS: usize = 200_000;
pub const MAX_PASSAGES: usize = 2_000;
pub const MAX_PASSAGE_CHARS: usize = 4_000;
const SENTENCE_ENDS: [char; 3] = ['.', '!', '?'];

pub(super) fn ensure_source_bytes(bytes: u64) -> Result<()> {
    refuse_over(bytes > MAX_SOURCE_BYTES, "MAX_SOURCE_BYTES")
}

pub(super) fn ensure_source_chars(chars: usize) -> Result<()> {
    refuse_over(chars > MAX_SOURCE_CHARS, "MAX_SOURCE_CHARS")
}

pub(super) fn ensure_passage_count(passages: usize) -> Result<()> {
    refuse_over(passages > MAX_PASSAGES, "MAX_PASSAGES")
}

fn refuse_over(over: bool, limit: &str) -> Result<()> {
    if over {
        bail!("SOURCE_TOO_LARGE:{limit}");
    }
    Ok(())
}

pub(super) fn split_span(chars: &[char], start: usize, end: usize) -> Vec<(usize, usize)> {
    let mut pieces = Vec::new();
    let mut open = start;
    while end - open > MAX_PASSAGE_CHARS {
        let cut = cut_before_cap(chars, open);
        pieces.push((open, cut));
        open = cut;
    }
    pieces.push((open, end));
    pieces
}

fn cut_before_cap(chars: &[char], open: usize) -> usize {
    let cap = open + MAX_PASSAGE_CHARS;
    let after_whitespace = |cut: &usize| chars[cut - 1].is_whitespace();
    let candidates = || (open + 2..=cap).rev().filter(after_whitespace);
    candidates()
        .find(|cut| SENTENCE_ENDS.contains(&chars[cut - 2]))
        .or_else(|| candidates().next())
        .unwrap_or(cap)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::import::import_file;
    use crate::documents::ingest::ingest_text;
    use crate::documents::repository::list_passages;
    use crate::knowledge::test_support::migrated_pool;
    use chrono::Utc;
    use serde_json::Value;
    use sqlx::SqlitePool;
    use tempfile::TempDir;

    async fn assert_tables_empty(pool: &SqlitePool) {
        for table in ["documents", "document_versions", "document_passages"] {
            let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_one(pool)
                .await
                .expect("count");
            assert_eq!(count, 0, "{table}");
        }
    }

    fn spans(passages: &[crate::documents::models::Passage]) -> Vec<(u64, u64)> {
        passages
            .iter()
            .map(|passage| {
                let locator: Value = serde_json::from_str(&passage.locator_json).unwrap();
                (
                    locator["start"].as_u64().unwrap(),
                    locator["end"].as_u64().unwrap(),
                )
            })
            .collect()
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn limits_refuse_an_oversized_file_by_its_metadata_without_reading_it() {
        use std::os::unix::fs::PermissionsExt;
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        let source = app_data.path().join("big.md");
        let file = std::fs::File::create(&source).expect("create");
        file.set_len(1024 * 1024 + 1).expect("set_len");
        std::fs::set_permissions(&source, std::fs::Permissions::from_mode(0o000)).expect("chmod");

        let error = import_file(&pool, app_data.path(), &source, Utc::now())
            .await
            .expect_err("too large");

        assert_eq!(error.to_string(), "SOURCE_TOO_LARGE:MAX_SOURCE_BYTES");
        assert!(!app_data.path().join("documents").exists());
        assert_tables_empty(&pool).await;
    }

    #[tokio::test]
    async fn limits_refuse_a_file_under_the_byte_limit_with_too_many_characters() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        let source = app_data.path().join("full.txt");
        let paragraph = format!("{}\n\n", "a".repeat(98));
        std::fs::write(&source, paragraph.repeat(1024 * 1024 / 100)).expect("write");

        let error = import_file(&pool, app_data.path(), &source, Utc::now())
            .await
            .expect_err("too many chars");

        assert_eq!(error.to_string(), "SOURCE_TOO_LARGE:MAX_SOURCE_CHARS");
        assert_tables_empty(&pool).await;
    }

    #[tokio::test]
    async fn limits_refuse_pasted_text_over_the_character_limit() {
        let pool = migrated_pool().await;
        let at_limit = "é".repeat(200_000);
        ingest_text(&pool, "Notes", &at_limit, Utc::now())
            .await
            .expect("at the limit");

        let pool = migrated_pool().await;
        let error = ingest_text(&pool, "Notes", &"é".repeat(200_001), Utc::now())
            .await
            .expect_err("over");
        assert_eq!(error.to_string(), "SOURCE_TOO_LARGE:MAX_SOURCE_CHARS");
        assert_tables_empty(&pool).await;
    }

    #[tokio::test]
    async fn limits_refuse_more_than_two_thousand_passages() {
        let pool = migrated_pool().await;
        ingest_text(&pool, "Notes", &"a\n\n".repeat(2_000), Utc::now())
            .await
            .expect("at the limit");

        let pool = migrated_pool().await;
        let error = ingest_text(&pool, "Notes", &"a\n\n".repeat(2_001), Utc::now())
            .await
            .expect_err("over");
        assert_eq!(error.to_string(), "SOURCE_TOO_LARGE:MAX_PASSAGES");
        assert_tables_empty(&pool).await;
    }

    #[tokio::test]
    async fn limits_split_a_nine_thousand_character_paragraph_into_three_contiguous_passages() {
        let pool = migrated_pool().await;
        let sentence = format!("{}. ", "w".repeat(98));
        let paragraph = sentence.repeat(90);
        assert_eq!(paragraph.chars().count(), 9_000);

        let version = ingest_text(&pool, "Notes", &paragraph, Utc::now())
            .await
            .expect("ingest");
        let passages = list_passages(&pool, &version.id).await.expect("passages");

        assert_eq!(
            spans(&passages),
            vec![(0, 4_000), (4_000, 8_000), (8_000, 9_000)]
        );
        let indexes: Vec<Value> = passages
            .iter()
            .map(|p| serde_json::from_str::<Value>(&p.locator_json).unwrap()["index"].clone())
            .collect();
        assert_eq!(indexes, vec![0, 1, 2]);
        let joined: String = passages.iter().map(|p| p.text.as_str()).collect();
        assert_eq!(joined, paragraph);
        assert!(passages[0].text.ends_with(". "));
    }

    #[tokio::test]
    async fn limits_split_markdown_sections_with_consecutive_paragraph_locators() {
        let pool = migrated_pool().await;
        let app_data = TempDir::new().expect("tempdir");
        let source = app_data.path().join("long.md");
        let body = "word ".repeat(1_800);
        std::fs::write(&source, format!("# Plan\n{}\n\nTail", body.trim_end())).expect("write");

        let version = import_file(&pool, app_data.path(), &source, Utc::now())
            .await
            .expect("import");
        let passages = list_passages(&pool, &version.id).await.expect("passages");

        assert_eq!(
            spans(&passages),
            vec![(7, 4_007), (4_007, 8_007), (8_007, 9_006), (9_008, 9_012)]
        );
        let paragraphs: Vec<Value> = passages
            .iter()
            .map(|p| serde_json::from_str::<Value>(&p.locator_json).unwrap()["paragraph"].clone())
            .collect();
        assert_eq!(paragraphs, vec![0, 1, 2, 3]);
    }

    #[test]
    fn limits_split_falls_back_to_whitespace_then_a_hard_cut() {
        let words: Vec<char> = format!("{} b", "a".repeat(4_500)).chars().collect();
        assert_eq!(
            split_span(&words, 0, words.len()),
            vec![(0, 4_000), (4_000, 4_502)]
        );

        let spaced: Vec<char> = format!("{} {}", "a".repeat(3_000), "b".repeat(3_000))
            .chars()
            .collect();
        assert_eq!(
            split_span(&spaced, 0, spaced.len()),
            vec![(0, 3_001), (3_001, 6_001)]
        );
    }

    #[test]
    fn limits_split_pieces_cover_generated_paragraphs_exactly() {
        let pieces = ["a", "é", "😀", " ", ". ", "!", "\n", "word "];
        let mut seed: u64 = 0x2545f4914f6cdd1d;
        for _ in 0..200 {
            let mut text = String::from("x");
            for _ in 0..(seed % 12_000) {
                seed ^= seed << 13;
                seed ^= seed >> 7;
                seed ^= seed << 17;
                text.push_str(pieces[(seed % pieces.len() as u64) as usize]);
            }
            seed = seed.wrapping_add(1);
            let chars: Vec<char> = text.chars().collect();
            let split = split_span(&chars, 0, chars.len());
            let mut expected_start = 0;
            for (start, end) in &split {
                assert_eq!(*start, expected_start);
                assert!(start < end && end - start <= MAX_PASSAGE_CHARS);
                expected_start = *end;
            }
            assert_eq!(expected_start, chars.len());
        }
    }
}
