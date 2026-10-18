use super::{ratio, PredictionSet, ReviewOutcomeRates};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewDecision {
    Accept,
    Correct,
    Reject,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub struct PlannedReview {
    pub action: ReviewDecision,
}

pub type ReviewPlan = HashMap<String, PlannedReview>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewPlanError {
    UnknownPrediction,
}

pub fn plan_review_outcomes(
    fixture_ids: &[String],
    predictions: &PredictionSet,
    plan: &ReviewPlan,
) -> Result<BTreeMap<String, ReviewOutcomeRates>, ReviewPlanError> {
    let scored: HashSet<&str> = fixture_ids.iter().map(String::as_str).collect();
    let items: Vec<_> = predictions
        .fixtures
        .iter()
        .filter(|fixture| scored.contains(fixture.fixture_id.as_str()))
        .flat_map(|fixture| fixture.items.iter())
        .collect();
    let known: HashSet<&str> = items.iter().map(|item| item.pred_id.as_str()).collect();
    if plan.keys().any(|pred_id| !known.contains(pred_id.as_str())) {
        return Err(ReviewPlanError::UnknownPrediction);
    }
    let mut by_type: BTreeMap<String, Vec<Option<ReviewDecision>>> = BTreeMap::new();
    for item in items {
        let decision = plan.get(&item.pred_id).map(|review| review.action);
        by_type.entry(item.item_type.as_str().to_string()).or_default().push(decision);
    }
    Ok(by_type
        .into_iter()
        .map(|(item_type, decisions)| (item_type, rates(&decisions)))
        .collect())
}

fn rates(decisions: &[Option<ReviewDecision>]) -> ReviewOutcomeRates {
    let total = decisions.len() as u64;
    let count = |wanted: Option<ReviewDecision>| decisions.iter().filter(|decision| **decision == wanted).count() as u64;
    ReviewOutcomeRates {
        accepted: ratio(count(Some(ReviewDecision::Accept)), total),
        corrected: ratio(count(Some(ReviewDecision::Correct)), total),
        rejected: ratio(count(Some(ReviewDecision::Reject)), total),
        pending: ratio(count(None), total),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::evaluation::{ratio, review_accepted, FixturePredictions, PredictedItem};
    use crate::knowledge::models::KnowledgeType;
    use serde_json::json;

    fn predicted(pred_id: &str, item_type: KnowledgeType) -> PredictedItem {
        PredictedItem {
            pred_id: pred_id.to_string(),
            item_type,
            text: format!("predicted {pred_id}"),
            owner: None,
            due: None,
            links: Vec::new(),
        }
    }

    fn predictions() -> PredictionSet {
        PredictionSet {
            prompt_version: "test".to_string(),
            fixtures: vec![
                FixturePredictions {
                    fixture_id: "scored".to_string(),
                    items: vec![
                        predicted("scored#1", KnowledgeType::Decision),
                        predicted("scored#2", KnowledgeType::Decision),
                        predicted("scored#3", KnowledgeType::Fact),
                    ],
                    ..FixturePredictions::default()
                },
                FixturePredictions {
                    fixture_id: "unscored".to_string(),
                    items: vec![predicted("unscored#1", KnowledgeType::Decision)],
                    ..FixturePredictions::default()
                },
            ],
            ..PredictionSet::default()
        }
    }

    fn plan(value: serde_json::Value) -> ReviewPlan {
        serde_json::from_value(value).expect("review plan")
    }

    #[test]
    fn plan_review_outcomes_counts_each_decision_by_type_and_missing_as_pending() {
        let plan = plan(json!({
            "scored#1": { "action": "accept", "text": "kept", "owner": null, "due": null },
            "scored#2": { "action": "correct", "text": "narrower", "owner": "Maria", "due": null },
        }));

        let outcomes = plan_review_outcomes(&["scored".to_string()], &predictions(), &plan).expect("outcomes");

        let decision = &outcomes["decision"];
        assert_eq!(decision.accepted, ratio(1, 2));
        assert_eq!(decision.corrected, ratio(1, 2));
        assert_eq!(decision.rejected, ratio(0, 2));
        assert_eq!(decision.pending, ratio(0, 2));
        assert_eq!(outcomes["fact"].pending, ratio(1, 1));
        assert_eq!(review_accepted(decision), ratio(2, 2));
        assert_eq!(outcomes.len(), 2);
    }

    #[test]
    fn plan_review_outcomes_rejects_a_plan_entry_for_an_unscored_prediction() {
        let plan = plan(json!({ "unscored#1": { "action": "reject" } }));

        let result = plan_review_outcomes(&["scored".to_string()], &predictions(), &plan);

        assert_eq!(result.err(), Some(ReviewPlanError::UnknownPrediction));
    }
}
