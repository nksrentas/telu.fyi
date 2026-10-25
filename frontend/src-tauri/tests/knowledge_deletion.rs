use app_lib::api::delete_meeting_then_cancel_extraction;
use app_lib::database::repositories::meeting::MeetingsRepository;
use app_lib::knowledge::extraction::{has_active_extraction, register_extraction};
use app_lib::knowledge::models::{
    AbstentionReason, CorrectionInput, KnowledgeType, ReviewAction, RunStatus, SuppressionReason, TriggerKind,
};
use app_lib::knowledge::repository::{
    KnowledgeRepository, NewAbstention, NewItem, NewRun, NewSuppression, RunCounts,
};
use app_lib::knowledge::review::{append_review, correct_item};
use app_lib::knowledge::span_verifier::{sha256_hex, AttributeSupport, VerifiedSpan};
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use std::collections::BTreeMap;

const MEETING_A: &str = "018f5e27-2f68-7e27-9c90-7c7212317001";
const MEETING_B: &str = "018f5e27-2f68-7e27-9c90-7c7212317002";
const EVIDENCE_TEXT: &str = "We decided to ship the beta on Friday and Maria owns the notes.";

async fn migrated_pool(directory: &tempfile::TempDir) -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(directory.path().join("telu.sqlite"))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .expect("database");
    sqlx::migrate!("./migrations").run(&pool).await.expect("migrations");
    pool
}

async fn insert_meeting(pool: &SqlitePool, meeting_id: &str) {
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc)
         VALUES (?, 'Deletion', ?, ?, 'complete', 'complete', NULL, ?)",
    )
    .bind(meeting_id)
    .bind(now)
    .bind(now)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .expect("meeting");
}

async fn insert_evidence(pool: &SqlitePool, meeting_id: &str, evidence_id: &str, sequence: i64) {
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO transcript_evidence (evidence_id, meeting_id, source_track, source_segment_key, sequence,
            transcript, audio_start_time, audio_end_time, is_final, capture_completeness, created_at, updated_at)
         VALUES (?, ?, 'mixed', ?, ?, ?, 0.0, 4.0, 1, 'complete', ?, ?)",
    )
    .bind(evidence_id)
    .bind(meeting_id)
    .bind(format!("segment-{sequence}"))
    .bind(sequence)
    .bind(EVIDENCE_TEXT)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .expect("evidence");
}

async fn insert_generic(pool: &SqlitePool, table: &str, overrides: &[(&str, &str)]) {
    let columns = sqlx::query("SELECT name, type, \"notnull\" AS required, pk FROM pragma_table_info(?)")
        .bind(table)
        .fetch_all(pool)
        .await
        .expect("columns");
    let mut names = Vec::new();
    let mut values = Vec::new();
    for column in columns {
        let name: String = column.get("name");
        let kind: String = column.get("type");
        let required: i64 = column.get("required");
        let pk: i64 = column.get("pk");
        let value = match overrides.iter().find(|(key, _)| *key == name) {
            Some((_, value)) => value.to_string(),
            None if required == 0 && pk == 0 => continue,
            None if kind.eq_ignore_ascii_case("INTEGER") => "1".to_string(),
            None if kind.eq_ignore_ascii_case("REAL") => "1.0".to_string(),
            None => format!("{table}-{name}"),
        };
        names.push(name);
        values.push(value);
    }
    let placeholders = vec!["?"; names.len()].join(", ");
    let statement = format!("INSERT INTO {table} ({}) VALUES ({placeholders})", names.join(", "));
    let mut query = sqlx::query(&statement);
    for value in &values {
        query = query.bind(value);
    }
    query.execute(pool).await.unwrap_or_else(|error| panic!("insert {table}: {error}"));
}

fn claim(evidence_id: &str) -> VerifiedSpan {
    VerifiedSpan {
        evidence_id: evidence_id.to_string(),
        raw_start: 14,
        raw_end: 37,
        quote_text: "ship the beta on Friday".to_string(),
        normalized_quote: "ship the beta on friday".to_string(),
        evidence_text_sha256: sha256_hex(EVIDENCE_TEXT),
        segment_capture_incomplete: false,
    }
}

fn new_run(meeting_id: &str, run_id: &str) -> NewRun {
    NewRun {
        run_id: run_id.to_string(),
        meeting_id: meeting_id.to_string(),
        trigger_kind: TriggerKind::User,
        provider_id: "ollama".to_string(),
        model_id: "llama3".to_string(),
        location_class: "local".to_string(),
        sanitized_origin: "This device".to_string(),
        prompt_version: "knowledge-extract-v2".to_string(),
        meeting_completeness_at_start: "complete".to_string(),
        input_evidence_count: 2,
        input_fingerprint: "fingerprint".to_string(),
    }
}

async fn insert_run_with_items(pool: &SqlitePool, meeting_id: &str, run_id: &str, items: Vec<NewItem>, suppress: Option<&str>) {
    KnowledgeRepository::insert_running_run(pool, &new_run(meeting_id, run_id)).await.expect("run");
    let mut transaction = pool.begin().await.expect("transaction");
    KnowledgeRepository::insert_items_with_links(&mut transaction, meeting_id, run_id, &items).await.expect("items");
    let abstention = NewAbstention { reason: AbstentionReason::QuoteNotFound, candidate_type: Some(KnowledgeType::Fact) };
    KnowledgeRepository::insert_abstentions(&mut transaction, meeting_id, run_id, &[abstention]).await.expect("abstentions");
    if let Some(matched_item_id) = suppress {
        let suppression = NewSuppression {
            matched_item_id: matched_item_id.to_string(),
            reason: SuppressionReason::MatchedRejected,
            candidate_normalized_key: "ship the beta on friday".to_string(),
            candidate_text: "Ship the beta on Friday".to_string(),
        };
        KnowledgeRepository::insert_suppressions(&mut transaction, meeting_id, run_id, &[suppression]).await.expect("suppressions");
    }
    let counts = RunCounts { proposed: items.len() as i64, skipped: 1, ..RunCounts::default() };
    KnowledgeRepository::finalize_run(&mut transaction, run_id, RunStatus::Succeeded, counts, None).await.expect("finalize");
    transaction.commit().await.expect("commit");
}

fn item(item_id: &str, evidence_id: &str, owner: bool) -> NewItem {
    let owner_support = if owner {
        AttributeSupport::Stated { text: "Maria".to_string(), spans: vec![claim(evidence_id)] }
    } else {
        AttributeSupport::NotStated
    };
    NewItem {
        item_id: item_id.to_string(),
        item_type: KnowledgeType::Decision,
        text: "Ship the beta on Friday".to_string(),
        normalized_key: "ship the beta on friday".to_string(),
        claims: vec![claim(evidence_id)],
        owner: owner_support,
        due: AttributeSupport::NotStated,
    }
}

async fn populate_meeting_a(pool: &SqlitePool) {
    let (evidence_one, evidence_two) = ("018f5e27-2f68-7e27-9c90-7c7212317101", "018f5e27-2f68-7e27-9c90-7c7212317102");
    insert_meeting(pool, MEETING_A).await;
    insert_evidence(pool, MEETING_A, evidence_one, 0).await;
    insert_evidence(pool, MEETING_A, evidence_two, 1).await;
    let first_item = "018f5e27-2f68-7e27-9c90-7c7212317301";
    insert_run_with_items(pool, MEETING_A, "018f5e27-2f68-7e27-9c90-7c7212317201", vec![item(first_item, evidence_one, true)], None).await;
    let correction = CorrectionInput { text: "Ship the beta Friday".to_string(), owner_text: Some("Maria".to_string()), due_text: None, based_on_revision_id: None };
    correct_item(pool, MEETING_A, first_item, &correction).await.expect("correct");
    let latest = sqlx::query_scalar::<_, String>("SELECT revision_id FROM knowledge_revisions WHERE item_id = ?")
        .bind(first_item)
        .fetch_one(pool)
        .await
        .expect("revision");
    let chained = CorrectionInput { text: "Ship the beta on Friday".to_string(), owner_text: None, due_text: None, based_on_revision_id: Some(latest) };
    correct_item(pool, MEETING_A, first_item, &chained).await.expect("chained correction");
    append_review(pool, MEETING_A, first_item, ReviewAction::Reject).await.expect("reject");
    insert_run_with_items(pool, MEETING_A, "018f5e27-2f68-7e27-9c90-7c7212317202", vec![item("018f5e27-2f68-7e27-9c90-7c7212317302", evidence_two, false)], Some(first_item)).await;
    populate_phase_one_rows(pool, MEETING_A, "evaluation-run-a", evidence_one).await;
    insert_preparation_source(pool, MEETING_A, first_item).await;
}

async fn insert_preparation_source(pool: &SqlitePool, meeting_id: &str, item_id: &str) {
    sqlx::query("INSERT INTO planned_meetings (id, title, created_utc, updated_utc) VALUES ('plan-a', 'Next sync', '', '')")
        .execute(pool)
        .await
        .expect("planned meeting");
    sqlx::query("INSERT INTO preparation_sources (planned_meeting_id, position, kind, meeting_id, knowledge_item_id) VALUES ('plan-a', 0, 'knowledge', ?, ?)")
        .bind(meeting_id)
        .bind(item_id)
        .execute(pool)
        .await
        .expect("preparation source");
}

async fn populate_phase_one_rows(pool: &SqlitePool, meeting_id: &str, evaluation_run: &str, evidence_id: &str) {
    let scoped = [("meeting_id", meeting_id)];
    insert_generic(pool, "meeting_notes", &scoped).await;
    insert_generic(pool, "meeting_finalizations", &[("meeting_id", meeting_id), ("lifecycle", "complete")]).await;
    insert_generic(pool, "meeting_finalization_gaps", &scoped).await;
    insert_generic(pool, "transcript_chunks", &scoped).await;
    insert_generic(pool, "summary_processes", &scoped).await;
    insert_generic(pool, "transcripts", &[("meeting_id", meeting_id), ("id", &format!("transcript-{meeting_id}"))]).await;
    insert_generic(pool, "evaluation_runs", &[("meeting_id", meeting_id), ("run_id", evaluation_run)]).await;
    for table in [
        "evaluation_error_records",
        "evaluation_evidence_commits",
        "evaluation_gap_records",
        "evaluation_outbound_records",
        "evaluation_queue_records",
        "evaluation_resource_records",
        "evaluation_route_records",
        "evaluation_run_summaries",
        "evaluation_stage_records",
        "evaluation_terminal_records",
    ] {
        insert_generic(pool, table, &[("run_id", evaluation_run), ("meeting_id", meeting_id), ("evidence_id", evidence_id), ("sequence", "0")]).await;
    }
}

async fn meeting_scoped_tables(pool: &SqlitePool) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT m.name FROM sqlite_master m JOIN pragma_table_info(m.name) p
         WHERE m.type = 'table' AND p.name = 'meeting_id' ORDER BY m.name",
    )
    .fetch_all(pool)
    .await
    .expect("tables")
}

async fn evaluation_child_tables(pool: &SqlitePool) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT m.name FROM sqlite_master m JOIN pragma_table_info(m.name) p
         WHERE m.type = 'table' AND p.name = 'run_id' AND m.name LIKE 'evaluation_%' AND m.name <> 'evaluation_runs'
         ORDER BY m.name",
    )
    .fetch_all(pool)
    .await
    .expect("tables")
}

async fn counts(pool: &SqlitePool, tables: &[String], column: &str, value: &str) -> BTreeMap<String, i64> {
    let mut result = BTreeMap::new();
    for table in tables {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE {column} = ?"))
            .bind(value)
            .fetch_one(pool)
            .await
            .expect("count");
        result.insert(table.clone(), count);
    }
    result
}

async fn populated() -> (tempfile::TempDir, SqlitePool) {
    let directory = tempfile::tempdir().expect("temp dir");
    let pool = migrated_pool(&directory).await;
    populate_meeting_a(&pool).await;
    insert_meeting(&pool, MEETING_B).await;
    insert_evidence(&pool, MEETING_B, "018f5e27-2f68-7e27-9c90-7c7212317103", 0).await;
    insert_run_with_items(&pool, MEETING_B, "018f5e27-2f68-7e27-9c90-7c7212317203", vec![item("018f5e27-2f68-7e27-9c90-7c7212317303", "018f5e27-2f68-7e27-9c90-7c7212317103", false)], None).await;
    (directory, pool)
}

#[tokio::test]
async fn deleting_a_meeting_leaves_zero_rows_in_every_meeting_scoped_table() {
    let (_directory, pool) = populated().await;
    let tables = meeting_scoped_tables(&pool).await;
    let evaluation_tables = evaluation_child_tables(&pool).await;
    let before_a = counts(&pool, &tables, "meeting_id", MEETING_A).await;
    let before_b = counts(&pool, &tables, "meeting_id", MEETING_B).await;
    assert!(before_a.values().all(|count| *count > 0), "meeting A was not fully populated: {before_a:?}");
    let evaluation_before = counts(&pool, &evaluation_tables, "run_id", "evaluation-run-a").await;
    assert!(evaluation_before.values().all(|count| *count > 0), "evaluation run was not fully populated: {evaluation_before:?}");

    assert!(MeetingsRepository::delete_meeting(&pool, MEETING_A).await.expect("delete"));

    let after_a = counts(&pool, &tables, "meeting_id", MEETING_A).await;
    assert!(after_a.values().all(|count| *count == 0), "residue after delete: {after_a:?}");
    let evaluation_after = counts(&pool, &evaluation_tables, "run_id", "evaluation-run-a").await;
    assert!(evaluation_after.values().all(|count| *count == 0), "evaluation residue: {evaluation_after:?}");
    assert_eq!(counts(&pool, &tables, "meeting_id", MEETING_B).await, before_b);
    let meetings: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meetings WHERE id = ?").bind(MEETING_A).fetch_one(&pool).await.expect("count");
    assert_eq!(meetings, 0);
}

#[tokio::test]
async fn foreign_keys_block_a_meeting_delete_that_would_orphan_knowledge() {
    let (_directory, pool) = populated().await;
    let enabled: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&pool).await.expect("pragma");
    assert_eq!(enabled, 1);

    let error = sqlx::query("DELETE FROM meetings WHERE id = ?").bind(MEETING_A).execute(&pool).await.expect_err("fk");

    assert!(error.to_string().to_lowercase().contains("foreign key"), "unexpected error: {error}");
}

#[tokio::test]
async fn deleting_a_missing_meeting_changes_nothing() {
    let (_directory, pool) = populated().await;
    let tables = meeting_scoped_tables(&pool).await;
    let before = counts(&pool, &tables, "meeting_id", MEETING_A).await;

    let deleted = MeetingsRepository::delete_meeting(&pool, "018f5e27-2f68-7e27-9c90-7c7212317999").await.expect("delete");

    assert!(!deleted);
    assert_eq!(counts(&pool, &tables, "meeting_id", MEETING_A).await, before);
}

#[tokio::test]
async fn a_delete_of_an_unknown_meeting_leaves_its_extraction_running() {
    let (_directory, pool) = populated().await;
    let unknown = "018f5e27-2f68-7e27-9c90-7c7212317998";
    let token = register_extraction(unknown, "run-unknown");

    let deleted = delete_meeting_then_cancel_extraction(&pool, unknown).await.expect("delete");

    assert!(!deleted);
    assert!(!token.is_cancelled());
    assert!(has_active_extraction(unknown));
}

#[tokio::test]
async fn a_delete_that_errors_leaves_the_extraction_running() {
    let (_directory, pool) = populated().await;
    let token = register_extraction(" ", "run-blank");

    delete_meeting_then_cancel_extraction(&pool, " ").await.expect_err("repository error");

    assert!(!token.is_cancelled());
    assert!(has_active_extraction(" "));
}

#[tokio::test]
async fn a_successful_delete_cancels_the_extraction_and_leaves_no_residue() {
    let (_directory, pool) = populated().await;
    let tables = meeting_scoped_tables(&pool).await;
    let token = register_extraction(MEETING_A, "run-a");

    assert!(delete_meeting_then_cancel_extraction(&pool, MEETING_A).await.expect("delete"));

    assert!(token.is_cancelled());
    assert!(!has_active_extraction(MEETING_A));
    let residue = counts(&pool, &tables, "meeting_id", MEETING_A).await;
    assert!(residue.values().all(|count| *count == 0), "residue after delete: {residue:?}");
}
