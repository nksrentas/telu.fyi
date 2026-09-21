const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const root = join(__dirname, '..');
const readSource = (relativePath) => {
  const path = join(root, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

const service = readSource('frontend/src/services/providerRouteService.ts');
const boundary = readSource('frontend/src/components/ProviderBoundary.tsx');
const transcriptSettings = readSource('frontend/src/components/TranscriptSettings.tsx');
const summarySettings = readSource('frontend/src/components/SummaryModelSettings.tsx');
const recordingControls = readSource('frontend/src/components/RecordingControls.tsx');
const meetingDetails = readSource('frontend/src/app/meeting-details/page-content.tsx');
const recordingStart = readSource('frontend/src/hooks/useRecordingStart.ts');

test('settings refresh and render the Rust-owned route contract after selection', () => {
  assert.match(service, /invoke<EffectiveRoute>\(\s*['"]get_current_provider_route['"]/);
  assert.match(service, /capability:\s*ProviderCapability/);
  assert.match(service, /locationClass:\s*LocationClass\s*\|\s*null/);
  assert.match(service, /sanitizedOrigin:\s*string\s*\|\s*null/);
  assert.match(transcriptSettings, /<ProviderBoundary[\s\S]*capability="transcription"/);
  assert.match(summarySettings, /<ProviderBoundary[\s\S]*capability="summary"/);
});

test('boundary renders neutral Local LAN Remote icon and text plus explicit transport state', () => {
  assert.match(boundary, /Laptop/);
  assert.match(boundary, /Network/);
  assert.match(boundary, /Cloud/);
  assert.match(boundary, /route\.locationClass/);
  assert.match(boundary, /Not encrypted/);
  assert.match(boundary, /route\.encrypted/);
});

test('long sanitized origins expand to a selectable full value without tooltip-only disclosure', () => {
  assert.match(boundary, /middleTruncate/);
  assert.match(boundary, /aria-expanded=\{isExpanded\}/);
  assert.match(boundary, /setIsExpanded/);
  assert.match(boundary, /select-text/);
  assert.match(boundary, /route\.sanitizedOrigin/);
  assert.doesNotMatch(boundary, /TooltipContent[\s\S]*route\.sanitizedOrigin/);
});

test('loading or changed routes remain visible and unavailable before data-bearing action enablement', () => {
  assert.match(boundary, /validationState/);
  assert.match(boundary, /materially_changed/);
  assert.match(boundary, /onRouteStateChange/);
  assert.match(boundary, /status:\s*['"]loading['"]/);
  assert.match(transcriptSettings, /refreshKey=\{/);
  assert.match(summarySettings, /refreshKey=\{/);
});

test('recording and summary actions expose then freshly validate the Rust route', () => {
  assert.match(recordingControls, /<ProviderBoundary[\s\S]*capability="transcription"/);
  assert.match(recordingControls, /validateProviderRoute\(transcriptionRouteState\.route\)[\s\S]*await onRecordingStart\(\)/);
  assert.ok(
    recordingControls.indexOf('<ProviderBoundary') < recordingControls.indexOf('Start recording'),
    'the transcription route disclosure must render before the start action',
  );

  assert.match(meetingDetails, /<ProviderBoundary[\s\S]*capability="summary"/);
  assert.match(meetingDetails, /validateProviderRoute\(summaryRouteState\.route\)[\s\S]*summaryGeneration\.handleGenerateSummary/);
  assert.ok(
    meetingDetails.indexOf('<ProviderBoundary') < meetingDetails.indexOf('<SummaryPanel'),
    'the summary route disclosure must render before the summary action',
  );
});

test('route failures use the exact no-fallback recovery copy and ordered actions', () => {
  assert.match(boundary, /\{Capability\} provider unavailable|provider unavailable/);
  assert.match(boundary, /Telu couldn’t reach \{destination\}\. \{failure\.providerId\} is still selected, and no data was sent to another provider\./);

  const retryIndex = boundary.indexOf('Retry transcription');
  const changeIndex = boundary.indexOf('Change transcription provider');
  const cancelIndex = boundary.indexOf('Cancel transcription');
  assert.ok(retryIndex >= 0 && retryIndex < changeIndex && changeIndex < cancelIndex);
  assert.match(boundary, /Retrying transcription…/);
  assert.match(boundary, /Retrying summary…/);
  assert.match(boundary, /Show technical details/);
});

test('retry state disables only the affected action CTA and never changes provider selection', () => {
  assert.match(recordingControls, /isRetryingRoute/);
  assert.match(recordingControls, /disabled=\{[\s\S]*isRetryingRoute/);
  assert.match(meetingDetails, /isSummaryRouteRetrying/);
  assert.match(meetingDetails, /isModelConfigLoading=\{[\s\S]*isSummaryRouteRetrying/);
  assert.doesNotMatch(boundary, /setModelConfig|api_save_model_config/);
});

test('active transcription failures disclose the Rust-confirmed capture outcome', () => {
  assert.match(boundary, /Recording continues locally/);
  assert.match(boundary, /Recording stopped/);
  assert.match(recordingControls, /recordingState\.isRecording[\s\S]*continues_locally[\s\S]*stopped/);
});

test('frontend action paths neither infer route locality nor silently fall back providers', () => {
  assert.doesNotMatch(boundary, /hostname|127\.0\.0\.1|privateIp|isPrivate/);
  assert.doesNotMatch(recordingStart, /config\?\.provider\s*\|\|\s*['"]parakeet['"]/);
  assert.doesNotMatch(recordingStart, /catch[\s\S]{0,180}return\s+['"]parakeet['"]/);
});
