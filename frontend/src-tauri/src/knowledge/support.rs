#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::matcher::normalized_key;
    use crate::knowledge::models::KnowledgeType;
    use crate::knowledge::parse::{ParseFailure, MAX_TEXT_CHARS};
    use crate::knowledge::span_verifier::AttributeSupport;
    use crate::knowledge::test_support::verified_item;

    fn candidates() -> Vec<crate::knowledge::repository::NewItem> {
        let mut owned = verified_item(KnowledgeType::Commitment, "Maria writes the notes by Monday", "e2", "Maria will write the notes");
        owned.owner = AttributeSupport::Stated {
            text: "Maria".to_string(),
            spans: owned.claims.clone(),
        };
        vec![
            verified_item(KnowledgeType::Decision, "Ship the beta on Friday", "e1", "ship the beta on Friday"),
            verified_item(KnowledgeType::Decision, "Move the launch to March", "e1", "we could move the launch"),
            owned,
        ]
    }

    #[test]
    fn parse_support_reads_verdicts_inside_think_blocks_and_fences() {
        let raw = "<think>checking</think>\n```json\n{\"verdicts\":[{\"id\":\"C1\",\"verdict\":\"keep\"},{\"id\":\"C2\",\"verdict\":\"trim\",\"text\":\"narrower text\"},{\"id\":\"C3\",\"verdict\":\"drop\"},{\"id\":\"C4\",\"verdict\":\"perhaps\"}]}\n```";

        let verdicts = parse_support(raw).expect("verdicts");

        assert_eq!(
            verdicts,
            vec![
                ("C1".to_string(), SupportVerdict::Keep),
                ("C2".to_string(), SupportVerdict::Trim("narrower text".to_string())),
                ("C3".to_string(), SupportVerdict::Drop),
            ]
        );
    }

    #[test]
    fn parse_support_fails_without_a_verdicts_array() {
        assert_eq!(parse_support("{\"items\": []}"), Err(ParseFailure));
        assert_eq!(parse_support("All items look fine."), Err(ParseFailure));
    }

    #[test]
    fn apply_support_keeps_trims_and_drops_without_touching_evidence() {
        let before = candidates();
        let verdicts = Ok(vec![
            ("C1".to_string(), SupportVerdict::Keep),
            ("C2".to_string(), SupportVerdict::Drop),
            ("C3".to_string(), SupportVerdict::Trim("narrower text".to_string())),
        ]);

        let (after, counts) = apply_support(before.clone(), verdicts);

        assert_eq!(after.len(), 2);
        assert_eq!(after[0], before[0]);
        assert_eq!(after[1].text, "narrower text");
        assert_eq!(after[1].normalized_key, normalized_key("narrower text"));
        assert_eq!(after[1].item_id, before[2].item_id);
        assert_eq!(after[1].item_type, before[2].item_type);
        assert_eq!(after[1].claims, before[2].claims);
        assert_eq!(after[1].owner, before[2].owner);
        assert_eq!(after[1].due, before[2].due);
        assert_eq!(counts, SupportCounts { trimmed: 1, dropped: 1, unparsed: 0 });
    }

    #[test]
    fn apply_support_keeps_every_candidate_when_the_reply_is_unparsed() {
        let before = candidates();

        let (after, counts) = apply_support(before.clone(), Err(ParseFailure));

        assert_eq!(after, before);
        assert_eq!(counts, SupportCounts { trimmed: 0, dropped: 0, unparsed: 3 });
    }

    #[test]
    fn apply_support_keeps_candidates_with_missing_verdicts_or_unusable_trims() {
        let before = candidates();
        let verdicts = Ok(vec![
            ("C2".to_string(), SupportVerdict::Trim("   ".to_string())),
            ("C3".to_string(), SupportVerdict::Trim("x".repeat(MAX_TEXT_CHARS + 1))),
        ]);

        let (after, counts) = apply_support(before.clone(), verdicts);

        assert_eq!(after, before);
        assert_eq!(counts, SupportCounts { trimmed: 0, dropped: 0, unparsed: 3 });
    }

    #[test]
    fn support_prompt_lists_ids_types_texts_quotes_and_stated_attributes() {
        let prompt = support_prompt(&candidates());

        assert!(prompt.contains("C1 decision: Ship the beta on Friday"));
        assert!(prompt.contains("quote: \"ship the beta on Friday\""));
        assert!(prompt.contains("C2 decision: Move the launch to March"));
        assert!(prompt.contains("C3 commitment: Maria writes the notes by Monday"));
        assert!(prompt.contains("owner: Maria"));
        assert!(!prompt.contains("due:"));
    }
}
