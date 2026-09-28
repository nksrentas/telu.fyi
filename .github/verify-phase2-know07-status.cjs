const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const REPO_ROOT = join(__dirname, '..');
const THRESHOLDS_PATH = 'frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json';
const EVAL_DIR = '.planning/phases/02-evidence-linked-post-meeting-knowledge/eval';
const STATUS_PATH = `${EVAL_DIR}/know-07-status.json`;
const REPRESENTATIVE_REPORT_PATH = `${EVAL_DIR}/representative-report.json`;
const MAX_CONTENT_FREE_STRING = 80;

function leaves(value) {
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(leaves);
  return [value];
}

function thresholdsValid(thresholds) {
  return thresholds !== null && typeof thresholds === 'object';
}

function thresholdsDeclared(thresholds) {
  const quality = Object.entries(thresholds)
    .filter(([key]) => key !== 'version' && key !== 'invariants')
    .flatMap(([, value]) => leaves(value));
  return quality.length > 0 && quality.every((leaf) => typeof leaf === 'number' && leaf >= 0 && leaf <= 1);
}

function contentFree(value) {
  return leaves(value).every((leaf) => typeof leaf !== 'string' || leaf.length <= MAX_CONTENT_FREE_STRING);
}

function deriveKnow07Status(thresholds, representativeReport, thresholdsSha256) {
  const reasons = [];
  if (!thresholdsValid(thresholds)) reasons.push('thresholds_invalid');
  else if (!thresholdsDeclared(thresholds)) reasons.push('quality_thresholds_undeclared');
  if (!representativeReport || !contentFree(representativeReport)) {
    reasons.push('representative_evaluation_pending');
  } else {
    if (representativeReport.thresholdsSha256 !== thresholdsSha256) reasons.push('representative_thresholds_mismatch');
    if (representativeReport.gate !== 'pass') reasons.push('representative_gate_not_pass');
  }
  const sorted = [...reasons].sort();
  return { status: sorted.length === 0 ? 'satisfied' : 'open', reasons: sorted };
}

function readCommittedInputs(root) {
  const thresholdsSource = readFileSync(join(root, THRESHOLDS_PATH));
  const reportPath = join(root, REPRESENTATIVE_REPORT_PATH);
  return {
    thresholds: JSON.parse(thresholdsSource.toString('utf8')),
    representativeReport: existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null,
    thresholdsSha256: createHash('sha256').update(thresholdsSource).digest('hex'),
  };
}

function deriveCommittedStatus(root) {
  const { thresholds, representativeReport, thresholdsSha256 } = readCommittedInputs(root);
  return deriveKnow07Status(thresholds, representativeReport, thresholdsSha256);
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(deriveCommittedStatus(REPO_ROOT), null, 2)}\n`);
}

module.exports = {
  REPO_ROOT,
  STATUS_PATH,
  deriveKnow07Status,
  thresholdsValid,
  thresholdsDeclared,
  contentFree,
  readCommittedInputs,
};
