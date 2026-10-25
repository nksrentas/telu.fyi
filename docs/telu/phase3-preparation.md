# Phase 3 Preparation: maintainer notes

Sources and briefings for planned meetings (DOC-01 to DOC-04, PREP-01 to PREP-05, build only). Code lives in `frontend/src-tauri/src/{planning,documents,preparation}` and `frontend/src/components/preparation`.

## Supported formats

| Path | Accepted | Parser version |
|---|---|---|
| Paste | Plain text | `paste-text-1` |
| Import | `.md`, `.markdown` (Markdown) | `import-markdown-1` |
| Import | `.txt` (plain text) | `import-text-1` |

Nothing else is parsed. Text must be UTF-8 with no NUL byte. A leading BOM is stripped and line endings become `\n`. Other bytes give a version with extraction status `failed` (`EXTRACTION_FAILED`). An empty source is refused (`EMPTY_SOURCE`).

Each replace adds a new immutable version, with a SHA-256 hash, and keeps the old ones. Passage locators are JSON with character offsets `start`/`end` into the normalised text: `{"kind":"paragraph","index",...}` for plain text, `{"kind":"section","heading_path","paragraph",...}` for Markdown.

## Limits (`documents/limits.rs`)

| Constant | Value | Applies to | Refusal |
|---|---|---|---|
| `MAX_SOURCE_BYTES` | `1024 * 1024` (1 MiB) | Imported files, before and after reading | `SOURCE_TOO_LARGE:MAX_SOURCE_BYTES` |
| `MAX_SOURCE_CHARS` | `200_000` | Normalised text, paste and import | `SOURCE_TOO_LARGE:MAX_SOURCE_CHARS` |
| `MAX_PASSAGES` | `2_000` | Passages per version | `SOURCE_TOO_LARGE:MAX_PASSAGES` |
| `MAX_PASSAGE_CHARS` | `4_000` | One passage. Longer spans are split at a sentence end or whitespace | none (split) |

## Selection (`preparation/models.rs`)

| Constant | Value |
|---|---|
| `MAX_SELECTED_DOCUMENT_VERSIONS` | `12` |
| `MAX_SELECTED_KNOWLEDGE_ITEMS` | `60` |

Going over refuses with `SELECTION_TOO_LARGE`. A repeated source refuses with `SELECTION_DUPLICATE_SOURCE`, and a knowledge item that is not accepted and eligible refuses with `SOURCE_NOT_ELIGIBLE`.

## Context budget

| Constant | Value | Where |
|---|---|---|
| `CHARS_PER_TOKEN` | `4` (tokens = ceil(chars / 4)) | `preparation/context.rs` |
| `RESERVED_OUTPUT_TOKENS` | `2_000` | `preparation/commands.rs` |
| `MIN_CONTEXT_TOKENS` | `1_000` | `preparation/commands.rs` |
| `MAX_CONTEXT_TOKENS` | `12_000` | `preparation/commands.rs` |

`budget_for(summary_context_tokens)`: total = context − `RESERVED_OUTPUT_TOKENS`, clamped to `MIN_CONTEXT_TOKENS..=MAX_CONTEXT_TOKENS`, and per source = total / 2. Sources are packed in selection order, passage by passage, and a source stops at its first passage that does not fit.

## Briefing (`preparation/briefing.rs`, `preparation/questions.rs`)

| Constant | Value |
|---|---|
| `PREP_PROMPT_VERSION` | `prep-briefing-v3` |
| `MAX_QUESTIONS` | `5` (further questions are dropped with `QUESTION_LIMIT`) |

Every statement and question must cite a source block in the prompt and quote it verbatim. Claims that do not verify are dropped and counted (`droppedCount`, `droppedQuestionCount`). Model calls go only through a completer closure, and tests use staged replies.

## Manifest statuses (`SourceStatus`)

| Status | Reason codes |
|---|---|
| `included` | `WITHIN_BUDGET` |
| `truncated` (`kept`, `total` passages) | `SOURCE_BUDGET`, `TOTAL_BUDGET` |
| `omitted` | `SOURCE_BUDGET`, `TOTAL_BUDGET` |
| `deleted` | `DOCUMENT_DELETED` |
| `missing` | `MANAGED_FILE_MISSING` (the imported file is gone from app data) |
| `unavailable` | `VERSION_NOT_FOUND`, `KNOWLEDGE_NOT_ELIGIBLE` |

Claim statuses: `cited`, `stale` (the knowledge item was rejected, corrected or became ineligible, derived when read) and `source_unavailable` (the document or meeting was deleted, and the quote is scrubbed). A briefing reads `stale` when a cited document has a newer version or any claim is stale. Run statuses: `running`, `completed`, `failed`, `cancelled`, `stale` (the selection changed during the run, `SELECTION_CHANGED`).

## Measurement harness

`preparation/evaluation.rs` scores one run against expected citations and reports only integer counts, never passage text: `supportedClaims`, `sourceCorrectness`, `staleCitations`, `supersededCitations` and `directContextFit`. The synthetic corpus `prep-corpus-v1` is in `frontend/src-tauri/tests/fixtures/preparation` (`corpus.json` and `sources/`). Run it with:

```bash
cargo test --manifest-path frontend/src-tauri/Cargo.toml --features coreml preparation::evaluation
```

The prompt-injection corpus is in `frontend/src-tauri/tests/fixtures/preparation/injection` and runs with `preparation::injection`.

## Not built

- No evaluation run on real documents or meetings, and no thresholds or target values. The harness exists, but nothing gates on its numbers.
- No PDF, DOCX or other formats. Adding one needs the user's approval.
- No link between a planned meeting and its recording.
