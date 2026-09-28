use crate::database::models::CaptureCompleteness;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum KnowledgeType {
    Decision,
    Commitment,
    Question,
    Fact,
}

impl KnowledgeType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Decision => "decision",
            Self::Commitment => "commitment",
            Self::Question => "question",
            Self::Fact => "fact",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "decision" => Some(Self::Decision),
            "commitment" => Some(Self::Commitment),
            "question" => Some(Self::Question),
            "fact" => Some(Self::Fact),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum RunStatus {
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

impl RunStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum TriggerKind {
    Auto,
    User,
    Regenerate,
}

impl TriggerKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::User => "user",
            Self::Regenerate => "regenerate",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum Support {
    Stated,
    NotStated,
}

impl Support {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Stated => "stated",
            Self::NotStated => "not_stated",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum EvidenceRole {
    Claim,
    Owner,
    Due,
}

impl EvidenceRole {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Claim => "claim",
            Self::Owner => "owner",
            Self::Due => "due",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum AbstentionReason {
    UnknownSegment,
    QuoteNotFound,
    EmptyText,
    InvalidType,
    MalformedItem,
}

impl AbstentionReason {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::UnknownSegment => "unknown_segment",
            Self::QuoteNotFound => "quote_not_found",
            Self::EmptyText => "empty_text",
            Self::InvalidType => "invalid_type",
            Self::MalformedItem => "malformed_item",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewState {
    Proposed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KnowledgeError {
    InvalidRequest,
    MeetingNotFound,
    MeetingNotReady,
    NoEvidence,
    RunInProgress,
    Route(String),
    Storage,
}

impl KnowledgeError {
    pub fn code(&self) -> &str {
        match self {
            Self::InvalidRequest => "KNOWLEDGE_INVALID_REQUEST",
            Self::MeetingNotFound => "KNOWLEDGE_MEETING_NOT_FOUND",
            Self::MeetingNotReady => "KNOWLEDGE_MEETING_NOT_READY",
            Self::NoEvidence => "KNOWLEDGE_NO_EVIDENCE",
            Self::RunInProgress => "KNOWLEDGE_RUN_IN_PROGRESS",
            Self::Route(code) => code,
            Self::Storage => "KNOWLEDGE_STORAGE_FAILED",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeRunView {
    pub run_id: String,
    pub meeting_id: String,
    pub trigger_kind: TriggerKind,
    pub status: RunStatus,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: String,
    pub sanitized_origin: String,
    pub prompt_version: String,
    pub input_evidence_count: i64,
    pub proposed_count: i64,
    pub skipped_count: i64,
    pub suppressed_count: i64,
    pub reconfirmed_count: i64,
    pub failure_code: Option<String>,
    pub started_at_utc: String,
    pub finished_at_utc: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceLinkView {
    pub link_id: String,
    pub evidence_id: String,
    pub role: EvidenceRole,
    pub quote_text: String,
    pub raw_start: i64,
    pub raw_end: i64,
    pub sequence: i64,
    pub audio_start_time: f64,
    pub audio_end_time: f64,
    pub segment_capture_incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeItemView {
    pub item_id: String,
    pub meeting_id: String,
    pub origin_run_id: String,
    pub item_type: KnowledgeType,
    pub text: String,
    pub owner_text: Option<String>,
    pub owner_support: Support,
    pub due_text: Option<String>,
    pub due_support: Support,
    pub review_state: ReviewState,
    pub created_at_utc: String,
    pub evidence: Vec<EvidenceLinkView>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingKnowledgeView {
    pub meeting_id: String,
    pub latest_run: Option<KnowledgeRunView>,
    pub items: Vec<KnowledgeItemView>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceSegmentView {
    pub evidence_id: String,
    pub sequence: i64,
    pub text: String,
    pub audio_start_time: f64,
    pub audio_end_time: f64,
    pub capture_completeness: CaptureCompleteness,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeUpdatedEvent {
    pub meeting_id: String,
    pub run_id: String,
    pub status: RunStatus,
}
