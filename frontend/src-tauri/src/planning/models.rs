use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, PartialEq, Eq, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlannedMeeting {
    pub id: String,
    pub title: String,
    pub start_utc: Option<String>,
    pub purpose: String,
    pub created_utc: String,
    pub updated_utc: String,
}

pub struct PlannedMeetingInput {
    pub title: String,
    pub start_utc: Option<String>,
    pub purpose: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanningError {
    TitleRequired,
    InvalidStart,
    InvalidDay,
    NotFound,
    Storage,
}

impl PlanningError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::TitleRequired => "PLANNED_MEETING_TITLE_REQUIRED",
            Self::InvalidStart => "PLANNED_MEETING_INVALID_START",
            Self::InvalidDay => "PLANNED_MEETING_INVALID_DAY",
            Self::NotFound => "PLANNED_MEETING_NOT_FOUND",
            Self::Storage => "PLANNED_MEETING_STORAGE_FAILED",
        }
    }
}
