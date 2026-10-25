use crate::documents::models::Availability;
use crate::documents::repository as documents;
use crate::knowledge::models::{KnowledgeError, KnowledgeItemView};
use crate::knowledge::repository::KnowledgeRepository;
use crate::preparation::models::{SelectedSource, SelectionError};
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::Path;
use tracing::warn;

pub const CHARS_PER_TOKEN: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Budget {
    pub per_source_tokens: usize,
    pub total_tokens: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ContextPiece {
    Passage {
        version_id: String,
        passage_id: String,
        ordinal: i64,
        locator_json: String,
        text: String,
    },
    Knowledge {
        meeting_id: String,
        item_id: String,
        revision_id: Option<String>,
        text: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(
    tag = "status",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum SourceStatus {
    Included,
    Truncated { kept: usize, total: usize },
    Omitted,
    Missing,
    Deleted,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub source: SelectedSource,
    #[serde(flatten)]
    pub status: SourceStatus,
    pub reason: &'static str,
    pub tokens: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackedContext {
    pub pieces: Vec<ContextPiece>,
    pub manifest: Vec<ManifestEntry>,
}

enum Loaded {
    Pieces(Vec<ContextPiece>),
    Unusable(SourceStatus, &'static str),
}

pub async fn build(
    pool: &SqlitePool,
    app_data_dir: &Path,
    selection: &[SelectedSource],
    budget: Budget,
) -> Result<PackedContext, SelectionError> {
    let mut eligible: HashMap<String, Option<Vec<KnowledgeItemView>>> = HashMap::new();
    let mut loaded = Vec::with_capacity(selection.len());
    for source in selection {
        let content = match source {
            SelectedSource::Document { version_id } => {
                load_document(pool, app_data_dir, version_id).await?
            }
            SelectedSource::Knowledge {
                meeting_id,
                item_id,
            } => {
                if !eligible.contains_key(meeting_id) {
                    let items = load_eligible(pool, meeting_id).await?;
                    eligible.insert(meeting_id.clone(), items);
                }
                knowledge_piece(eligible[meeting_id].as_deref(), meeting_id, item_id)
            }
        };
        loaded.push((source.clone(), content));
    }
    Ok(pack(loaded, budget))
}

async fn load_document(
    pool: &SqlitePool,
    app_data_dir: &Path,
    version_id: &str,
) -> Result<Loaded, SelectionError> {
    let Some(version) = documents::get_version(pool, version_id)
        .await
        .map_err(storage)?
    else {
        return Ok(Loaded::Unusable(
            SourceStatus::Unavailable,
            "VERSION_NOT_FOUND",
        ));
    };
    let document = documents::get_document(pool, &version.document_id)
        .await
        .map_err(storage)?;
    if !matches!(document, Some(document) if document.availability == Availability::Available) {
        return Ok(Loaded::Unusable(SourceStatus::Deleted, "DOCUMENT_DELETED"));
    }
    if let Some(managed_path) = &version.managed_path {
        let exists = tokio::fs::try_exists(app_data_dir.join(managed_path))
            .await
            .unwrap_or(false);
        if !exists {
            return Ok(Loaded::Unusable(
                SourceStatus::Missing,
                "MANAGED_FILE_MISSING",
            ));
        }
    }
    let pieces = documents::list_passages(pool, version_id)
        .await
        .map_err(storage)?
        .into_iter()
        .map(|passage| ContextPiece::Passage {
            version_id: passage.version_id,
            passage_id: passage.id,
            ordinal: passage.ordinal,
            locator_json: passage.locator_json,
            text: passage.text,
        })
        .collect();
    Ok(Loaded::Pieces(pieces))
}

async fn load_eligible(
    pool: &SqlitePool,
    meeting_id: &str,
) -> Result<Option<Vec<KnowledgeItemView>>, SelectionError> {
    match KnowledgeRepository::list_eligible_items(pool, meeting_id).await {
        Ok(items) => Ok(Some(items)),
        Err(KnowledgeError::Storage) => Err(SelectionError::Storage),
        Err(_) => Ok(None),
    }
}

fn knowledge_piece(
    eligible: Option<&[KnowledgeItemView]>,
    meeting_id: &str,
    item_id: &str,
) -> Loaded {
    match eligible
        .unwrap_or_default()
        .iter()
        .find(|item| item.item_id == item_id)
    {
        Some(item) => Loaded::Pieces(vec![ContextPiece::Knowledge {
            meeting_id: meeting_id.to_string(),
            item_id: item_id.to_string(),
            revision_id: item.latest_revision_id.clone(),
            text: item.text.clone(),
        }]),
        None => Loaded::Unusable(SourceStatus::Unavailable, "KNOWLEDGE_NOT_ELIGIBLE"),
    }
}

fn pack(sources: Vec<(SelectedSource, Loaded)>, budget: Budget) -> PackedContext {
    let mut remaining = budget.total_tokens;
    let mut pieces = Vec::new();
    let mut manifest = Vec::with_capacity(sources.len());
    for (source, loaded) in sources {
        let candidates = match loaded {
            Loaded::Pieces(candidates) => candidates,
            Loaded::Unusable(status, reason) => {
                manifest.push(ManifestEntry {
                    source,
                    status,
                    reason,
                    tokens: 0,
                });
                continue;
            }
        };
        let source_is_binding = budget.per_source_tokens <= remaining;
        let limit = budget.per_source_tokens.min(remaining);
        let total = candidates.len();
        let mut tokens = 0;
        let mut kept = 0;
        for candidate in candidates {
            let cost = piece_tokens(&candidate);
            if tokens + cost > limit {
                break;
            }
            tokens += cost;
            kept += 1;
            pieces.push(candidate);
        }
        remaining -= tokens;
        let budget_reason = if source_is_binding {
            "SOURCE_BUDGET"
        } else {
            "TOTAL_BUDGET"
        };
        let (status, reason) = match kept {
            _ if kept == total => (SourceStatus::Included, "WITHIN_BUDGET"),
            0 => (SourceStatus::Omitted, budget_reason),
            _ => (SourceStatus::Truncated { kept, total }, budget_reason),
        };
        manifest.push(ManifestEntry {
            source,
            status,
            reason,
            tokens,
        });
    }
    PackedContext { pieces, manifest }
}

fn piece_tokens(piece: &ContextPiece) -> usize {
    let text = match piece {
        ContextPiece::Passage { text, .. } | ContextPiece::Knowledge { text, .. } => text,
    };
    text.chars().count().div_ceil(CHARS_PER_TOKEN)
}

fn storage(error: sqlx::Error) -> SelectionError {
    warn!(error = %error, "preparation context storage failed");
    SelectionError::Storage
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::import::import_file;
    use crate::documents::ingest::ingest_text;
    use crate::knowledge::models::ReviewAction;
    use crate::knowledge::review::append_review;
    use crate::knowledge::test_support::{migrated_pool, seed_items, MEETING_ID};
    use chrono::{DateTime, Utc};

    const ROOMY: Budget = Budget {
        per_source_tokens: 1_000,
        total_tokens: 10_000,
    };

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
            .expect("test timestamp")
            .with_timezone(&Utc)
    }

    async fn pasted(pool: &SqlitePool, title: &str, text: &str) -> SelectedSource {
        let version = ingest_text(pool, title, text, now())
            .await
            .expect("document");
        SelectedSource::Document {
            version_id: version.id,
        }
    }

    fn passage_texts(context: &PackedContext) -> Vec<&str> {
        context
            .pieces
            .iter()
            .map(|piece| match piece {
                ContextPiece::Passage { text, .. } | ContextPiece::Knowledge { text, .. } => {
                    text.as_str()
                }
            })
            .collect()
    }

    fn statuses(context: &PackedContext) -> Vec<(SourceStatus, &'static str)> {
        context
            .manifest
            .iter()
            .map(|entry| (entry.status, entry.reason))
            .collect()
    }

    #[tokio::test]
    async fn context_is_byte_identical_for_the_same_selection() {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let items = seed_items(&pool, MEETING_ID, &["Ship the beta"]).await;
        append_review(&pool, MEETING_ID, &items[0], ReviewAction::Accept)
            .await
            .expect("accept");
        let selection = vec![
            pasted(&pool, "Roadmap", "Alpha.\n\nBeta.\n\nGamma.").await,
            SelectedSource::Knowledge {
                meeting_id: MEETING_ID.to_string(),
                item_id: items[0].clone(),
            },
            pasted(&pool, "Notes", "Delta.").await,
        ];

        let first = build(&pool, app_data.path(), &selection, ROOMY)
            .await
            .expect("first");
        let second = build(&pool, app_data.path(), &selection, ROOMY)
            .await
            .expect("second");

        assert_eq!(
            serde_json::to_vec(&first).expect("json"),
            serde_json::to_vec(&second).expect("json")
        );
        assert_eq!(
            passage_texts(&first),
            vec!["Alpha.", "Beta.", "Gamma.", "Ship the beta", "Delta."]
        );
        assert_eq!(
            statuses(&first),
            vec![(SourceStatus::Included, "WITHIN_BUDGET"); 3]
        );
    }

    #[tokio::test]
    async fn truncation_stops_at_a_passage_boundary_under_the_source_budget() {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let selection =
            vec![pasted(&pool, "Long", "aaaaaaaa\n\nbbbbbbbb\n\ncccccccc\n\ndddd").await];
        let budget = Budget {
            per_source_tokens: 5,
            total_tokens: 100,
        };

        let context = build(&pool, app_data.path(), &selection, budget)
            .await
            .expect("built");

        assert_eq!(passage_texts(&context), vec!["aaaaaaaa", "bbbbbbbb"]);
        assert_eq!(
            statuses(&context),
            vec![(
                SourceStatus::Truncated { kept: 2, total: 4 },
                "SOURCE_BUDGET"
            )]
        );
        assert_eq!(context.manifest[0].tokens, 4);
    }

    #[tokio::test]
    async fn the_total_budget_truncates_then_omits_later_sources() {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let selection = vec![
            pasted(&pool, "First", "aaaaaaaa\n\nbbbbbbbb").await,
            pasted(&pool, "Second", "cccccccc\n\ndddddddd").await,
            pasted(&pool, "Third", "eeee").await,
        ];
        let budget = Budget {
            per_source_tokens: 10,
            total_tokens: 6,
        };

        let context = build(&pool, app_data.path(), &selection, budget)
            .await
            .expect("built");

        assert_eq!(
            passage_texts(&context),
            vec!["aaaaaaaa", "bbbbbbbb", "cccccccc"]
        );
        assert_eq!(
            statuses(&context),
            vec![
                (SourceStatus::Included, "WITHIN_BUDGET"),
                (
                    SourceStatus::Truncated { kept: 1, total: 2 },
                    "TOTAL_BUDGET"
                ),
                (SourceStatus::Omitted, "TOTAL_BUDGET"),
            ]
        );
    }

    #[tokio::test]
    async fn a_deleted_document_is_listed_as_deleted() {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let gone = pasted(&pool, "Gone", "Secret plan.").await;
        let kept = pasted(&pool, "Kept", "Public plan.").await;
        let SelectedSource::Document { version_id } = &gone else {
            unreachable!()
        };
        let version = documents::get_version(&pool, version_id)
            .await
            .expect("version")
            .expect("exists");
        documents::mark_deleted(&pool, &version.document_id)
            .await
            .expect("deleted");

        let context = build(&pool, app_data.path(), &[gone.clone(), kept], ROOMY)
            .await
            .expect("built");

        assert_eq!(passage_texts(&context), vec!["Public plan."]);
        assert_eq!(context.manifest[0].source, gone);
        assert_eq!(
            statuses(&context),
            vec![
                (SourceStatus::Deleted, "DOCUMENT_DELETED"),
                (SourceStatus::Included, "WITHIN_BUDGET"),
            ]
        );
    }

    #[tokio::test]
    async fn a_managed_file_that_is_gone_is_listed_as_missing() {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let source_dir = tempfile::tempdir().expect("source dir");
        let source = source_dir.path().join("brief.md");
        std::fs::write(&source, "# Brief\n\nKeep it short.").expect("source");
        let version = import_file(&pool, app_data.path(), &source, now())
            .await
            .expect("imported");
        let selection = vec![SelectedSource::Document {
            version_id: version.id.clone(),
        }];
        let before = build(&pool, app_data.path(), &selection, ROOMY)
            .await
            .expect("before");
        std::fs::remove_file(app_data.path().join(version.managed_path.expect("managed")))
            .expect("removed");

        let after = build(&pool, app_data.path(), &selection, ROOMY)
            .await
            .expect("after");

        assert_eq!(
            statuses(&before),
            vec![(SourceStatus::Included, "WITHIN_BUDGET")]
        );
        assert!(after.pieces.is_empty());
        assert_eq!(
            statuses(&after),
            vec![(SourceStatus::Missing, "MANAGED_FILE_MISSING")]
        );
    }

    #[tokio::test]
    async fn unknown_versions_and_ineligible_knowledge_are_unavailable() {
        let pool = migrated_pool().await;
        let app_data = tempfile::tempdir().expect("app data");
        let items = seed_items(&pool, MEETING_ID, &["Still proposed"]).await;
        let selection = vec![
            SelectedSource::Document {
                version_id: "missing".to_string(),
            },
            SelectedSource::Knowledge {
                meeting_id: MEETING_ID.to_string(),
                item_id: items[0].clone(),
            },
            SelectedSource::Knowledge {
                meeting_id: "not-a-meeting".to_string(),
                item_id: "x".to_string(),
            },
        ];

        let context = build(&pool, app_data.path(), &selection, ROOMY)
            .await
            .expect("built");

        assert!(context.pieces.is_empty());
        assert_eq!(
            statuses(&context),
            vec![
                (SourceStatus::Unavailable, "VERSION_NOT_FOUND"),
                (SourceStatus::Unavailable, "KNOWLEDGE_NOT_ELIGIBLE"),
                (SourceStatus::Unavailable, "KNOWLEDGE_NOT_ELIGIBLE"),
            ]
        );
    }

    #[test]
    fn manifest_entries_serialize_with_status_and_reason() {
        let entry = ManifestEntry {
            source: SelectedSource::Document {
                version_id: "v".to_string(),
            },
            status: SourceStatus::Truncated { kept: 1, total: 3 },
            reason: "SOURCE_BUDGET",
            tokens: 7,
        };

        assert_eq!(
            serde_json::to_value(entry).expect("json"),
            serde_json::json!({
                "source": {"kind": "document", "versionId": "v"},
                "status": "truncated", "kept": 1, "total": 3,
                "reason": "SOURCE_BUDGET", "tokens": 7
            })
        );
    }

    struct XorShift(u64);

    impl XorShift {
        fn below(&mut self, bound: usize) -> usize {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            (self.0 % bound as u64) as usize
        }
    }

    #[test]
    fn packing_never_exceeds_either_budget_over_generated_sizes() {
        let mut rng = XorShift(0x9E37_79B9_7F4A_7C15);
        for _ in 0..500 {
            let budget = Budget {
                per_source_tokens: rng.below(60),
                total_tokens: rng.below(200),
            };
            let sources: Vec<(SelectedSource, Vec<usize>)> = (0..rng.below(8))
                .map(|index| {
                    let sizes = (0..rng.below(10)).map(|_| 1 + rng.below(80)).collect();
                    let source = SelectedSource::Document {
                        version_id: format!("v{index}"),
                    };
                    (source, sizes)
                })
                .collect();
            let loaded = sources
                .iter()
                .map(|(source, sizes)| {
                    let pieces = sizes
                        .iter()
                        .enumerate()
                        .map(|(ordinal, size)| ContextPiece::Passage {
                            version_id: format!("{source:?}"),
                            passage_id: format!("{ordinal}"),
                            ordinal: ordinal as i64,
                            locator_json: "{}".to_string(),
                            text: "é".repeat(*size),
                        })
                        .collect();
                    (source.clone(), Loaded::Pieces(pieces))
                })
                .collect();

            let context = pack(loaded, budget);

            let mut total = 0;
            for (entry, (_, sizes)) in context.manifest.iter().zip(&sources) {
                let kept = match entry.status {
                    SourceStatus::Included => sizes.len(),
                    SourceStatus::Truncated { kept, .. } => kept,
                    _ => 0,
                };
                let expected: usize = sizes[..kept].iter().map(|size| size.div_ceil(4)).sum();
                assert_eq!(entry.tokens, expected);
                assert!(entry.tokens <= budget.per_source_tokens);
                if kept < sizes.len() {
                    let next = sizes[kept].div_ceil(4);
                    assert!(
                        entry.tokens + next
                            > budget.per_source_tokens.min(budget.total_tokens - total),
                        "stopped before a passage that fits"
                    );
                }
                total += entry.tokens;
            }
            assert!(total <= budget.total_tokens);
            assert_eq!(context.manifest.len(), sources.len());
            assert_eq!(
                context.pieces.iter().map(piece_tokens).sum::<usize>(),
                total
            );
        }
    }
}
