use crate::documents::encoding::extract;
use crate::documents::limits::split_span;
use crate::documents::models::{DocumentFormat, DocumentVersion, NewPassage, NewVersion};
use crate::documents::repository;
use anyhow::{bail, Result};
use chrono::{DateTime, Utc};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

const PASTE_PARSER_VERSION: &str = "paste-text-1";

pub async fn ingest_text(
    pool: &SqlitePool,
    title: &str,
    text: &str,
    now: DateTime<Utc>,
) -> Result<DocumentVersion> {
    let prepared = prepare(text)?;
    let mut tx = pool.begin().await?;
    let document = repository::create_document(&mut *tx, title, DocumentFormat::Text, now).await?;
    let version = repository::create_version(
        &mut tx,
        &document.id,
        prepared.version,
        prepared.passages,
        now,
    )
    .await?;
    tx.commit().await?;
    Ok(version)
}

pub async fn ingest_text_into(
    pool: &SqlitePool,
    document_id: &str,
    text: &str,
    now: DateTime<Utc>,
) -> Result<DocumentVersion> {
    let prepared = prepare(text)?;
    let mut tx = pool.begin().await?;
    if !repository::is_available(&mut *tx, document_id).await? {
        bail!("DOCUMENT_NOT_FOUND");
    }
    if let Some(existing) =
        repository::find_version_by_sha256(&mut *tx, document_id, &prepared.version.sha256).await?
    {
        return Ok(existing);
    }
    let version = repository::create_version(
        &mut tx,
        document_id,
        prepared.version,
        prepared.passages,
        now,
    )
    .await?;
    tx.commit().await?;
    Ok(version)
}

struct Prepared {
    version: NewVersion,
    passages: Vec<NewPassage>,
}

fn prepare(text: &str) -> Result<Prepared> {
    let extraction = extract(text.as_bytes(), paragraph_passages)?;
    let stored = extraction.normalised.as_deref().unwrap_or(text);
    let (sha256, byte_size) = (sha256_hex(stored.as_bytes()), stored.len() as i64);
    Ok(Prepared {
        version: NewVersion {
            sha256,
            byte_size,
            char_count: extraction.char_count as i64,
            parser_version: PASTE_PARSER_VERSION.to_string(),
            extraction_status: extraction.status,
            failure_code: extraction.failure_code,
            managed_path: None,
        },
        passages: extraction.passages,
    })
}

pub(super) fn paragraph_passages(text: &str) -> Vec<NewPassage> {
    let chars: Vec<char> = text.chars().collect();
    paragraph_spans(text)
        .into_iter()
        .flat_map(|(start, end)| split_span(&chars, start, end))
        .enumerate()
        .map(|(index, (start, end))| {
            passage(
                &chars,
                json!({"kind": "paragraph", "index": index, "start": start, "end": end}),
                start,
                end,
            )
        })
        .collect()
}

pub(super) fn passage(
    chars: &[char],
    locator: serde_json::Value,
    start: usize,
    end: usize,
) -> NewPassage {
    let text: String = chars[start..end].iter().collect();
    NewPassage {
        locator_json: locator.to_string(),
        content_hash: sha256_hex(text.as_bytes()),
        text,
    }
}

fn paragraph_spans(text: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut current: Option<(usize, usize)> = None;
    let mut offset = 0;
    for line in text.split('\n') {
        let line_end = offset + line.chars().count();
        if line.trim().is_empty() {
            spans.extend(current.take());
        } else {
            current = Some((current.map_or(offset, |(start, _)| start), line_end));
        }
        offset = line_end + 1;
    }
    spans.extend(current);
    spans
}

pub(super) fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::encoding::normalise;
    use crate::documents::repository::list_passages;
    use crate::knowledge::test_support::migrated_pool;

    fn slice_chars(text: &str, start: usize, end: usize) -> String {
        text.chars().skip(start).take(end - start).collect()
    }

    fn locator(passage: &crate::documents::models::Passage) -> serde_json::Value {
        serde_json::from_str(&passage.locator_json).expect("locator json")
    }

    #[tokio::test]
    async fn ingest_three_paragraphs_give_three_passages_whose_locators_slice_back() {
        let pool = migrated_pool().await;
        let raw = "\u{feff}Café agenda\r\nline two\r\n\r\nSecond — ünïcode\r\n \r\n\r\nThird";
        let normalised = "Café agenda\nline two\n\nSecond — ünïcode\n \n\nThird";
        let version = ingest_text(&pool, "Notes", raw, Utc::now())
            .await
            .expect("ingest");

        let passages = list_passages(&pool, &version.id).await.expect("passages");
        let texts: Vec<&str> = passages.iter().map(|p| p.text.as_str()).collect();
        assert_eq!(
            texts,
            vec!["Café agenda\nline two", "Second — ünïcode", "Third"]
        );
        let mut spans = Vec::new();
        for (index, passage) in passages.iter().enumerate() {
            let loc = locator(passage);
            assert_eq!(loc["kind"], "paragraph");
            assert_eq!(loc["index"], index);
            let (start, end) = (
                loc["start"].as_u64().unwrap() as usize,
                loc["end"].as_u64().unwrap() as usize,
            );
            assert_eq!(slice_chars(normalised, start, end), passage.text);
            spans.push((start, end));
        }
        assert_eq!(spans, vec![(0, 20), (22, 38), (42, 47)]);
        assert_eq!(
            (version.version, version.char_count, version.byte_size),
            (1, 47, 52)
        );
        assert_eq!(
            version.sha256,
            "7a4301b97c9cbf10e117df7bd6c58aa04b29a7920c26d4321049dfd0a56405f2"
        );
    }

    #[tokio::test]
    async fn ingest_the_same_text_twice_keeps_one_version() {
        let pool = migrated_pool().await;
        let first = ingest_text(&pool, "Notes", "One\n\nTwo", Utc::now())
            .await
            .expect("first");
        let again = ingest_text_into(&pool, &first.document_id, "One\r\n\r\nTwo", Utc::now())
            .await
            .expect("again");
        assert_eq!(again.id, first.id);
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM document_versions")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn ingest_text_that_differs_by_one_character_yields_version_two() {
        let pool = migrated_pool().await;
        let first = ingest_text(&pool, "Notes", "One\n\nTwo", Utc::now())
            .await
            .expect("first");
        let second = ingest_text_into(&pool, &first.document_id, "One\n\nTwo!", Utc::now())
            .await
            .expect("second");
        assert_eq!(
            (second.document_id.as_str(), second.version),
            (first.document_id.as_str(), 2)
        );
        let passages = list_passages(&pool, &second.id).await.expect("passages");
        assert_eq!(passages.last().map(|p| p.text.as_str()), Some("Two!"));
    }

    #[tokio::test]
    async fn ingest_refuses_text_without_a_paragraph() {
        let pool = migrated_pool().await;
        let error = ingest_text(&pool, "Notes", "\u{feff} \r\n\t\n", Utc::now())
            .await
            .expect_err("empty");
        assert_eq!(error.to_string(), "EMPTY_SOURCE");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM documents")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(count, 0);
    }

    #[test]
    fn ingest_locators_slice_back_for_generated_text() {
        let pieces = [
            "a", "é", "—", "😀", "e\u{301}", "İ", " ", "\t", "\n", "\r", "\r\n", "\n\n", " \n",
        ];
        let mut seed: u64 = 0x9e3779b97f4a7c15;
        for _ in 0..500 {
            let mut raw = String::new();
            for _ in 0..(seed % 40) {
                seed ^= seed << 13;
                seed ^= seed >> 7;
                seed ^= seed << 17;
                raw.push_str(pieces[(seed % pieces.len() as u64) as usize]);
            }
            seed = seed.wrapping_add(1);
            let normalised = normalise(&raw);
            let Ok(prepared) = prepare(&raw) else {
                assert!(normalised.trim().is_empty(), "{raw:?}");
                continue;
            };
            let mut previous_end = 0;
            for passage in &prepared.passages {
                let loc: serde_json::Value = serde_json::from_str(&passage.locator_json).unwrap();
                let (start, end) = (
                    loc["start"].as_u64().unwrap() as usize,
                    loc["end"].as_u64().unwrap() as usize,
                );
                assert!(start >= previous_end && start < end, "{raw:?}");
                assert_eq!(
                    slice_chars(&normalised, start, end),
                    passage.text,
                    "{raw:?}"
                );
                assert!(
                    passage.text.split('\n').all(|line| !line.trim().is_empty()),
                    "{raw:?}"
                );
                previous_end = end;
            }
            let visible = |text: &str| {
                text.chars()
                    .filter(|c| !c.is_whitespace())
                    .collect::<String>()
            };
            let covered: String = prepared.passages.iter().map(|p| visible(&p.text)).collect();
            assert_eq!(covered, visible(&normalised), "{raw:?}");
        }
    }
}
