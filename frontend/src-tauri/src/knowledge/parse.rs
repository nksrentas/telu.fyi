use crate::knowledge::models::{AbstentionReason, KnowledgeType};
use crate::knowledge::repository::NewAbstention;
use crate::summary::processor::clean_llm_markdown_detailed;
use serde::Deserialize;
use serde_json::Value;

pub const MAX_ITEMS_PER_CHUNK: usize = 40;
pub const MAX_TEXT_CHARS: usize = 400;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedQuote {
    pub segment: String,
    pub quote: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedAttribute {
    pub value: String,
    pub segment: String,
    pub quote: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedItem {
    pub item_type: KnowledgeType,
    pub text: String,
    pub evidence: Vec<ParsedQuote>,
    pub owner: Option<ParsedAttribute>,
    pub due: Option<ParsedAttribute>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ParsedExtraction {
    pub items: Vec<ParsedItem>,
    pub rejected: Vec<NewAbstention>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseFailure;

#[derive(Deserialize)]
struct RawItem {
    #[serde(rename = "type")]
    item_type: String,
    text: Option<String>,
    #[serde(default)]
    evidence: Vec<RawQuote>,
    #[serde(default)]
    owner: Option<Value>,
    #[serde(default)]
    due: Option<Value>,
}

#[derive(Deserialize)]
struct RawQuote {
    segment: String,
    quote: String,
}

#[derive(Deserialize)]
struct RawAttribute {
    value: String,
    segment: String,
    quote: String,
}

pub(crate) fn json_object(raw: &str) -> Result<Value, ParseFailure> {
    let cleaned = clean_llm_markdown_detailed(raw).markdown;
    let start = cleaned.find('{').ok_or(ParseFailure)?;
    let end = cleaned.rfind('}').ok_or(ParseFailure)?;
    if end <= start {
        return Err(ParseFailure);
    }
    serde_json::from_str(&cleaned[start..=end]).map_err(|_| ParseFailure)
}

pub fn parse_extraction(raw: &str) -> Result<ParsedExtraction, ParseFailure> {
    let root = json_object(raw)?;
    let entries = root
        .get("items")
        .and_then(Value::as_array)
        .ok_or(ParseFailure)?;
    Ok(entries
        .iter()
        .enumerate()
        .fold(ParsedExtraction::default(), |parsed, (index, entry)| {
            with_entry(parsed, validate_entry(index, entry))
        }))
}

pub(crate) fn parse_verdicts<V>(
    raw: &str,
    read: impl Fn(&str, &Value) -> Option<V>,
) -> Result<Vec<(String, V)>, ParseFailure> {
    let root = json_object(raw)?;
    let entries = root
        .get("verdicts")
        .and_then(Value::as_array)
        .ok_or(ParseFailure)?;
    Ok(entries
        .iter()
        .filter_map(|entry| {
            let id = entry.get("id")?.as_str()?.trim().to_string();
            let verdict = entry.get("verdict")?.as_str()?.trim().to_lowercase();
            read(&verdict, entry).map(|verdict| (id, verdict))
        })
        .collect())
}

fn with_entry(parsed: ParsedExtraction, entry: Result<ParsedItem, NewAbstention>) -> ParsedExtraction {
    match entry {
        Ok(item) => ParsedExtraction {
            items: parsed.items.into_iter().chain(std::iter::once(item)).collect(),
            rejected: parsed.rejected,
        },
        Err(abstention) => ParsedExtraction {
            items: parsed.items,
            rejected: parsed.rejected.into_iter().chain(std::iter::once(abstention)).collect(),
        },
    }
}

fn validate_entry(index: usize, entry: &Value) -> Result<ParsedItem, NewAbstention> {
    let malformed = NewAbstention {
        reason: AbstentionReason::MalformedItem,
        candidate_type: None,
    };
    if index >= MAX_ITEMS_PER_CHUNK {
        return Err(malformed);
    }
    let raw: RawItem = serde_json::from_value(entry.clone()).map_err(|_| malformed)?;
    let item_type = KnowledgeType::parse(&raw.item_type).ok_or(NewAbstention {
        reason: AbstentionReason::InvalidType,
        candidate_type: None,
    })?;
    let reject = |reason| NewAbstention {
        reason,
        candidate_type: Some(item_type),
    };
    let text = raw.text.as_deref().map(str::trim).unwrap_or_default();
    if text.is_empty() {
        return Err(reject(AbstentionReason::EmptyText));
    }
    if text.chars().count() > MAX_TEXT_CHARS || raw.evidence.is_empty() {
        return Err(reject(AbstentionReason::MalformedItem));
    }
    Ok(ParsedItem {
        item_type,
        text: text.to_string(),
        evidence: raw
            .evidence
            .into_iter()
            .map(|quote| ParsedQuote {
                segment: quote.segment,
                quote: quote.quote,
            })
            .collect(),
        owner: parse_attribute(raw.owner),
        due: parse_attribute(raw.due),
    })
}

fn parse_attribute(value: Option<Value>) -> Option<ParsedAttribute> {
    let raw: RawAttribute = serde_json::from_value(value?).ok()?;
    Some(ParsedAttribute {
        value: raw.value,
        segment: raw.segment,
        quote: raw.quote,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(item_type: &str, text: &str) -> String {
        format!(
            r#"{{"type":"{item_type}","text":"{text}","evidence":[{{"segment":"S1","quote":"we ship on friday"}}],"owner":null,"due":null}}"#
        )
    }

    #[test]
    fn parse_extraction_reads_json_inside_think_blocks_and_fences() {
        let raw = format!(
            "<think>private reasoning</think>\n```json\n{{\"items\":[{}]}}\n```",
            item("decision", "Ship on Friday")
        );

        let parsed = parse_extraction(&raw).expect("parsed extraction");

        assert_eq!(parsed.items.len(), 1);
        assert_eq!(parsed.items[0].item_type, KnowledgeType::Decision);
        assert_eq!(parsed.items[0].evidence[0].segment, "S1");
    }

    #[test]
    fn parse_extraction_takes_the_outermost_object_from_surrounding_prose() {
        let raw = format!("Here you go: {{\"items\":[{}]}} Hope this helps.", item("fact", "Budget is fixed"));

        let parsed = parse_extraction(&raw).expect("parsed extraction");

        assert_eq!(parsed.items[0].text, "Budget is fixed");
    }

    #[test]
    fn parse_extraction_rejects_invalid_entries_per_item() {
        let long_text = "x".repeat(401);
        let mut entries = vec![
            item("opinion", "Not a type"),
            item("decision", "   "),
            item("decision", &long_text),
        ];
        entries.extend((0..37).map(|n| item("fact", &format!("Fact {n}"))));
        entries.push(item("fact", "Forty first"));
        let raw = format!("{{\"items\":[{}]}}", entries.join(","));

        let parsed = parse_extraction(&raw).expect("parsed extraction");
        let reasons: Vec<AbstentionReason> = parsed.rejected.iter().map(|entry| entry.reason).collect();

        assert_eq!(parsed.items.len(), 37);
        assert_eq!(
            reasons,
            vec![
                AbstentionReason::InvalidType,
                AbstentionReason::EmptyText,
                AbstentionReason::MalformedItem,
                AbstentionReason::MalformedItem,
            ]
        );
        assert_eq!(parsed.rejected[1].candidate_type, Some(KnowledgeType::Decision));
    }

    #[test]
    fn parse_extraction_keeps_attributes_and_treats_null_or_invalid_as_absent() {
        let raw = r#"{"items":[{"type":"commitment","text":"Maria writes notes","evidence":[{"segment":"S3","quote":"Maria will own the notes"}],"owner":{"value":"Maria","segment":"S3","quote":"Maria will own the notes"},"due":"soon"}]}"#;

        let parsed = parse_extraction(raw).expect("parsed extraction");

        assert_eq!(parsed.items[0].owner.as_ref().map(|owner| owner.value.as_str()), Some("Maria"));
        assert_eq!(parsed.items[0].due, None);
    }

    #[test]
    fn parse_extraction_fails_only_for_unreadable_documents() {
        assert_eq!(parse_extraction("I found nothing useful."), Err(ParseFailure));
        assert_eq!(parse_extraction("{\"items\": [}"), Err(ParseFailure));
        assert_eq!(parse_extraction("{\"items\": []}").map(|parsed| parsed.items.len()), Ok(0));
    }
}
