use crate::knowledge::models::AbstentionReason;
use sha2::{Digest, Sha256};
use unicode_normalization::UnicodeNormalization;

pub const QUOTE_MIN_WORDS: usize = 3;
pub const QUOTE_MIN_CHARS: usize = 12;
pub const MAX_SPAN_SEGMENTS: usize = 2;
pub const MAX_ATTRIBUTE_CHARS: usize = 80;
pub const MIN_ATTRIBUTE_CHARS: usize = 2;
const NON_ATTRIBUTE_VALUES: [&str; 4] = ["i", "we", "you", "they"];

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
    let byte_start = find_whole_token(&normalized, normalized_quote)?;
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
    claim_evidence_ids: &[String],
) -> AttributeSupport {
    let normalized_value = normalize_quote(value);
    if !is_attributable(&normalized_value) || value.trim().chars().count() > MAX_ATTRIBUTE_CHARS {
        return AttributeSupport::NotStated;
    }
    let Some(index) = segments.position(label) else {
        return AttributeSupport::NotStated;
    };
    let normalized_quote = normalize_quote(quote);
    if find_whole_token(&normalized_quote, &normalized_value).is_none() {
        return AttributeSupport::NotStated;
    }
    let Some(spans) = locate_quote(index, &normalized_quote, segments) else {
        return AttributeSupport::NotStated;
    };
    if !is_tied_to_claim(&spans, claim_evidence_ids, segments) {
        return AttributeSupport::NotStated;
    }
    match stated_text(&normalized_value, &spans) {
        Some(text) => AttributeSupport::Stated { text, spans },
        None => AttributeSupport::NotStated,
    }
}

fn is_attributable(normalized_value: &str) -> bool {
    normalized_value.chars().count() >= MIN_ATTRIBUTE_CHARS
        && !NON_ATTRIBUTE_VALUES.contains(&normalized_value)
}

fn is_tied_to_claim(spans: &[VerifiedSpan], claim_evidence_ids: &[String], segments: &LabeledSegments) -> bool {
    let all = segments.as_slice();
    let following = all
        .iter()
        .rposition(|segment| claim_evidence_ids.contains(&segment.evidence_id))
        .and_then(|last| all.get(last + 1))
        .map(|segment| &segment.evidence_id);
    spans.iter().any(|span| {
        claim_evidence_ids.contains(&span.evidence_id) || following == Some(&span.evidence_id)
    })
}

fn stated_text(normalized_value: &str, spans: &[VerifiedSpan]) -> Option<String> {
    spans
        .iter()
        .find_map(|span| whole_token_slice(&span.quote_text, normalized_value))
        .filter(|raw| raw.chars().count() <= MAX_ATTRIBUTE_CHARS)
}

fn whole_token_slice(raw: &str, normalized_value: &str) -> Option<String> {
    let (normalized, map) = normalize_with_map(raw);
    let byte_start = find_whole_token(&normalized, normalized_value)?;
    let char_start = normalized[..byte_start].chars().count();
    let char_end = char_start + normalized_value.chars().count();
    Some(
        raw.chars()
            .skip(map[char_start])
            .take(map[char_end - 1] + 1 - map[char_start])
            .collect(),
    )
}

fn find_whole_token(haystack: &str, needle: &str) -> Option<usize> {
    if needle.is_empty() {
        return None;
    }
    haystack
        .char_indices()
        .map(|(at, _)| at)
        .filter(|&at| haystack[at..].starts_with(needle))
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

    fn ids(labels: &[&str]) -> Vec<String> {
        labels.iter().map(|label| format!("evidence-{label}")).collect()
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
        let stated = verify_attribute("maria", "S3", "Maria will own the release notes", &segments(), &ids(&["S3"]));
        let unsupported = verify_attribute("Maria", "S4", "I'll take it from here", &segments(), &ids(&["S4"]));
        let due = verify_attribute("by friday", "S4", "take it from here by Friday", &segments(), &ids(&["S4"]));

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

        let tom = verify_attribute("Tom", "S1", "we ship tomorrow for sure", &partial, &ids(&["S1"]));
        let ann = verify_attribute("Ann", "S2", "Joanne will handle it", &partial, &ids(&["S2"]));
        let ed = verify_attribute("Ed", "S3", "everyone decided to freeze the API", &partial, &ids(&["S3"]));

        assert_eq!(tom, AttributeSupport::NotStated);
        assert_eq!(ann, AttributeSupport::NotStated);
        assert_eq!(ed, AttributeSupport::NotStated);
    }

    #[test]
    fn find_whole_token_sees_an_occurrence_that_overlaps_a_mid_word_one() {
        assert_eq!(find_whole_token("xab ab ab", "ab ab"), Some(4));
        assert_eq!(find_whole_token("ab", ""), None);
    }

    #[test]
    fn verify_attribute_never_stores_text_that_crosses_a_segment_boundary() {
        let crossing = verify_attribute("on Friday", "S2", "final beta - on Friday", &segments(), &ids(&["S2"]));

        assert_eq!(crossing, AttributeSupport::NotStated);
    }

    #[test]
    fn verify_attribute_rejects_a_raw_slice_longer_than_the_attribute_cap() {
        let words = ["Maria", "Nadia", "Oscar", "Petra", "Quinn", "Rosa", "Sven", "Tara", "Uma", "Vera"];
        let value = words.join(" ");
        let spaced = LabeledSegments::new(vec![segment("S1", &words.join("     "), false)]);

        let long = verify_attribute(&value, "S1", &value, &spaced, &ids(&["S1"]));

        assert!(value.chars().count() <= MAX_ATTRIBUTE_CHARS);
        assert!(words.join("     ").chars().count() > MAX_ATTRIBUTE_CHARS);
        assert_eq!(long, AttributeSupport::NotStated);
    }

    #[test]
    fn verify_attribute_never_states_short_values_or_pronouns() {
        let pronouns = LabeledSegments::new(vec![
            segment("S1", "I'll take it from here by Friday.", false),
            segment("S2", "We'll ship the final beta.", false),
            segment("S3", "You and they said M will ship it.", false),
        ]);
        let cases = [
            ("I", "S1", "I'll take it from here"),
            ("we", "S2", "We'll ship the final beta"),
            ("You", "S3", "You and they said M will ship it"),
            ("they", "S3", "You and they said M will ship it"),
            ("", "S3", "You and they said M will ship it"),
            ("   ", "S3", "You and they said M will ship it"),
            ("M", "S3", "You and they said M will ship it"),
        ];

        for (value, label, quote) in cases {
            let support = verify_attribute(value, label, quote, &pronouns, &ids(&[label]));
            assert_eq!(support, AttributeSupport::NotStated, "value {value:?}");
        }
    }

    #[test]
    fn verify_attribute_requires_a_span_tied_to_the_claim() {
        let quote = "Maria will own the release notes";
        let same = verify_attribute("Maria", "S3", quote, &segments(), &ids(&["S3"]));
        let following = verify_attribute("Maria", "S3", quote, &segments(), &ids(&["S2"]));
        let unrelated = verify_attribute("Maria", "S3", quote, &segments(), &ids(&["S1"]));

        assert!(matches!(same, AttributeSupport::Stated { .. }));
        assert!(matches!(following, AttributeSupport::Stated { .. }));
        assert_eq!(unrelated, AttributeSupport::NotStated);
    }

    #[test]
    fn verify_attribute_stores_the_first_whole_token_occurrence() {
        let repeated = LabeledSegments::new(vec![segment("S1", "MARIA said Maria will own the notes", false)]);

        let stated = verify_attribute("maria", "S1", "MARIA said Maria will own the notes", &repeated, &ids(&["S1"]));

        match stated {
            AttributeSupport::Stated { text, .. } => assert_eq!(text, "MARIA"),
            AttributeSupport::NotStated => panic!("quote names Maria"),
        }
    }

    #[test]
    fn verify_claim_quote_rejects_quotes_that_start_or_end_mid_word() {
        let later = "They disagree with the plan to ship, we agree with the plan to ship";
        let claims = LabeledSegments::new(vec![
            segment("S1", "I disagree with the plan to ship Friday", false),
            segment("S2", "We cannot ship the beta today", false),
            segment("S3", later, false),
        ]);

        let disagree = verify_claim_quote("S1", "agree with the plan to ship Friday", &claims);
        let cannot = verify_claim_quote("S2", "not ship the beta today", &claims);
        let spans = verify_claim_quote("S3", "agree with the plan to ship", &claims).expect("whole-token occurrence");

        assert_eq!(disagree, Err(AbstentionReason::QuoteNotFound));
        assert_eq!(cannot, Err(AbstentionReason::QuoteNotFound));
        assert_eq!(spans.len(), 1);
        assert_eq!(raw_slice(later, &spans[0]), "agree with the plan to ship");
        assert_eq!(spans[0].raw_start, later.find("we agree").expect("second occurrence") + 3);
    }
}
