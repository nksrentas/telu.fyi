use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum DocumentFormat {
    Text,
    Markdown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum Availability {
    Available,
    Deleted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum ExtractionStatus {
    Pending,
    Extracted,
    Failed,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub title: String,
    pub format: DocumentFormat,
    pub availability: Availability,
    pub created_utc: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVersion {
    pub id: String,
    pub document_id: String,
    pub version: i64,
    pub sha256: String,
    pub byte_size: i64,
    pub char_count: i64,
    pub parser_version: String,
    pub extraction_status: ExtractionStatus,
    pub failure_code: Option<String>,
    pub managed_path: Option<String>,
    pub created_utc: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub id: String,
    pub title: String,
    pub format: DocumentFormat,
    pub availability: Availability,
    pub created_utc: String,
    pub latest_version_id: String,
    pub latest_version: i64,
    pub extraction_status: ExtractionStatus,
    pub failure_code: Option<String>,
    pub byte_size: i64,
}

pub struct NewVersion {
    pub sha256: String,
    pub byte_size: i64,
    pub char_count: i64,
    pub parser_version: String,
    pub extraction_status: ExtractionStatus,
    pub failure_code: Option<String>,
    pub managed_path: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Passage {
    pub id: String,
    pub version_id: String,
    pub ordinal: i64,
    pub locator_json: String,
    pub text: String,
    pub content_hash: String,
}

pub struct NewPassage {
    pub locator_json: String,
    pub text: String,
    pub content_hash: String,
}
