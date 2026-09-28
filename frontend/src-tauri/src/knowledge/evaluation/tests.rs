use super::*;

fn segment(id: &str, text: &str) -> GoldSegment {
    GoldSegment {
        id: id.to_string(),
        start: 0.0,
        end: 1.0,
        text: text.to_string(),
        capture_completeness: "complete".to_string(),
    }
}

fn gold(gold_id: &str, item_type: KnowledgeType, evidence: &[&str]) -> GoldItem {
    GoldItem {
        gold_id: gold_id.to_string(),
        item_type,
        text: format!("gold {gold_id}"),
        evidence_segment_ids: evidence.iter().map(|id| id.to_string()).collect(),
        owner: None,
        due: None,
    }
}

fn predicted(pred_id: &str, item_type: KnowledgeType, segment_id: &str, start: usize, end: usize, quote: &str) -> PredictedItem {
    PredictedItem {
        pred_id: pred_id.to_string(),
        item_type,
        text: format!("predicted {pred_id}"),
        owner: None,
        due: None,
        links: vec![PredictedLink {
            segment_id: segment_id.to_string(),
            role: "claim".to_string(),
            raw_start: start,
            raw_end: end,
            quote: quote.to_string(),
        }],
    }
}

fn label(claim: bool, supports: bool, owner: Option<bool>, due: Option<bool>) -> Label {
    Label {
        matches_gold_id: None,
        claim_correct: claim,
        quote_supports_claim: supports,
        owner_correct: owner,
        due_correct: due,
    }
}

fn fixture() -> GoldFixture {
    GoldFixture {
        fixture_id: "standup".to_string(),
        category: FixtureCategory::Representative,
        segments: vec![
            segment("s1", "We will ship the beta on Friday."),
            segment("s2", "Maria owns the release notes."),
            segment("s3", "Is the budget approved?"),
        ],
        gold: vec![
            gold("g1", KnowledgeType::Decision, &["s1"]),
            gold("g2", KnowledgeType::Commitment, &["s2"]),
            gold("g3", KnowledgeType::Question, &["s3"]),
        ],
        expect_abstain: false,
    }
}

fn insufficient() -> GoldFixture {
    GoldFixture {
        fixture_id: "vague".to_string(),
        category: FixtureCategory::InsufficientEvidence,
        segments: vec![segment("v1", "Yeah, sounds good, let us see.")],
        gold: Vec::new(),
        expect_abstain: true,
    }
}

fn fixtures() -> [GoldFixture; 2] {
    [fixture(), insufficient()]
}

fn predictions(items: Vec<PredictedItem>) -> PredictionSet {
    PredictionSet {
        prompt_version: "knowledge-extract-v2".to_string(),
        fixtures: vec![
            FixturePredictions {
                fixture_id: "standup".to_string(),
                items,
                abstentions: Vec::new(),
                duplicates: Vec::new(),
            },
            FixturePredictions {
                fixture_id: "vague".to_string(),
                ..FixturePredictions::default()
            },
        ],
        resurrection_count: Some(0),
    }
}

fn standard_items() -> Vec<PredictedItem> {
    vec![
        predicted("p1", KnowledgeType::Decision, "s1", 8, 31, "ship the beta on Friday"),
        predicted("p2", KnowledgeType::Commitment, "s2", 0, 28, "Maria owns the release notes"),
        predicted("p3", KnowledgeType::Question, "s1", 0, 12, "We will ship"),
    ]
}

fn labels() -> LabelSet {
    HashMap::from([
        ("p1".to_string(), label(true, true, Some(true), Some(true))),
        ("p2".to_string(), label(true, true, Some(true), None)),
        ("p3".to_string(), label(false, false, None, None)),
    ])
}

fn thresholds(fact: Option<ScopeThresholds>) -> Thresholds {
    let declared = ScopeThresholds {
        claim_correctness: Some(0.0),
        semantic_support: Some(0.0),
        evidence_coverage: Some(0.0),
        attribution: None,
    };
    Thresholds {
        version: 1,
        invariants: InvariantThresholds {
            exact_span_support: 1.0,
            resurrection: 0,
            deletion_residue: 0,
        },
        quality: QualityThresholds {
            abstention: Some(AbstentionThreshold { insufficient_evidence: 0.0 }),
            scopes: SCOPES
                .iter()
                .map(|scope| (scope.to_string(), if *scope == "fact" { fact } else { Some(declared) }))
                .collect(),
        },
    }
}

fn envelope() -> ReportEnvelope {
    ReportEnvelope {
        generated_at_utc: "2026-09-28T00:00:00Z".to_string(),
        thresholds_sha256: "hash".to_string(),
        git_commit: "commit".to_string(),
        review_outcomes: None,
    }
}

fn scope<'a>(report: &'a EvaluationReport, name: &str) -> &'a ScopeMetrics {
    report.metrics.iter().find(|metrics| metrics.scope == name).expect("scope metrics")
}

#[test]
fn score_reports_hand_computed_metrics_per_type_in_fixed_order() {
    let fixtures = fixtures();
    let set = predictions(standard_items());
    let labels = labels();
    let limits = thresholds(Some(ScopeThresholds::default()));
    let report = score(&ScoreInput { fixtures: &fixtures, predictions: &set, labels: &labels, thresholds: &limits }, envelope());

    assert_eq!(report.metrics.iter().map(|metrics| metrics.scope.as_str()).collect::<Vec<_>>(), SCOPES.to_vec());
    let decision = scope(&report, "decision");
    assert_eq!(decision.claim_correctness.value, Some(1.0));
    assert_eq!(decision.evidence_coverage.value, Some(1.0));
    assert_eq!(decision.attribution.value, Some(1.0));
    let question = scope(&report, "question");
    assert_eq!(question.claim_correctness.value, Some(0.0));
    assert_eq!(question.evidence_coverage.value, Some(0.0));
    assert_eq!(question.attribution.status, MetricStatus::NotMeasurable);
    let overall = scope(&report, "overall");
    assert_eq!((overall.claim_correctness.numerator, overall.claim_correctness.denominator), (2, 3));
    assert_eq!(overall.exact_span_support.value, Some(1.0));
    assert_eq!((overall.evidence_coverage.numerator, overall.evidence_coverage.denominator), (2, 3));
    assert_eq!((overall.attribution.numerator, overall.attribution.denominator), (3, 3));
}

#[test]
fn score_fails_the_invariant_gate_when_a_quote_no_longer_slices_its_segment() {
    let fixtures = fixtures();
    let mut items = standard_items();
    items[0].links[0].quote = "ship the beta on Monday".to_string();
    let set = predictions(items);
    let labels = labels();
    let limits = thresholds(Some(ScopeThresholds::default()));

    let report = score(&ScoreInput { fixtures: &fixtures, predictions: &set, labels: &labels, thresholds: &limits }, envelope());

    assert!(report.invariants.exact_span_support.value.is_some_and(|value| value < 1.0));
    assert_eq!(report.gate, GateStatus::Fail);
    assert!(report.failures.contains(&"invariants.exactSpanSupport".to_string()));
}

#[test]
fn score_ignores_adjacent_evidence_and_passes_metrics_equal_to_their_threshold() {
    let fixtures = fixtures();
    let mut items = standard_items();
    items[2] = predicted("p3", KnowledgeType::Question, "s2", 0, 5, "Maria");
    let set = predictions(items);
    let labels = labels();
    let mut limits = thresholds(Some(ScopeThresholds::default()));
    limits.quality.scopes.insert(
        "overall".to_string(),
        Some(ScopeThresholds {
            claim_correctness: Some(2.0 / 3.0),
            semantic_support: None,
            evidence_coverage: None,
            attribution: None,
        }),
    );

    let report = score(&ScoreInput { fixtures: &fixtures, predictions: &set, labels: &labels, thresholds: &limits }, envelope());

    assert_eq!(scope(&report, "question").evidence_coverage.value, Some(0.0));
    assert_eq!(scope(&report, "overall").claim_correctness.value, Some(2.0 / 3.0));
    assert_eq!(report.gate, GateStatus::Pass);
}

#[test]
fn score_marks_empty_denominators_not_measurable_and_null_thresholds_undeclared() {
    let fixtures = fixtures();
    let set = predictions(standard_items());
    let labels = labels();
    let limits = thresholds(None);

    let report = score(&ScoreInput { fixtures: &fixtures, predictions: &set, labels: &labels, thresholds: &limits }, envelope());
    let fact = scope(&report, "fact");

    assert_eq!(fact.claim_correctness.value, None);
    assert_eq!(fact.claim_correctness.status, MetricStatus::NotMeasurable);
    assert_eq!(fact.evidence_coverage.status, MetricStatus::NotMeasurable);
    assert_eq!(report.gate, GateStatus::Undeclared);
}
