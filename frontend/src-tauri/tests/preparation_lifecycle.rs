use app_lib::database::repositories::meeting::MeetingsRepository;
use app_lib::documents::commands::{delete, delete_impact};
use app_lib::documents::ingest::{ingest_text, ingest_text_into};
use app_lib::documents::models::DocumentVersion;
use app_lib::documents::repository::list_passages;
use app_lib::knowledge::models::{
    CorrectionInput, KnowledgeType, ReviewAction, RunStatus, TriggerKind,
};
use app_lib::knowledge::repository::{KnowledgeRepository, NewItem, NewRun, RunCounts};
use app_lib::knowledge::review::{append_review, correct_item};
use app_lib::knowledge::span_verifier::{sha256_hex, AttributeSupport, VerifiedSpan};
use app_lib::planning::models::PlannedMeetingInput;
use app_lib::planning::repository as planning;
use app_lib::preparation::briefing::{self, ClaimStatus};
use app_lib::preparation::commands::{get_briefing, StoredBriefing};
use app_lib::preparation::context::{self, Budget};
use app_lib::preparation::models::SelectedSource;
use app_lib::preparation::selection;
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use std::path::PathBuf;
use tempfile::TempDir;

const BUDGET: Budget = Budget {
    per_source_tokens: 1_000,
    total_tokens: 2_000,
};
const ROADMAP: &str = "The marmalade launch moves to March.\n\nQuartz vendors may slip by a week.";
const ROADMAP_V2: &str = "The marmalade launch moves to April.";
const HIRING: &str = "Zephyr panel meets on Tuesday.";

struct Fixture {
    _root: TempDir,
    pool: SqlitePool,
    app_data: PathBuf,
}

async fn fixture() -> Fixture {
    let root = TempDir::new().expect("temp dir");
    let app_data = root.path().join("app-data");
    std::fs::create_dir_all(&app_data).expect("app data");
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(root.path().join("telu.sqlite"))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .expect("database");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations");
    Fixture {
        _root: root,
        pool,
        app_data,
    }
}

impl Fixture {
    async fn paste(&self, title: &str, text: &str) -> DocumentVersion {
        ingest_text(&self.pool, title, text, Utc::now())
            .await
            .expect("paste")
    }

    async fn plan(&self, title: &str) -> String {
        let input = PlannedMeetingInput {
            title: title.to_string(),
            start_utc: None,
            purpose: String::new(),
        };
        planning::create(&self.pool, input, Utc::now())
            .await
            .expect("planned meeting")
            .id
    }

    async fn brief(&self, plan: &str, versions: &[&DocumentVersion], reply: &str) {
        let sources: Vec<SelectedSource> = versions
            .iter()
            .map(|version| SelectedSource::Document {
                version_id: version.id.clone(),
            })
            .collect();
        self.brief_from(plan, sources, reply).await;
    }

    async fn brief_from(&self, plan: &str, sources: Vec<SelectedSource>, reply: &str) {
        selection::select(&self.pool, plan, sources.clone())
            .await
            .expect("selection");
        let packed = context::build(&self.pool, &self.app_data, &sources, BUDGET)
            .await
            .expect("context");
        let reply = reply.to_string();
        let draft = briefing::compose(&packed, move |_, _| {
            let reply = reply.clone();
            async move { Ok(reply) }
        })
        .await
        .expect("compose");
        briefing::save(&self.pool, plan, &packed, draft, Utc::now())
            .await
            .expect("save");
    }

    async fn stored(&self, plan: &str) -> StoredBriefing {
        get_briefing(&self.pool, plan)
            .await
            .expect("briefing view")
            .briefing
            .expect("briefing")
    }
}

const ROADMAP_REPLY: &str = r#"{"statements":[
    {"text":"Launch timing changed.","source":"S1#0","quote":"moves to March"}],
  "questions":[
    {"text":"Which vendor is late?","rationale":"A supplier delay was flagged.","source":"S1#1","quote":"Quartz vendors may slip"}]}"#;

async fn text_columns_containing(pool: &SqlitePool, needle: &str) -> Vec<String> {
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await
    .expect("tables");
    let mut hits = Vec::new();
    for table in tables {
        let columns = sqlx::query(&format!("PRAGMA table_info(\"{table}\")"))
            .fetch_all(pool)
            .await
            .expect("columns");
        for column in columns {
            let name: String = column.get("name");
            let declared: String = column.get("type");
            if !declared.to_ascii_uppercase().contains("TEXT") {
                continue;
            }
            let count: i64 = sqlx::query_scalar(&format!(
                "SELECT COUNT(*) FROM \"{table}\" WHERE instr(\"{name}\", ?) > 0"
            ))
            .bind(needle)
            .fetch_one(pool)
            .await
            .expect("scan");
            if count > 0 {
                hits.push(format!("{table}.{name}"));
            }
        }
    }
    hits
}

#[tokio::test]
async fn replacing_a_selected_document_marks_the_briefing_stale_and_keeps_version_one() {
    let fixture = fixture().await;
    let roadmap = fixture.paste("Roadmap", ROADMAP).await;
    let hiring = fixture.paste("Hiring", HIRING).await;
    let plan = fixture.plan("Launch review").await;
    let other_plan = fixture.plan("Hiring sync").await;
    fixture.brief(&plan, &[&roadmap], ROADMAP_REPLY).await;
    fixture
        .brief(
            &other_plan,
            &[&hiring],
            r#"{"statements":[{"text":"Panel day.","source":"S1#0","quote":"Tuesday"}]}"#,
        )
        .await;
    assert!(!fixture.stored(&plan).await.stale);

    ingest_text_into(&fixture.pool, &roadmap.document_id, ROADMAP_V2, Utc::now())
        .await
        .expect("replace");

    let stored = fixture.stored(&plan).await;
    assert!(stored.stale);
    assert!(!fixture.stored(&other_plan).await.stale);
    let claim = &stored.claims[0];
    assert_eq!(claim.status, ClaimStatus::Cited);
    assert_eq!(claim.quote, "moves to March");
    assert_eq!(
        claim.source,
        SelectedSource::Document {
            version_id: roadmap.id.clone()
        }
    );
    let v1_passages = list_passages(&fixture.pool, &roadmap.id)
        .await
        .expect("v1 passages");
    let cited = v1_passages
        .iter()
        .find(|passage| Some(&passage.id) == claim.passage_id.as_ref())
        .expect("claim resolves to a version 1 passage");
    assert!(cited.text.contains(&claim.quote));
}

#[tokio::test]
async fn deleting_a_document_makes_its_claims_source_unavailable_and_removes_its_text() {
    let fixture = fixture().await;
    let roadmap = fixture.paste("Roadmap", ROADMAP).await;
    let hiring = fixture.paste("Hiring", HIRING).await;
    let first = fixture.plan("Launch review").await;
    let second = fixture.plan("Launch follow-up").await;
    let unrelated = fixture.plan("Hiring sync").await;
    fixture
        .brief(
            &first,
            &[&roadmap, &hiring],
            r#"{"statements":[
                {"text":"Launch timing changed.","source":"S1#0","quote":"moves to March"},
                {"text":"Panel day.","source":"S2#0","quote":"Tuesday"}]}"#,
        )
        .await;
    fixture.brief(&second, &[&roadmap], ROADMAP_REPLY).await;
    fixture
        .brief(
            &unrelated,
            &[&roadmap, &hiring],
            r#"{"statements":[{"text":"Panel day.","source":"S2#0","quote":"Tuesday"}]}"#,
        )
        .await;

    assert_eq!(
        delete_impact(&fixture.pool, &roadmap.document_id).await,
        Ok(2)
    );
    assert_eq!(
        delete_impact(&fixture.pool, &hiring.document_id).await,
        Ok(2)
    );

    delete(&fixture.pool, &fixture.app_data, &roadmap.document_id)
        .await
        .expect("delete");

    let stored = fixture.stored(&first).await;
    assert_eq!(stored.claims[0].status, ClaimStatus::SourceUnavailable);
    assert_eq!(stored.claims[0].quote, "");
    assert_eq!(stored.claims[0].text, "Launch timing changed.");
    assert_eq!(stored.claims[1].status, ClaimStatus::Cited);
    assert_eq!(stored.claims[1].quote, "Tuesday");
    let question = &fixture.stored(&second).await.questions[0];
    assert_eq!(question.claim.status, ClaimStatus::SourceUnavailable);
    assert_eq!(question.claim.quote, "");
    for needle in [
        "The marmalade launch moves to March.",
        "Quartz vendors may slip by a week.",
        "moves to March",
        "Quartz vendors may slip",
    ] {
        assert_eq!(
            text_columns_containing(&fixture.pool, needle).await,
            Vec::<String>::new(),
            "{needle}"
        );
    }
    assert_eq!(
        text_columns_containing(&fixture.pool, HIRING).await,
        vec!["document_passages.text".to_string()]
    );
}

#[tokio::test]
async fn delete_impact_of_an_unknown_document_is_not_found() {
    let fixture = fixture().await;
    assert_eq!(
        delete_impact(&fixture.pool, "missing").await,
        Err("DOCUMENT_NOT_FOUND".to_string())
    );
}

const MEETING: &str = "018f5e27-2f68-7e27-9c90-7c7212318001";
const ITEM: &str = "018f5e27-2f68-7e27-9c90-7c7212318301";
const EVIDENCE: &str = "018f5e27-2f68-7e27-9c90-7c7212318101";
const TRANSCRIPT: &str = "We decided to ship the beta on Friday and Maria owns the notes.";
const ITEM_QUOTE: &str = "beta on Friday";
const KNOWLEDGE_REPLY: &str = r#"{"statements":[
    {"text":"A release date was agreed.","source":"S1","quote":"beta on Friday"}],
  "questions":[
    {"text":"Is the date still realistic?","rationale":"The team committed to it.","source":"S1","quote":"Ship the beta"}]}"#;

impl Fixture {
    async fn accepted_knowledge_item(&self) -> SelectedSource {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc)
             VALUES (?, 'Beta sync', ?, ?, 'complete', 'complete', NULL, ?)",
        )
        .bind(MEETING)
        .bind(now)
        .bind(now)
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await
        .expect("meeting");
        sqlx::query(
            "INSERT INTO transcript_evidence (evidence_id, meeting_id, source_track, source_segment_key, sequence,
                transcript, audio_start_time, audio_end_time, is_final, capture_completeness, created_at, updated_at)
             VALUES (?, ?, 'mixed', 'segment-0', 0, ?, 0.0, 4.0, 1, 'complete', ?, ?)",
        )
        .bind(EVIDENCE)
        .bind(MEETING)
        .bind(TRANSCRIPT)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .expect("evidence");
        let run_id = "018f5e27-2f68-7e27-9c90-7c7212318201";
        let run = NewRun {
            run_id: run_id.to_string(),
            meeting_id: MEETING.to_string(),
            trigger_kind: TriggerKind::User,
            provider_id: "ollama".to_string(),
            model_id: "llama3".to_string(),
            location_class: "local".to_string(),
            sanitized_origin: "This device".to_string(),
            prompt_version: "knowledge-extract-v2".to_string(),
            meeting_completeness_at_start: "complete".to_string(),
            input_evidence_count: 1,
            input_fingerprint: "fingerprint".to_string(),
        };
        KnowledgeRepository::insert_running_run(&self.pool, &run)
            .await
            .expect("run");
        let span = VerifiedSpan {
            evidence_id: EVIDENCE.to_string(),
            raw_start: 14,
            raw_end: 37,
            quote_text: "ship the beta on Friday".to_string(),
            normalized_quote: "ship the beta on friday".to_string(),
            evidence_text_sha256: sha256_hex(TRANSCRIPT),
            segment_capture_incomplete: false,
        };
        let item = NewItem {
            item_id: ITEM.to_string(),
            item_type: KnowledgeType::Decision,
            text: "Ship the beta on Friday".to_string(),
            normalized_key: "ship the beta on friday".to_string(),
            claims: vec![span],
            owner: AttributeSupport::NotStated,
            due: AttributeSupport::NotStated,
        };
        let mut transaction = self.pool.begin().await.expect("transaction");
        KnowledgeRepository::insert_items_with_links(&mut transaction, MEETING, run_id, &[item])
            .await
            .expect("items");
        let counts = RunCounts {
            proposed: 1,
            ..RunCounts::default()
        };
        KnowledgeRepository::finalize_run(
            &mut transaction,
            run_id,
            RunStatus::Succeeded,
            counts,
            None,
        )
        .await
        .expect("finalize");
        transaction.commit().await.expect("commit");
        append_review(&self.pool, MEETING, ITEM, ReviewAction::Accept)
            .await
            .expect("accept");
        SelectedSource::Knowledge {
            meeting_id: MEETING.to_string(),
            item_id: ITEM.to_string(),
        }
    }

    async fn knowledge_statuses(&self, plan: &str) -> (bool, ClaimStatus, ClaimStatus) {
        let stored = self.stored(plan).await;
        (
            stored.stale,
            stored.claims[0].status,
            stored.questions[0].claim.status,
        )
    }
}

#[tokio::test]
async fn rejecting_a_cited_knowledge_item_makes_its_claims_stale() {
    let fixture = fixture().await;
    let source = fixture.accepted_knowledge_item().await;
    let plan = fixture.plan("Beta follow-up").await;
    fixture
        .brief_from(&plan, vec![source], KNOWLEDGE_REPLY)
        .await;
    assert_eq!(
        fixture.knowledge_statuses(&plan).await,
        (false, ClaimStatus::Cited, ClaimStatus::Cited)
    );

    append_review(&fixture.pool, MEETING, ITEM, ReviewAction::Reject)
        .await
        .expect("reject");

    assert_eq!(
        fixture.knowledge_statuses(&plan).await,
        (true, ClaimStatus::Stale, ClaimStatus::Stale)
    );
    assert_eq!(fixture.stored(&plan).await.claims[0].quote, ITEM_QUOTE);
}

#[tokio::test]
async fn correcting_a_cited_knowledge_item_makes_its_claims_stale() {
    let fixture = fixture().await;
    let source = fixture.accepted_knowledge_item().await;
    let plan = fixture.plan("Beta follow-up").await;
    fixture
        .brief_from(&plan, vec![source], KNOWLEDGE_REPLY)
        .await;

    let correction = CorrectionInput {
        text: "Ship the beta on Monday".to_string(),
        owner_text: None,
        due_text: None,
        based_on_revision_id: None,
    };
    correct_item(&fixture.pool, MEETING, ITEM, &correction)
        .await
        .expect("correct");

    assert_eq!(
        fixture.knowledge_statuses(&plan).await,
        (true, ClaimStatus::Stale, ClaimStatus::Stale)
    );
}

#[tokio::test]
async fn a_claim_built_on_a_corrected_item_stays_cited_until_the_next_revision() {
    let fixture = fixture().await;
    let source = fixture.accepted_knowledge_item().await;
    let first = CorrectionInput {
        text: "Ship the beta on Friday".to_string(),
        owner_text: Some("Maria".to_string()),
        due_text: None,
        based_on_revision_id: None,
    };
    correct_item(&fixture.pool, MEETING, ITEM, &first)
        .await
        .expect("correct");
    let plan = fixture.plan("Beta follow-up").await;
    fixture
        .brief_from(&plan, vec![source], KNOWLEDGE_REPLY)
        .await;
    assert_eq!(
        fixture.knowledge_statuses(&plan).await,
        (false, ClaimStatus::Cited, ClaimStatus::Cited)
    );

    let revision = KnowledgeRepository::item_view(&fixture.pool, MEETING, ITEM)
        .await
        .expect("item")
        .latest_revision_id;
    let second = CorrectionInput {
        text: "Ship the beta on Friday".to_string(),
        owner_text: None,
        due_text: None,
        based_on_revision_id: revision,
    };
    correct_item(&fixture.pool, MEETING, ITEM, &second)
        .await
        .expect("second correction");

    assert_eq!(
        fixture.knowledge_statuses(&plan).await,
        (true, ClaimStatus::Stale, ClaimStatus::Stale)
    );
}

#[tokio::test]
async fn deleting_the_cited_meeting_makes_its_claims_source_unavailable_and_removes_its_quotes() {
    let fixture = fixture().await;
    let knowledge = fixture.accepted_knowledge_item().await;
    let hiring = fixture.paste("Hiring", HIRING).await;
    let plan = fixture.plan("Beta follow-up").await;
    let document = SelectedSource::Document {
        version_id: hiring.id.clone(),
    };
    fixture
        .brief_from(
            &plan,
            vec![knowledge, document],
            r#"{"statements":[
                {"text":"A release date was agreed.","source":"S1","quote":"beta on Friday"},
                {"text":"Panel day.","source":"S2#0","quote":"Tuesday"}],
              "questions":[
                {"text":"Is the date still realistic?","rationale":"The team committed to it.","source":"S1","quote":"Ship the beta"}]}"#,
        )
        .await;

    assert!(MeetingsRepository::delete_meeting(&fixture.pool, MEETING)
        .await
        .expect("delete meeting"));

    let stored = fixture.stored(&plan).await;
    assert_eq!(stored.claims[0].status, ClaimStatus::SourceUnavailable);
    assert_eq!(stored.claims[0].quote, "");
    assert_eq!(stored.claims[0].text, "A release date was agreed.");
    assert_eq!(
        stored.questions[0].claim.status,
        ClaimStatus::SourceUnavailable
    );
    assert_eq!(stored.questions[0].claim.quote, "");
    assert_eq!(stored.claims[1].status, ClaimStatus::Cited);
    assert_eq!(stored.claims[1].quote, "Tuesday");
    for needle in [
        TRANSCRIPT,
        ITEM_QUOTE,
        "Ship the beta",
        "ship the beta on Friday",
    ] {
        assert_eq!(
            text_columns_containing(&fixture.pool, needle).await,
            Vec::<String>::new(),
            "{needle}"
        );
    }
}
