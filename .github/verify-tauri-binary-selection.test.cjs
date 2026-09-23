const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const tauriDir = path.join(root, 'frontend', 'src-tauri');
const cargoManifest = fs.readFileSync(path.join(tauriDir, 'Cargo.toml'), 'utf8');

function packageField(name) {
  const packageStart = cargoManifest.indexOf('[package]') + '[package]'.length;
  const packageEnd = cargoManifest.indexOf('\n[', packageStart);
  const packageSection = cargoManifest.slice(
    packageStart,
    packageEnd === -1 ? undefined : packageEnd,
  );
  return packageSection.match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];
}

function autoDiscoveredBinaryNames() {
  const names = [];
  if (fs.existsSync(path.join(tauriDir, 'src', 'main.rs'))) {
    names.push(packageField('name'));
  }

  const binDir = path.join(tauriDir, 'src', 'bin');
  if (fs.existsSync(binDir)) {
    for (const entry of fs.readdirSync(binDir, { withFileTypes: true })) {
      if (entry.isFile() && path.extname(entry.name) === '.rs') {
        names.push(path.basename(entry.name, '.rs'));
      }
    }
  }

  return names.filter(Boolean).sort();
}

test('the multi-binary Tauri package pins the desktop GUI as Cargo default-run', () => {
  const binaries = autoDiscoveredBinaryNames();
  assert.ok(binaries.length > 1, 'this regression requires a multi-binary package');
  assert.ok(binaries.includes('telu'));
  assert.ok(binaries.includes('telu-baseline'));
  assert.equal(
    packageField('default-run'),
    'telu',
    'Tauri requires an explicit Cargo default-run once src/bin adds an auxiliary executable',
  );
});
