use crate::knowledge::models::AbstentionReason;
use sha2::{Digest, Sha256};
use unicode_normalization::UnicodeNormalization;

pub const QUOTE_MIN_WORDS: usize = 3;
pub const QUOTE_MIN_CHARS: usize = 12;
pub const MAX_SPAN_SEGMENTS: usize = 2;
pub const MAX_ATTRIBUTE_CHARS: usize = 80;

#[derive(Debug, Clone, PartialEq)]
pub struct LabeledSegment {
    pub label: String,
    pub evidence_id: String,
    pub text: String,
    pub audio_start_time: f64,
    pub capture_incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct LabeledSegments {
    segments: Vec<LabeledSegment>,
}

impl LabeledSegments {
    pub fn new(segments: Vec<LabeledSegment>) -> Self {
        Self { segments }
    }

    pub fn as_slice(&self) -> &[LabeledSegment] {
        &self.segments
    }

    pub fn len(&self) -> usize {
        self.segments.len()
    }

    pub fn is_empty(&self) -> bool {
        self.segments.is_empty()
    }

    fn position(&self, label: &str) -> Option<usize> {
        let label = label.trim();
        self.segments.iter().position(|segment| segment.label == label)
    }
}

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

#[derive(Debug, Clone, PartialEq)]
pub enum AttributeSupport {
    Stated { text: String, spans: Vec<VerifiedSpan> },
    NotStated,
}

pub fn normalize_with_map(raw: &str) -> (String, Vec<usize>) {
    let mut normalized = String::new();
    let mut map = Vec::new();
    let mut pending_space = false;
    for (raw_index, ch) in raw.chars().enumerate() {
        let folded_chars = std::iter::once(ch)
            .nfkc()
            .flat_map(char::to_lowercase)
            .map(fold_punctuation);
        for folded in folded_chars {
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

pub fn normalize_quote(quote: &str) -> String {
    let (normalized, _) = normalize_with_map(quote);
    normalized
        .trim_matches(|ch: char| !ch.is_alphanumeric())
        .to_string()
}

fn quote_is_long_enough(normalized_quote: &str) -> bool {
    normalized_quote.split_whitespace().count() >= QUOTE_MIN_WORDS
        && normalized_quote.chars().count() >= QUOTE_MIN_CHARS
}

pub fn verify_claim_quote(
    label: &str,
    quote: &str,
    segments: &LabeledSegments,
) -> Result<Vec<VerifiedSpan>, AbstentionReason> {
    let index = segments
        .position(label)
        .ok_or(AbstentionReason::UnknownSegment)?;
    let normalized_quote = normalize_quote(quote);
    if !quote_is_long_enough(&normalized_quote) {
        return Err(AbstentionReason::QuoteTooShort);
    }
    locate_quote(index, &normalized_quote, segments).ok_or(AbstentionReason::QuoteNotFound)
}

fn locate_quote(
    index: usize,
    normalized_quote: &str,
    segments: &LabeledSegments,
) -> Option<Vec<VerifiedSpan>> {
    let covered: Vec<&LabeledSegment> = segments
        .as_slice()
        .iter()
        .skip(index)
        .take(MAX_SPAN_SEGMENTS)
        .collect();
    (1..=covered.len()).find_map(|count| match_across(&covered[..count], normalized_quote))
}

fn match_across(covered: &[&LabeledSegment], normalized_quote: &str) -> Option<Vec<VerifiedSpan>> {
    let joined = covered
        .iter()
        .map(|segment| segment.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let (normalized, map) = normalize_with_map(&joined);
    let byte_start = normalized.find(normalized_quote)?;
    let char_start = normalized[..byte_start].chars().count();
    let char_end = char_start + normalized_quote.chars().count();
    let raw_start = map[char_start];
    let raw_end = map[char_end - 1] + 1;
    let first_length = covered[0].text.chars().count();
    if raw_start >= first_length {
        return None;
    }
    let spans = split_by_segment(covered, raw_start, raw_end);
    (spans.len() == covered.len()).then_some(spans)
}

fn split_by_segment(covered: &[&LabeledSegment], raw_start: usize, raw_end: usize) -> Vec<VerifiedSpan> {
    let mut offset = 0;
    let mut spans = Vec::new();
    for segment in covered {
        let length = segment.text.chars().count();
        let start = raw_start.max(offset).saturating_sub(offset).min(length);
        let end = raw_end.min(offset + length).saturating_sub(offset);
        if end > start {
            if let Some(span) = trimmed_span(segment, start, end) {
                spans.push(span);
            }
        }
        offset += length + 1;
    }
    spans
}

fn trimmed_span(segment: &LabeledSegment, start: usize, end: usize) -> Option<VerifiedSpan> {
    let chars: Vec<char> = segment.text.chars().collect();
    let start = (start..end).find(|&index| !chars[index].is_whitespace())?;
    let end = (start..end).rev().find(|&index| !chars[index].is_whitespace())? + 1;
    let quote_text: String = chars[start..end].iter().collect();
    Some(VerifiedSpan {
        evidence_id: segment.evidence_id.clone(),
        raw_start: start,
        raw_end: end,
        normalized_quote: normalize_with_map(&quote_text).0,
        quote_text,
        evidence_text_sha256: sha256_hex(&segment.text),
        segment_capture_incomplete: segment.capture_incomplete,
    })
}

pub fn verify_attribute(
    value: &str,
    label: &str,
    quote: &str,
    segments: &LabeledSegments,
) -> AttributeSupport {
    let normalized_value = normalize_quote(value);
    if normalized_value.is_empty() || value.trim().chars().count() > MAX_ATTRIBUTE_CHARS {
        return AttributeSupport::NotStated;
    }
    let Some(index) = segments.position(label) else {
        return AttributeSupport::NotStated;
    };
    let normalized_quote = normalize_quote(quote);
    if normalized_quote.is_empty() || find_whole_token(&normalized_quote, &normalized_value).is_none() {
        return AttributeSupport::NotStated;
    }
    match locate_quote(index, &normalized_quote, segments) {
        Some(spans) => AttributeSupport::Stated {
            text: stated_text(value, &normalized_value, &spans),
            spans,
        },
        None => AttributeSupport::NotStated,
    }
}

fn stated_text(value: &str, normalized_value: &str, spans: &[VerifiedSpan]) -> String {
    spans
        .iter()
        .find_map(|span| {
            let (normalized, map) = normalize_with_map(&span.quote_text);
            let byte_start = find_whole_token(&normalized, normalized_value)?;
            let char_start = normalized[..byte_start].chars().count();
            let char_end = char_start + normalized_value.chars().count();
            let raw: String = span
                .quote_text
                .chars()
                .skip(map[char_start])
                .take(map[char_end - 1] + 1 - map[char_start])
                .collect();
            Some(raw)
        })
        .unwrap_or_else(|| value.trim().to_string())
}

fn find_whole_token(haystack: &str, needle: &str) -> Option<usize> {
    haystack
        .match_indices(needle)
        .map(|(at, _)| at)
        .find(|&at| is_token_boundary(haystack, at, at + needle.len()))
}

fn is_token_boundary(haystack: &str, start: usize, end: usize) -> bool {
    let before = haystack[..start].chars().next_back();
    let after = haystack[end..].chars().next();
    !before.is_some_and(char::is_alphanumeric) && !after.is_some_and(char::is_alphanumeric)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(label: &str, text: &str, capture_incomplete: bool) -> LabeledSegment {
        LabeledSegment {
            label: label.to_string(),
            evidence_id: format!("evidence-{label}"),
            text: text.to_string(),
            audio_start_time: 0.0,
            capture_incomplete,
        }
    }

    fn segments() -> LabeledSegments {
        LabeledSegments::new(vec![
            segment("S1", "Okay, let's start.", false),
            segment("S2", "We\u{2019}ll SHIP the \u{FB01}nal beta \u{2014} on", false),
            segment("S3", "Friday. Maria will own the release notes.", false),
            segment("S4", "I'll take it from here by Friday.", true),
        ])
    }

    fn raw_slice(text: &str, span: &VerifiedSpan) -> String {
        text.chars()
            .skip(span.raw_start)
            .take(span.raw_end - span.raw_start)
            .collect()
    }

    #[test]
    fn normalize_with_map_folds_ligatures_width_quotes_dashes_and_whitespace() {
        let (normalized, map) = normalize_with_map("  \u{FB01}NAL  \u{FF21}\u{2019}s \u{2014} go ");

        assert_eq!(normalized, "final a's - go");
        assert_eq!(map[0], 2);
        assert_eq!(map[1], 2);
        assert_eq!(map[4], 5);
        assert_eq!(map[5], 8);
    }

    #[test]
    fn verify_claim_quote_matches_after_normalization_and_slices_raw_text() {
        let spans = verify_claim_quote("S2", "we'll ship the final beta", &segments())
            .expect("verbatim quote after normalization");

        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].evidence_id, "evidence-S2");
        assert_eq!(raw_slice(&segments().as_slice()[1].text, &spans[0]), spans[0].quote_text);
        assert_eq!(spans[0].quote_text, "We\u{2019}ll SHIP the \u{FB01}nal beta");
    }

    #[test]
    fn verify_claim_quote_rejects_short_quotes_and_strips_edge_punctuation() {
        let short = verify_claim_quote("S1", "let's do it", &segments());
        let too_few_chars = verify_claim_quote("S1", "Okay, let's", &segments());
        let punctuated = verify_claim_quote("S3", "\"Maria will own the release notes!\"", &segments());

        assert_eq!(short, Err(AbstentionReason::QuoteTooShort));
        assert_eq!(too_few_chars, Err(AbstentionReason::QuoteTooShort));
        assert!(punctuated.is_ok());
    }

    #[test]
    fn verify_claim_quote_spans_two_consecutive_segments_but_not_three() {
        let spans = verify_claim_quote("S2", "final beta - on Friday", &segments())
            .expect("quote across S2 and S3");
        let three = verify_claim_quote("S2", "on Friday. Maria will own the release notes. I'll take it", &segments());

        assert_eq!(spans.len(), 2);
        assert_eq!(spans[0].evidence_id, "evidence-S2");
        assert_eq!(spans[0].quote_text, "\u{FB01}nal beta \u{2014} on");
        assert_eq!(spans[1].evidence_id, "evidence-S3");
        assert_eq!(spans[1].quote_text, "Friday");
        assert_eq!(three, Err(AbstentionReason::QuoteNotFound));
    }

    #[test]
    fn verify_claim_quote_rejects_unknown_labels_and_absent_quotes() {
        let unknown = verify_claim_quote("S9", "ship the final beta", &segments());
        let absent = verify_claim_quote("S2", "ship the release candidate", &segments());
        let later_only = verify_claim_quote("S2", "Maria will own the release", &segments());

        assert_eq!(unknown, Err(AbstentionReason::UnknownSegment));
        assert_eq!(absent, Err(AbstentionReason::QuoteNotFound));
        assert_eq!(later_only, Err(AbstentionReason::QuoteNotFound));
    }

    #[test]
    fn verify_attribute_requires_the_value_inside_its_own_verified_quote() {
        let stated = verify_attribute("maria", "S3", "Maria will own the release notes", &segments());
        let unsupported = verify_attribute("Maria", "S4", "I'll take it from here", &segments());
        let due = verify_attribute("by friday", "S4", "take it from here by Friday", &segments());

        match stated {
            AttributeSupport::Stated { text, spans } => {
                assert_eq!(text, "Maria");
                assert_eq!(spans[0].evidence_id, "evidence-S3");
            }
            AttributeSupport::NotStated => panic!("owner quote names Maria"),
        }
        assert_eq!(unsupported, AttributeSupport::NotStated);
        match due {
            AttributeSupport::Stated { text, spans } => {
                assert_eq!(text, "by Friday");
                assert!(spans[0].segment_capture_incomplete);
            }
            AttributeSupport::NotStated => panic!("due quote states by Friday"),
        }
    }

    #[test]
    fn verify_attribute_rejects_values_that_only_match_part_of_a_word() {
        let partial = LabeledSegments::new(vec![
            segment("S1", "We ship tomorrow for sure.", false),
            segment("S2", "Joanne will handle it.", false),
            segment("S3", "Everyone decided to freeze the API.", false),
        ]);

        let tom = verify_attribute("Tom", "S1", "we ship tomorrow for sure", &partial);
        let ann = verify_attribute("Ann", "S2", "Joanne will handle it", &partial);
        let ed = verify_attribute("Ed", "S3", "everyone decided to freeze the API", &partial);

        assert_eq!(tom, AttributeSupport::NotStated);
        assert_eq!(ann, AttributeSupport::NotStated);
        assert_eq!(ed, AttributeSupport::NotStated);
    }
}
