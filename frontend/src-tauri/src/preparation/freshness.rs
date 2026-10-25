use crate::knowledge::models::{KnowledgeError, KnowledgeItemView};
use crate::knowledge::repository::KnowledgeRepository;
use crate::preparation::briefing::{BriefingError, Claim, ClaimStatus};
use crate::preparation::models::SelectedSource;
use sqlx::SqlitePool;
use std::collections::HashMap;
use tracing::warn;

pub struct KnowledgeNow(HashMap<String, Vec<KnowledgeItemView>>);

impl KnowledgeNow {
    pub async fn load(pool: &SqlitePool, claims: &[&Claim]) -> Result<Self, BriefingError> {
        let mut meetings = HashMap::new();
        for claim in claims {
            let SelectedSource::Knowledge { meeting_id, .. } = &claim.source else {
                continue;
            };
            if claim.status != ClaimStatus::Cited || meetings.contains_key(meeting_id) {
                continue;
            }
            let items = match KnowledgeRepository::meeting_view(pool, meeting_id).await {
                Ok(view) => view.items.into_iter().chain(view.rejected).collect(),
                Err(KnowledgeError::Storage) => {
                    warn!("preparation could not read cited knowledge");
                    return Err(BriefingError::Storage);
                }
                Err(_) => Vec::new(),
            };
            meetings.insert(meeting_id.clone(), items);
        }
        Ok(Self(meetings))
    }

    pub fn checked(&self, claim: Claim) -> Claim {
        let SelectedSource::Knowledge {
            meeting_id,
            item_id,
        } = &claim.source
        else {
            return claim;
        };
        let Some(items) = self.0.get(meeting_id) else {
            return claim;
        };
        let status = match items.iter().find(|item| &item.item_id == item_id) {
            None => ClaimStatus::SourceUnavailable,
            Some(item) if !item.eligibility || item.latest_revision_id != claim.revision_id => {
                ClaimStatus::Stale
            }
            Some(_) => claim.status,
        };
        Claim { status, ..claim }
    }
}
