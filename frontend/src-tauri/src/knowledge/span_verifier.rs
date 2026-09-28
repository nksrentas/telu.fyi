use crate::knowledge::models::AbstentionReason;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct LabeledSegment {
    pub evidence_id: String,
    pub text: String,
    pub capture_incomplete: bool,
}

pub type LabeledSegments = HashMap<String, LabeledSegment>;

#[derive(Debug, Clone, PartialEq)]
pub struct VerifiedSpan {
    pub evidence_id: String,
    pub raw_start: usize,
    pub raw_end: usize,
    pub quote_text: String,
    pub normalized_quote: String,
    pub evidence_text_sha256: String,
    pub segment_capture_incomplete: bool,
}

pub fn normalize_with_map(raw: &str) -> (String, Vec<usize>) {
    let mut normalized = String::new();
    let mut map = Vec::new();
    let mut pending_space = false;
    for (raw_index, ch) in raw.chars().enumerate() {
        for folded in ch.to_lowercase().map(fold_punctuation) {
            if folded.is_whitespace() {
                pending_space = !normalized.is_empty();
                continue;
            }
            if pending_space {
                normalized.push(' ');
                map.push(raw_index);
                pending_space = false;
            }
            normalized.push(folded);
            map.push(raw_index);
        }
    }
    (normalized, map)
}

fn fold_punctuation(ch: char) -> char {
    match ch {
        '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}' => '\'',
        '\u{201C}' | '\u{201D}' | '\u{201E}' => '"',
        '\u{2010}'..='\u{2015}' | '\u{2212}' => '-',
        other => other,
    }
}

pub fn sha256_hex(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

pub fn verify_claim_quote(
    label: &str,
    quote: &str,
    segments: &LabeledSegments,
) -> Result<VerifiedSpan, AbstentionReason> {
    let segment = segments
        .get(label.trim())
        .ok_or(AbstentionReason::UnknownSegment)?;
    let (normalized_quote, _) = normalize_with_map(quote);
    if normalized_quote.is_empty() {
        return Err(AbstentionReason::QuoteNotFound);
    }
    let (normalized_text, map) = normalize_with_map(&segment.text);
    let byte_start = normalized_text
        .find(&normalized_quote)
        .ok_or(AbstentionReason::QuoteNotFound)?;
    let char_start = normalized_text[..byte_start].chars().count();
    let char_end = char_start + normalized_quote.chars().count();
    let raw_start = map[char_start];
    let raw_end = map[char_end - 1] + 1;
    let quote_text = segment
        .text
        .chars()
        .skip(raw_start)
        .take(raw_end - raw_start)
        .collect();

    Ok(VerifiedSpan {
        evidence_id: segment.evidence_id.clone(),
        raw_start,
        raw_end,
        quote_text,
        normalized_quote,
        evidence_text_sha256: sha256_hex(&segment.text),
        segment_capture_incomplete: segment.capture_incomplete,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segments() -> LabeledSegments {
        HashMap::from([(
            "S2".to_string(),
            LabeledSegment {
                evidence_id: "evidence-2".to_string(),
                text: "Okay.  We\u{2019}ll SHIP the beta \u{2014} on Friday.".to_string(),
                capture_incomplete: false,
            },
        )])
    }

    #[test]
    fn normalize_with_map_folds_case_quotes_dashes_and_whitespace() {
        let (normalized, map) = normalize_with_map("  We\u{2019}ll  \u{2014}  GO ");

        assert_eq!(normalized, "we'll - go");
        assert_eq!(map.len(), normalized.chars().count());
        assert_eq!(map[0], 2);
        assert_eq!(map[3], 5);
        assert_eq!(map[6], 9);
    }

    #[test]
    fn verify_claim_quote_returns_raw_offsets_that_slice_back_to_the_quote() {
        let span = verify_claim_quote("S2", "we'll ship the beta - on friday", &segments())
            .expect("verbatim quote after normalization");
        let raw: String = segments()["S2"]
            .text
            .chars()
            .skip(span.raw_start)
            .take(span.raw_end - span.raw_start)
            .collect();

        assert_eq!(span.evidence_id, "evidence-2");
        assert_eq!(raw, span.quote_text);
        assert_eq!(span.quote_text, "We\u{2019}ll SHIP the beta \u{2014} on Friday");
        assert_eq!(span.normalized_quote, "we'll ship the beta - on friday");
        assert_eq!(span.evidence_text_sha256, sha256_hex(&segments()["S2"].text));
    }

    #[test]
    fn verify_claim_quote_rejects_unknown_labels() {
        let result = verify_claim_quote("S9", "ship the beta", &segments());

        assert_eq!(result, Err(AbstentionReason::UnknownSegment));
    }

    #[test]
    fn verify_claim_quote_rejects_quotes_absent_from_the_segment() {
        let absent = verify_claim_quote("S2", "ship the release candidate", &segments());
        let empty = verify_claim_quote("S2", "   ", &segments());

        assert_eq!(absent, Err(AbstentionReason::QuoteNotFound));
        assert_eq!(empty, Err(AbstentionReason::QuoteNotFound));
    }
}
