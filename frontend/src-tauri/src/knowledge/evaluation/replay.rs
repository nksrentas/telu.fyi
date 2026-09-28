use super::{
    ratio, FixtureCategory, FixturePredictions, GoldFixture, GoldSegment, PredictedAbstention,
    PredictedItem, PredictedLink, PredictionSet, ReviewOutcomeRates,
};
use crate::database::models::{CaptureCompleteness, DateTimeUtc, TranscriptEvidence};
use crate::database::repositories::transcript::TranscriptsRepository;
use crate::knowledge::extraction::{extract_from_segments, input_fingerprint, run_extraction, ExtractionOutcome};
use crate::knowledge::matcher::normalized_key;
use crate::knowledge::models::{KnowledgeItemView, KnowledgeType, ReviewAction, SuppressionReason, TriggerKind};
use crate::knowledge::prompt::PROMPT_VERSION;
use crate::knowledge::repository::{KnowledgeRepository, NewRun};
use crate::knowledge::review::append_review;
use crate::knowledge::span_verifier::{AttributeSupport, LabeledSegment, LabeledSegments, VerifiedSpan};
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const REPLAY_BUDGET_TOKENS: usize = 100_000;
const EMPTY_REPLY: &str = "{\"items\": []}";

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
    let mut resurrection = 0;
    for fixture in fixtures {
        let replies = completions.get(&fixture.fixture_id).cloned().unwrap_or_default();
        let outcome = extract_fixture(fixture, &replies).await;
        predicted.push(fixture_predictions(&fixture.fixture_id, &outcome));
        resurrection += measure_resurrection(fixture, &replies).await?;
    }
    Ok(PredictionSet {
        prompt_version: PROMPT_VERSION.to_string(),
        fixtures: predicted,
        resurrection_count: Some(resurrection),
    })
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
            .filter(|suppression| {
                matches!(suppression.reason, SuppressionReason::DuplicateInRun | SuppressionReason::DuplicatePending)
            })
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

async fn measure_resurrection(fixture: &GoldFixture, replies: &[String]) -> Result<u64, ReplayError> {
    let pool = replay_pool().await?;
    let meeting_id = Uuid::new_v4().to_string();
    seed_meeting(&pool, &meeting_id, &fixture.segments).await?;
    let evidence = TranscriptsRepository::list_evidence_by_meeting(&pool, &meeting_id)
        .await
        .map_err(|_| ReplayError::Storage)?;
    let first_run = replay_run(&pool, &meeting_id, &evidence, replies, TriggerKind::User).await?;
    let rejected = items_of_run(&pool, &meeting_id, &first_run).await?;
    for item in &rejected {
        append_review(&pool, &meeting_id, &item.item_id, ReviewAction::Reject)
            .await
            .map_err(|_| ReplayError::Storage)?;
    }
    let second_run = replay_run(&pool, &meeting_id, &evidence, replies, TriggerKind::Regenerate).await?;
    let resurrected = items_of_run(&pool, &meeting_id, &second_run)
        .await?
        .iter()
        .filter(|item| {
            rejected.iter().any(|old| {
                old.item_type == item.item_type && normalized_key(&old.text) == normalized_key(&item.text)
            })
        })
        .count();
    Ok(resurrected as u64)
}

async fn replay_pool() -> Result<SqlitePool, ReplayError> {
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

async fn seed_meeting(pool: &SqlitePool, meeting_id: &str, segments: &[GoldSegment]) -> Result<(), ReplayError> {
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

async fn replay_run(
    pool: &SqlitePool,
    meeting_id: &str,
    evidence: &[TranscriptEvidence],
    replies: &[String],
    trigger: TriggerKind,
) -> Result<String, ReplayError> {
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
    run_extraction(pool, meeting_id, &run_id, evidence, REPLAY_BUDGET_TOKENS, &CancellationToken::new(), replayer(replies))
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
    for meeting_id in meeting_ids {
        let (fixture, predictions) = export_meeting(&pool, meeting_id).await?;
        fixtures.push(fixture);
        predicted.push(predictions);
    }
    Ok((
        fixtures,
        PredictionSet {
            prompt_version: PROMPT_VERSION.to_string(),
            fixtures: predicted,
            resurrection_count: None,
        },
    ))
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
         WHERE s.meeting_id = ? AND s.reason IN ('duplicate_pending', 'duplicate_in_run')",
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

pub async fn review_outcomes(db_path: &Path) -> Result<BTreeMap<String, ReviewOutcomeRates>, ReplayError> {
    let pool = read_only_pool(db_path).await?;
    let rows: Vec<(String, String, bool)> =
        sqlx::query_as("SELECT item_type, review_state, corrected FROM knowledge_item_current")
            .fetch_all(&pool)
            .await
            .map_err(|_| ReplayError::Storage)?;
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
