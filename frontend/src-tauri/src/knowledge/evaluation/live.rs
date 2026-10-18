use super::replay::{
    fixture_predictions, labeled, measure_invariants, prediction_set, replay_pool, FirstPass, ReplayError,
};
use super::{GoldFixture, PredictionSet};
use crate::knowledge::dispatch::{dispatch_completer, extraction_budget};
use crate::knowledge::extraction::extract_from_segments;
use crate::knowledge::prompt::PROMPT_VERSION;
use crate::summary::service::{resolve_summary_dispatch, SummaryDispatch};
use crate::summary::summary_engine::client::force_shutdown_sidecar;
use crate::summary::summary_engine::models::{get_model_by_name, get_model_path};
use crate::trust::provider_route::LocationClass;
use serde::Serialize;
use std::collections::BTreeMap;
use std::future::Future;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Instant;
use tokio_util::sync::CancellationToken;

const BUILTIN_PROVIDER: &str = "builtin-ai";

pub struct LiveSettings {
    pub app_data_dir: PathBuf,
    pub model_name: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LiveOutput {
    pub predictions: PredictionSet,
    pub completions: BTreeMap<String, Vec<String>>,
    pub meta: LiveRunMeta,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRunMeta {
    pub prompt_version: String,
    pub model: String,
    pub budget_tokens: usize,
    pub fixtures: Vec<LiveFixtureMeta>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveFixtureMeta {
    pub fixture_id: String,
    pub windows: usize,
    pub completions: usize,
    pub items: usize,
    pub abstentions: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LiveError {
    ModelUnknown,
    ModelMissing,
    RouteUnavailable,
    Provider,
    Replay(ReplayError),
}

impl LiveError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::ModelUnknown => "LIVE_MODEL_UNKNOWN",
            Self::ModelMissing => "LIVE_MODEL_MISSING",
            Self::RouteUnavailable => "LIVE_ROUTE_UNAVAILABLE",
            Self::Provider => "LIVE_PROVIDER_ERROR",
            Self::Replay(error) => error.code(),
        }
    }
}

pub async fn run_live<E>(fixtures: &[GoldFixture], settings: &LiveSettings, on_fixture: E) -> Result<LiveOutput, LiveError>
where
    E: FnMut(&LiveOutput),
{
    let dispatch = Arc::new(local_dispatch(settings).await?);
    let budget = extraction_budget(&dispatch, "telu-knowledge-eval").await;
    let app_data_dir = settings.app_data_dir.clone();
    let completer_for = |fixture_id: &str| {
        dispatch_completer(
            Arc::clone(&dispatch),
            fixture_id.to_string(),
            Some(app_data_dir.clone()),
            CancellationToken::new(),
        )
    };
    let result = run_live_with(fixtures, &settings.model_name, budget, completer_for, on_fixture).await;
    if let Err(error) = force_shutdown_sidecar().await {
        tracing::warn!(error = %error, "knowledge eval could not stop the local model sidecar");
    }
    result
}

async fn local_dispatch(settings: &LiveSettings) -> Result<SummaryDispatch, LiveError> {
    get_model_by_name(&settings.model_name).ok_or(LiveError::ModelUnknown)?;
    let model_path = get_model_path(&settings.app_data_dir, &settings.model_name).map_err(|_| LiveError::ModelUnknown)?;
    if !model_path.is_file() {
        return Err(LiveError::ModelMissing);
    }
    let pool = replay_pool().await.map_err(LiveError::Replay)?;
    let dispatch = resolve_summary_dispatch(&pool, BUILTIN_PROVIDER, &settings.model_name)
        .await
        .map_err(|_| LiveError::RouteUnavailable)?;
    match dispatch.route.location_class {
        Some(LocationClass::Local) => Ok(dispatch),
        _ => Err(LiveError::RouteUnavailable),
    }
}

pub(crate) async fn run_live_with<C, F, Fut, E>(
    fixtures: &[GoldFixture],
    model: &str,
    budget_tokens: usize,
    mut completer_for: C,
    mut on_fixture: E,
) -> Result<LiveOutput, LiveError>
where
    C: FnMut(&str) -> F,
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
    E: FnMut(&LiveOutput),
{
    let mut predicted = Vec::new();
    let mut counts = Vec::new();
    let mut output = LiveOutput {
        predictions: PredictionSet::default(),
        completions: BTreeMap::new(),
        meta: LiveRunMeta {
            prompt_version: PROMPT_VERSION.to_string(),
            model: model.to_string(),
            budget_tokens,
            fixtures: Vec::new(),
        },
    };
    for fixture in fixtures {
        let started = Instant::now();
        let recorded = Arc::new(Mutex::new(Vec::new()));
        let mut complete = completer_for(&fixture.fixture_id);
        let mut recorder = |system_prompt: String, user_prompt: String| {
            let pending = complete(system_prompt, user_prompt);
            let recorded = Arc::clone(&recorded);
            async move {
                let reply = pending.await;
                if let Ok(text) = &reply {
                    recorded.lock().unwrap_or_else(PoisonError::into_inner).push(text.clone());
                }
                reply
            }
        };
        let outcome = extract_from_segments(&labeled(fixture), budget_tokens, Vec::new(), &CancellationToken::new(), &mut recorder)
            .await
            .map_err(|_| LiveError::Provider)?;
        let replies = std::mem::take(&mut *recorded.lock().unwrap_or_else(PoisonError::into_inner));
        predicted.push(fixture_predictions(&fixture.fixture_id, &outcome));
        counts.push(
            measure_invariants(fixture, FirstPass::Recorded(&replies), budget_tokens)
                .await
                .map_err(LiveError::Replay)?,
        );
        output.meta.fixtures.push(LiveFixtureMeta {
            fixture_id: fixture.fixture_id.clone(),
            windows: outcome.window_count,
            completions: replies.len(),
            items: outcome.items.len(),
            abstentions: outcome.abstentions.len(),
            elapsed_ms: started.elapsed().as_millis() as u64,
        });
        output.completions.insert(fixture.fixture_id.clone(), replies);
        output.predictions = prediction_set(predicted.clone(), &counts);
        on_fixture(&output);
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::evaluation::replay::run_replay;
    use crate::knowledge::evaluation::{FixtureCategory, GoldSegment};
    use serde_json::{json, Value};
    use std::collections::HashMap;

    const TWO_WINDOW_BUDGET: usize = 40;
    const ONE_WINDOW_BUDGET: usize = 1000;
    const SEGMENT_TEXTS: [&str; 6] = [
        "We decided to ship on Friday.",
        "Maria raised a staging issue.",
        "The team reviewed the slides.",
        "Nobody objected to the scope.",
        "The beta has forty customers.",
        "Alex shared the final budget.",
    ];

    fn fixture(fixture_id: &str) -> GoldFixture {
        GoldFixture {
            fixture_id: fixture_id.to_string(),
            category: FixtureCategory::Representative,
            segments: SEGMENT_TEXTS
                .iter()
                .enumerate()
                .map(|(index, text)| GoldSegment {
                    id: format!("{fixture_id}-s{}", index + 1),
                    start: 0.0,
                    end: 1.0,
                    text: text.to_string(),
                    capture_completeness: "complete".to_string(),
                })
                .collect(),
            gold: Vec::new(),
            expect_abstain: false,
        }
    }

    fn item(item_type: &str, text: &str, segment: &str, quote: &str) -> Value {
        json!({ "type": item_type, "text": text, "evidence": [{ "segment": segment, "quote": quote }], "owner": null, "due": null })
    }

    fn reply(items: &[Value]) -> String {
        json!({ "items": items }).to_string()
    }

    fn scripted(
        replies: Vec<Result<String, String>>,
    ) -> impl FnMut(String, String) -> std::future::Ready<Result<String, String>> {
        let mut queue = replies.into_iter();
        move |_, _| std::future::ready(queue.next().unwrap_or_else(|| Ok(reply(&[]))))
    }

    #[tokio::test]
    async fn live_recording_replays_to_identical_predictions() {
        let fixtures = [fixture("standup")];
        let replies = vec![
            Ok(reply(&[item("decision", "Ship on Friday", "S1", "ship on Friday")])),
            Ok(reply(&[
                item("fact", "The beta has forty customers", "S5", "The beta has forty customers"),
                item("question", "Did the budget double", "S6", "the budget doubled"),
            ])),
        ];

        let output = run_live_with(&fixtures, "scripted", TWO_WINDOW_BUDGET, |_: &str| scripted(replies.clone()), |_: &LiveOutput| {})
            .await
            .expect("live run");

        let meta = &output.meta.fixtures[0];
        assert_eq!(output.completions["standup"].len(), 2);
        assert_eq!((meta.windows, meta.completions, meta.items, meta.abstentions), (2, 2, 2, 1));
        assert_eq!(output.predictions.resurrection_count, Some(0));
        let recorded: HashMap<String, Vec<String>> = output.completions.clone().into_iter().collect();
        let replayed = run_replay(&fixtures, &recorded, TWO_WINDOW_BUDGET).await.expect("replay");
        assert_eq!(replayed, output.predictions);
    }

    #[tokio::test]
    async fn live_stops_with_a_provider_error_and_keeps_completed_fixtures() {
        let fixtures = [fixture("first"), fixture("second")];
        let mut seen = Vec::new();

        let result = run_live_with(
            &fixtures,
            "scripted",
            ONE_WINDOW_BUDGET,
            |fixture_id: &str| match fixture_id {
                "first" => scripted(vec![Ok(reply(&[]))]),
                _ => scripted(vec![Err("provider down".to_string())]),
            },
            |output: &LiveOutput| {
                seen.push(output.meta.fixtures.iter().map(|meta| meta.fixture_id.clone()).collect::<Vec<_>>())
            },
        )
        .await;

        assert_eq!(result.err(), Some(LiveError::Provider));
        assert_eq!(seen, vec![vec!["first".to_string()]]);
    }
}
