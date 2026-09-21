const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const tauriConfigPath = path.join(repoRoot, 'frontend/src-tauri/tauri.conf.json');

function loadMainCapability() {
  const config = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  const capability = config.app.security.capabilities.find(
    ({ identifier }) => identifier === 'main',
  );

  assert.ok(capability, 'the main renderer capability must remain declared');
  return { config, capability };
}

function permissionIdentifiers(permissions) {
  return permissions.map((permission) =>
    typeof permission === 'string' ? permission : permission.identifier,
  );
}

test('renderer filesystem access excludes global and download-wide authority', () => {
  const { capability } = loadMainCapability();
  const identifiers = permissionIdentifiers(capability.permissions);
  const forbidden = [
    'fs:read-all',
    'fs:write-all',
    'fs:allow-download-read',
    'fs:allow-download-write',
    'fs:scope-download',
  ];

  assert.deepEqual(
    identifiers.filter((identifier) => forbidden.includes(identifier)),
    [],
    'renderer capability must not include global or download-wide filesystem grants',
  );
});

test('app-owned and dialog-selected local flows retain explicit least-privilege scopes', () => {
  const { config, capability } = loadMainCapability();
  const identifiers = permissionIdentifiers(capability.permissions);
  const requiredPermissions = [
    'fs:allow-read-file',
    'fs:allow-write-file',
    'dialog:allow-open',
    'dialog:allow-save',
  ];

  for (const identifier of requiredPermissions) {
    assert.ok(
      identifiers.includes(identifier),
      `main capability must retain ${identifier} for app-owned or selected-file flows`,
    );
  }

  const filesystemScope = capability.permissions.find(
    (permission) =>
      typeof permission === 'object' && permission.identifier === 'fs:scope',
  );
  assert.ok(filesystemScope, 'main capability must declare an explicit filesystem scope');
  assert.deepEqual(
    filesystemScope.allow,
    [{ path: '$APPDATA' }, { path: '$APPDATA/**' }],
    'static renderer scope must be limited to app-owned data; dialog selections are runtime-scoped',
  );
  assert.deepEqual(
    config.app.security.assetProtocol.scope,
    ['$APPDATA/**'],
    'asset protocol must remain limited to app-owned recordings and models',
  );
});

test('content security policy contains only the declared renderer destinations', () => {
  const { config } = loadMainCapability();
  const connectSources = config.app.security.csp['connect-src'].split(/\s+/).filter(Boolean);
  const declaredSources = [
    "'self'",
    'http://localhost:11434',
    'http://localhost:5167',
    'http://localhost:8178',
    'https://api.ollama.ai',
  ];

  assert.deepEqual(
    connectSources,
    declaredSources,
    'connect-src must contain only reviewed renderer destinations',
  );
  for (const source of Object.values(config.app.security.csp).flatMap((value) =>
    value.split(/\s+/).filter(Boolean),
  )) {
    assert.ok(!source.includes('*'), `CSP wildcard is forbidden: ${source}`);
  }
});
