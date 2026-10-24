use crate::documents::models::{
    Availability, Document, DocumentFormat, DocumentVersion, ExtractionStatus, NewPassage,
    NewVersion, Passage,
};
use chrono::{DateTime, SecondsFormat, Utc};
use sqlx::{SqliteConnection, SqliteExecutor, SqlitePool};
use uuid::Uuid;

pub async fn create_document(
    executor: impl SqliteExecutor<'_>,
    title: &str,
    format: DocumentFormat,
    now: DateTime<Utc>,
) -> Result<Document, sqlx::Error> {
    let document = Document {
        id: Uuid::new_v4().to_string(),
        title: title.to_string(),
        format,
        availability: Availability::Available,
        created_utc: format_utc(now),
    };
    sqlx::query(
        "INSERT INTO documents (id, title, format, availability, created_utc)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&document.id)
    .bind(&document.title)
    .bind(document.format)
    .bind(document.availability)
    .bind(&document.created_utc)
    .execute(executor)
    .await?;
    Ok(document)
}

pub async fn find_version_by_sha256(
    executor: impl SqliteExecutor<'_>,
    document_id: &str,
    sha256: &str,
) -> Result<Option<DocumentVersion>, sqlx::Error> {
    sqlx::query_as::<_, DocumentVersion>(
        "SELECT id, document_id, version, sha256, byte_size, char_count, parser_version,
             extraction_status, failure_code, managed_path, created_utc
         FROM document_versions WHERE document_id = ? AND sha256 = ?",
    )
    .bind(document_id)
    .bind(sha256)
    .fetch_optional(executor)
    .await
}

pub async fn create_version(
    conn: &mut SqliteConnection,
    document_id: &str,
    new: NewVersion,
    passages: Vec<NewPassage>,
    now: DateTime<Utc>,
) -> Result<DocumentVersion, sqlx::Error> {
    let version: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM document_versions WHERE document_id = ?",
    )
    .bind(document_id)
    .fetch_one(&mut *conn)
    .await?;
    let row = DocumentVersion {
        id: Uuid::new_v4().to_string(),
        document_id: document_id.to_string(),
        version,
        sha256: new.sha256,
        byte_size: new.byte_size,
        char_count: new.char_count,
        parser_version: new.parser_version,
        extraction_status: new.extraction_status,
        failure_code: new.failure_code,
        managed_path: new.managed_path,
        created_utc: format_utc(now),
    };
    sqlx::query(
        "INSERT INTO document_versions (id, document_id, version, sha256, byte_size, char_count,
             parser_version, extraction_status, failure_code, managed_path, created_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&row.id)
    .bind(&row.document_id)
    .bind(row.version)
    .bind(&row.sha256)
    .bind(row.byte_size)
    .bind(row.char_count)
    .bind(&row.parser_version)
    .bind(row.extraction_status)
    .bind(&row.failure_code)
    .bind(&row.managed_path)
    .bind(&row.created_utc)
    .execute(&mut *conn)
    .await?;
    for (ordinal, passage) in passages.into_iter().enumerate() {
        sqlx::query(
            "INSERT INTO document_passages (id, version_id, ordinal, locator_json, text, content_hash)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&row.id)
        .bind(ordinal as i64)
        .bind(passage.locator_json)
        .bind(passage.text)
        .bind(passage.content_hash)
        .execute(&mut *conn)
        .await?;
    }
    Ok(row)
}

pub async fn list_passages(
    pool: &SqlitePool,
    version_id: &str,
) -> Result<Vec<Passage>, sqlx::Error> {
    sqlx::query_as::<_, Passage>(
        "SELECT id, version_id, ordinal, locator_json, text, content_hash
         FROM document_passages WHERE version_id = ? ORDER BY ordinal",
    )
    .bind(version_id)
    .fetch_all(pool)
    .await
}

fn format_utc(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::test_support::migrated_pool;

    const SHA_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const SHA_B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    fn new_version(sha256: &str) -> NewVersion {
        NewVersion {
            sha256: sha256.to_string(),
            byte_size: 12,
            char_count: 12,
            parser_version: "test-1".to_string(),
            extraction_status: ExtractionStatus::Extracted,
            failure_code: None,
            managed_path: None,
        }
    }

    fn passage(locator_json: &str, text: &str) -> NewPassage {
        NewPassage {
            locator_json: locator_json.to_string(),
            text: text.to_string(),
            content_hash: format!("hash-{text}"),
        }
    }

    async fn version_with(
        pool: &SqlitePool,
        document_id: &str,
        sha256: &str,
        passages: Vec<NewPassage>,
    ) -> Result<DocumentVersion, sqlx::Error> {
        let mut conn = pool.acquire().await.expect("connection");
        create_version(
            &mut conn,
            document_id,
            new_version(sha256),
            passages,
            Utc::now(),
        )
        .await
    }

    async fn document(pool: &SqlitePool) -> Document {
        create_document(pool, "Notes", DocumentFormat::Markdown, Utc::now())
            .await
            .expect("document")
    }

    #[tokio::test]
    async fn documents_migrations_apply_and_versions_are_numbered_per_document() {
        let pool = migrated_pool().await;
        let doc = document(&pool).await;
        let first = version_with(&pool, &doc.id, SHA_A, vec![])
            .await
            .expect("first version");
        let second = version_with(&pool, &doc.id, SHA_B, vec![])
            .await
            .expect("second version");
        assert_eq!((first.version, second.version), (1, 2));
        assert_eq!(doc.availability, Availability::Available);
    }

    #[tokio::test]
    async fn documents_refuse_two_versions_with_the_same_sha256() {
        let pool = migrated_pool().await;
        let doc = document(&pool).await;
        version_with(&pool, &doc.id, SHA_A, vec![])
            .await
            .expect("first version");
        let error = version_with(&pool, &doc.id, SHA_A, vec![])
            .await
            .expect_err("duplicate sha256");
        assert!(error.to_string().contains("UNIQUE"), "{error}");
    }

    #[tokio::test]
    async fn documents_freeze_a_versions_sha256_and_byte_size() {
        let pool = migrated_pool().await;
        let doc = document(&pool).await;
        let version = version_with(&pool, &doc.id, SHA_A, vec![])
            .await
            .expect("version");
        for statement in [
            "UPDATE document_versions SET sha256 = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' WHERE id = ?",
            "UPDATE document_versions SET byte_size = 99 WHERE id = ?",
        ] {
            let error = sqlx::query(statement)
                .bind(&version.id)
                .execute(&pool)
                .await
                .expect_err("frozen column");
            assert!(
                error.to_string().contains("document_versions content is frozen"),
                "{error}"
            );
        }
        sqlx::query("UPDATE document_versions SET extraction_status = 'failed' WHERE id = ?")
            .bind(&version.id)
            .execute(&pool)
            .await
            .expect("status stays mutable");
    }

    #[tokio::test]
    async fn documents_freeze_passage_text() {
        let pool = migrated_pool().await;
        let doc = document(&pool).await;
        let version = version_with(
            &pool,
            &doc.id,
            SHA_A,
            vec![passage(r#"{"line":1}"#, "Hello")],
        )
        .await
        .expect("version");
        let error =
            sqlx::query("UPDATE document_passages SET text = 'Changed' WHERE version_id = ?")
                .bind(&version.id)
                .execute(&pool)
                .await
                .expect_err("frozen text");
        assert!(
            error
                .to_string()
                .contains("document_passages text is frozen"),
            "{error}"
        );
    }

    #[tokio::test]
    async fn documents_passages_load_in_ordinal_order_with_locators_intact() {
        let pool = migrated_pool().await;
        let doc = document(&pool).await;
        let version = version_with(&pool, &doc.id, SHA_A, vec![])
            .await
            .expect("version");
        let locators = [
            r#"{"heading":["Intro"],"line_start":1,"line_end":2}"#,
            r#"{"heading":["Intro","Détails"],"line_start":3,"line_end":7}"#,
            r#"{"line_start":8,"line_end":8}"#,
        ];
        for (ordinal, text) in [(2, "three"), (0, "one"), (1, "two")] {
            sqlx::query(
                "INSERT INTO document_passages (id, version_id, ordinal, locator_json, text, content_hash)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(format!("passage-{ordinal}"))
            .bind(&version.id)
            .bind(ordinal)
            .bind(locators[ordinal as usize])
            .bind(text)
            .bind(format!("hash-{text}"))
            .execute(&pool)
            .await
            .expect("out-of-order passage");
        }

        let loaded = list_passages(&pool, &version.id).await.expect("list");
        let summary: Vec<(i64, &str, &str)> = loaded
            .iter()
            .map(|p| (p.ordinal, p.locator_json.as_str(), p.text.as_str()))
            .collect();
        assert_eq!(
            summary,
            vec![
                (0, locators[0], "one"),
                (1, locators[1], "two"),
                (2, locators[2], "three"),
            ]
        );
    }

    #[tokio::test]
    async fn documents_create_version_numbers_passages_in_input_order() {
        let pool = migrated_pool().await;
        let doc = document(&pool).await;
        let version = version_with(
            &pool,
            &doc.id,
            SHA_A,
            vec![passage(r#"{"line":1}"#, "a"), passage(r#"{"line":2}"#, "b")],
        )
        .await
        .expect("version");

        let loaded = list_passages(&pool, &version.id).await.expect("list");
        let summary: Vec<(i64, &str)> = loaded
            .iter()
            .map(|p| (p.ordinal, p.text.as_str()))
            .collect();
        assert_eq!(summary, vec![(0, "a"), (1, "b")]);
    }
}
