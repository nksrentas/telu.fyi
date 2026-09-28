const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const {
  REPO_ROOT,
  STATUS_PATH,
  deriveKnow07Status,
  contentFree,
  readCommittedInputs,
} = require('./verify-phase2-know07-status.cjs');

const modulePath = join(__dirname, 'verify-phase2-know07-status.cjs');
const evalDir = join(REPO_ROOT, '.planning/phases/02-evidence-linked-post-meeting-knowledge/eval');
const thresholdsV1Path = join(REPO_ROOT, 'frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v1.json');
const SHA = 'abc';

function derivedFromCommittedFiles() {
  const { thresholds, representativeReport, thresholdsSha256 } = readCommittedInputs(REPO_ROOT);
  return deriveKnow07Status(thresholds, representativeReport, thresholdsSha256);
}

function setIn(value, [key, ...rest], leaf) {
  if (key === undefined) return leaf;
  return { ...value, [key]: setIn(value?.[key], rest, leaf) };
}

function removeIn(value, [key, ...rest]) {
  if (rest.length === 0) {
    const { [key]: _removed, ...kept } = value;
    return kept;
  }
  return { ...value, [key]: removeIn(value[key], rest) };
}

const scope = (minimum, maxDuplication) => ({
  claimCorrectness: minimum,
  semanticSupport: minimum,
  evidenceCoverage: minimum,
  attribution: minimum,
  maxDuplication,
  minReviewAccepted: minimum,
});

function declaredThresholds(minimum = 0.9, maxDuplication = 0.1) {
  return {
    version: 2,
    invariants: { exactSpanSupport: 1, resurrection: 0, deletionResidue: 0 },
    quality: {
      abstention: { insufficientEvidence: minimum },
      decision: scope(minimum, maxDuplication),
      commitment: scope(minimum, maxDuplication),
      question: scope(minimum, maxDuplication),
      fact: scope(minimum, maxDuplication),
      overall: scope(minimum, maxDuplication),
    },
  };
}

const cleanReport = () => ({
  schemaVersion: 1,
  thresholdsSha256: SHA,
  gate: 'pass',
  failures: [],
  invariants: {
    exactSpanSupport: { value: 1, status: 'measured', numerator: 4, denominator: 4 },
    resurrection: 0,
    deletionResidue: 0,
  },
});

const reasonsFor = (thresholds, report = cleanReport()) => deriveKnow07Status(thresholds, report, SHA).reasons;

test('the two CR-80 reproduction cases derive open', () => {
  const first = deriveKnow07Status(
    { version: 1, invariants: { exactSpanSupport: 0 }, quality: { overall: { claimCorrectness: 0 } } },
    { gate: 'pass', thresholdsSha256: 'x', failures: ['claimCorrectness'] },
    'x',
  );
  const second = deriveKnow07Status(
    { version: 1, quality: { decision: {}, overall: { claimCorrectness: 0.9 } } },
    { gate: 'pass', thresholdsSha256: 'x' },
    'x',
  );
  assert.equal(first.status, 'open');
  assert.ok(first.reasons.includes('thresholds_invalid'));
  assert.ok(first.reasons.includes('representative_gate_not_pass'));
  assert.equal(second.status, 'open');
  assert.ok(second.reasons.includes('thresholds_invalid'));
  assert.ok(second.reasons.includes('representative_schema_unknown'));
});

test('a fully declared v2 file with a matching clean passing report is satisfied', () => {
  assert.deepEqual(deriveKnow07Status(declaredThresholds(), cleanReport(), SHA), { status: 'satisfied', reasons: [] });
});

test('null leaves are undeclared', () => {
  const nullLeaves = [
    ['quality', 'decision', 'claimCorrectness'],
    ['quality', 'fact', 'minReviewAccepted'],
    ['quality', 'overall', 'maxDuplication'],
    ['quality', 'abstention', 'insufficientEvidence'],
  ];
  for (const path of nullLeaves) {
    assert.deepEqual(reasonsFor(setIn(declaredThresholds(), path, null)), ['quality_thresholds_undeclared'], path.join('.'));
  }
});

test('malformed thresholds are invalid', () => {
  const declared = declaredThresholds();
  const malformed = {
    'empty scope object': setIn(declared, ['quality', 'decision'], {}),
    'missing scope': removeIn(declared, ['quality', 'fact']),
    'missing metric key': removeIn(declared, ['quality', 'overall', 'attribution']),
    'missing abstention': removeIn(declared, ['quality', 'abstention']),
    'v1 abstention shape': setIn(declared, ['quality', 'abstention'], null),
    'extra top-level key': setIn(declared, ['extra'], 0.5),
    'unknown scope': setIn(declared, ['quality', 'summary'], scope(0.9, 0.1)),
    'unknown scope key': setIn(declared, ['quality', 'decision', 'novelty'], 0.5),
    'extra invariant': setIn(declared, ['invariants', 'rawGrounding'], 1),
    'version 1': setIn(declared, ['version'], 1),
    'exactSpanSupport 0': setIn(declared, ['invariants', 'exactSpanSupport'], 0),
    'resurrection 1': setIn(declared, ['invariants', 'resurrection'], 1),
    'deletionResidue 1': setIn(declared, ['invariants', 'deletionResidue'], 1),
    'minimum of 0': setIn(declared, ['quality', 'question', 'claimCorrectness'], 0),
    'minimum of 1.2': setIn(declared, ['quality', 'commitment', 'semanticSupport'], 1.2),
    'maxDuplication of 1': setIn(declared, ['quality', 'decision', 'maxDuplication'], 1),
    'maxDuplication of -0.1': setIn(declared, ['quality', 'overall', 'maxDuplication'], -0.1),
    'string leaf': setIn(declared, ['quality', 'fact', 'evidenceCoverage'], '0.9'),
    'not an object': null,
  };
  for (const [name, thresholds] of Object.entries(malformed)) {
    assert.deepEqual(reasonsFor(thresholds), ['thresholds_invalid'], name);
  }
});

test('the historical thresholds-v1 file is rejected as invalid', () => {
  const v1 = JSON.parse(readFileSync(thresholdsV1Path, 'utf8'));
  assert.deepEqual(reasonsFor(v1), ['thresholds_invalid']);
});

test('boundary declarations', () => {
  assert.deepEqual(deriveKnow07Status(declaredThresholds(1, 0), cleanReport(), SHA), { status: 'satisfied', reasons: [] });
});

test('a pass gate is not enough', () => {
  const declared = declaredThresholds();
  const expectations = [
    [setIn(cleanReport(), ['failures'], ['decision.claimCorrectness']), 'representative_gate_not_pass'],
    [removeIn(cleanReport(), ['failures']), 'representative_gate_not_pass'],
    [setIn(cleanReport(), ['failures'], 'none'), 'representative_gate_not_pass'],
    [setIn(cleanReport(), ['gate'], 'fail'), 'representative_gate_not_pass'],
    [setIn(cleanReport(), ['gate'], 'undeclared'), 'representative_gate_not_pass'],
    [setIn(cleanReport(), ['schemaVersion'], 2), 'representative_schema_unknown'],
    [removeIn(cleanReport(), ['schemaVersion']), 'representative_schema_unknown'],
    [setIn(cleanReport(), ['thresholdsSha256'], 'other'), 'representative_thresholds_mismatch'],
    [setIn(cleanReport(), ['invariants', 'resurrection'], 1), 'representative_invariants_not_met'],
    [setIn(cleanReport(), ['invariants', 'deletionResidue'], null), 'representative_invariants_not_met'],
    [setIn(cleanReport(), ['invariants', 'exactSpanSupport', 'value'], 0.98), 'representative_invariants_not_met'],
    [setIn(cleanReport(), ['invariants', 'exactSpanSupport', 'status'], 'not_measurable'), 'representative_invariants_not_met'],
    [removeIn(cleanReport(), ['invariants']), 'representative_invariants_not_met'],
  ];
  for (const [report, reason] of expectations) {
    assert.deepEqual(reasonsFor(declared, report), [reason], JSON.stringify(report));
  }
});

test('content in a report is reported as content, not as pending', () => {
  const declared = declaredThresholds();
  const contentBearing = [
    setIn(cleanReport(), ['excerpt'], 'we will ship on friday'),
    setIn(cleanReport(), ['excerpt'], 'x'.repeat(81)),
    setIn(cleanReport(), ['we will ship on friday'], 1),
    setIn(cleanReport(), ['failures'], ['we will ship on friday']),
  ];
  for (const report of contentBearing) {
    assert.deepEqual(reasonsFor(declared, report), ['representative_report_contains_content'], JSON.stringify(report));
  }
  assert.equal(contentFree(setIn(cleanReport(), ['token'], 'x'.repeat(80))), true);
  const synthetic = JSON.parse(readFileSync(join(evalDir, 'synthetic-report.json'), 'utf8'));
  assert.equal(contentFree(synthetic), true);
});

test('no representative report stays pending', () => {
  assert.deepEqual(deriveKnow07Status(declaredThresholds(), null, SHA), {
    status: 'open',
    reasons: ['representative_evaluation_pending'],
  });
});

test('reasons are emitted sorted so the same inputs produce the same status', () => {
  const report = { ...cleanReport(), schemaVersion: 2, gate: 'fail', thresholdsSha256: 'other' };
  const derived = deriveKnow07Status(setIn(declaredThresholds(), ['version'], 3), report, SHA);
  assert.deepEqual(derived.reasons, [
    'representative_gate_not_pass',
    'representative_schema_unknown',
    'representative_thresholds_mismatch',
    'thresholds_invalid',
  ]);
  assert.deepEqual(deriveKnow07Status(setIn(declaredThresholds(), ['version'], 3), report, SHA), derived);
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
