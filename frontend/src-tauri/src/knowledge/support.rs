use crate::knowledge::matcher::normalized_key;
use crate::knowledge::parse::{parse_verdicts, ParseFailure, MAX_TEXT_CHARS};
use crate::knowledge::repository::NewItem;
use crate::knowledge::span_verifier::AttributeSupport;
use serde_json::Value;
use std::iter::once;

pub const SUPPORT_SYSTEM_PROMPT: &str = r#"You check knowledge items extracted from a meeting against the exact quotes they cite. Be strict. Output JSON only, no prose.
Each item has an id, a type, a text and its quotes, plus owner and due when stated.
Read each text word by word. Every person, group, number, date, place, reason, purpose and qualifier in the text must appear in its quotes.
Give every item one verdict:
- "keep": the quotes alone state everything the text says, and nothing in the text goes beyond them.
- "trim": the quotes state the main point, but the text adds anything they do not state (a name, reason, purpose, time, detail, interpretation or summary). Give a shorter "text" that uses the quotes' own words and says only what they state. When in doubt between keep and trim, trim.
- "drop": the quotes do not state the main point of the text; or the quotes only ask, guess, suggest or wonder ("I think", "maybe", "could", "should we", "I'm not sure") while the item states it as settled; or the item is a decision but its quotes show a proposal, an option, a condition or open discussion rather than agreement; or the item is a commitment but no one in its quotes says they will do it; or the item is a question but its quotes do not ask a question.
Judge only from the quotes. Never add details. Give one verdict for every id.
Answer with one JSON object that has a "verdicts" array, never a bare array.
Schema: {"verdicts":[{"id":"C1","verdict":"keep"},{"id":"C2","verdict":"trim","text":"..."},{"id":"C3","verdict":"drop"}]}"#;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SupportVerdict {
    Keep,
    Trim(String),
    Drop,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct SupportCounts {
    pub trimmed: usize,
    pub dropped: usize,
    pub unparsed: usize,
}

pub(crate) fn candidate_id(index: usize) -> String {
    format!("C{}", index + 1)
}

pub(crate) fn verdict_for<V>(verdicts: &[(String, V)], index: usize) -> Option<&V> {
    let id = candidate_id(index);
    verdicts.iter().find(|(known, _)| *known == id).map(|(_, verdict)| verdict)
}

pub fn support_prompt(candidates: &[NewItem]) -> String {
    candidates
        .iter()
        .enumerate()
        .map(|(index, candidate)| candidate_block(index, candidate))
        .collect::<Vec<_>>()
        .join("\n")
}

fn candidate_block(index: usize, candidate: &NewItem) -> String {
    let quotes = candidate.claims.iter().map(|span| format!("  quote: \"{}\"", span.quote_text));
    let attributes = [("owner", &candidate.owner), ("due", &candidate.due)]
        .into_iter()
        .filter_map(|(name, attribute)| match attribute {
            AttributeSupport::Stated { text, .. } => Some(format!("  {name}: {text}")),
            AttributeSupport::NotStated => None,
        });
    once(format!("{} {}: {}", candidate_id(index), candidate.item_type.as_str(), candidate.text))
        .chain(quotes)
        .chain(attributes)
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn parse_support(raw: &str) -> Result<Vec<(String, SupportVerdict)>, ParseFailure> {
    parse_verdicts(raw, |verdict, entry| match verdict {
        "keep" => Some(SupportVerdict::Keep),
        "drop" => Some(SupportVerdict::Drop),
        "trim" => Some(SupportVerdict::Trim(
            entry.get("text").and_then(Value::as_str).unwrap_or_default().to_string(),
        )),
        _ => None,
    })
}

pub fn apply_support(
    candidates: Vec<NewItem>,
    verdicts: Result<Vec<(String, SupportVerdict)>, ParseFailure>,
) -> (Vec<NewItem>, SupportCounts) {
    let Ok(verdicts) = verdicts else {
        let unparsed = candidates.len();
        return (candidates, SupportCounts { unparsed, ..SupportCounts::default() });
    };
    let mut kept = Vec::with_capacity(candidates.len());
    let mut counts = SupportCounts::default();
    for (index, candidate) in candidates.into_iter().enumerate() {
        match verdict_for(&verdicts, index) {
            Some(SupportVerdict::Keep) => kept.push(candidate),
            Some(SupportVerdict::Drop) => counts.dropped += 1,
            Some(SupportVerdict::Trim(text)) if text.trim() == candidate.text => kept.push(candidate),
            Some(SupportVerdict::Trim(text)) if is_usable_text(text) => {
                counts.trimmed += 1;
                kept.push(trimmed(candidate, text.trim()));
            }
            _ => {
                counts.unparsed += 1;
                kept.push(candidate);
            }
        }
    }
    (kept, counts)
}

fn is_usable_text(text: &str) -> bool {
    let text = text.trim();
    !text.is_empty() && text.chars().count() <= MAX_TEXT_CHARS
}

fn trimmed(candidate: NewItem, text: &str) -> NewItem {
    NewItem {
        normalized_key: normalized_key(text),
        text: text.to_string(),
        ..candidate
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::models::KnowledgeType;
    use crate::knowledge::test_support::verified_item;

    fn candidates() -> Vec<NewItem> {
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
