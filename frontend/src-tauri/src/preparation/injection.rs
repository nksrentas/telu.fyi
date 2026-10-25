use crate::documents::ingest::ingest_text;
use crate::knowledge::test_support::migrated_pool;
use crate::planning::models::PlannedMeetingInput;
use crate::planning::repository as planning;
use crate::preparation::briefing::{
    self, piece_text, BriefingError, SYSTEM_PROMPT, USER_PROMPT_HEADER,
};
use crate::preparation::commands::{begin, execute};
use crate::preparation::context::{build, Budget, ContextPiece, PackedContext};
use crate::preparation::models::SelectedSource;
use crate::preparation::runs::{self, RunStatus};
use crate::preparation::selection;
use crate::trust::provider_route::{
    Capability, EffectiveRoute, LocationClass, RouteValidationState,
};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const BUDGET: Budget = Budget {
    per_source_tokens: 1_000,
    total_tokens: 2_000,
};

#[derive(Deserialize)]
struct Corpus {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    source: String,
    obeying: String,
    #[serde(default)]
    dropped: Vec<String>,
    #[serde(default)]
    dropped_questions: Vec<String>,
    #[serde(default)]
    parse_failed: bool,
}

type Prompts = Arc<Mutex<Vec<(String, String)>>>;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/preparation/injection")
}

fn corpus() -> Corpus {
    let raw = std::fs::read_to_string(fixture_dir().join("corpus.json")).expect("corpus");
    serde_json::from_str(&raw).expect("corpus json")
}

fn source_text(case: &Case) -> String {
    std::fs::read_to_string(fixture_dir().join("sources").join(&case.source)).expect("source")
}

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
        .expect("test timestamp")
        .with_timezone(&Utc)
}

fn route() -> EffectiveRoute {
    EffectiveRoute {
        capability: Capability::Summary,
        provider_id: "ollama".to_string(),
        model_id: "llama3".to_string(),
        location_class: Some(LocationClass::Local),
        sanitized_origin: Some("This device".to_string()),
        encrypted: false,
        validation_state: RouteValidationState::Validated,
        resolved_addresses: Vec::new(),
    }
}

async fn prepared(pool: &SqlitePool, text: &str) -> (String, PackedContext) {
    let input = PlannedMeetingInput {
        title: "Weekly sync".to_string(),
        start_utc: None,
        purpose: String::new(),
    };
    let plan = planning::create(pool, input, now())
        .await
        .expect("planned meeting")
        .id;
    let version = ingest_text(pool, "Pasted", text, now())
        .await
        .expect("document");
    let sources = vec![SelectedSource::Document {
        version_id: version.id,
    }];
    selection::select(pool, &plan, sources.clone())
        .await
        .expect("selection");
    let app_data = tempfile::tempdir().expect("app data");
    let context = build(pool, app_data.path(), &sources, BUDGET)
        .await
        .expect("context");
    (plan, context)
}

fn recording(
    prompts: &Prompts,
    reply: String,
) -> impl FnMut(String, String) -> std::future::Ready<Result<String, String>> {
    let prompts = Arc::clone(prompts);
    move |system, user| {
        prompts.lock().expect("prompts").push((system, user));
        std::future::ready(Ok(reply.clone()))
    }
}

async fn prompts_for(text: &str) -> (PackedContext, String, String) {
    let pool = migrated_pool().await;
    let (_, context) = prepared(&pool, text).await;
    let prompts = Prompts::default();
    briefing::compose(
        &context,
        recording(&prompts, "{\"statements\": []}".to_string()),
    )
    .await
    .expect("draft");
    let (system, user) = prompts.lock().expect("prompts")[0].clone();
    (context, system, user)
}

fn first_ref(context: &PackedContext) -> String {
    match &context.pieces[0] {
        ContextPiece::Passage { ordinal, .. } => format!("S1#{ordinal}"),
        ContextPiece::Knowledge { .. } => panic!("expected a passage"),
    }
}

async fn claim_count(pool: &SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM briefing_claims")
        .fetch_one(pool)
        .await
        .expect("count")
}

#[test]
fn the_corpus_has_at_least_six_adversarial_sources() {
    assert!(corpus().cases.len() >= 6);
}

#[tokio::test]
async fn the_system_prompt_is_byte_identical_for_every_adversarial_source() {
    for case in corpus().cases {
        let (_, system, _) = prompts_for(&source_text(&case)).await;
        assert_eq!(
            system.as_bytes(),
            SYSTEM_PROMPT.as_bytes(),
            "{}",
            case.source
        );
    }
}

#[tokio::test]
async fn a_fake_delimiter_cannot_close_its_source_block() {
    let any_source_tag = Regex::new(r"(?i)<\s*/?\s*source").expect("tag pattern");
    let real_block =
        Regex::new(r#"(?s)<source ref="([^"]+)">\n(.*?)\n</source>\n\n"#).expect("block pattern");
    for case in corpus().cases {
        let (context, _, user) = prompts_for(&source_text(&case)).await;
        let blocks: Vec<(String, String)> = real_block
            .captures_iter(&user)
            .map(|block| (block[1].to_string(), block[2].to_string()))
            .collect();

        assert_eq!(blocks.len(), context.pieces.len(), "{}", case.source);
        assert_eq!(
            real_block.replace_all(&user, ""),
            USER_PROMPT_HEADER,
            "{}",
            case.source
        );
        assert_eq!(blocks[0].0, first_ref(&context), "{}", case.source);
        for ((_, body), piece) in blocks.iter().zip(&context.pieces) {
            assert!(!any_source_tag.is_match(body), "{}", case.source);
            assert_eq!(
                &body.replace("&lt;", "<"),
                piece_text(piece),
                "{}",
                case.source
            );
        }
    }
}

#[tokio::test]
async fn replies_that_obey_the_injected_text_store_no_claims() {
    for case in corpus().cases {
        let pool = migrated_pool().await;
        let (plan, context) = prepared(&pool, &source_text(&case)).await;
        let reply = case.obeying.replace("{ref}", &first_ref(&context));
        let prompts = Prompts::default();

        let result = briefing::run(&pool, &plan, &context, now(), recording(&prompts, reply)).await;

        if case.parse_failed {
            assert_eq!(result, Err(BriefingError::ParseFailed), "{}", case.source);
        } else {
            let outcome = result.expect("briefing");
            let reasons = |dropped: &[briefing::DroppedStatement]| -> Vec<String> {
                dropped.iter().map(|drop| drop.reason.to_string()).collect()
            };
            assert!(outcome.claims.is_empty(), "{}", case.source);
            assert!(outcome.questions.is_empty(), "{}", case.source);
            assert_eq!(reasons(&outcome.dropped), case.dropped, "{}", case.source);
            assert_eq!(
                reasons(&outcome.dropped_questions),
                case.dropped_questions,
                "{}",
                case.source
            );
        }
        assert_eq!(claim_count(&pool).await, 0, "{}", case.source);
    }
}

#[tokio::test]
async fn a_request_to_switch_providers_leaves_the_route_unchanged() {
    let case = corpus()
        .cases
        .into_iter()
        .find(|case| case.source == "switch-provider.txt")
        .expect("switch-provider case");
    let pool = migrated_pool().await;
    let (plan, _) = prepared(&pool, &source_text(&case)).await;
    let (run, token) = begin(&pool, &plan, &route(), &route(), now())
        .await
        .expect("run");
    let prompts = Prompts::default();
    let app_data = tempfile::tempdir().expect("app data");

    let status = execute(
        &pool,
        app_data.path(),
        &run,
        BUDGET,
        &token,
        recording(&prompts, case.obeying.clone()),
    )
    .await;

    assert_eq!(status, RunStatus::Failed);
    let calls = prompts.lock().expect("prompts").clone();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].0, SYSTEM_PROMPT);
    let finished = runs::latest(&pool, &plan)
        .await
        .expect("latest")
        .expect("run row");
    let route_of = |run: &runs::PreparationRun| {
        (
            run.provider_id.clone(),
            run.model_id.clone(),
            run.location_class.clone(),
            run.sanitized_origin.clone(),
        )
    };
    assert_eq!(route_of(&finished), route_of(&run));
    assert_eq!(finished.failure_code.as_deref(), Some("PREP_PARSE_FAILED"));
    assert_eq!(claim_count(&pool).await, 0);
}
