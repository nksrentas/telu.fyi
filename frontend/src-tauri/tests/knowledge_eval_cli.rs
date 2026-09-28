use app_lib::knowledge::models::{KnowledgeType, RunStatus, TriggerKind};
use app_lib::knowledge::repository::{KnowledgeRepository, NewItem, NewRun, RunCounts};
use app_lib::knowledge::span_verifier::{sha256_hex, AttributeSupport, VerifiedSpan};
use chrono::Utc;
use serde_json::Value;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

fn runner() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_telu-knowledge-eval"))
}

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/knowledge-eval")
}

fn run(args: &[&str]) -> Output {
    Command::new(runner()).args(args).output().expect("run telu-knowledge-eval")
}

fn text(path: &Path) -> String {
    fs::read_to_string(path).expect("output file")
}

fn replay_predictions(out: &Path) -> PathBuf {
    let output = run(&[
        "run",
        "--gold-dir",
        fixtures().to_str().unwrap(),
        "--replay-completions",
        fixtures().join("completions-sample.json").to_str().unwrap(),
        "--out",
        out.to_str().unwrap(),
    ]);
    assert!(output.status.success(), "run failed: {}", String::from_utf8_lossy(&output.stderr));
    out.join("predictions.json")
}

fn fixture_texts() -> Vec<String> {
    fs::read_dir(fixtures())
        .expect("fixture dir")
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter_map(|path| serde_json::from_str::<Value>(&text(&path)).ok())
        .filter(|value| value.get("fixtureId").is_some())
        .flat_map(|value| {
            let segments = value["segments"].as_array().cloned().unwrap_or_default();
            let gold = value["gold"].as_array().cloned().unwrap_or_default();
            segments
                .into_iter()
                .chain(gold)
                .filter_map(|entry| entry["text"].as_str().map(str::to_string))
                .collect::<Vec<_>>()
        })
        .collect()
}

#[test]
fn score_writes_a_content_free_report_tied_to_the_thresholds_file() {
    let temp = tempfile::tempdir().expect("temp dir");
    let predictions = replay_predictions(&temp.path().join("run"));
    let out = temp.path().join("score");

    let output = run(&[
        "score",
        "--gold-dir",
        fixtures().to_str().unwrap(),
        "--predictions",
        predictions.to_str().unwrap(),
        "--labels",
        fixtures().join("labels-sample.json").to_str().unwrap(),
        "--thresholds",
        fixtures().join("thresholds-test.json").to_str().unwrap(),
        "--out",
        out.to_str().unwrap(),
        "--commit",
        "test-commit",
    ]);

    assert!(output.status.success(), "score failed: {}", String::from_utf8_lossy(&output.stderr));
    let report = text(&out.join("report.json"));
    let parsed: Value = serde_json::from_str(&report).expect("report json");
    assert_eq!(parsed["thresholdsSha256"].as_str().map(str::len), Some(64));
    assert!(parsed.get("gate").is_some());
    assert_eq!(parsed["gitCommit"], "test-commit");
    for fixture_text in fixture_texts() {
        assert!(!report.contains(&fixture_text), "report leaked fixture text");
    }
}

fn score_with_thresholds(predictions: &Path, thresholds: &Path, out: &Path) -> Output {
    run(&[
        "score",
        "--gold-dir",
        fixtures().to_str().unwrap(),
        "--predictions",
        predictions.to_str().unwrap(),
        "--labels",
        fixtures().join("labels-sample.json").to_str().unwrap(),
        "--thresholds",
        thresholds.to_str().unwrap(),
        "--out",
        out.to_str().unwrap(),
    ])
}

fn misspelled_thresholds(directory: &Path, name: &str, key: &str, typo: &str) -> PathBuf {
    let original = text(&fixtures().join("thresholds-test.json"));
    let path = directory.join(name);
    fs::write(&path, original.replacen(&format!("\"{key}\""), &format!("\"{typo}\""), 1)).expect("thresholds copy");
    path
}

#[test]
fn score_rejects_a_thresholds_file_that_is_not_v2() {
    let temp = tempfile::tempdir().expect("temp dir");
    let predictions = replay_predictions(&temp.path().join("run"));
    let candidates = [
        fixtures().join("thresholds-v1.json"),
        misspelled_thresholds(temp.path(), "scope.json", "decision", "decisoin"),
        misspelled_thresholds(temp.path(), "metric.json", "claimCorrectness", "claimCorectness"),
    ];

    for (index, thresholds) in candidates.iter().enumerate() {
        let output = score_with_thresholds(&predictions, thresholds, &temp.path().join(format!("out-{index}")));

        assert!(!output.status.success(), "thresholds candidate {index} was accepted");
        assert!(String::from_utf8_lossy(&output.stderr).contains("THRESHOLDS_INVALID"), "candidate {index}");
    }
}

#[test]
fn score_rejects_inputs_over_32_mib() {
    let temp = tempfile::tempdir().expect("temp dir");
    let oversized = temp.path().join("labels.json");
    fs::File::create(&oversized)
        .expect("oversized file")
        .set_len(33 * 1024 * 1024)
        .expect("sparse size");

    let output = run(&[
        "score",
        "--gold-dir",
        fixtures().to_str().unwrap(),
        "--predictions",
        oversized.to_str().unwrap(),
        "--labels",
        fixtures().join("labels-sample.json").to_str().unwrap(),
        "--thresholds",
        fixtures().join("thresholds-test.json").to_str().unwrap(),
        "--out",
        temp.path().join("out").to_str().unwrap(),
    ]);

    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("INPUT_TOO_LARGE"));
}

#[test]
fn run_replays_completions_through_the_production_pipeline_without_resurrection() {
    let temp = tempfile::tempdir().expect("temp dir");

    let predictions: Value = serde_json::from_str(&text(&replay_predictions(temp.path()))).expect("predictions");

    let standup = predictions["fixtures"]
        .as_array()
        .and_then(|fixtures| fixtures.iter().find(|fixture| fixture["fixtureId"] == "representative-standup"))
        .expect("standup predictions");
    assert_eq!(standup["items"].as_array().map(Vec::len), Some(4));
    assert_eq!(standup["abstentions"][0]["reason"], "quote_not_found");
    assert_eq!(standup["duplicates"].as_array().map(Vec::len), Some(1));
    assert_eq!(standup["items"][1]["owner"], "Maria");
    assert_eq!(standup["items"][1]["due"], "by Thursday");
    assert_eq!(predictions["resurrectionCount"], 0);
}

async fn seed_database(path: &Path, meeting_ids: &[&str]) {
    let pool: SqlitePool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().filename(path).create_if_missing(true))
        .await
        .expect("temp database");
    sqlx::migrate!("./migrations").run(&pool).await.expect("migrations");
    for (index, meeting_id) in meeting_ids.iter().enumerate() {
        seed_meeting(&pool, meeting_id, index).await;
    }
    pool.close().await;
}

async fn seed_meeting(pool: &SqlitePool, meeting_id: &str, index: usize) {
    let now = Utc::now();
    let text = "We decided to ship the beta on Friday.";
    let evidence_id = format!("018f5e27-2f68-7e27-9c90-7c72123160{index:02x}");
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc)
         VALUES (?, 'Export', ?, ?, 'complete', 'complete', NULL, ?)",
    )
    .bind(meeting_id)
    .bind(now)
    .bind(now)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .expect("meeting");
    sqlx::query(
        "INSERT INTO transcript_evidence (evidence_id, meeting_id, source_track, source_segment_key, sequence,
            transcript, audio_start_time, audio_end_time, is_final, capture_completeness, created_at, updated_at)
         VALUES (?, ?, 'mixed', 'segment-0', 0, ?, 0.0, 4.0, 1, 'complete', ?, ?)",
    )
    .bind(&evidence_id)
    .bind(meeting_id)
    .bind(text)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .expect("evidence");
    let run_id = format!("018f5e27-2f68-7e27-9c90-7c72123161{index:02x}");
    KnowledgeRepository::insert_running_run(
        pool,
        &NewRun {
            run_id: run_id.clone(),
            meeting_id: meeting_id.to_string(),
            trigger_kind: TriggerKind::User,
            provider_id: "ollama".to_string(),
            model_id: "llama3".to_string(),
            location_class: "local".to_string(),
            sanitized_origin: "This device".to_string(),
            prompt_version: "knowledge-extract-v2".to_string(),
            meeting_completeness_at_start: "complete".to_string(),
            input_evidence_count: 1,
            input_fingerprint: "fingerprint".to_string(),
        },
    )
    .await
    .expect("run");
    let item = NewItem {
        item_id: format!("018f5e27-2f68-7e27-9c90-7c72123162{index:02x}"),
        item_type: KnowledgeType::Decision,
        text: "Ship the beta on Friday".to_string(),
        normalized_key: "ship the beta on friday".to_string(),
        claims: vec![VerifiedSpan {
            evidence_id,
            raw_start: 14,
            raw_end: 37,
            quote_text: "ship the beta on Friday".to_string(),
            normalized_quote: "ship the beta on friday".to_string(),
            evidence_text_sha256: sha256_hex(text),
            segment_capture_incomplete: false,
        }],
        owner: AttributeSupport::NotStated,
        due: AttributeSupport::NotStated,
    };
    let mut transaction = pool.begin().await.expect("transaction");
    KnowledgeRepository::insert_items_with_links(&mut transaction, meeting_id, &run_id, &[item])
        .await
        .expect("items");
    KnowledgeRepository::finalize_run(
        &mut transaction,
        &run_id,
        RunStatus::Succeeded,
        RunCounts {
            proposed: 1,
            ..RunCounts::default()
        },
        None,
    )
    .await
    .expect("finalize");
    transaction.commit().await.expect("commit");
}

#[tokio::test]
async fn export_reads_one_meeting_from_the_app_database_and_rejects_bad_ids() {
    let temp = tempfile::tempdir().expect("temp dir");
    let database = temp.path().join("telu.sqlite");
    let exported = "018f5e27-2f68-7e27-9c90-7c7212316301";
    let other = "018f5e27-2f68-7e27-9c90-7c7212316302";
    seed_database(&database, &[exported, other]).await;
    let out = temp.path().join("export");

    let output = run(&["export", "--db", database.to_str().unwrap(), "--meeting", exported, "--out", out.to_str().unwrap()]);
    let refused = run(&["export", "--db", database.to_str().unwrap(), "--meeting", "not-a-uuid", "--out", out.to_str().unwrap()]);

    assert!(output.status.success(), "export failed: {}", String::from_utf8_lossy(&output.stderr));
    let predictions: Value = serde_json::from_str(&text(&out.join("predictions.json"))).expect("predictions");
    let fixtures = predictions["fixtures"].as_array().expect("fixtures");
    assert_eq!(fixtures.len(), 1);
    assert_eq!(fixtures[0]["fixtureId"], exported);
    assert_eq!(fixtures[0]["items"][0]["links"][0]["quote"], "ship the beta on Friday");
    assert!(out.join("fixtures").join(format!("{exported}.json")).exists());
    assert!(!refused.status.success());
    assert!(String::from_utf8_lossy(&refused.stderr).contains("INVALID_MEETING_ID"));
}
