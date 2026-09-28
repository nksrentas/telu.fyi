const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const REPO_ROOT = join(__dirname, '..');
const THRESHOLDS_PATH = 'frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json';
const EVAL_DIR = '.planning/phases/02-evidence-linked-post-meeting-knowledge/eval';
const STATUS_PATH = `${EVAL_DIR}/know-07-status.json`;
const REPRESENTATIVE_REPORT_PATH = `${EVAL_DIR}/representative-report.json`;
const REAL_MEETING_PILOT_REPORT_PATH = `${EVAL_DIR}/real-meeting-pilot-report.json`;

const THRESHOLDS_VERSION = 2;
const REPORT_SCHEMA_VERSION = 1;
const REPRESENTATIVE_KIND = 'representative';
const SCOPES = ['decision', 'commitment', 'question', 'fact', 'overall'];
const MIN_METRICS = ['claimCorrectness', 'semanticSupport', 'evidenceCoverage', 'attribution', 'minReviewAccepted'];
const MAX_METRICS = ['maxDuplication'];
const ABSTENTION_METRICS = ['insufficientEvidence'];
const INVARIANTS = { exactSpanSupport: 1, resurrection: 0, deletionResidue: 0 };
const CONTENT_FREE_TOKEN = /^[A-Za-z0-9_.:+#-]{0,80}$/;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const minimumInRange = (leaf) => leaf === null || (typeof leaf === 'number' && leaf > 0 && leaf <= 1);
const maximumInRange = (leaf) => leaf === null || (typeof leaf === 'number' && leaf >= 0 && leaf < 1);

function hasExactKeys(value, keys) {
  return isPlainObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function scopeValid(scope) {
  return (
    hasExactKeys(scope, [...MIN_METRICS, ...MAX_METRICS]) &&
    MIN_METRICS.every((metric) => minimumInRange(scope[metric])) &&
    MAX_METRICS.every((metric) => maximumInRange(scope[metric]))
  );
}

function qualityValid(quality) {
  return (
    hasExactKeys(quality, ['abstention', ...SCOPES]) &&
    hasExactKeys(quality.abstention, ABSTENTION_METRICS) &&
    ABSTENTION_METRICS.every((metric) => minimumInRange(quality.abstention[metric])) &&
    SCOPES.every((scope) => scopeValid(quality[scope]))
  );
}

function invariantsExact(invariants) {
  return (
    hasExactKeys(invariants, Object.keys(INVARIANTS)) &&
    Object.entries(INVARIANTS).every(([name, required]) => invariants[name] === required)
  );
}

function thresholdsValid(thresholds) {
  return (
    hasExactKeys(thresholds, ['version', 'invariants', 'quality']) &&
    thresholds.version === THRESHOLDS_VERSION &&
    invariantsExact(thresholds.invariants) &&
    qualityValid(thresholds.quality)
  );
}

function thresholdsDeclared(thresholds) {
  if (!thresholdsValid(thresholds)) return false;
  const { quality } = thresholds;
  const leaves = [quality.abstention, ...SCOPES.map((scope) => quality[scope])].flatMap(Object.values);
  return leaves.every((leaf) => leaf !== null);
}

function contentFree(value) {
  if (typeof value === 'string') return CONTENT_FREE_TOKEN.test(value);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).every(([key, child]) => CONTENT_FREE_TOKEN.test(key) && contentFree(child));
  }
  return true;
}

function gatePassed(report) {
  return report.gate === 'pass' && Array.isArray(report.failures) && report.failures.length === 0;
}

function invariantsMet(invariants) {
  const exactSpan = invariants?.exactSpanSupport;
  return (
    isPlainObject(invariants) &&
    isPlainObject(exactSpan) &&
    exactSpan.status === 'measured' &&
    exactSpan.value === 1 &&
    invariants.resurrection === 0 &&
    invariants.deletionResidue === 0
  );
}

function heldOutFromPilot(report, pilotReport) {
  const pilotIds = pilotReport === null ? [] : pilotReport?.fixtures;
  if (!Array.isArray(report.fixtures) || !Array.isArray(pilotIds)) return false;
  const pilot = new Set(pilotIds);
  return report.fixtures.every((id) => !pilot.has(id));
}

function thresholdsReasons(thresholds) {
  if (!thresholdsValid(thresholds)) return ['thresholds_invalid'];
  if (!thresholdsDeclared(thresholds)) return ['quality_thresholds_undeclared'];
  return [];
}

function reportReasons(report, thresholdsSha256, pilotReport) {
  if (report === null || report === undefined) return ['representative_evaluation_pending'];
  if (!contentFree(report)) return ['representative_report_contains_content'];
  const checks = [
    [report.schemaVersion === REPORT_SCHEMA_VERSION, 'representative_schema_unknown'],
    [typeof report.thresholdsSha256 === 'string' && report.thresholdsSha256 === thresholdsSha256, 'representative_thresholds_mismatch'],
    [gatePassed(report), 'representative_gate_not_pass'],
    [invariantsMet(report.invariants), 'representative_invariants_not_met'],
    [report.evaluationKind === REPRESENTATIVE_KIND, 'representative_kind_mismatch'],
    [heldOutFromPilot(report, pilotReport), 'representative_not_held_out'],
  ];
  return checks.filter(([met]) => !met).map(([, reason]) => reason);
}

function deriveKnow07Status(thresholds, representativeReport, thresholdsSha256, pilotReport = null) {
  const reasons = [
    ...thresholdsReasons(thresholds),
    ...reportReasons(representativeReport, thresholdsSha256, pilotReport),
  ].sort();
  return { status: reasons.length === 0 ? 'satisfied' : 'open', reasons };
}

function readJsonIfPresent(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function readCommittedInputs(root) {
  const thresholdsSource = readFileSync(join(root, THRESHOLDS_PATH));
  return {
    thresholds: JSON.parse(thresholdsSource.toString('utf8')),
    representativeReport: readJsonIfPresent(join(root, REPRESENTATIVE_REPORT_PATH)),
    thresholdsSha256: createHash('sha256').update(thresholdsSource).digest('hex'),
    pilotReport: readJsonIfPresent(join(root, REAL_MEETING_PILOT_REPORT_PATH)),
  };
}

function deriveCommittedStatus(root) {
  const { thresholds, representativeReport, thresholdsSha256, pilotReport } = readCommittedInputs(root);
  return deriveKnow07Status(thresholds, representativeReport, thresholdsSha256, pilotReport);
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(deriveCommittedStatus(REPO_ROOT), null, 2)}\n`);
}

module.exports = {
  REPO_ROOT,
  STATUS_PATH,
  REAL_MEETING_PILOT_REPORT_PATH,
  THRESHOLDS_VERSION,
  REPORT_SCHEMA_VERSION,
  REPRESENTATIVE_KIND,
  SCOPES,
  MIN_METRICS,
  MAX_METRICS,
  CONTENT_FREE_TOKEN,
  deriveKnow07Status,
  thresholdsValid,
  thresholdsDeclared,
  contentFree,
  readCommittedInputs,
};
