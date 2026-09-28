const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const root = join(__dirname, '..');
const thresholdsPath = join(root, 'frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v1.json');
const evalDir = join(root, '.planning/phases/02-evidence-linked-post-meeting-knowledge/eval');
const statusPath = join(evalDir, 'know-07-status.json');
const representativePath = join(evalDir, 'representative-report.json');
const MAX_CONTENT_FREE_STRING = 80;

function leaves(value) {
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(leaves);
  return [value];
}

function thresholdsDeclared(thresholds) {
  const quality = Object.entries(thresholds)
    .filter(([key]) => key !== 'version' && key !== 'invariants')
    .flatMap(([, value]) => leaves(value));
  return quality.length > 0 && quality.every((leaf) => typeof leaf === 'number' && leaf >= 0 && leaf <= 1);
}

function contentFree(report) {
  return leaves(report).every((leaf) => typeof leaf !== 'string' || leaf.length <= MAX_CONTENT_FREE_STRING);
}

function deriveKnow07Status(thresholds, representativeReport, thresholdsSha256) {
  const reasons = [];
  if (!thresholdsDeclared(thresholds)) reasons.push('quality_thresholds_undeclared');
  if (!representativeReport || !contentFree(representativeReport)) {
    reasons.push('representative_evaluation_pending');
  } else {
    if (representativeReport.thresholdsSha256 !== thresholdsSha256) reasons.push('representative_thresholds_mismatch');
    if (representativeReport.gate !== 'pass') reasons.push('representative_gate_not_pass');
  }
  reasons.sort();
  return { status: reasons.length === 0 ? 'satisfied' : 'open', reasons };
}

const scope = (value) => ({ claimCorrectness: value, semanticSupport: value, evidenceCoverage: value, attribution: value });
const thresholdsWith = (value, abstention = { insufficientEvidence: value }) => ({
  version: 1,
  invariants: { exactSpanSupport: 1, resurrection: 0, deletionResidue: 0 },
  quality: { abstention, decision: scope(value), commitment: scope(value), question: scope(value), fact: scope(value), overall: scope(value) },
});
const report = (overrides = {}) => ({ schemaVersion: 1, thresholdsSha256: 'abc', gate: 'pass', failures: [], ...overrides });

test('any undeclared quality threshold keeps KNOW-07 open', () => {
  const derived = deriveKnow07Status(thresholdsWith(0.9, null), report(), 'abc');
  assert.equal(derived.status, 'open');
  assert.ok(derived.reasons.includes('quality_thresholds_undeclared'));
  assert.ok(deriveKnow07Status(thresholdsWith(1.2), report(), 'abc').reasons.includes('quality_thresholds_undeclared'));
});

test('declared thresholds without a representative report stay pending', () => {
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.9), null, 'abc'), {
    status: 'open',
    reasons: ['representative_evaluation_pending'],
  });
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.9), report({ excerpt: 'x'.repeat(200) }), 'abc').reasons, [
    'representative_evaluation_pending',
  ]);
});

test('only a matching, passing representative report with declared thresholds satisfies KNOW-07', () => {
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.9), report({ thresholdsSha256: 'other' }), 'abc').reasons, [
    'representative_thresholds_mismatch',
  ]);
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.9), report({ gate: 'fail' }), 'abc').reasons, ['representative_gate_not_pass']);
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.9), report({ gate: 'undeclared' }), 'abc').reasons, [
    'representative_gate_not_pass',
  ]);
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.9), report(), 'abc'), { status: 'satisfied', reasons: [] });
});

test('the committed KNOW-07 status equals the status derived from the committed files', () => {
  const thresholdsSource = readFileSync(thresholdsPath);
  const thresholds = JSON.parse(thresholdsSource.toString('utf8'));
  const representative = existsSync(representativePath) ? JSON.parse(readFileSync(representativePath, 'utf8')) : null;
  const sha = createHash('sha256').update(thresholdsSource).digest('hex');
  const committed = JSON.parse(readFileSync(statusPath, 'utf8'));
  assert.deepEqual(committed, deriveKnow07Status(thresholds, representative, sha));
});
