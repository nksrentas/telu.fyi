const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const { REPO_ROOT, STATUS_PATH, deriveKnow07Status, readCommittedInputs } = require('./verify-phase2-know07-status.cjs');

const modulePath = join(__dirname, 'verify-phase2-know07-status.cjs');

function derivedFromCommittedFiles() {
  const { thresholds, representativeReport, thresholdsSha256 } = readCommittedInputs(REPO_ROOT);
  return deriveKnow07Status(thresholds, representativeReport, thresholdsSha256);
}

const scope = (value) => ({
  claimCorrectness: value,
  semanticSupport: value,
  evidenceCoverage: value,
  attribution: value,
  maxDuplication: value,
  minReviewAccepted: value,
});
const thresholdsWith = (value, abstention = { insufficientEvidence: value }) => ({
  version: 2,
  invariants: { exactSpanSupport: 1, resurrection: 0, deletionResidue: 0 },
  quality: { abstention, decision: scope(value), commitment: scope(value), question: scope(value), fact: scope(value), overall: scope(value) },
});
const report = (overrides = {}) => ({ schemaVersion: 1, thresholdsSha256: 'abc', gate: 'pass', failures: [], ...overrides });

test('any undeclared quality threshold keeps KNOW-07 open', () => {
  const derived = deriveKnow07Status(thresholdsWith(0.1, null), report(), 'abc');
  assert.equal(derived.status, 'open');
  assert.ok(derived.reasons.includes('quality_thresholds_undeclared'));
});

test('declared thresholds without a representative report stay pending', () => {
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.1), null, 'abc'), {
    status: 'open',
    reasons: ['representative_evaluation_pending'],
  });
});

test('only a matching, passing representative report with declared thresholds satisfies KNOW-07', () => {
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.1), report({ thresholdsSha256: 'other' }), 'abc').reasons, [
    'representative_thresholds_mismatch',
  ]);
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.1), report({ gate: 'fail' }), 'abc').reasons, ['representative_gate_not_pass']);
  assert.deepEqual(deriveKnow07Status(thresholdsWith(0.1), report(), 'abc'), { status: 'satisfied', reasons: [] });
});

test('the committed KNOW-07 status equals the status derived from the committed files', () => {
  const committed = JSON.parse(readFileSync(join(REPO_ROOT, STATUS_PATH), 'utf8'));
  assert.deepEqual(committed, derivedFromCommittedFiles());
});

test('the module prints the derived status as JSON', () => {
  const result = spawnSync(process.execPath, [modulePath], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), derivedFromCommittedFiles());
});
