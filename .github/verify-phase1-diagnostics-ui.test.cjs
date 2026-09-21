const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function source(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

test('diagnostics is the final settings tab with the approved privacy and empty copy', () => {
  const settings = source('frontend/src/app/settings/page.tsx');
  const panel = source('frontend/src/components/DiagnosticsPanel.tsx');

  assert.match(settings, /value:\s*['"]diagnostics['"],\s*label:\s*['"]Diagnostics['"]/);
  assert.ok(settings.indexOf("label: 'Diagnostics'") > settings.indexOf("label: 'Beta'"));
  assert.match(panel, /Diagnostic data stays on this device unless you export a local copy\./);
  assert.match(panel, /No diagnostic runs yet/);
  assert.match(panel, /Run a baseline scenario, then return here to inspect its local results\./);
});

test('diagnostic rows expose the required local run facts and a detail action', () => {
  const service = source('frontend/src/services/diagnosticsService.ts');
  const panel = source('frontend/src/components/DiagnosticsPanel.tsx');

  for (const field of ['scenario', 'startedAtUtc', 'outcome', 'route', 'durationMs']) {
    assert.match(service, new RegExp(`\\b${field}\\b`));
  }
  assert.match(panel, /View details/);
});

test('diagnostic detail keeps the approved section order and preserves unknowns and outliers', () => {
  const panel = source('frontend/src/components/DiagnosticsPanel.tsx');
  const headings = [
    'Result and limitations',
    'Environment',
    'Stage timing',
    'Queue and terminal outcomes',
    'Resources',
    'Provider route and outbound attempts',
    'Redacted errors',
  ];

  let previous = -1;
  for (const heading of headings) {
    const index = panel.indexOf(heading);
    assert.ok(index > previous, `${heading} must follow the preceding diagnostic section`);
    previous = index;
  }
  assert.match(panel, /Unknown/);
  assert.match(panel, /outliers/);
});

test('technical evidence is selectable and contained without a dashboard grid', () => {
  const panel = source('frontend/src/components/DiagnosticsPanel.tsx');

  assert.match(panel, /select-all/);
  assert.match(panel, /overflow-x-auto/);
  assert.doesNotMatch(panel, /grid-cols-[234]/);
});

test('export review names categories destination and redaction with sensitive choices off', () => {
  const dialog = source('frontend/src/components/DiagnosticExportDialog.tsx');

  assert.match(dialog, /Review diagnostic export/);
  assert.match(dialog, /Transcript text and audio are excluded unless you include them below\./);
  assert.match(dialog, /Included categories/);
  assert.match(dialog, /Destination folder/);
  assert.match(dialog, /Redaction policy/);
  assert.match(dialog, /Transcript text/);
  assert.match(dialog, /Audio/);
  assert.match(dialog, /Export local copy/);
  assert.match(dialog, /useState\(false\)/);
});

test('closing and reopening export review resets transcript and audio independently off', () => {
  const dialog = source('frontend/src/components/DiagnosticExportDialog.tsx');

  assert.match(dialog, /setIncludeTranscript\(false\)/);
  assert.match(dialog, /setIncludeAudio\(false\)/);
  assert.match(dialog, /checked=\{includeTranscript\}/);
  assert.match(dialog, /checked=\{includeAudio\}/);
  assert.doesNotMatch(dialog, /defaultChecked/);
});

test('diagnostic export is a sanitized local copy with no upload or share path', () => {
  const service = source('frontend/src/services/diagnosticsService.ts');
  const dialog = source('frontend/src/components/DiagnosticExportDialog.tsx');
  const rust = source('frontend/src-tauri/src/observability/run_bundle.rs');
  const combined = `${service}\n${dialog}`;

  assert.match(service, /select_diagnostic_export_folder/);
  assert.match(service, /export_diagnostic_copy/);
  assert.match(rust, /local_only/);
  assert.match(rust, /transcript_requested/);
  assert.match(rust, /audio_requested/);
  assert.match(rust, /write_atomic_file/);
  assert.doesNotMatch(combined, /\bfetch\s*\(|axios|XMLHttpRequest|navigator\.share|upload/i);
});

test('export success and filesystem recovery use the approved noun-bearing actions', () => {
  const dialog = source('frontend/src/components/DiagnosticExportDialog.tsx');

  assert.match(dialog, /Diagnostic copy exported locally/);
  assert.match(dialog, /Show in folder/);
  assert.match(dialog, /Retry export/);
  assert.match(dialog, /Choose another folder/);
});
