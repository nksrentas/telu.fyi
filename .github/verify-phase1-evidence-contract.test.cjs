const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const root = join(__dirname, '..');
const transcriptService = readFileSync(
  join(root, 'frontend/src/services/transcriptService.ts'),
  'utf8',
);
const transcriptContext = readFileSync(
  join(root, 'frontend/src/contexts/TranscriptContext.tsx'),
  'utf8',
);
const indexedDBService = readFileSync(
  join(root, 'frontend/src/services/indexedDBService.ts'),
  'utf8',
);

test('provisional transcript stays structurally noncanonical and out of recovery evidence', () => {
  assert.match(transcriptService, /interface ProvisionalTranscriptUpdate/);
  assert.match(transcriptService, /evidence_id:\s*null/);
  assert.match(transcriptService, /is_canonical:\s*false/);
  assert.match(transcriptService, /isCanonicalFinalTranscript/);
  assert.match(
    transcriptContext,
    /isCanonicalFinalTranscript\(update\)[\s\S]*saveFinalTranscript/,
  );
  assert.doesNotMatch(
    transcriptContext,
    /indexedDBService\.saveTranscript\(currentMeetingId,\s*update\)/,
  );
});

test('final evidence uses its Rust identity as an idempotent IndexedDB key', () => {
  assert.match(transcriptService, /interface FinalTranscriptUpdate/);
  assert.match(transcriptService, /evidence_id:\s*string/);
  assert.match(indexedDBService, /DB_VERSION\s*=\s*3/);
  assert.match(
    indexedDBService,
    /createObjectStore\('transcriptEvidence',\s*\{\s*keyPath:\s*'evidenceId'\s*\}\)/,
  );
  assert.match(
    indexedDBService,
    /createIndex\('meetingSourceSegment',[\s\S]*unique:\s*true/,
  );
  assert.match(indexedDBService, /transcriptEvidenceStore\.put\(storedTranscript\)/);
  assert.match(transcriptContext, /id:\s*update\.evidence_id/);
});

test('reload projection retains final evidence source, bounds, and completeness', () => {
  for (const field of [
    'evidenceId',
    'meetingId',
    'source',
    'sourceSegmentKey',
    'audio_start_time',
    'audio_end_time',
    'captureCompleteness',
    'isCanonical',
  ]) {
    assert.match(indexedDBService, new RegExp(`\\b${field}\\b`));
  }
  assert.match(indexedDBService, /getFinalTranscripts\(meetingId:\s*string\)/);
  assert.match(transcriptContext, /evidence_id:\s*segment\.evidence_id/);
  assert.match(transcriptContext, /capture_completeness:\s*segment\.capture_completeness/);
  assert.doesNotMatch(transcriptContext, /crypto\.randomUUID|Uuid|uuidv4/);
});
