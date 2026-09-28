use super::*;
use crate::database::repositories::transcript::TranscriptsRepository;
use crate::knowledge::models::{CorrectionInput, ReviewAction};
use crate::knowledge::prompt::PROMPT_VERSION;
use crate::knowledge::repository::NewRun;
use crate::knowledge::review::{append_review, correct_item};
use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};

const TEXTS: [&str; 4] = [
    "We agreed to ship the beta on Friday.",
    "We will cancel the offsite this year.",
    "We need to hire two engineers soon.",
    "Let us move standup to ten tomorrow.",
];

async fn meeting() -> (SqlitePool, Vec<TranscriptEvidence>) {
    let pool = migrated_pool().await;
    insert_meeting(&pool, MEETING_ID, "complete", "complete").await;
    for (sequence, text) in TEXTS.iter().enumerate() {
        let evidence_id = format!("018f5e27-2f68-7e27-9c90-7c72123147{sequence:02x}");
        insert_evidence(&pool, MEETING_ID, &evidence_id, sequence as i64, text).await;
    }
    let evidence = TranscriptsRepository::list_evidence_by_meeting(&pool, MEETING_ID)
        .await
        .expect("evidence rows");
    (pool, evidence)
}

fn candidate(text: &str, segment: &str, quote: &str) -> String {
    format!(r#"{{"type":"decision","text":"{text}","evidence":[{{"segment":"{segment}","quote":"{quote}"}}]}}"#)
}

async fn run(pool: &SqlitePool, evidence: &[TranscriptEvidence], run_id: &str, items: &[String]) -> RunOutcome {
    KnowledgeRepository::insert_running_run(
        pool,
        &NewRun {
            run_id: run_id.to_string(),
            meeting_id: MEETING_ID.to_string(),
            trigger_kind: TriggerKind::Regenerate,
            provider_id: "ollama".to_string(),
            model_id: "llama3".to_string(),
            location_class: "local".to_string(),
            sanitized_origin: "This device".to_string(),
            prompt_version: PROMPT_VERSION.to_string(),
            meeting_completeness_at_start: "complete".to_string(),
            input_evidence_count: evidence.len() as i64,
            input_fingerprint: input_fingerprint(evidence),
        },
    )
    .await
    .expect("running run");
    let reply = format!("{{\"items\":[{}]}}", items.join(","));
    run_extraction(pool, MEETING_ID, run_id, evidence, 100_000, &CancellationToken::new(), move |_, _| {
        let reply = reply.clone();
        async move { Ok(reply) }
    })
    .await
    .expect("run outcome")
}

async fn item_id(pool: &SqlitePool, text: &str) -> String {
    sqlx::query_scalar("SELECT item_id FROM knowledge_items WHERE text = ?")
        .bind(text)
        .fetch_one(pool)
        .await
        .expect("item id")
}

async fn reasons(pool: &SqlitePool, run_id: &str) -> Vec<String> {
    sqlx::query_scalar("SELECT reason FROM knowledge_suppressions WHERE run_id = ? ORDER BY reason")
        .bind(run_id)
        .fetch_all(pool)
        .await
        .expect("suppression reasons")
}

async fn reviewed_meeting() -> (SqlitePool, Vec<TranscriptEvidence>) {
    let (pool, evidence) = meeting().await;
    run(
        &pool,
        &evidence,
        "018f5e27-2f68-7e27-9c90-7c7212314801",
        &[
            candidate("Ship the beta on Friday", "S1", "ship the beta on Friday"),
            candidate("Cancel the offsite", "S2", "cancel the offsite this year"),
            candidate("Hire two engineers", "S3", "hire two engineers soon"),
        ],
    )
    .await;
    let (a, b, c) = (
        item_id(&pool, "Ship the beta on Friday").await,
        item_id(&pool, "Cancel the offsite").await,
        item_id(&pool, "Hire two engineers").await,
    );
    append_review(&pool, MEETING_ID, &a, ReviewAction::Accept).await.expect("accept A");
    append_review(&pool, MEETING_ID, &b, ReviewAction::Reject).await.expect("reject B");
    let correction = CorrectionInput {
        text: "Hire three engineers".to_string(),
        owner_text: None,
        due_text: None,
        based_on_revision_id: None,
    };
    correct_item(&pool, MEETING_ID, &c, &correction).await.expect("correct C");
    (pool, evidence)
}

fn regenerate_candidates() -> Vec<String> {
    vec![
        candidate("Ship the beta on Friday", "S1", "ship the beta on Friday"),
        candidate("Cancel the offsite", "S2", "cancel the offsite this year"),
        candidate("Hire two engineers", "S3", "hire two engineers soon"),
        candidate("Hire three engineers", "S3", "hire two engineers soon"),
        candidate("Move standup to ten", "S4", "move standup to ten tomorrow"),
    ]
}

#[tokio::test]
async fn knowledge_regenerate_never_resurrects_rejected_or_corrected_wording() {
    let (pool, evidence) = reviewed_meeting().await;
    let regenerate_run = "018f5e27-2f68-7e27-9c90-7c7212314802";

    let outcome = run(&pool, &evidence, regenerate_run, &regenerate_candidates()).await;

    assert_eq!(
        outcome.counts,
        RunCounts {
            proposed: 1,
            skipped: 0,
            suppressed: 1,
            reconfirmed: 3,
            duplicate: 0,
        }
    );
    assert_eq!(
        reasons(&pool, regenerate_run).await,
        vec!["matched_rejected", "reconfirmed_accepted", "reconfirmed_accepted", "reconfirmed_accepted"]
    );
    let new_texts: Vec<String> = sqlx::query_scalar("SELECT text FROM knowledge_items WHERE origin_run_id = ?")
        .bind(regenerate_run)
        .fetch_all(&pool)
        .await
        .expect("new items");
    assert_eq!(new_texts, vec!["Move standup to ten"]);
}

#[tokio::test]
async fn knowledge_regenerate_keeps_rejected_items_out_of_review_and_eligibility() {
    let (pool, evidence) = reviewed_meeting().await;
    run(&pool, &evidence, "018f5e27-2f68-7e27-9c90-7c7212314802", &regenerate_candidates()).await;

    let view = KnowledgeRepository::meeting_view(&pool, MEETING_ID)
        .await
        .expect("meeting view");
    let eligible = KnowledgeRepository::list_eligible_items(&pool, MEETING_ID)
        .await
        .expect("eligible items");

    assert!(view.items.iter().all(|item| item.text != "Cancel the offsite"));
    assert_eq!(view.rejected.len(), 1);
    assert!(eligible.iter().all(|item| item.review_state == ReviewState::Accepted));
    assert!(eligible.iter().all(|item| item.text != "Cancel the offsite"));
}

#[tokio::test]
async fn knowledge_regenerate_after_restore_marks_the_restored_item_duplicate_pending() {
    let (pool, evidence) = reviewed_meeting().await;
    let b = item_id(&pool, "Cancel the offsite").await;
    append_review(&pool, MEETING_ID, &b, ReviewAction::Restore).await.expect("restore B");
    let regenerate_run = "018f5e27-2f68-7e27-9c90-7c7212314803";

    let outcome = run(
        &pool,
        &evidence,
        regenerate_run,
        &[candidate("Cancel the offsite", "S2", "cancel the offsite this year")],
    )
    .await;
    let restored = KnowledgeRepository::item_view(&pool, MEETING_ID, &b)
        .await
        .expect("restored item");

    assert_eq!((outcome.counts.proposed, outcome.counts.duplicate), (0, 1));
    assert_eq!(reasons(&pool, regenerate_run).await, vec!["duplicate_pending"]);
    assert_eq!(restored.review_state, ReviewState::Proposed);
}

#[tokio::test]
async fn knowledge_run_merges_repeated_candidates_into_one_item() {
    let (pool, evidence) = meeting().await;
    let run_id = "018f5e27-2f68-7e27-9c90-7c7212314804";
    let repeated = candidate("Ship the beta on Friday", "S1", "ship the beta on Friday");

    let outcome = run(&pool, &evidence, run_id, &[repeated.clone(), repeated]).await;

    assert_eq!((outcome.counts.proposed, outcome.counts.duplicate), (1, 1));
    assert_eq!(reasons(&pool, run_id).await, vec!["duplicate_in_run"]);
}

#[tokio::test]
async fn knowledge_suppressions_are_append_only() {
    let (pool, evidence) = meeting().await;
    let repeated = candidate("Ship the beta on Friday", "S1", "ship the beta on Friday");
    run(&pool, &evidence, "018f5e27-2f68-7e27-9c90-7c7212314805", &[repeated.clone(), repeated]).await;

    let update = sqlx::query("UPDATE knowledge_suppressions SET reason = 'matched_rejected'")
        .execute(&pool)
        .await;

    assert!(update.is_err());
}
