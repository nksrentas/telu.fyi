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
