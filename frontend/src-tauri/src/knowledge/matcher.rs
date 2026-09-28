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
    pub superseded_keys: Vec<String>,
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
        .filter(|item| is_match(candidate, item, comparable_keys(candidate, item)))
        .min_by(|left, right| {
            state_priority(left.state)
                .cmp(&state_priority(right.state))
                .then_with(|| left.item_id.cmp(&right.item_id))
        })
        .map(outcome_for)
        .unwrap_or(MatchOutcome::New)
}

fn comparable_keys<'a>(candidate: &Candidate, item: &'a ExistingItem) -> &'a [String] {
    if item.state == ReviewState::Rejected || item.item_type == candidate.item_type {
        &item.keys
    } else {
        &item.superseded_keys
    }
}

fn is_match(candidate: &Candidate, item: &ExistingItem, keys: &[String]) -> bool {
    let exact = keys.iter().any(|key| *key == candidate.key);
    let shares_evidence = item
        .claim_evidence_ids
        .iter()
        .any(|evidence_id| candidate.claim_evidence_ids.contains(evidence_id));
    exact
        || (shares_evidence
            && keys
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
            superseded_keys: Vec::new(),
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

    fn typed(item_type: KnowledgeType, text: &str, evidence: &[&str]) -> Candidate {
        Candidate {
            item_type,
            ..candidate(text, evidence)
        }
    }

    #[test]
    fn match_candidate_suppresses_a_rejected_item_under_any_type() {
        let items = [existing("r", ReviewState::Rejected, &["Ship the beta"], &[])];
        let similar = [existing("r", ReviewState::Rejected, &["Ship the beta on Friday"], &["e1"])];

        for item_type in [KnowledgeType::Question, KnowledgeType::Commitment, KnowledgeType::Fact] {
            assert_eq!(
                match_candidate(&typed(item_type, "Ship the beta", &[]), &items),
                MatchOutcome::Suppressed("r".to_string())
            );
        }
        assert_eq!(
            match_candidate(&typed(KnowledgeType::Commitment, "Ship the beta by Friday", &["e1"]), &similar),
            MatchOutcome::Suppressed("r".to_string())
        );
    }

    fn with_superseded(item: ExistingItem, superseded: &[&str]) -> ExistingItem {
        ExistingItem {
            superseded_keys: superseded.iter().map(|key| normalized_key(key)).collect(),
            ..item
        }
    }

    #[test]
    fn match_candidate_matches_corrected_away_wording_under_any_type() {
        let keys = ["Hire three engineers", "Hire two engineers"];
        let accepted = [with_superseded(existing("a", ReviewState::Accepted, &keys, &[]), &["Hire two engineers"])];
        let rejected = [with_superseded(existing("r", ReviewState::Rejected, &keys, &[]), &["Hire two engineers"])];
        let corrected_away = typed(KnowledgeType::Fact, "Hire two engineers", &[]);
        let current = typed(KnowledgeType::Fact, "Hire three engineers", &[]);

        assert_eq!(match_candidate(&corrected_away, &accepted), MatchOutcome::Reconfirmed("a".to_string()));
        assert_eq!(match_candidate(&current, &accepted), MatchOutcome::New);
        assert_eq!(match_candidate(&corrected_away, &rejected), MatchOutcome::Suppressed("r".to_string()));
        assert_eq!(match_candidate(&current, &rejected), MatchOutcome::Suppressed("r".to_string()));
    }

    #[test]
    fn match_candidate_keeps_type_for_current_wording_of_accepted_and_proposed_items() {
        let accepted = [existing("a", ReviewState::Accepted, &["Ship the beta"], &[])];
        let proposed = [existing("p", ReviewState::Proposed, &["Ship the beta"], &[])];
        let commitment = typed(KnowledgeType::Commitment, "Ship the beta", &[]);
        let decision = candidate("Ship the beta", &[]);

        assert_eq!(match_candidate(&commitment, &accepted), MatchOutcome::New);
        assert_eq!(match_candidate(&commitment, &proposed), MatchOutcome::New);
        assert_eq!(match_candidate(&decision, &accepted), MatchOutcome::Reconfirmed("a".to_string()));
        assert_eq!(match_candidate(&decision, &proposed), MatchOutcome::Duplicate("p".to_string()));
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
