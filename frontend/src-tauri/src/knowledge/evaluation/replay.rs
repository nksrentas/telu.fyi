use super::{
    ratio, FixtureCategory, FixturePredictions, GoldFixture, GoldSegment, PredictedAbstention,
    PredictedItem, PredictedLink, PredictionSet, ReviewOutcomeRates,
};
use crate::database::models::{CaptureCompleteness, DateTimeUtc, TranscriptEvidence};
use crate::database::repositories::meeting::MeetingsRepository;
use crate::database::repositories::transcript::TranscriptsRepository;
use crate::knowledge::extraction::{extract_from_segments, input_fingerprint, run_extraction, ExtractionOutcome};
use crate::knowledge::matcher::normalized_key;
use crate::knowledge::models::{
    EvidenceRole, KnowledgeItemView, KnowledgeType, ReviewAction, SuppressionReason, TriggerKind,
};
use crate::knowledge::prompt::PROMPT_VERSION;
use crate::knowledge::repository::{KnowledgeRepository, NewRun};
use crate::knowledge::review::append_review;
use crate::knowledge::span_verifier::{AttributeSupport, LabeledSegment, LabeledSegments, VerifiedSpan};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::future::Future;
use std::path::Path;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const REPLAY_BUDGET_TOKENS: usize = 100_000;
const EMPTY_REPLY: &str = "{\"items\": []}";
const MEETING_SCOPED_TABLES: &str = "SELECT m.name FROM sqlite_master m JOIN pragma_table_info(m.name) p
     WHERE m.type = 'table' AND p.name = 'meeting_id' ORDER BY m.name";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReplayError {
    InvalidMeetingId,
    InvalidFixture,
    Storage,
}

impl ReplayError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::InvalidMeetingId => "INVALID_MEETING_ID",
            Self::InvalidFixture => "INVALID_FIXTURE",
            Self::Storage => "STORAGE_FAILED",
        }
    }
}

pub async fn run_replay(
    fixtures: &[GoldFixture],
    completions: &HashMap<String, Vec<String>>,
) -> Result<PredictionSet, ReplayError> {
    let mut predicted = Vec::new();
    let mut counts = Vec::new();
    for fixture in fixtures {
        let replies = completions.get(&fixture.fixture_id).cloned().unwrap_or_default();
        let outcome = extract_fixture(fixture, &replies).await;
        predicted.push(fixture_predictions(&fixture.fixture_id, &outcome));
        counts.push(measure_invariants(fixture, FirstPass::Recorded(&replies)).await?);
    }
    Ok(prediction_set(predicted, &counts))
}

fn prediction_set(fixtures: Vec<FixturePredictions>, counts: &[InvariantCounts]) -> PredictionSet {
    let probes: u64 = counts.iter().map(|count| count.probes).sum();
    PredictionSet {
        prompt_version: PROMPT_VERSION.to_string(),
        fixtures,
        resurrection_count: (probes > 0).then(|| counts.iter().map(|count| count.resurrected).sum()),
        deletion_residue_count: (!counts.is_empty()).then(|| counts.iter().map(|count| count.deletion_residue).sum()),
    }
}

fn labeled(fixture: &GoldFixture) -> LabeledSegments {
    LabeledSegments::new(
        fixture
            .segments
            .iter()
            .enumerate()
            .map(|(index, segment)| LabeledSegment {
                label: format!("S{}", index + 1),
                evidence_id: segment.id.clone(),
                text: segment.text.clone(),
                audio_start_time: segment.start,
                capture_incomplete: segment.capture_completeness == "incomplete",
            })
            .collect(),
    )
}

fn replayer(replies: &[String]) -> impl FnMut(String, String) -> std::future::Ready<Result<String, String>> {
    let mut queue = replies.to_vec().into_iter();
    move |_, _| std::future::ready(Ok(queue.next().unwrap_or_else(|| EMPTY_REPLY.to_string())))
}

async fn extract_fixture(fixture: &GoldFixture, replies: &[String]) -> ExtractionOutcome {
    let mut replay = replayer(replies);
    extract_from_segments(&labeled(fixture), REPLAY_BUDGET_TOKENS, Vec::new(), &CancellationToken::new(), &mut replay)
        .await
        .unwrap_or_default()
}

fn fixture_predictions(fixture_id: &str, outcome: &ExtractionOutcome) -> FixturePredictions {
    let type_of: HashMap<&str, KnowledgeType> = outcome
        .items
        .iter()
        .map(|item| (item.item_id.as_str(), item.item_type))
        .collect();
    FixturePredictions {
        fixture_id: fixture_id.to_string(),
        items: outcome
            .items
            .iter()
            .enumerate()
            .map(|(index, item)| PredictedItem {
                pred_id: format!("{fixture_id}#{}", index + 1),
                item_type: item.item_type,
                text: item.text.clone(),
                owner: stated(&item.owner),
                due: stated(&item.due),
                links: span_links("claim", &item.claims)
                    .into_iter()
                    .chain(attribute_links("owner", &item.owner))
                    .chain(attribute_links("due", &item.due))
                    .collect(),
            })
            .collect(),
        abstentions: outcome
            .abstentions
            .iter()
            .map(|abstention| PredictedAbstention {
                reason: abstention.reason.as_str().to_string(),
                item_type: abstention.candidate_type,
            })
            .collect(),
        duplicates: outcome
            .suppressions
            .iter()
            .filter(|suppression| suppression.reason == SuppressionReason::DuplicateInRun)
            .filter_map(|suppression| type_of.get(suppression.matched_item_id.as_str()).copied())
            .collect(),
    }
}

fn stated(attribute: &AttributeSupport) -> Option<String> {
    match attribute {
        AttributeSupport::Stated { text, .. } => Some(text.clone()),
        AttributeSupport::NotStated => None,
    }
}

fn span_links(role: &str, spans: &[VerifiedSpan]) -> Vec<PredictedLink> {
    spans
        .iter()
        .map(|span| PredictedLink {
            segment_id: span.evidence_id.clone(),
            role: role.to_string(),
            raw_start: span.raw_start,
            raw_end: span.raw_end,
            quote: span.quote_text.clone(),
        })
        .collect()
}

fn attribute_links(role: &str, attribute: &AttributeSupport) -> Vec<PredictedLink> {
    match attribute {
        AttributeSupport::Stated { spans, .. } => span_links(role, spans),
        AttributeSupport::NotStated => Vec::new(),
    }
}

enum FirstPass<'a> {
    Recorded(&'a [String]),
    Synthesized(String),
}

struct InvariantCounts {
    resurrected: u64,
    probes: u64,
    deletion_residue: u64,
}

async fn measure_invariants(fixture: &GoldFixture, first_pass: FirstPass<'_>) -> Result<InvariantCounts, ReplayError> {
    let pool = replay_pool().await?;
    let meeting_id = Uuid::new_v4().to_string();
    seed_meeting(&pool, &meeting_id, &fixture.segments).await?;
    let evidence = TranscriptsRepository::list_evidence_by_meeting(&pool, &meeting_id)
        .await
        .map_err(|_| ReplayError::Storage)?;
    let first_run = first_pass_run(&pool, &meeting_id, &evidence, first_pass).await?;
    let rejected = items_of_run(&pool, &meeting_id, &first_run).await?;
    reject_all(&pool, &meeting_id, &rejected).await?;
    let reply = regenerate_reply(&rejected, fixture);
    let second_run =
        replay_run(&pool, &meeting_id, &evidence, TriggerKind::Regenerate, repeat_replayer(reply)).await?;
    let regenerated = items_of_run(&pool, &meeting_id, &second_run).await?;
    MeetingsRepository::delete_meeting(&pool, &meeting_id)
        .await
        .map_err(|_| ReplayError::Storage)?;
    Ok(InvariantCounts {
        resurrected: count_resurrected(&texts(&rejected), &texts(&regenerated)),
        probes: rejected.len() as u64,
        deletion_residue: count_deletion_residue(&pool, &meeting_id).await?,
    })
}

async fn first_pass_run(
    pool: &SqlitePool,
    meeting_id: &str,
    evidence: &[TranscriptEvidence],
    first_pass: FirstPass<'_>,
) -> Result<String, ReplayError> {
    match first_pass {
        FirstPass::Recorded(replies) => replay_run(pool, meeting_id, evidence, TriggerKind::User, replayer(replies)).await,
        FirstPass::Synthesized(reply) => {
            replay_run(pool, meeting_id, evidence, TriggerKind::User, repeat_replayer(reply)).await
        }
    }
}

pub(super) async fn count_deletion_residue(pool: &SqlitePool, meeting_id: &str) -> Result<u64, ReplayError> {
    let tables: Vec<String> = sqlx::query_scalar(MEETING_SCOPED_TABLES)
        .fetch_all(pool)
        .await
        .map_err(|_| ReplayError::Storage)?;
    let terms: Vec<String> = tables
        .iter()
        .map(|table| format!("(SELECT COUNT(*) FROM \"{table}\" WHERE meeting_id = ?1)"))
        .chain(std::iter::once("(SELECT COUNT(*) FROM meetings WHERE id = ?1)".to_string()))
        .collect();
    let residue: i64 = sqlx::query_scalar(&format!("SELECT {}", terms.join(" + ")))
        .bind(meeting_id)
        .fetch_one(pool)
        .await
        .map_err(|_| ReplayError::Storage)?;
    Ok(residue.max(0) as u64)
}

async fn reject_all(pool: &SqlitePool, meeting_id: &str, items: &[KnowledgeItemView]) -> Result<(), ReplayError> {
    for item in items {
        append_review(pool, meeting_id, &item.item_id, ReviewAction::Reject)
            .await
            .map_err(|_| ReplayError::Storage)?;
    }
    Ok(())
}

fn texts(items: &[KnowledgeItemView]) -> Vec<&str> {
    items.iter().map(|item| item.text.as_str()).collect()
}

pub(super) fn count_resurrected(rejected: &[&str], regenerated: &[&str]) -> u64 {
    let rejected_keys: HashSet<String> = rejected.iter().map(|text| normalized_key(text)).collect();
    regenerated
        .iter()
        .filter(|text| rejected_keys.contains(&normalized_key(text)))
        .count() as u64
}

fn regenerate_reply(items: &[KnowledgeItemView], fixture: &GoldFixture) -> String {
    let entries: Vec<Value> = items
        .iter()
        .filter_map(|item| claim_evidence(item, fixture).map(|evidence| (item, evidence)))
        .flat_map(|(item, evidence)| {
            [item.item_type, rotate_type(item.item_type)].map(|item_type| {
                json!({
                    "type": item_type.as_str(),
                    "text": format!("{}.", item.text.to_uppercase()),
                    "evidence": [evidence.clone()],
                    "owner": null,
                    "due": null,
                })
            })
        })
        .collect();
    json!({ "items": entries }).to_string()
}

fn claim_evidence(item: &KnowledgeItemView, fixture: &GoldFixture) -> Option<Value> {
    let claims: Vec<_> = item.evidence.iter().filter(|link| link.role == EvidenceRole::Claim).collect();
    let first = claims.first()?;
    let position = fixture.segments.iter().position(|segment| segment.id == first.evidence_id)?;
    let quote = claims.iter().map(|link| link.quote_text.as_str()).collect::<Vec<_>>().join(" ");
    Some(json!({ "segment": format!("S{}", position + 1), "quote": quote }))
}

fn rotate_type(item_type: KnowledgeType) -> KnowledgeType {
    match item_type {
        KnowledgeType::Decision => KnowledgeType::Commitment,
        KnowledgeType::Commitment => KnowledgeType::Question,
        KnowledgeType::Question => KnowledgeType::Fact,
        KnowledgeType::Fact => KnowledgeType::Decision,
    }
}

fn repeat_replayer(reply: String) -> impl FnMut(String, String) -> std::future::Ready<Result<String, String>> {
    move |_, _| std::future::ready(Ok(reply.clone()))
}

pub(super) async fn replay_pool() -> Result<SqlitePool, ReplayError> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .map_err(|_| ReplayError::Storage)?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|_| ReplayError::Storage)?;
    Ok(pool)
}

pub(super) async fn seed_meeting(pool: &SqlitePool, meeting_id: &str, segments: &[GoldSegment]) -> Result<(), ReplayError> {
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc)
         VALUES (?, 'Replay', ?, ?, 'complete', 'complete', NULL, ?)",
    )
    .bind(meeting_id)
    .bind(now)
    .bind(now)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|_| ReplayError::Storage)?;
    for (sequence, segment) in segments.iter().enumerate() {
        insert_segment(pool, meeting_id, sequence as i64, segment).await?;
    }
    Ok(())
}

async fn insert_segment(pool: &SqlitePool, meeting_id: &str, sequence: i64, segment: &GoldSegment) -> Result<(), ReplayError> {
    let evidence = TranscriptEvidence {
        evidence_id: segment.id.clone(),
        meeting_id: meeting_id.to_string(),
        source_track: "mixed".to_string(),
        source_segment_key: format!("replay-{sequence}"),
        sequence,
        transcript: segment.text.clone(),
        audio_start_time: segment.start,
        audio_end_time: segment.end.max(segment.start),
        is_final: true,
        capture_completeness: if segment.capture_completeness == "incomplete" {
            CaptureCompleteness::Incomplete
        } else {
            CaptureCompleteness::Complete
        },
        created_at: DateTimeUtc(Utc::now()),
        updated_at: DateTimeUtc(Utc::now()),
    };
    sqlx::query(
        "INSERT INTO transcript_evidence (
            evidence_id, meeting_id, source_track, source_segment_key, sequence, transcript,
            audio_start_time, audio_end_time, is_final, capture_completeness, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
    )
    .bind(&evidence.evidence_id)
    .bind(&evidence.meeting_id)
    .bind(&evidence.source_track)
    .bind(&evidence.source_segment_key)
    .bind(evidence.sequence)
    .bind(&evidence.transcript)
    .bind(evidence.audio_start_time)
    .bind(evidence.audio_end_time)
    .bind(evidence.capture_completeness.as_str())
    .bind(evidence.created_at.0)
    .bind(evidence.updated_at.0)
    .execute(pool)
    .await
    .map(|_| ())
    .map_err(|_| ReplayError::InvalidFixture)
}

async fn replay_run<F, Fut>(
    pool: &SqlitePool,
    meeting_id: &str,
    evidence: &[TranscriptEvidence],
    trigger: TriggerKind,
    complete: F,
) -> Result<String, ReplayError>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let run_id = Uuid::new_v4().to_string();
    KnowledgeRepository::insert_running_run(
        pool,
        &NewRun {
            run_id: run_id.clone(),
            meeting_id: meeting_id.to_string(),
            trigger_kind: trigger,
            provider_id: "replay".to_string(),
            model_id: "replay".to_string(),
            location_class: "local".to_string(),
            sanitized_origin: "This device".to_string(),
            prompt_version: PROMPT_VERSION.to_string(),
            meeting_completeness_at_start: "complete".to_string(),
            input_evidence_count: evidence.len() as i64,
            input_fingerprint: input_fingerprint(evidence),
        },
    )
    .await
    .map_err(|_| ReplayError::Storage)?;
    run_extraction(pool, meeting_id, &run_id, evidence, REPLAY_BUDGET_TOKENS, &CancellationToken::new(), complete)
        .await
        .map_err(|_| ReplayError::Storage)?;
    Ok(run_id)
}

async fn items_of_run(pool: &SqlitePool, meeting_id: &str, run_id: &str) -> Result<Vec<KnowledgeItemView>, ReplayError> {
    let view = KnowledgeRepository::meeting_view(pool, meeting_id)
        .await
        .map_err(|_| ReplayError::Storage)?;
    Ok(view
        .items
        .into_iter()
        .chain(view.rejected)
        .filter(|item| item.origin_run_id == run_id)
        .collect())
}

pub async fn export_from_db(
    db_path: &Path,
    meeting_ids: &[String],
) -> Result<(Vec<GoldFixture>, PredictionSet), ReplayError> {
    if meeting_ids.iter().any(|id| Uuid::parse_str(id).is_err()) {
        return Err(ReplayError::InvalidMeetingId);
    }
    let pool = read_only_pool(db_path).await?;
    let mut fixtures = Vec::new();
    let mut predicted = Vec::new();
    let mut counts = Vec::new();
    for meeting_id in meeting_ids {
        let (fixture, predictions) = export_meeting(&pool, meeting_id).await?;
        let first_pass = FirstPass::Synthesized(claim_reply(&fixture, &predictions.items));
        counts.push(measure_invariants(&fixture, first_pass).await?);
        fixtures.push(fixture);
        predicted.push(predictions);
    }
    Ok((fixtures, prediction_set(predicted, &counts)))
}

fn claim_reply(fixture: &GoldFixture, items: &[PredictedItem]) -> String {
    let entries: Vec<Value> = items
        .iter()
        .filter_map(|item| {
            claim_link_evidence(fixture, &item.links).map(|evidence| {
                json!({
                    "type": item.item_type.as_str(),
                    "text": item.text,
                    "evidence": [evidence],
                    "owner": null,
                    "due": null,
                })
            })
        })
        .collect();
    json!({ "items": entries }).to_string()
}

fn claim_link_evidence(fixture: &GoldFixture, links: &[PredictedLink]) -> Option<Value> {
    let claims: Vec<&PredictedLink> = links.iter().filter(|link| link.role == EvidenceRole::Claim.as_str()).collect();
    let first = claims.first()?;
    let position = fixture.segments.iter().position(|segment| segment.id == first.segment_id)?;
    let quote = claims.iter().map(|link| link.quote.as_str()).collect::<Vec<_>>().join(" ");
    Some(json!({ "segment": format!("S{}", position + 1), "quote": quote }))
}

async fn read_only_pool(db_path: &Path) -> Result<SqlitePool, ReplayError> {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().filename(db_path).read_only(true))
        .await
        .map_err(|_| ReplayError::Storage)
}

async fn export_meeting(pool: &SqlitePool, meeting_id: &str) -> Result<(GoldFixture, FixturePredictions), ReplayError> {
    let evidence = TranscriptsRepository::list_evidence_by_meeting(pool, meeting_id)
        .await
        .map_err(|_| ReplayError::Storage)?;
    let view = KnowledgeRepository::meeting_view(pool, meeting_id)
        .await
        .map_err(|_| ReplayError::Storage)?;
    let abstentions: Vec<(String, Option<KnowledgeType>)> =
        sqlx::query_as("SELECT reason_code, candidate_type FROM knowledge_abstentions WHERE meeting_id = ?")
            .bind(meeting_id)
            .fetch_all(pool)
            .await
            .map_err(|_| ReplayError::Storage)?;
    let duplicates: Vec<KnowledgeType> = sqlx::query_scalar(
        "SELECT i.item_type FROM knowledge_suppressions s
         JOIN knowledge_items i ON i.item_id = s.matched_item_id
         WHERE s.meeting_id = ? AND s.reason = 'duplicate_in_run'",
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await
    .map_err(|_| ReplayError::Storage)?;
    let fixture = GoldFixture {
        fixture_id: meeting_id.to_string(),
        category: FixtureCategory::Representative,
        segments: evidence.iter().map(exported_segment).collect(),
        gold: Vec::new(),
        expect_abstain: false,
    };
    let predictions = FixturePredictions {
        fixture_id: meeting_id.to_string(),
        items: view.items.iter().chain(view.rejected.iter()).map(exported_item).collect(),
        abstentions: abstentions
            .into_iter()
            .map(|(reason, item_type)| PredictedAbstention { reason, item_type })
            .collect(),
        duplicates,
    };
    Ok((fixture, predictions))
}

fn exported_segment(row: &TranscriptEvidence) -> GoldSegment {
    GoldSegment {
        id: row.evidence_id.clone(),
        start: row.audio_start_time,
        end: row.audio_end_time,
        text: row.transcript.clone(),
        capture_completeness: row.capture_completeness.as_str().to_string(),
    }
}

fn exported_item(item: &KnowledgeItemView) -> PredictedItem {
    PredictedItem {
        pred_id: item.item_id.clone(),
        item_type: item.item_type,
        text: item.text.clone(),
        owner: item.owner_text.clone(),
        due: item.due_text.clone(),
        links: item
            .evidence
            .iter()
            .map(|link| PredictedLink {
                segment_id: link.evidence_id.clone(),
                role: link.role.as_str().to_string(),
                raw_start: link.raw_start.max(0) as usize,
                raw_end: link.raw_end.max(0) as usize,
                quote: link.quote_text.clone(),
            })
            .collect(),
    }
}

pub async fn review_outcomes(
    db_path: &Path,
    meeting_ids: &[String],
) -> Result<BTreeMap<String, ReviewOutcomeRates>, ReplayError> {
    if meeting_ids.iter().any(|id| Uuid::parse_str(id).is_err()) {
        return Err(ReplayError::InvalidMeetingId);
    }
    let rows = review_rows(&read_only_pool(db_path).await?, meeting_ids).await?;
    let mut by_type: BTreeMap<String, Vec<(String, bool)>> = BTreeMap::new();
    for (item_type, state, corrected) in rows {
        by_type.entry(item_type).or_default().push((state, corrected));
    }
    Ok(by_type
        .into_iter()
        .map(|(item_type, states)| {
            let total = states.len() as u64;
            let count = |check: &dyn Fn(&(String, bool)) -> bool| states.iter().filter(|state| check(state)).count() as u64;
            let rates = ReviewOutcomeRates {
                accepted: ratio(count(&|(state, corrected)| state == "accepted" && !corrected), total),
                corrected: ratio(count(&|(state, corrected)| state == "accepted" && *corrected), total),
                rejected: ratio(count(&|(state, _)| state == "rejected"), total),
                pending: ratio(count(&|(state, _)| state == "proposed"), total),
            };
            (item_type, rates)
        })
        .collect())
}

async fn review_rows(pool: &SqlitePool, meeting_ids: &[String]) -> Result<Vec<(String, String, bool)>, ReplayError> {
    if meeting_ids.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = vec!["?"; meeting_ids.len()].join(", ");
    let sql = format!(
        "SELECT item_type, review_state, corrected FROM knowledge_item_current WHERE meeting_id IN ({placeholders})"
    );
    meeting_ids
        .iter()
        .fold(sqlx::query_as(&sql), |query, meeting_id| query.bind(meeting_id))
        .fetch_all(pool)
        .await
        .map_err(|_| ReplayError::Storage)
}
