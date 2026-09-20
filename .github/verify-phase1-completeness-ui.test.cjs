const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const root = join(__dirname, '..');
const indexedDBService = readFileSync(
  join(root, 'frontend/src/services/indexedDBService.ts'),
  'utf8',
);
const recoveryHook = readFileSync(
  join(root, 'frontend/src/hooks/useTranscriptRecovery.ts'),
  'utf8',
);
const recoveryDialog = readFileSync(
  join(root, 'frontend/src/components/TranscriptRecovery/TranscriptRecovery.tsx'),
  'utf8',
);

test('recovery submits only canonical meeting and final evidence identity to Rust', () => {
  assert.match(recoveryHook, /invoke<RecoveryResult>\(\s*'reconcile_meeting'/);
  assert.match(recoveryHook, /meeting_id:\s*metadata\.meetingId/);
  assert.match(recoveryHook, /evidence_id:\s*transcript\.evidenceId/);
  assert.match(recoveryHook, /meeting_id:\s*transcript\.meetingId/);
  assert.match(recoveryHook, /source_track:\s*transcript\.source/);
  assert.match(recoveryHook, /source_segment_key:\s*transcript\.sourceSegmentKey/);
  assert.doesNotMatch(recoveryHook, /storageService\.saveMeeting/);
  assert.doesNotMatch(recoveryHook, /Date\.now\(\).*index/);
});

test('authoritative recovery updates the existing cache candidate without removal or duplication', () => {
  assert.match(indexedDBService, /applyRecoveryResult\(result:\s*RecoveryResult\)/);
  assert.match(indexedDBService, /store\.get\(result\.meeting_id\)/);
  assert.match(indexedDBService, /store\.put\(meeting\)/);
  assert.match(recoveryHook, /applyRecoveryResult\(result\)/);
  assert.match(recoveryHook, /meeting\.meetingId === result\.meeting_id/);
  assert.doesNotMatch(recoveryHook, /prev\.filter\(m => m\.meetingId !== meetingId\)/);
});

test('recovery remains in the dialog and renders authoritative result actions', () => {
  assert.match(recoveryDialog, /setRecoveryResult\(result\)/);
  assert.doesNotMatch(
    recoveryDialog,
    /const handleRecover[\s\S]*?await onRecover\([^)]*\);[\s\S]{0,120}onClose\(\)/,
  );
  assert.match(recoveryDialog, /Meeting recovered\. No recorded gaps remain\./);
  assert.match(recoveryDialog, /Meeting recovered with[\s\S]*gap/);
  assert.match(recoveryDialog, />View meeting</);
  assert.match(recoveryDialog, />Close recovery</);
  assert.match(recoveryDialog, />Review gaps</);
});

test('recovery loading, empty, selection, and delete controls stay explicit', () => {
  assert.match(recoveryDialog, /Recovering meeting…/);
  assert.match(recoveryDialog, /No interrupted meetings/);
  assert.match(
    recoveryDialog,
    /There are no interrupted recordings available to recover on this device\./,
  );
  assert.match(recoveryDialog, /disabled=\{isRecovering \|\| isDeleting\}/);
  assert.match(recoveryDialog, /Delete interrupted meeting/);
  assert.match(
    recoveryDialog,
    /Its local recovery data will be removed\. This cannot be undone\./,
  );
  assert.match(recoveryDialog, />Keep meeting</);
  assert.match(recoveryDialog, />Delete meeting</);
});
