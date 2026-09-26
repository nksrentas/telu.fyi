const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function readBuffer(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngDimensions(buffer) {
  assert.deepEqual(
    buffer.subarray(0, 8),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'asset must have the PNG signature',
  );
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR');

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('Tauri selects the supplied Telu bundle icon assets', () => {
  const tauriConfig = JSON.parse(
    readBuffer('frontend/src-tauri/tauri.conf.json').toString('utf8'),
  );

  assert.deepEqual(tauriConfig.bundle.icon, [
    'icons/icon.png',
    'icons/app_icon.icns',
    'icons/app_icon.ico',
  ]);
});

test('configured bundle icons retain their inspected Telu asset identities', () => {
  const png = readBuffer('frontend/src-tauri/icons/icon.png');
  const icns = readBuffer('frontend/src-tauri/icons/app_icon.icns');
  const ico = readBuffer('frontend/src-tauri/icons/app_icon.ico');

  assert.equal(
    sha256(png),
    'b76a488474d9f5e46ef3afc7b1fe694cd27b469cdd2baacc8b977885e9ce624c',
  );
  assert.deepEqual(pngDimensions(png), { width: 1024, height: 1024 });

  assert.equal(
    sha256(icns),
    'b0eb4683c23163c061432d9a11af2de944cef80247e058d8333623c54506d7c3',
  );
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');

  assert.equal(
    sha256(ico),
    'b20501f4a2099319e9dc9769a390549e0fd5eab9ff8bb385d66bee2fa7754d45',
  );
  assert.deepEqual(ico.subarray(0, 4), Buffer.from([0x00, 0x00, 0x01, 0x00]));
});

test('macOS tray uses the supplied template while other platforms keep the window icon', () => {
  const template = readBuffer(
    'frontend/src-tauri/icons/TeluMenuBarTemplate@2x.png',
  );
  const traySource = readBuffer('frontend/src-tauri/src/tray.rs').toString('utf8');

  assert.equal(
    sha256(template),
    '700265ac6c2367dc719c51622a21de78ff1a736cd596e5268a9c3b761835de5f',
  );
  assert.deepEqual(pngDimensions(template), { width: 36, height: 36 });

  assert.match(
    traySource,
    /#\[cfg\(target_os = "macos"\)\]\s*let tray_icon = tauri::include_image!\("\.\/icons\/TeluMenuBarTemplate@2x\.png"\);/,
  );
  assert.match(
    traySource,
    /#\[cfg\(not\(target_os = "macos"\)\)\]\s*let tray_icon = app\.default_window_icon\(\)\.unwrap\(\)\.clone\(\);/,
  );
  assert.match(
    traySource,
    /#\[cfg\(target_os = "macos"\)\]\s*let tray_builder = tray_builder\.icon_as_template\(true\);/,
  );
});
