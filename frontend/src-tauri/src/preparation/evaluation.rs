use crate::preparation::briefing::{Claim, ClaimStatus, Draft, DroppedStatement};
use crate::preparation::context::PackedContext;
use crate::preparation::models::SelectedSource;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ratio {
    pub hit: usize,
    pub of: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub supported_claims: Ratio,
    pub source_correctness: Ratio,
    pub stale_citations: usize,
    pub superseded_citations: usize,
    pub direct_context_fit: Ratio,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExpectedCitation {
    pub version_id: String,
    pub locator: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Expected {
    pub statements: Vec<Option<ExpectedCitation>>,
    pub questions: Vec<Option<ExpectedCitation>>,
}

pub struct Observed<'a> {
    pub selected: &'a PackedContext,
    pub packed: &'a PackedContext,
    pub draft: &'a Draft,
    pub stored: &'a [Claim],
    pub latest_versions: &'a HashSet<String>,
}

pub fn score(observed: &Observed, expected: &Expected) -> Report {
    let draft = observed.draft;
    let verified = draft.claims.len() + draft.questions.len();
    let expected_for_stored: Vec<Option<&ExpectedCitation>> =
        kept(&expected.statements, &draft.dropped)
            .chain(kept(&expected.questions, &draft.dropped_questions))
            .collect();
    let correct = observed
        .stored
        .iter()
        .zip(&expected_for_stored)
        .filter(|(claim, expected)| expected.is_some_and(|expected| cites(claim, expected)))
        .count();
    Report {
        supported_claims: Ratio {
            hit: verified,
            of: verified + draft.dropped.len() + draft.dropped_questions.len(),
        },
        source_correctness: Ratio {
            hit: correct,
            of: observed.stored.len(),
        },
        stale_citations: observed
            .stored
            .iter()
            .filter(|claim| claim.status != ClaimStatus::Cited)
            .count(),
        superseded_citations: observed
            .stored
            .iter()
            .filter(|claim| {
                matches!(&claim.source, SelectedSource::Document { version_id }
                    if !observed.latest_versions.contains(version_id))
            })
            .count(),
        direct_context_fit: Ratio {
            hit: context_tokens(observed.packed),
            of: context_tokens(observed.selected),
        },
    }
}

fn kept<'a>(
    expected: &'a [Option<ExpectedCitation>],
    dropped: &'a [DroppedStatement],
) -> impl Iterator<Item = Option<&'a ExpectedCitation>> {
    expected
        .iter()
        .enumerate()
        .filter(|(index, _)| dropped.iter().all(|drop| drop.index != *index))
        .map(|(_, citation)| citation.as_ref())
}

fn cites(claim: &Claim, expected: &ExpectedCitation) -> bool {
    let locator = claim
        .locator_json
        .as_deref()
        .and_then(|json| serde_json::from_str::<Value>(json).ok());
    matches!(&claim.source, SelectedSource::Document { version_id } if *version_id == expected.version_id)
        && locator.as_ref() == Some(&expected.locator)
}

fn context_tokens(context: &PackedContext) -> usize {
    context.manifest.iter().map(|entry| entry.tokens).sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::import::{import_file, import_file_into};
    use crate::documents::repository as documents;
    use crate::knowledge::test_support::migrated_pool;
    use crate::planning::models::PlannedMeetingInput;
    use crate::planning::repository as planning;
    use crate::preparation::briefing::{compose, save};
    use crate::preparation::commands::get_briefing;
    use crate::preparation::context::{build, Budget};
    use crate::preparation::selection;
    use chrono::{DateTime, Utc};
    use sqlx::SqlitePool;
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};

    const CORPUS_VERSION: &str = "prep-corpus-v1";

    #[derive(Deserialize)]
    struct Corpus {
        version: String,
        cases: Vec<Case>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Case {
        id: String,
        select: Vec<String>,
        budget: CaseBudget,
        reply: Value,
        expected: CaseExpected,
        after: Vec<Change>,
        score: Report,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CaseBudget {
        per_source_tokens: usize,
        total_tokens: usize,
    }

    #[derive(Deserialize)]
    struct CaseExpected {
        statements: Vec<Option<FixtureCitation>>,
        questions: Vec<Option<FixtureCitation>>,
    }

    #[derive(Deserialize)]
    struct FixtureCitation {
        source: String,
        locator: Value,
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Change {
        Replace { replace: String, with: String },
        Delete { delete: String },
    }

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
            .expect("test timestamp")
            .with_timezone(&Utc)
    }

    fn fixture_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/preparation")
    }

    fn source_path(file: &str) -> PathBuf {
        fixture_dir().join("sources").join(file)
    }

    fn corpus() -> Corpus {
        let raw = std::fs::read_to_string(fixture_dir().join("corpus.json")).expect("corpus");
        serde_json::from_str(&raw).expect("corpus json")
    }

    fn resolve(
        citations: &[Option<FixtureCitation>],
        versions: &HashMap<String, (String, String)>,
    ) -> Vec<Option<ExpectedCitation>> {
        citations
            .iter()
            .map(|citation| {
                citation.as_ref().map(|citation| ExpectedCitation {
                    version_id: versions[&citation.source].0.clone(),
                    locator: citation.locator.clone(),
                })
            })
            .collect()
    }

    async fn apply(
        pool: &SqlitePool,
        app_data: &Path,
        change: &Change,
        versions: &HashMap<String, (String, String)>,
    ) {
        match change {
            Change::Replace { replace, with } => {
                let document = documents::get_document(pool, &versions[replace].1)
                    .await
                    .expect("read document")
                    .expect("document");
                import_file_into(pool, app_data, &document, &source_path(with), now())
                    .await
                    .expect("replace");
            }
            Change::Delete { delete } => {
                assert!(documents::mark_deleted(pool, &versions[delete].1)
                    .await
                    .expect("delete"));
            }
        }
    }

    async fn import_sources(
        pool: &SqlitePool,
        app_data: &Path,
        files: &[String],
    ) -> HashMap<String, (String, String)> {
        let mut versions = HashMap::new();
        for file in files {
            let version = import_file(pool, app_data, &source_path(file), now())
                .await
                .expect("import");
            versions.insert(file.clone(), (version.id, version.document_id));
        }
        versions
    }

    async fn stored_claims(pool: &SqlitePool, plan: &str) -> Vec<Claim> {
        let briefing = get_briefing(pool, plan)
            .await
            .expect("briefing view")
            .briefing
            .expect("stored briefing");
        briefing
            .claims
            .into_iter()
            .chain(
                briefing
                    .questions
                    .into_iter()
                    .map(|question| question.claim),
            )
            .collect()
    }

    async fn run_case(case: &Case) -> Report {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let versions = import_sources(&pool, app_data.path(), &case.select).await;
        let selection: Vec<SelectedSource> = case
            .select
            .iter()
            .map(|file| SelectedSource::Document {
                version_id: versions[file].0.clone(),
            })
            .collect();
        let plan = planning::create(
            &pool,
            PlannedMeetingInput {
                title: "Corpus".to_string(),
                start_utc: None,
                purpose: String::new(),
            },
            now(),
        )
        .await
        .expect("planned meeting")
        .id;
        selection::select(&pool, &plan, selection.clone())
            .await
            .expect("selection");
        let budget = Budget {
            per_source_tokens: case.budget.per_source_tokens,
            total_tokens: case.budget.total_tokens,
        };
        let unbounded = Budget {
            per_source_tokens: usize::MAX,
            total_tokens: usize::MAX,
        };
        let packed = build(&pool, app_data.path(), &selection, budget)
            .await
            .expect("packed context");
        let selected = build(&pool, app_data.path(), &selection, unbounded)
            .await
            .expect("selected context");
        let reply = case.reply.to_string();
        let draft = compose(&packed, |_, _| std::future::ready(Ok(reply.clone())))
            .await
            .expect("compose");
        save(&pool, &plan, &packed, draft.clone(), now())
            .await
            .expect("save");
        for change in &case.after {
            apply(&pool, app_data.path(), change, &versions).await;
        }
        let stored = stored_claims(&pool, &plan).await;
        assert_eq!(stored.len(), draft.claims.len() + draft.questions.len());
        let latest_versions: HashSet<String> = documents::list_summaries(&pool)
            .await
            .expect("summaries")
            .into_iter()
            .map(|summary| summary.latest_version_id)
            .collect();
        let expected = Expected {
            statements: resolve(&case.expected.statements, &versions),
            questions: resolve(&case.expected.questions, &versions),
        };
        score(
            &Observed {
                selected: &selected,
                packed: &packed,
                draft: &draft,
                stored: &stored,
                latest_versions: &latest_versions,
            },
            &expected,
        )
    }

    fn fixture_sentences(case: &Case) -> Vec<String> {
        let mut sentences: Vec<String> = std::fs::read_dir(fixture_dir().join("sources"))
            .expect("sources")
            .flat_map(|entry| {
                let text = std::fs::read_to_string(entry.expect("entry").path()).expect("source");
                text.split("\n\n")
                    .map(|block| block.trim_start_matches('#').trim().to_string())
                    .collect::<Vec<_>>()
            })
            .collect();
        for item in ["statements", "questions"]
            .iter()
            .filter_map(|key| case.reply.get(key).and_then(Value::as_array))
            .flatten()
        {
            for field in ["text", "quote", "rationale"] {
                if let Some(value) = item.get(field).and_then(Value::as_str) {
                    sentences.push(value.to_string());
                }
            }
        }
        sentences.retain(|sentence| !sentence.is_empty());
        sentences
    }

    #[tokio::test]
    async fn corpus_scores_to_the_expected_numbers() {
        let corpus = corpus();
        assert_eq!(corpus.version, CORPUS_VERSION);
        for case in &corpus.cases {
            assert_eq!(run_case(case).await, case.score, "case {}", case.id);
        }
    }

    #[tokio::test]
    async fn report_contains_no_passage_text() {
        for case in &corpus().cases {
            let json = serde_json::to_string(&run_case(case).await).expect("report json");
            for sentence in fixture_sentences(case) {
                assert!(
                    !json.contains(&sentence),
                    "case {} leaks fixture text",
                    case.id
                );
            }
        }
    }

    #[test]
    fn no_threshold_file_is_part_of_the_corpus() {
        let mut names = Vec::new();
        let mut pending = vec![fixture_dir()];
        while let Some(dir) = pending.pop() {
            for entry in std::fs::read_dir(dir).expect("fixture dir") {
                let path = entry.expect("entry").path();
                names.push(path.to_string_lossy().to_lowercase());
                if path.is_dir() {
                    pending.push(path);
                }
            }
        }
        assert!(!names.is_empty());
        assert!(names.iter().all(|name| !name.contains("threshold")));
        let corpus = std::fs::read_to_string(fixture_dir().join("corpus.json")).expect("corpus");
        assert!(!corpus.to_lowercase().contains("threshold"));
    }
}
