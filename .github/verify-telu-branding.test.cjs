const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function sourceFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(rs|ts|tsx)$/.test(entry.name) ? [child] : [];
  });
}

test('package and desktop metadata use the Telu identity', () => {
  const packageJson = JSON.parse(read('frontend/package.json'));
  const tauriConfig = JSON.parse(read('frontend/src-tauri/tauri.conf.json'));
  const cargoManifest = read('frontend/src-tauri/Cargo.toml');

  assert.equal(packageJson.name, 'telu');
  assert.equal(tauriConfig.productName, 'Telu');
  assert.equal(tauriConfig.app.windows[0].title, 'Telu');
  assert.equal(
    tauriConfig.identifier,
    'com.meetily.ai',
    'the installed data and OS-permission identity must remain stable during the rename',
  );
  assert.match(cargoManifest, /^name\s*=\s*"telu"$/m);
  assert.match(cargoManifest, /^default-run\s*=\s*"telu"$/m);
});

test('active product surfaces do not reintroduce stale Meetily branding', () => {
  const compatibilityFiles = new Set([
    'frontend/src/components/DatabaseImport/HomebrewDatabaseDetector.tsx',
    'frontend/src/components/DatabaseImport/LegacyDatabaseImport.tsx',
    'frontend/src/components/MeetingDetails/MeetingDetailsSplitView.tsx',
    'frontend/src/contexts/OnboardingContext.tsx',
    'frontend/src/lib/analytics.ts',
    'frontend/src/services/indexedDBService.ts',
    'frontend/src-tauri/src/audio/pipeline.rs',
    'frontend/src-tauri/src/bin/telu-baseline.rs',
    'frontend/src-tauri/src/notifications/settings.rs',
    'frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs',
    'frontend/src-tauri/src/summary/summary_engine/model_manager.rs',
    'frontend/src-tauri/src/summary/summary_engine/sidecar.rs',
    'frontend/src-tauri/src/summary/templates/loader.rs',
    'frontend/src-tauri/src/summary/templates/mod.rs',
    'frontend/src-tauri/src/whisper_engine/whisper_engine.rs',
  ]);

  const staleFiles = [
    ...sourceFiles('frontend/src'),
    ...sourceFiles('frontend/src-tauri/src'),
  ].filter((relativePath) => {
    if (relativePath.endsWith('lib_old_complex.rs')) return false;
    if (compatibilityFiles.has(relativePath)) return false;
    return /meet(?:i)?ly/i.test(read(relativePath));
  });

  assert.deepEqual(
    staleFiles,
    [],
    `unexpected stale branding in active source: ${staleFiles.join(', ')}`,
  );
});
