use crate::knowledge::models::{KnowledgeType, ReviewState};
use crate::knowledge::span_verifier::normalize_quote;
use strsim::normalized_levenshtein;

pub const MATCH_SIMILARITY_THRESHOLD: f64 = 0.6;

#[derive(Debug, Clone, PartialEq)]
pub struct ExistingItem {
    pub item_id: String,
    pub item_type: KnowledgeType,
    pub state: ReviewState,
    pub keys: Vec<String>,
    pub claim_evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Candidate {
    pub item_type: KnowledgeType,
    pub key: String,
    pub claim_evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MatchOutcome {
    New,
    Suppressed(String),
    Reconfirmed(String),
    Duplicate(String),
}

pub fn normalized_key(text: &str) -> String {
    normalize_quote(text)
}

pub fn match_candidate(candidate: &Candidate, existing: &[ExistingItem]) -> MatchOutcome {
    existing
        .iter()
        .filter(|item| item.item_type == candidate.item_type && is_match(candidate, item))
        .min_by(|left, right| {
            state_priority(left.state)
                .cmp(&state_priority(right.state))
                .then_with(|| left.item_id.cmp(&right.item_id))
        })
        .map(outcome_for)
        .unwrap_or(MatchOutcome::New)
}

fn is_match(candidate: &Candidate, item: &ExistingItem) -> bool {
    let exact = item.keys.iter().any(|key| *key == candidate.key);
    let shares_evidence = item
        .claim_evidence_ids
        .iter()
        .any(|evidence_id| candidate.claim_evidence_ids.contains(evidence_id));
    exact
        || (shares_evidence
            && item
                .keys
                .iter()
                .any(|key| normalized_levenshtein(key, &candidate.key) >= MATCH_SIMILARITY_THRESHOLD))
}

fn state_priority(state: ReviewState) -> u8 {
    match state {
        ReviewState::Rejected => 0,
        ReviewState::Accepted => 1,
        ReviewState::Proposed => 2,
    }
}

fn outcome_for(item: &ExistingItem) -> MatchOutcome {
    match item.state {
        ReviewState::Rejected => MatchOutcome::Suppressed(item.item_id.clone()),
        ReviewState::Accepted => MatchOutcome::Reconfirmed(item.item_id.clone()),
        ReviewState::Proposed => MatchOutcome::Duplicate(item.item_id.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn existing(item_id: &str, state: ReviewState, keys: &[&str], evidence: &[&str]) -> ExistingItem {
        ExistingItem {
            item_id: item_id.to_string(),
            item_type: KnowledgeType::Decision,
            state,
            keys: keys.iter().map(|key| normalized_key(key)).collect(),
            claim_evidence_ids: evidence.iter().map(|id| id.to_string()).collect(),
        }
    }

    fn candidate(text: &str, evidence: &[&str]) -> Candidate {
        Candidate {
            item_type: KnowledgeType::Decision,
            key: normalized_key(text),
            claim_evidence_ids: evidence.iter().map(|id| id.to_string()).collect(),
        }
    }

    #[test]
    fn match_candidate_maps_exact_keys_to_the_existing_state() {
        let rejected = [existing("r", ReviewState::Rejected, &["Ship the beta"], &[])];
        let accepted = [existing("a", ReviewState::Accepted, &["Ship the beta"], &[])];
        let proposed = [existing("p", ReviewState::Proposed, &["Ship the beta"], &[])];
        let emitted = candidate("ship the BETA.", &[]);

        assert_eq!(match_candidate(&emitted, &rejected), MatchOutcome::Suppressed("r".to_string()));
        assert_eq!(match_candidate(&emitted, &accepted), MatchOutcome::Reconfirmed("a".to_string()));
        assert_eq!(match_candidate(&emitted, &proposed), MatchOutcome::Duplicate("p".to_string()));
    }

    #[test]
    fn match_candidate_matches_superseded_revision_wording() {
        let accepted = [existing("a", ReviewState::Accepted, &["Hire two engineers", "Hire three engineers"], &[])];
        let rejected = [existing("r", ReviewState::Rejected, &["Hire two engineers", "Hire three engineers"], &[])];
        let emitted = candidate("Hire two engineers", &[]);

        assert_eq!(match_candidate(&emitted, &accepted), MatchOutcome::Reconfirmed("a".to_string()));
        assert_eq!(match_candidate(&emitted, &rejected), MatchOutcome::Suppressed("r".to_string()));
    }

    #[test]
    fn match_candidate_needs_shared_evidence_for_similar_wording() {
        let items = [existing("p", ReviewState::Proposed, &["Ship the beta on Friday"], &["e1"])];

        let similar_shared = candidate("Ship the beta by Friday", &["e1"]);
        let similar_unshared = candidate("Ship the beta by Friday", &["e2"]);
        let different_shared = candidate("Order new laptops", &["e1"]);

        assert_eq!(match_candidate(&similar_shared, &items), MatchOutcome::Duplicate("p".to_string()));
        assert_eq!(match_candidate(&similar_unshared, &items), MatchOutcome::New);
        assert_eq!(match_candidate(&different_shared, &items), MatchOutcome::New);
    }

    #[test]
    fn match_candidate_never_matches_another_type() {
        let items = [existing("r", ReviewState::Rejected, &["Ship the beta"], &[])];
        let question = Candidate {
            item_type: KnowledgeType::Question,
            key: normalized_key("Ship the beta"),
            claim_evidence_ids: Vec::new(),
        };

        assert_eq!(match_candidate(&question, &items), MatchOutcome::New);
    }

    #[test]
    fn match_candidate_prefers_rejected_over_other_matches() {
        let items = [
            existing("a-proposed", ReviewState::Proposed, &["Ship the beta"], &[]),
            existing("z-rejected", ReviewState::Rejected, &["Ship the beta"], &[]),
        ];

        assert_eq!(
            match_candidate(&candidate("Ship the beta", &[]), &items),
            MatchOutcome::Suppressed("z-rejected".to_string())
        );
    }

    #[test]
    fn normalized_key_folds_case_width_quotes_dashes_whitespace_and_edges() {
        assert_eq!(
            normalized_key("  \u{201C}We\u{2019}ll \u{FB01}x   the \u{FF21}PI \u{2014} now!\u{201D} "),
            "we'll fix the api - now"
        );
    }
}
