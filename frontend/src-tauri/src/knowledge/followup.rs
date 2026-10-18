#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::models::KnowledgeType;
    use crate::knowledge::parse::ParseFailure;
    use crate::knowledge::repository::NewItem;
    use crate::knowledge::span_verifier::{LabeledSegment, LabeledSegments};
    use crate::knowledge::test_support::verified_item;

    fn meeting(count: usize) -> LabeledSegments {
        LabeledSegments::new(
            (0..count)
                .map(|index| LabeledSegment {
                    label: format!("S{}", index + 1),
                    evidence_id: format!("evidence-{index}"),
                    text: format!("segment {} {}", index + 1, "x".repeat(17)),
                    audio_start_time: index as f64 * 5.0,
                    capture_incomplete: false,
                })
                .collect(),
        )
    }

    fn labels(segments: &[LabeledSegment]) -> Vec<&str> {
        segments.iter().map(|segment| segment.label.as_str()).collect()
    }

    fn candidates() -> Vec<NewItem> {
        vec![
            verified_item(KnowledgeType::Question, "Who owns the budget", "evidence-3", "who owns the budget"),
            verified_item(KnowledgeType::Decision, "Ship on Friday", "evidence-3", "ship on Friday"),
            verified_item(KnowledgeType::Commitment, "Maria writes the notes", "evidence-4", "Maria writes the notes"),
            verified_item(KnowledgeType::Fact, "The beta has forty customers", "evidence-4", "forty customers"),
            verified_item(KnowledgeType::Decision, "Use the staging cluster", "evidence-4", "use the staging cluster"),
            verified_item(KnowledgeType::Question, "Is the scope fixed", "evidence-5", "is the scope fixed"),
            verified_item(KnowledgeType::Fact, "Alex has the slides", "evidence-5", "Alex has the slides"),
        ]
    }

    fn verdict(id: &str, verdict: FollowupVerdict) -> (String, FollowupVerdict) {
        (id.to_string(), verdict)
    }

    #[test]
    fn later_context_returns_whole_segments_from_the_window_start_within_the_budget() {
        let all = meeting(8);

        assert_eq!(labels(later_context(&all, 2, 25)), vec!["S3", "S4"]);
        assert_eq!(labels(later_context(&all, 2, 30)), vec!["S3", "S4", "S5"]);
        assert_eq!(labels(later_context(&all, 1, 1)), vec!["S2"]);
        assert_eq!(labels(later_context(&all, 6, 10_000)), vec!["S7", "S8"]);
    }

    #[test]
    fn parse_followup_reads_known_verdicts_and_skips_unknown_ones() {
        let raw = "<think>reading</think>{\"verdicts\":[{\"id\":\"C1\",\"verdict\":\"answered\"},{\"id\":\"C2\",\"verdict\":\"Superseded\"},{\"id\":\"C3\",\"verdict\":\"stands\"},{\"id\":\"C4\",\"verdict\":\"unclear\"}]}";

        let verdicts = parse_followup(raw).expect("verdicts");

        assert_eq!(
            verdicts,
            vec![
                verdict("C1", FollowupVerdict::Answered),
                verdict("C2", FollowupVerdict::Superseded),
                verdict("C3", FollowupVerdict::Stands),
            ]
        );
        assert_eq!(parse_followup("{\"items\": []}"), Err(ParseFailure));
    }

    #[test]
    fn apply_followup_drops_answered_questions_and_superseded_items_only() {
        let before = candidates();
        let verdicts = Ok(vec![
            verdict("C1", FollowupVerdict::Answered),
            verdict("C2", FollowupVerdict::Superseded),
            verdict("C3", FollowupVerdict::Stands),
            verdict("C4", FollowupVerdict::Superseded),
            verdict("C5", FollowupVerdict::Answered),
            verdict("C6", FollowupVerdict::Superseded),
        ]);

        let (after, counts) = apply_followup(before.clone(), verdicts);

        assert_eq!(after, vec![before[2].clone(), before[4].clone(), before[5].clone(), before[6].clone()]);
        assert_eq!(counts, FollowupCounts { dropped: 3, unparsed: 1 });
    }

    #[test]
    fn apply_followup_keeps_every_candidate_when_the_reply_is_unparsed() {
        let before = candidates();

        let (after, counts) = apply_followup(before.clone(), Err(ParseFailure));

        assert_eq!(after, before);
        assert_eq!(counts, FollowupCounts { dropped: 0, unparsed: 7 });
    }

    #[test]
    fn followup_prompt_lists_later_transcript_lines_and_each_candidate_with_its_segment_label() {
        let all = meeting(8);
        let checked = vec![candidates()[0].clone(), candidates()[2].clone()];

        let prompt = followup_prompt(&all, 2, &checked);

        assert!(!prompt.contains("[S2 "));
        assert!(prompt.contains("[S3 00:10] segment 3"));
        assert!(prompt.contains("[S8 00:35] segment 8"));
        assert!(prompt.contains("C1 question at S4: Who owns the budget"));
        assert!(prompt.contains("C2 commitment at S5: Maria writes the notes"));
    }
}
