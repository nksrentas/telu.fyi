use serde::{Deserialize, Serialize};

pub(super) const MAX_SELECTED_DOCUMENT_VERSIONS: usize = 12;
pub(super) const MAX_SELECTED_KNOWLEDGE_ITEMS: usize = 60;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum SelectedSource {
    Document { version_id: String },
    Knowledge { meeting_id: String, item_id: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectionError {
    PlannedMeetingNotFound,
    TooLarge,
    Duplicate,
    NotEligible,
    Storage,
}

impl SelectionError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::PlannedMeetingNotFound => "PLANNED_MEETING_NOT_FOUND",
            Self::TooLarge => "SELECTION_TOO_LARGE",
            Self::Duplicate => "SELECTION_DUPLICATE_SOURCE",
            Self::NotEligible => "SOURCE_NOT_ELIGIBLE",
            Self::Storage => "PREPARATION_STORAGE_FAILED",
        }
    }
}
