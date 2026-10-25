use app_lib::api::delete_meeting_then_cancel_extraction;
use app_lib::database::models::TranscriptEvidence;
use app_lib::database::repositories::transcript::TranscriptsRepository;
use app_lib::knowledge::extraction::{input_fingerprint, run_extraction, RunOutcome};
use app_lib::knowledge::models::{
    CorrectionInput, KnowledgeDeletionImpact, KnowledgeItemView, MeetingKnowledgeView,
    ReviewAction, ReviewState, RunStatus, TriggerKind,
};
use app_lib::knowledge::prompt::{EXTRACTION_SYSTEM_PROMPT, PROMPT_VERSION};
use app_lib::knowledge::repository::{KnowledgeRepository, NewRun, RunCounts};
use app_lib::knowledge::review::{append_review, correct_item};
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::future::{ready, Ready};
use tokio_util::sync::CancellationToken;

const MEETING_ID: &str = "018f5e27-2f68-7e27-9c90-7c7212318001";
const FIRST_RUN: &str = "018f5e27-2f68-7e27-9c90-7c7212318201";
const REGENERATE_RUN: &str = "018f5e27-2f68-7e27-9c90-7c7212318202";
const EMPTY_REPLY: &str = "{\"items\": []}";
const TRANSCRIPT: [&str; 4] = [
    "We agreed to ship the beta on Friday.",
    "We will cancel the offsite this year.",
    "We need to hire two engineers soon.",
    "Let us move standup to ten tomorrow.",
];
const ACCEPTED: &str = "Ship the beta on Friday";
const REJECTED: &str = "Cancel the offsite";
const CORRECTED: &str = "Hire two engineers";
const FRESH: &str = "Move standup to ten";

async fn migrated_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await
        .expect("database");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations");
    pool
}

async fn completed_meeting(pool: &SqlitePool) -> Vec<TranscriptEvidence> {
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc)
         VALUES (?, 'Review loop', ?, ?, 'complete', 'complete', NULL, ?)",
    )
    .bind(MEETING_ID)
    .bind(now)
    .bind(now)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .expect("meeting");
    for (sequence, text) in TRANSCRIPT.iter().enumerate() {
        let start = sequence as f64 * 5.0;
        sqlx::query(
            "INSERT INTO transcript_evidence (evidence_id, meeting_id, source_track, source_segment_key, sequence,
                transcript, audio_start_time, audio_end_time, is_final, capture_completeness, created_at, updated_at)
             VALUES (?, ?, 'mixed', ?, ?, ?, ?, ?, 1, 'complete', ?, ?)",
        )
        .bind(format!("018f5e27-2f68-7e27-9c90-7c72123181{sequence:02x}"))
        .bind(MEETING_ID)
        .bind(format!("segment-{sequence}"))
        .bind(sequence as i64)
        .bind(text)
        .bind(start)
        .bind(start + 4.0)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .expect("evidence");
    }
    TranscriptsRepository::list_evidence_by_meeting(pool, MEETING_ID)
        .await
        .expect("evidence rows")
}

fn candidate(item_type: &str, text: &str, segment: &str, quote: &str) -> String {
    format!(
        r#"{{"type":"{item_type}","text":"{text}","evidence":[{{"segment":"{segment}","quote":"{quote}"}}],"owner":null,"due":null}}"#
    )
}

fn staged_model(
    candidates: &[String],
) -> impl FnMut(String, String) -> Ready<Result<String, String>> {
    let mut extraction = Some(format!("{{\"items\":[{}]}}", candidates.join(",")));
    move |system_prompt: String, _: String| {
        let reply = match system_prompt.as_str() {
            EXTRACTION_SYSTEM_PROMPT => extraction.take(),
            _ => None,
        };
        ready(Ok(reply.unwrap_or_else(|| EMPTY_REPLY.to_string())))
    }
}

async fn run(
    pool: &SqlitePool,
    evidence: &[TranscriptEvidence],
    run_id: &str,
    trigger: TriggerKind,
    candidates: &[String],
) -> RunOutcome {
    let run = NewRun {
        run_id: run_id.to_string(),
        meeting_id: MEETING_ID.to_string(),
        trigger_kind: trigger,
        provider_id: "staged".to_string(),
        model_id: "staged-model".to_string(),
        location_class: "local".to_string(),
        sanitized_origin: "This device".to_string(),
        prompt_version: PROMPT_VERSION.to_string(),
        meeting_completeness_at_start: "complete".to_string(),
        input_evidence_count: evidence.len() as i64,
        input_fingerprint: input_fingerprint(evidence),
    };
    KnowledgeRepository::insert_running_run(pool, &run)
        .await
        .expect("running run");
    run_extraction(
        pool,
        MEETING_ID,
        run_id,
        evidence,
        100_000,
        &CancellationToken::new(),
        staged_model(candidates),
    )
    .await
    .expect("run outcome")
}

async fn view(pool: &SqlitePool) -> MeetingKnowledgeView {
    KnowledgeRepository::meeting_view(pool, MEETING_ID)
        .await
        .expect("meeting view")
}

fn find<'a>(items: &'a [KnowledgeItemView], text: &str) -> Option<&'a KnowledgeItemView> {
    items.iter().find(|item| item.text == text)
}

async fn meeting_scoped_residue(pool: &SqlitePool) -> Vec<(String, i64)> {
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT m.name FROM sqlite_master m JOIN pragma_table_info(m.name) p
         WHERE m.type = 'table' AND p.name = 'meeting_id' ORDER BY m.name",
    )
    .fetch_all(pool)
    .await
    .expect("tables");
    let mut residue = Vec::new();
    for table in tables {
        let count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {table} WHERE meeting_id = ?"
        ))
        .bind(MEETING_ID)
        .fetch_one(pool)
        .await
        .expect("count");
        residue.push((table, count));
    }
    residue
}

fn first_run_candidates() -> Vec<String> {
    vec![
        candidate("decision", ACCEPTED, "S1", "ship the beta on Friday"),
        candidate("decision", REJECTED, "S2", "cancel the offsite this year"),
        candidate("commitment", CORRECTED, "S3", "hire two engineers soon"),
    ]
}

fn regenerate_candidates() -> Vec<String> {
    vec![
        candidate("decision", ACCEPTED, "S1", "ship the beta on Friday"),
        candidate("decision", REJECTED, "S2", "cancel the offsite this year"),
        candidate("commitment", REJECTED, "S2", "cancel the offsite this year"),
        candidate("commitment", CORRECTED, "S3", "hire two engineers soon"),
        candidate("decision", FRESH, "S4", "move standup to ten tomorrow"),
    ]
}

#[tokio::test]
async fn review_regenerate_restore_and_delete_loop_with_a_staged_model() {
    let pool = migrated_pool().await;
    let evidence = completed_meeting(&pool).await;

    let first = run(
        &pool,
        &evidence,
        FIRST_RUN,
        TriggerKind::User,
        &first_run_candidates(),
    )
    .await;
    assert_eq!(first.status, RunStatus::Succeeded);
    assert_eq!(first.counts.proposed, 3);
    let proposed = view(&pool).await;
    let id_of = |text: &str| {
        find(&proposed.items, text)
            .unwrap_or_else(|| panic!("{text} proposed"))
            .item_id
            .clone()
    };
    let (accepted_id, rejected_id, corrected_id) =
        (id_of(ACCEPTED), id_of(REJECTED), id_of(CORRECTED));
    assert!(proposed
        .items
        .iter()
        .all(|item| item.review_state == ReviewState::Proposed && !item.eligibility));

    append_review(&pool, MEETING_ID, &accepted_id, ReviewAction::Accept)
        .await
        .expect("accept");
    let owner = CorrectionInput {
        text: CORRECTED.to_string(),
        owner_text: Some("Maria".to_string()),
        due_text: None,
        based_on_revision_id: None,
    };
    correct_item(&pool, MEETING_ID, &corrected_id, &owner)
        .await
        .expect("correct");
    append_review(&pool, MEETING_ID, &rejected_id, ReviewAction::Reject)
        .await
        .expect("reject");

    let regenerate = run(
        &pool,
        &evidence,
        REGENERATE_RUN,
        TriggerKind::Regenerate,
        &regenerate_candidates(),
    )
    .await;
    assert_eq!(regenerate.status, RunStatus::Succeeded);
    assert_eq!(
        regenerate.counts,
        RunCounts {
            proposed: 1,
            skipped: 0,
            suppressed: 2,
            reconfirmed: 2,
            duplicate: 0
        }
    );
    let regenerated = view(&pool).await;
    let regenerated_texts: Vec<&str> = regenerated
        .items
        .iter()
        .map(|item| item.text.as_str())
        .collect();
    assert_eq!(
        regenerated_texts
            .iter()
            .filter(|text| **text == REJECTED)
            .count(),
        0,
        "rejected claim resurrected: {regenerated_texts:?}"
    );
    assert_eq!(
        regenerated_texts
            .iter()
            .filter(|text| **text == ACCEPTED)
            .count(),
        1
    );
    assert_eq!(
        regenerated_texts
            .iter()
            .filter(|text| **text == CORRECTED)
            .count(),
        1
    );
    assert_eq!(
        find(&regenerated.items, FRESH).map(|item| item.origin_run_id.as_str()),
        Some(REGENERATE_RUN)
    );
    assert_eq!(
        regenerated
            .rejected
            .iter()
            .map(|item| item.item_id.as_str())
            .collect::<Vec<_>>(),
        vec![rejected_id.as_str()]
    );
    let corrected = find(&regenerated.items, CORRECTED).expect("corrected item");
    assert_eq!(
        (
            corrected.review_state,
            corrected.corrected,
            corrected.owner_text.as_deref()
        ),
        (ReviewState::Accepted, true, Some("Maria"))
    );
    assert!(corrected.eligibility);

    append_review(&pool, MEETING_ID, &rejected_id, ReviewAction::Restore)
        .await
        .expect("restore");

    let restored_view = view(&pool).await;
    assert!(restored_view.rejected.is_empty());
    let restored = find(&restored_view.items, REJECTED).expect("restored item back in review");
    assert_eq!(restored.item_id, rejected_id);
    assert_eq!(restored.origin_run_id, FIRST_RUN);
    assert_eq!(restored.review_state, ReviewState::Proposed);
    assert!(!restored.eligibility);
    assert!(!restored.corrected);
    assert_eq!(restored.owner_text, None);
    assert_eq!(
        (restored_view.accepted_count, restored_view.pending_count),
        (2, 2)
    );
    let accepted = find(&restored_view.items, ACCEPTED).expect("accepted item");
    assert_eq!(
        (accepted.review_state, accepted.eligibility),
        (ReviewState::Accepted, true)
    );

    let impact = KnowledgeRepository::deletion_impact(&pool, MEETING_ID)
        .await
        .expect("deletion impact");
    assert_eq!(
        impact,
        KnowledgeDeletionImpact {
            accepted: 2,
            suggestions: 2,
            rejected: 0,
            runs: 2
        }
    );
    assert!(meeting_scoped_residue(&pool)
        .await
        .iter()
        .any(|(_, count)| *count > 0));

    assert!(delete_meeting_then_cancel_extraction(&pool, MEETING_ID)
        .await
        .expect("delete"));

    let residue: Vec<(String, i64)> = meeting_scoped_residue(&pool)
        .await
        .into_iter()
        .filter(|(_, count)| *count > 0)
        .collect();
    assert!(residue.is_empty(), "residue after delete: {residue:?}");
    let meetings: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meetings WHERE id = ?")
        .bind(MEETING_ID)
        .fetch_one(&pool)
        .await
        .expect("meetings");
    assert_eq!(meetings, 0);
    let after = view(&pool).await;
    assert!(after.items.is_empty() && after.rejected.is_empty() && after.latest_run.is_none());
}
