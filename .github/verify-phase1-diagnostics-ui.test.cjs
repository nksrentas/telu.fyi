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
