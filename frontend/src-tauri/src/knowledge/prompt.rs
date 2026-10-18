use crate::database::models::{CaptureCompleteness, TranscriptEvidence};
use crate::knowledge::span_verifier::{LabeledSegment, LabeledSegments};

pub const PROMPT_VERSION: &str = "knowledge-extract-v5";
pub const WINDOW_OVERLAP_SEGMENTS: usize = 2;
pub const RESERVED_OUTPUT_TOKENS: usize = 2000;
pub const MIN_WINDOW_TOKENS: usize = 500;
pub const MAX_WINDOW_TOKENS: usize = 1500;
const CHARS_PER_TOKEN: usize = 4;

pub const EXTRACTION_SYSTEM_PROMPT: &str = r#"You extract meeting knowledge from one part of a meeting transcript. Output JSON only, no prose.
Types:
- "decision": something the participants agreed or settled in this transcript. Never a proposal, an option, a suggestion, "could", "maybe", "should we", a condition, or a recap of an earlier meeting that this transcript changes.
- "commitment": a person or group agreeing to do something.
- "question": asked here and not answered anywhere later in this transcript.
- "fact": a specific stated fact that matters later (a number, requirement, constraint, date or name). Not an opinion, a joke or a guess.
Rules:
- Every item needs at least one evidence entry: {"segment": "<label>", "quote": "<exact words copied from that segment>"}. Give up to 3 evidence entries.
- Copy quotes character for character from the labeled segment. Never paraphrase inside "quote".
- The "text" says only what its quotes say. Every key detail of the text (who, what, number, date, name) appears inside one of its quotes. Write numbers the way the quote says them.
- Fill "owner" and "due" when the words state them, including roles such as "the project manager", groups such as "each of you", "everyone" or "the team", and relative times such as "by the next meeting", "in thirty minutes" or "tomorrow". Give each its own segment and a quote containing those exact words, and also cite that segment in "evidence". Never guess who "I" or "we" is. Otherwise use null.
- List every qualifying item separately. Do not merge different items and do not repeat an item.
- If nothing qualifies, return {"items": []}.
Schema: {"items":[{"type":"...","text":"...","evidence":[{"segment":"S3","quote":"..."}],"owner":{"value":"...","segment":"S4","quote":"..."}|null,"due":{"value":"...","segment":"S4","quote":"..."}|null}]}"#;

#[derive(Debug, Clone, PartialEq)]
pub struct ChunkWindow {
    pub segments: LabeledSegments,
    pub user_prompt: String,
}

pub fn label_segments(evidence: &[TranscriptEvidence]) -> LabeledSegments {
    LabeledSegments::new(
        evidence
            .iter()
            .enumerate()
            .map(|(index, row)| LabeledSegment {
                label: format!("S{}", index + 1),
                evidence_id: row.evidence_id.clone(),
                text: row.transcript.clone(),
                audio_start_time: row.audio_start_time,
                capture_incomplete: row.capture_completeness == CaptureCompleteness::Incomplete,
            })
            .collect(),
    )
}

pub fn window_budget(context_tokens: usize) -> usize {
    context_tokens
        .saturating_sub(RESERVED_OUTPUT_TOKENS)
        .max(MIN_WINDOW_TOKENS)
        .min(MAX_WINDOW_TOKENS)
}

pub fn chunk_windows(segments: &LabeledSegments, budget_tokens: usize) -> Vec<ChunkWindow> {
    let all = segments.as_slice();
    let mut windows = Vec::new();
    let mut start = 0;
    while start < all.len() {
        let end = window_end(all, start, budget_tokens);
        windows.push(window(&all[start..end]));
        if end == all.len() {
            break;
        }
        start = end.saturating_sub(WINDOW_OVERLAP_SEGMENTS).max(start + 1);
    }
    windows
}

pub(crate) fn window_end(all: &[LabeledSegment], start: usize, budget_tokens: usize) -> usize {
    let mut used = 0;
    let mut end = start;
    while end < all.len() {
        let cost = estimated_tokens(&prompt_line(&all[end]));
        if end > start && used + cost > budget_tokens {
            break;
        }
        used += cost;
        end += 1;
    }
    end
}

fn window(segments: &[LabeledSegment]) -> ChunkWindow {
    ChunkWindow {
        user_prompt: segments.iter().map(prompt_line).collect::<Vec<_>>().join("\n"),
        segments: LabeledSegments::new(segments.to_vec()),
    }
}

pub fn prompt_line(segment: &LabeledSegment) -> String {
    format!(
        "[{} {}] {}",
        segment.label,
        format_timestamp(segment.audio_start_time),
        segment.text
    )
}

fn estimated_tokens(text: &str) -> usize {
    text.chars().count().div_ceil(CHARS_PER_TOKEN)
}

fn format_timestamp(seconds: f64) -> String {
    let total = seconds.max(0.0).floor() as u64;
    format!("{:02}:{:02}", total / 60, total % 60)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segments(texts: &[&str]) -> LabeledSegments {
        LabeledSegments::new(
            texts
                .iter()
                .enumerate()
                .map(|(index, text)| LabeledSegment {
                    label: format!("S{}", index + 1),
                    evidence_id: format!("evidence-{index}"),
                    text: text.to_string(),
                    audio_start_time: index as f64 * 65.0,
                    capture_incomplete: false,
                })
                .collect(),
        )
    }

    fn labels(window: &ChunkWindow) -> Vec<String> {
        window
            .segments
            .as_slice()
            .iter()
            .map(|segment| segment.label.clone())
            .collect()
    }

    #[test]
    fn chunk_windows_pack_whole_segments_with_a_two_segment_overlap() {
        let text = "x".repeat(29);
        let all = segments(&[&text, &text, &text, &text, &text, &text, &text, &text]);

        let windows = chunk_windows(&all, 40);

        assert_eq!(windows.len(), 3);
        assert_eq!(labels(&windows[0]), vec!["S1", "S2", "S3", "S4"]);
        assert_eq!(labels(&windows[1]), vec!["S3", "S4", "S5", "S6"]);
        assert_eq!(labels(&windows[2]), vec!["S5", "S6", "S7", "S8"]);
        assert!(windows[1].user_prompt.starts_with("[S3 02:10] "));
    }

    #[test]
    fn chunk_windows_give_an_oversized_segment_its_own_window() {
        let huge = "y".repeat(400);
        let all = segments(&["short one", &huge, "short two"]);

        let windows = chunk_windows(&all, 20);

        assert!(windows.iter().any(|window| labels(window) == vec!["S2"]));
        assert!(windows
            .iter()
            .all(|window| window.segments.as_slice().iter().all(|segment| !segment.text.is_empty())));
        assert_eq!(labels(windows.last().expect("last window")).last().map(String::as_str), Some("S3"));
    }

    #[test]
    fn window_budget_caps_at_the_extraction_window_maximum() {
        assert_eq!(window_budget(32468), MAX_WINDOW_TOKENS);
        assert_eq!(
            window_budget(MAX_WINDOW_TOKENS + RESERVED_OUTPUT_TOKENS - 100),
            MAX_WINDOW_TOKENS - 100
        );
        assert_eq!(window_budget(1200), MIN_WINDOW_TOKENS);
    }

    #[test]
    fn chunk_windows_keep_a_single_small_meeting_in_one_window() {
        let windows = chunk_windows(&segments(&["only segment"]), 1000);

        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].user_prompt, "[S1 00:00] only segment");
    }
}
