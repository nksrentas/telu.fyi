pub mod replay;

use crate::knowledge::models::KnowledgeType;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

pub const REPORT_SCHEMA_VERSION: u16 = 1;
pub const SCOPES: [&str; 5] = ["decision", "commitment", "question", "fact", "overall"];
pub const THRESHOLDS_VERSION: u16 = 2;
pub const MIN_REPRESENTATIVE_FIXTURES: usize = 5;
pub const MIN_INSUFFICIENT_EVIDENCE_FIXTURES: usize = 1;
pub const MIN_DEGRADED_CAPTURE_FIXTURES: usize = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FixtureCategory {
    Representative,
    InsufficientEvidence,
    DegradedCapture,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldSegment {
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub capture_completeness: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldItem {
    pub gold_id: String,
    #[serde(rename = "type")]
    pub item_type: KnowledgeType,
    pub text: String,
    pub evidence_segment_ids: Vec<String>,
    pub owner: Option<String>,
    pub due: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldFixture {
    pub fixture_id: String,
    pub category: FixtureCategory,
    pub segments: Vec<GoldSegment>,
    pub gold: Vec<GoldItem>,
    pub expect_abstain: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictedLink {
    pub segment_id: String,
    pub role: String,
    pub raw_start: usize,
    pub raw_end: usize,
    pub quote: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictedItem {
    pub pred_id: String,
    #[serde(rename = "type")]
    pub item_type: KnowledgeType,
    pub text: String,
    pub owner: Option<String>,
    pub due: Option<String>,
    pub links: Vec<PredictedLink>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictedAbstention {
    pub reason: String,
    #[serde(rename = "type")]
    pub item_type: Option<KnowledgeType>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FixturePredictions {
    pub fixture_id: String,
    pub items: Vec<PredictedItem>,
    pub abstentions: Vec<PredictedAbstention>,
    pub duplicates: Vec<KnowledgeType>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PredictionSet {
    pub prompt_version: String,
    pub fixtures: Vec<FixturePredictions>,
    #[serde(default)]
    pub resurrection_count: Option<u64>,
    #[serde(default)]
    pub deletion_residue_count: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub matches_gold_id: Option<String>,
    pub claim_correct: bool,
    pub quote_supports_claim: bool,
    pub owner_correct: Option<bool>,
    pub due_correct: Option<bool>,
}

pub type LabelSet = HashMap<String, Label>;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvariantThresholds {
    pub exact_span_support: f64,
    pub resurrection: u64,
    pub deletion_residue: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScopeThresholds {
    pub claim_correctness: Option<f64>,
    pub semantic_support: Option<f64>,
    pub evidence_coverage: Option<f64>,
    pub attribution: Option<f64>,
    pub max_duplication: Option<f64>,
    pub min_review_accepted: Option<f64>,
}

impl ScopeThresholds {
    fn minimums(&self) -> [Option<f64>; 5] {
        [
            self.claim_correctness,
            self.semantic_support,
            self.evidence_coverage,
            self.attribution,
            self.min_review_accepted,
        ]
    }

    fn fully_declared(&self) -> bool {
        self.minimums().iter().all(Option::is_some) && self.max_duplication.is_some()
    }

    fn in_range(&self) -> bool {
        self.minimums().into_iter().flatten().all(minimum_in_range)
            && self.max_duplication.map_or(true, |value| (0.0..1.0).contains(&value))
    }
}

fn minimum_in_range(value: f64) -> bool {
    value > 0.0 && value <= 1.0
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbstentionThreshold {
    pub insufficient_evidence: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityThresholds {
    pub abstention: Option<AbstentionThreshold>,
    #[serde(flatten)]
    pub scopes: BTreeMap<String, Option<ScopeThresholds>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Thresholds {
    pub version: u16,
    pub invariants: InvariantThresholds,
    pub quality: QualityThresholds,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThresholdsError {
    UnsupportedVersion,
    InvariantsChanged,
    UnknownScope,
    OutOfRange,
}

impl Thresholds {
    pub fn validate(&self) -> Result<(), ThresholdsError> {
        let fixed = InvariantThresholds { exact_span_support: 1.0, resurrection: 0, deletion_residue: 0 };
        let scopes_in_range = self.quality.scopes.values().flatten().all(ScopeThresholds::in_range);
        let abstention_in_range = self
            .quality
            .abstention
            .and_then(|abstention| abstention.insufficient_evidence)
            .map_or(true, minimum_in_range);
        if self.version != THRESHOLDS_VERSION {
            Err(ThresholdsError::UnsupportedVersion)
        } else if self.invariants != fixed {
            Err(ThresholdsError::InvariantsChanged)
        } else if self.quality.scopes.keys().any(|scope| !SCOPES.contains(&scope.as_str())) {
            Err(ThresholdsError::UnknownScope)
        } else if !(scopes_in_range && abstention_in_range) {
            Err(ThresholdsError::OutOfRange)
        } else {
            Ok(())
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetricStatus {
    Measured,
    NotMeasurable,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricValue {
    pub value: Option<f64>,
    pub status: MetricStatus,
    pub numerator: u64,
    pub denominator: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeMetrics {
    pub scope: String,
    pub claim_correctness: MetricValue,
    pub semantic_support: MetricValue,
    pub exact_span_support: MetricValue,
    pub raw_grounding: MetricValue,
    pub evidence_coverage: MetricValue,
    pub attribution: MetricValue,
    pub duplication: MetricValue,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewOutcomeRates {
    pub accepted: MetricValue,
    pub corrected: MetricValue,
    pub rejected: MetricValue,
    pub pending: MetricValue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GateStatus {
    Pass,
    Fail,
    Undeclared,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvariantResults {
    pub exact_span_support: MetricValue,
    pub resurrection: Option<u64>,
    pub deletion_residue: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationReport {
    pub schema_version: u16,
    pub generated_at_utc: String,
    pub prompt_version: String,
    pub thresholds_sha256: String,
    pub git_commit: String,
    pub fixtures: Vec<String>,
    pub metrics: Vec<ScopeMetrics>,
    pub degraded_capture: ScopeMetrics,
    pub abstention: MetricValue,
    pub review_outcomes: Option<BTreeMap<String, ReviewOutcomeRates>>,
    pub invariants: InvariantResults,
    pub gate: GateStatus,
    pub failures: Vec<String>,
}

pub struct ScoreInput<'a> {
    pub fixtures: &'a [GoldFixture],
    pub predictions: &'a PredictionSet,
    pub labels: &'a LabelSet,
    pub thresholds: &'a Thresholds,
}

pub fn ratio(numerator: u64, denominator: u64) -> MetricValue {
    MetricValue {
        value: (denominator > 0).then(|| numerator as f64 / denominator as f64),
        status: if denominator > 0 {
            MetricStatus::Measured
        } else {
            MetricStatus::NotMeasurable
        },
        numerator,
        denominator,
    }
}

pub fn score_scope(scope: &str, input: &ScoreInput<'_>, categories: Option<FixtureCategory>) -> ScopeMetrics {
    let fixtures: Vec<&GoldFixture> = input
        .fixtures
        .iter()
        .filter(|fixture| categories.map_or(true, |category| fixture.category == category))
        .collect();
    let in_scope = |item_type: KnowledgeType| scope == "overall" || scope == item_type.as_str();
    let missing = FixturePredictions::default();
    let pairs: Vec<(&GoldFixture, &FixturePredictions)> = fixtures
        .iter()
        .map(|fixture| (*fixture, predictions_for(input.predictions, &fixture.fixture_id).unwrap_or(&missing)))
        .collect();
    let shown: Vec<(&GoldFixture, &PredictedItem)> = pairs
        .iter()
        .flat_map(|(fixture, predicted)| predicted.items.iter().map(move |item| (*fixture, item)))
        .filter(|(_, item)| in_scope(item.item_type))
        .collect();
    let label_count = |check: fn(&Label) -> bool| {
        shown
            .iter()
            .filter(|(_, item)| input.labels.get(&item.pred_id).is_some_and(check))
            .count() as u64
    };
    let shown_count = shown.len() as u64;
    let abstained = pairs
        .iter()
        .flat_map(|(_, predicted)| predicted.abstentions.iter())
        .filter(|abstention| scope == "overall" || abstention.item_type.is_some_and(|item_type| in_scope(item_type)))
        .count() as u64;
    let duplicates = pairs
        .iter()
        .flat_map(|(_, predicted)| predicted.duplicates.iter())
        .filter(|item_type| in_scope(**item_type))
        .count() as u64;
    ScopeMetrics {
        scope: scope.to_string(),
        claim_correctness: ratio(label_count(|label| label.claim_correct), shown_count),
        semantic_support: ratio(label_count(|label| label.quote_supports_claim), shown_count),
        exact_span_support: ratio(
            shown.iter().filter(|(fixture, item)| spans_verify(fixture, item)).count() as u64,
            shown_count,
        ),
        raw_grounding: ratio(shown_count, shown_count + abstained),
        evidence_coverage: coverage(&pairs, &in_scope),
        attribution: attribution(&shown, input.labels),
        duplication: ratio(duplicates, shown_count),
    }
}

fn predictions_for<'a>(predictions: &'a PredictionSet, fixture_id: &str) -> Option<&'a FixturePredictions> {
    predictions
        .fixtures
        .iter()
        .find(|predicted| predicted.fixture_id == fixture_id)
}

fn spans_verify(fixture: &GoldFixture, item: &PredictedItem) -> bool {
    let claims: Vec<&PredictedLink> = item.links.iter().filter(|link| link.role == "claim").collect();
    !claims.is_empty()
        && claims.iter().all(|link| {
            fixture
                .segments
                .iter()
                .find(|segment| segment.id == link.segment_id)
                .is_some_and(|segment| {
                    link.raw_end > link.raw_start
                        && segment.text.chars().skip(link.raw_start).take(link.raw_end - link.raw_start).collect::<String>()
                            == link.quote
                })
        })
}

fn coverage(pairs: &[(&GoldFixture, &FixturePredictions)], in_scope: &dyn Fn(KnowledgeType) -> bool) -> MetricValue {
    let mut covered = 0;
    let mut total = 0;
    for (fixture, predicted) in pairs {
        for gold in fixture.gold.iter().filter(|gold| in_scope(gold.item_type)) {
            total += 1;
            let cited = predicted.items.iter().any(|item| {
                item.item_type == gold.item_type
                    && item
                        .links
                        .iter()
                        .any(|link| link.role == "claim" && gold.evidence_segment_ids.contains(&link.segment_id))
            });
            if cited {
                covered += 1;
            }
        }
    }
    ratio(covered, total)
}

fn attribution(shown: &[(&GoldFixture, &PredictedItem)], labels: &LabelSet) -> MetricValue {
    let answers: Vec<bool> = shown
        .iter()
        .filter_map(|(_, item)| labels.get(&item.pred_id))
        .flat_map(|label| [label.owner_correct, label.due_correct])
        .flatten()
        .collect();
    ratio(answers.iter().filter(|correct| **correct).count() as u64, answers.len() as u64)
}

pub fn abstention_rate(input: &ScoreInput<'_>) -> MetricValue {
    let insufficient: Vec<&GoldFixture> = input
        .fixtures
        .iter()
        .filter(|fixture| fixture.category == FixtureCategory::InsufficientEvidence)
        .collect();
    let abstained = insufficient
        .iter()
        .filter(|fixture| {
            predictions_for(input.predictions, &fixture.fixture_id).is_some_and(|predicted| {
                predicted
                    .items
                    .iter()
                    .all(|item| item.owner.is_none() && item.due.is_none())
            })
        })
        .count() as u64;
    ratio(abstained, insufficient.len() as u64)
}

pub fn gate(report: &EvaluationReport, thresholds: &Thresholds, input_failures: Vec<String>) -> (GateStatus, Vec<String>) {
    let failures: Vec<String> = invariant_failures(report, thresholds)
        .into_iter()
        .chain(input_failures)
        .chain(SCOPES.iter().flat_map(|scope| declared_scope_failures(report, thresholds, scope)))
        .chain(abstention_failures(report, thresholds))
        .collect();
    let status = if !failures.is_empty() {
        GateStatus::Fail
    } else if undeclared(thresholds) {
        GateStatus::Undeclared
    } else {
        GateStatus::Pass
    };
    (status, failures)
}

fn undeclared(thresholds: &Thresholds) -> bool {
    let scope_undeclared = SCOPES.iter().any(|scope| {
        !thresholds
            .quality
            .scopes
            .get(*scope)
            .copied()
            .flatten()
            .is_some_and(|declared| declared.fully_declared())
    });
    let abstention_undeclared = thresholds
        .quality
        .abstention
        .and_then(|abstention| abstention.insufficient_evidence)
        .is_none();
    scope_undeclared || abstention_undeclared
}

fn abstention_failures(report: &EvaluationReport, thresholds: &Thresholds) -> Option<String> {
    thresholds
        .quality
        .abstention
        .and_then(|abstention| abstention.insufficient_evidence)
        .filter(|threshold| !meets(report.abstention, *threshold))
        .map(|_| "abstention.insufficientEvidence".to_string())
}

pub fn input_failures(input: &ScoreInput<'_>) -> Vec<String> {
    let count = |category: FixtureCategory| input.fixtures.iter().filter(|fixture| fixture.category == category).count();
    [
        ("inputs.predictionsMismatch", predictions_mismatch(input)),
        ("inputs.representativeFixtures", count(FixtureCategory::Representative) < MIN_REPRESENTATIVE_FIXTURES),
        (
            "inputs.insufficientEvidenceFixtures",
            count(FixtureCategory::InsufficientEvidence) < MIN_INSUFFICIENT_EVIDENCE_FIXTURES,
        ),
        ("inputs.degradedCaptureFixtures", count(FixtureCategory::DegradedCapture) < MIN_DEGRADED_CAPTURE_FIXTURES),
    ]
    .into_iter()
    .filter(|(_, failed)| *failed)
    .map(|(name, _)| name.to_string())
    .collect()
}

fn predictions_mismatch(input: &ScoreInput<'_>) -> bool {
    let predicted: Vec<&str> = input.predictions.fixtures.iter().map(|set| set.fixture_id.as_str()).collect();
    let unique: HashSet<&str> = predicted.iter().copied().collect();
    let gold: HashSet<&str> = input.fixtures.iter().map(|fixture| fixture.fixture_id.as_str()).collect();
    unique.len() != predicted.len() || unique != gold
}

pub fn review_accepted(rates: &ReviewOutcomeRates) -> MetricValue {
    ratio(rates.accepted.numerator + rates.corrected.numerator, rates.accepted.denominator)
}

fn scope_review(report: &EvaluationReport, scope: &str) -> Option<MetricValue> {
    let outcomes = report.review_outcomes.as_ref()?;
    if scope != "overall" {
        return outcomes.get(scope).map(review_accepted);
    }
    let per_type: Vec<MetricValue> = outcomes.values().map(review_accepted).collect();
    Some(ratio(
        per_type.iter().map(|value| value.numerator).sum(),
        per_type.iter().map(|value| value.denominator).sum(),
    ))
}

fn invariant_failures(report: &EvaluationReport, thresholds: &Thresholds) -> Vec<String> {
    let invariants = &report.invariants;
    let exact = invariants.exact_span_support;
    let limits = thresholds.invariants;
    [
        ("invariants.exactSpanSupport.unmeasured", exact.status != MetricStatus::Measured),
        ("invariants.resurrection.unmeasured", invariants.resurrection.is_none()),
        ("invariants.deletionResidue.unmeasured", invariants.deletion_residue.is_none()),
        (
            "invariants.exactSpanSupport",
            exact.status == MetricStatus::Measured && !meets(exact, limits.exact_span_support),
        ),
        ("invariants.resurrection", invariants.resurrection.is_some_and(|count| count > limits.resurrection)),
        (
            "invariants.deletionResidue",
            invariants.deletion_residue.is_some_and(|count| count > limits.deletion_residue),
        ),
    ]
    .into_iter()
    .filter(|(_, failed)| *failed)
    .map(|(name, _)| name.to_string())
    .collect()
}

#[derive(Clone, Copy)]
enum Bound {
    Minimum,
    Maximum,
}

fn declared_scope_failures(report: &EvaluationReport, thresholds: &Thresholds, scope: &str) -> Vec<String> {
    let Some(declared) = thresholds.quality.scopes.get(scope).copied().flatten() else {
        return Vec::new();
    };
    let metrics = report.metrics.iter().find(|metrics| metrics.scope == scope);
    let metric = |pick: fn(&ScopeMetrics) -> MetricValue| metrics.map(pick);
    [
        ("claimCorrectness", metric(|m| m.claim_correctness), declared.claim_correctness, Bound::Minimum),
        ("semanticSupport", metric(|m| m.semantic_support), declared.semantic_support, Bound::Minimum),
        ("evidenceCoverage", metric(|m| m.evidence_coverage), declared.evidence_coverage, Bound::Minimum),
        ("attribution", metric(|m| m.attribution), declared.attribution, Bound::Minimum),
        ("maxDuplication", metric(|m| m.duplication), declared.max_duplication, Bound::Maximum),
        ("minReviewAccepted", scope_review(report, scope), declared.min_review_accepted, Bound::Minimum),
    ]
    .into_iter()
    .filter(|(_, value, threshold, bound)| threshold.is_some_and(|threshold| !within(*value, threshold, *bound)))
    .map(|(name, ..)| format!("{scope}.{name}"))
    .collect()
}

fn within(value: Option<MetricValue>, threshold: f64, bound: Bound) -> bool {
    value.is_some_and(|value| match bound {
        Bound::Minimum => meets(value, threshold),
        Bound::Maximum => value.value.is_some_and(|measured| measured <= threshold),
    })
}

fn meets(value: MetricValue, threshold: f64) -> bool {
    value.value.is_some_and(|measured| measured >= threshold)
}

pub fn score(input: &ScoreInput<'_>, envelope: ReportEnvelope) -> EvaluationReport {
    let metrics: Vec<ScopeMetrics> = SCOPES.iter().map(|scope| score_scope(scope, input, None)).collect();
    let overall_exact = metrics
        .last()
        .map(|overall| overall.exact_span_support)
        .unwrap_or_else(|| ratio(0, 0));
    let mut report = EvaluationReport {
        schema_version: REPORT_SCHEMA_VERSION,
        generated_at_utc: envelope.generated_at_utc,
        prompt_version: input.predictions.prompt_version.clone(),
        thresholds_sha256: envelope.thresholds_sha256,
        git_commit: envelope.git_commit,
        fixtures: input.fixtures.iter().map(|fixture| fixture.fixture_id.clone()).collect(),
        degraded_capture: score_scope("overall", input, Some(FixtureCategory::DegradedCapture)),
        abstention: abstention_rate(input),
        review_outcomes: envelope.review_outcomes,
        invariants: InvariantResults {
            exact_span_support: overall_exact,
            resurrection: input.predictions.resurrection_count,
            deletion_residue: input.predictions.deletion_residue_count,
        },
        metrics,
        gate: GateStatus::Undeclared,
        failures: Vec::new(),
    };
    let (status, failures) = gate(&report, input.thresholds, input_failures(input));
    report.gate = status;
    report.failures = failures;
    report
}

pub struct ReportEnvelope {
    pub generated_at_utc: String,
    pub thresholds_sha256: String,
    pub git_commit: String,
    pub review_outcomes: Option<BTreeMap<String, ReviewOutcomeRates>>,
}

#[cfg(test)]
mod tests;
