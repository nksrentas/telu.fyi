const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  rustFindings,
  frontendFindings,
  importFindings,
  routeConfirmationFindings,
  scanRepository,
} = require('./verify-phase3-preparation-privacy.cjs');

test('the committed preparation, documents and planning code passes every privacy rule', () => {
  assert.deepEqual(scanRepository(), []);
});

test('an info, warn or error log that interpolates content is flagged', () => {
  const findings = rustFindings(
    [
      'log::info!("imported {}", document.title);',
      'warn!(path = %source.display(), "import failed");',
      'log::error!("read {path:?}: {error}");',
      'tracing::warn!(title = %title, "x");',
    ].join('\n'),
    'documents/import.rs',
  );
  assert.deepEqual(
    findings.map(({ expression }) => expression),
    ['document.title', 'source.display()', 'path', 'title'],
  );
});

test('content-free logs and logs below info pass', () => {
  const source = [
    'log::warn!("documents sweep failed: {error}");',
    'log::info!("documents sweep removed {removed} managed files");',
    'warn!(run_id = %run.id, error = %error, "could not finish");',
    'log::error!("documents command failed: {error:#}");',
    'warn!("preparation briefing model call failed");',
    'debug!("title {}", document.title);',
    'log::trace!(text = %text, "passage");',
  ].join('\n');
  assert.deepEqual(rustFindings(source, 'preparation/commands.rs'), []);
});

test('analytics from the new Rust modules is flagged', () => {
  assert.equal(rustFindings('crate::analytics::track_event("source", &title);', 'documents/commands.rs').length, 1);
});

test('printing to stdout or stderr is flagged in the new Rust modules', () => {
  const findings = rustFindings('println!("{}", title);\neprintln!("x");\ndbg!(text);', 'planning/repository.rs');
  assert.equal(findings.length, 3);
});

test('an analytics call with a title in a preparation component is flagged', () => {
  const source = [
    "import Analytics from '@/lib/analytics'",
    'export function A({ title }: { title: string }) {',
    "  Analytics.track('source_added', { title })",
    '}',
  ].join('\n');
  const rules = frontendFindings(source, 'components/preparation/sources-panel.tsx').map(({ rule }) => rule);
  assert.ok(rules.includes('analytics'));
});

test('a console call that logs a title or text is flagged, one that logs the error is not', () => {
  const flagged = frontendFindings('console.error("Failed to add:", document.title)', 'x.tsx');
  assert.deepEqual(flagged.map(({ expression }) => expression), ['document.title']);
  const passed = frontendFindings(
    'console.error("Failed to load:", error)\nconsole.error("Failed:", result.code)\nconsole.error("Failed")',
    'x.tsx',
  );
  assert.deepEqual(passed, []);
});

test('the renderer filesystem and dialog plugins are flagged in preparation code', () => {
  const findings = frontendFindings(
    "import { readTextFile } from '@tauri-apps/plugin-fs'\nimport { open } from \"@tauri-apps/plugin-dialog\"",
    'lib/document-service.ts',
  );
  assert.deepEqual(findings.map(({ rule }) => rule), ['renderer-fs', 'renderer-fs']);
});

const REPLACE = [
  'pub enum ReplaceSource {',
  '    Paste { text: String },',
  '    Import,',
  '}',
  '        ReplaceSource::Import => {',
  '            let Some(path) = pick(app).await? else {',
].join('\n');
const IMPORT_COMMAND = "pub async fn documents_import<R: Runtime>(\n    app: AppHandle<R>,\n    state: tauri::State<'_, AppState>,\n) -> Result<(), String> {";
const SERVICE = "export function importDocument() { return call('documents_import') }";
const PICKER = 'app.dialog().file()';
const importRules = (overrides) =>
  importFindings({ rust: `${IMPORT_COMMAND}\n${REPLACE}`, service: SERVICE, picker: PICKER, ...overrides }).map(({ rule }) => rule);

test('import picks the file in Rust and takes no path from the renderer', () => {
  assert.deepEqual(importRules({}), []);
  const withPath = 'pub async fn documents_import<R: Runtime>(\n    app: AppHandle<R>,\n    path: String,\n) -> Result<(), String> {';
  assert.deepEqual(importRules({ rust: `${withPath}\n${REPLACE}` }), ['import-path-param']);
  assert.deepEqual(importRules({ service: "call('documents_import', { path })" }), ['import-args']);
  assert.deepEqual(importRules({ picker: 'read_to_string(path)' }), ['import-picker']);
});

test('a replace source that carries a path, or a replace import that does not pick in Rust, is flagged', () => {
  const pathVariant = REPLACE.replace('    Import,', '    Import { path: String },');
  assert.deepEqual(importRules({ rust: `${IMPORT_COMMAND}\n${pathVariant}` }), ['replace-import']);
  const noPick = REPLACE.replace('pick(app)', 'Some(PathBuf::from(given))');
  assert.deepEqual(importRules({ rust: `${IMPORT_COMMAND}\n${noPick}` }), ['replace-import']);
});

test('analytics reached through the context or a command is flagged', () => {
  const source = "import { AnalyticsContext } from '@/components/AnalyticsProvider'\ninvoke('track_analytics_event', { title })";
  assert.deepEqual(frontendFindings(source, 'x.tsx').map(({ rule, line }) => [rule, line]), [
    ['analytics', 1],
    ['analytics', 1],
    ['analytics', 2],
  ]);
});

test('generating a brief without re-validating the route or showing the run notice is flagged', () => {
  const unconfirmed = {
    block: 'const prepare = async () => { await generateBriefing(plannedMeetingId, routeState.route) }',
    service: "invoke<PreparationRun>('prep_generate', { plannedMeetingId, expectedRoute })",
    commands: 'pub async fn begin(\n) {\n    validate_route_contract(expected_route, fresh_route).map_err(|error| error.code)?;',
  };
  const rules = routeConfirmationFindings(unconfirmed).map(({ rule }) => rule);
  assert.ok(rules.includes('route-revalidation'));
  assert.ok(rules.includes('run-notice'));
});

test('a generate command that does not check the route first is flagged', () => {
  const findings = routeConfirmationFindings({
    block: [
      '<RunNotice routeState={routeState} blocked={routeBlocked} action={a} />',
      'disabled={routeState.status !== "validated" || routeBlocked || starting}',
      'const fresh = await validateProviderRoute(routeState.route)',
      'if (!isRouteAvailable(fresh)) return',
      'await generateBriefing(plannedMeetingId, fresh)',
    ].join('\n'),
    service: "invoke<PreparationRun>('prep_generate', { plannedMeetingId })",
    commands: 'pub async fn begin(\n) {\n    let x = selection::list(pool, id).await?;\n    validate_route_contract(expected_route, fresh_route)?;',
  });
  assert.deepEqual(findings.map(({ rule }) => rule).sort(), ['route-contract', 'route-in-command']);
});
