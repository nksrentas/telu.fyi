use super::*;
use crate::database::repositories::meeting::MeetingsRepository;

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
        deletion_residue_count: Some(0),
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

#[test]
fn count_resurrected_counts_a_rejected_key_under_any_type() {
    let rejected = ["Ship the beta on Friday"];

    assert_eq!(replay::count_resurrected(&rejected, &["SHIP THE BETA ON FRIDAY."]), 1);
    assert_eq!(replay::count_resurrected(&rejected, &["Order new laptops"]), 0);
    assert_eq!(replay::count_resurrected(&rejected, &[]), 0);
}

fn release_fixture() -> GoldFixture {
    GoldFixture {
        fixture_id: "release".to_string(),
        category: FixtureCategory::Representative,
        segments: vec![
            segment("r1", "We decided to ship the beta on Friday."),
            segment("r2", "Maria will update the release notes."),
            segment("r3", "The staging database was migrated yesterday."),
        ],
        gold: Vec::new(),
        expect_abstain: false,
    }
}

fn release_reply() -> String {
    serde_json::json!({
        "items": [
            { "type": "decision", "text": "Ship the beta on Friday", "evidence": [{ "segment": "S1", "quote": "ship the beta on Friday" }], "owner": null, "due": null },
            { "type": "commitment", "text": "Maria will update the release notes", "evidence": [{ "segment": "S2", "quote": "Maria will update the release notes" }], "owner": null, "due": null },
            { "type": "fact", "text": "The staging database was migrated yesterday", "evidence": [{ "segment": "S3", "quote": "The staging database was migrated yesterday" }], "owner": null, "due": null },
        ]
    })
    .to_string()
}

#[tokio::test]
async fn run_replay_reports_zero_resurrection_when_rejected_items_return_under_other_types() {
    let fixtures = [release_fixture()];
    let completions = HashMap::from([("release".to_string(), vec![release_reply()])]);

    let predictions = replay::run_replay(&fixtures, &completions).await.expect("replay");

    assert_eq!(predictions.fixtures[0].items.len(), 3);
    assert_eq!(predictions.resurrection_count, Some(0));
}

fn empty_reply_fixture() -> GoldFixture {
    GoldFixture {
        fixture_id: "quiet".to_string(),
        ..release_fixture()
    }
}

#[tokio::test]
async fn count_deletion_residue_reports_rows_left_behind() {
    let pool = replay::replay_pool().await.expect("pool");
    let meeting_id = uuid::Uuid::new_v4().to_string();
    replay::seed_meeting(&pool, &meeting_id, &release_fixture().segments[..2]).await.expect("seed");

    assert_eq!(replay::count_deletion_residue(&pool, &meeting_id).await.expect("count"), 3);
    MeetingsRepository::delete_meeting(&pool, &meeting_id).await.expect("delete");
    assert_eq!(replay::count_deletion_residue(&pool, &meeting_id).await.expect("count"), 0);
}

#[tokio::test]
async fn run_replay_measures_zero_deletion_residue_through_the_production_delete() {
    let fixtures = [release_fixture()];
    let completions = HashMap::from([("release".to_string(), vec![release_reply()])]);

    let predictions = replay::run_replay(&fixtures, &completions).await.expect("replay");

    assert_eq!(predictions.deletion_residue_count, Some(0));
    assert_eq!(predictions.resurrection_count, Some(0));
}

#[tokio::test]
async fn run_replay_leaves_resurrection_unmeasured_without_rejected_items() {
    let fixtures = [empty_reply_fixture()];
    let completions = HashMap::from([("quiet".to_string(), vec!["{\"items\": []}".to_string()])]);

    let predictions = replay::run_replay(&fixtures, &completions).await.expect("replay");

    assert_eq!(predictions.resurrection_count, None);
    assert_eq!(predictions.deletion_residue_count, Some(0));
}

async fn seed_exported_meeting(path: &std::path::Path, meeting_id: &str) {
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(sqlx::sqlite::SqliteConnectOptions::new().filename(path).create_if_missing(true))
        .await
        .expect("database");
    sqlx::migrate!("./migrations").run(&pool).await.expect("migrations");
    let segments = [segment("018f5e27-2f68-7e27-9c90-7c7212316401", "We decided to ship the beta on Friday.")];
    replay::seed_meeting(&pool, meeting_id, &segments).await.expect("meeting");
    let run_id = uuid::Uuid::new_v4().to_string();
    crate::knowledge::repository::KnowledgeRepository::insert_running_run(&pool, &export_run(meeting_id, &run_id))
        .await
        .expect("run");
    let mut transaction = pool.begin().await.expect("transaction");
    crate::knowledge::repository::KnowledgeRepository::insert_items_with_links(
        &mut transaction,
        meeting_id,
        &run_id,
        &[export_item(&segments[0])],
    )
    .await
    .expect("items");
    crate::knowledge::repository::KnowledgeRepository::finalize_run(
        &mut transaction,
        &run_id,
        crate::knowledge::models::RunStatus::Succeeded,
        crate::knowledge::repository::RunCounts { proposed: 1, ..Default::default() },
        None,
    )
    .await
    .expect("finalize");
    transaction.commit().await.expect("commit");
    pool.close().await;
}

fn export_run(meeting_id: &str, run_id: &str) -> crate::knowledge::repository::NewRun {
    crate::knowledge::repository::NewRun {
        run_id: run_id.to_string(),
        meeting_id: meeting_id.to_string(),
        trigger_kind: crate::knowledge::models::TriggerKind::User,
        provider_id: "ollama".to_string(),
        model_id: "llama3".to_string(),
        location_class: "local".to_string(),
        sanitized_origin: "This device".to_string(),
        prompt_version: "knowledge-extract-v2".to_string(),
        meeting_completeness_at_start: "complete".to_string(),
        input_evidence_count: 1,
        input_fingerprint: "fingerprint".to_string(),
    }
}

fn export_item(segment: &GoldSegment) -> crate::knowledge::repository::NewItem {
    use crate::knowledge::span_verifier::{sha256_hex, AttributeSupport, VerifiedSpan};
    crate::knowledge::repository::NewItem {
        item_id: uuid::Uuid::new_v4().to_string(),
        item_type: KnowledgeType::Decision,
        text: "Ship the beta on Friday".to_string(),
        normalized_key: "ship the beta on friday".to_string(),
        claims: vec![VerifiedSpan {
            evidence_id: segment.id.clone(),
            raw_start: 14,
            raw_end: 37,
            quote_text: "ship the beta on Friday".to_string(),
            normalized_quote: "ship the beta on friday".to_string(),
            evidence_text_sha256: sha256_hex(&segment.text),
            segment_capture_incomplete: false,
        }],
        owner: AttributeSupport::NotStated,
        due: AttributeSupport::NotStated,
    }
}

#[tokio::test]
async fn export_from_db_measures_invariants_for_an_exported_meeting() {
    let temp = tempfile::tempdir().expect("temp dir");
    let database = temp.path().join("telu.sqlite");
    let meeting_id = "018f5e27-2f68-7e27-9c90-7c7212316402".to_string();
    seed_exported_meeting(&database, &meeting_id).await;

    let (_, predictions) = replay::export_from_db(&database, std::slice::from_ref(&meeting_id)).await.expect("export");

    assert_eq!(predictions.fixtures[0].items.len(), 1);
    assert_eq!(predictions.resurrection_count, Some(0));
    assert_eq!(predictions.deletion_residue_count, Some(0));
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(sqlx::sqlite::SqliteConnectOptions::new().filename(&database).read_only(true))
        .await
        .expect("app database");
    let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meetings WHERE id = ?")
        .bind(&meeting_id)
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(kept, 1);
}

fn unmeasured_failures(set: &PredictionSet) -> (GateStatus, Vec<String>) {
    let fixtures = fixtures();
    let labels = labels();
    let limits = thresholds(Some(ScopeThresholds::default()));
    let report = score(&ScoreInput { fixtures: &fixtures, predictions: set, labels: &labels, thresholds: &limits }, envelope());
    (report.gate, report.failures)
}

#[test]
fn score_fails_when_an_invariant_is_unmeasured() {
    let no_resurrection = PredictionSet { resurrection_count: None, ..predictions(standard_items()) };
    let no_residue = PredictionSet { deletion_residue_count: None, ..predictions(standard_items()) };
    let nothing_shown = predictions(Vec::new());

    for (set, failure) in [
        (no_resurrection, "invariants.resurrection.unmeasured"),
        (no_residue, "invariants.deletionResidue.unmeasured"),
        (nothing_shown, "invariants.exactSpanSupport.unmeasured"),
    ] {
        let (gate, failures) = unmeasured_failures(&set);
        assert_eq!(gate, GateStatus::Fail, "{failure}");
        assert!(failures.contains(&failure.to_string()), "{failure}: {failures:?}");
    }
}

#[test]
fn score_fails_when_deletion_residue_is_above_zero() {
    let fixtures = fixtures();
    let set = PredictionSet { deletion_residue_count: Some(2), ..predictions(standard_items()) };
    let labels = labels();
    let limits = thresholds(Some(ScopeThresholds::default()));

    let report = score(&ScoreInput { fixtures: &fixtures, predictions: &set, labels: &labels, thresholds: &limits }, envelope());

    assert_eq!(report.invariants.deletion_residue, Some(2));
    assert_eq!(report.gate, GateStatus::Fail);
    assert!(report.failures.contains(&"invariants.deletionResidue".to_string()));
}
