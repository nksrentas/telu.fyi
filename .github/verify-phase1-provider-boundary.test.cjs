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
