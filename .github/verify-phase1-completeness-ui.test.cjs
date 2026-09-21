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
const completeness = readFileSync(
  join(root, 'frontend/src/components/MeetingCompleteness.tsx'),
  'utf8',
);
const sidebarProvider = readFileSync(
  join(root, 'frontend/src/components/Sidebar/SidebarProvider.tsx'),
  'utf8',
);
const sidebar = readFileSync(
  join(root, 'frontend/src/components/Sidebar/index.tsx'),
  'utf8',
);
const meetingDetails = readFileSync(
  join(root, 'frontend/src/app/meeting-details/page-content.tsx'),
  'utf8',
);
const globals = readFileSync(join(root, 'frontend/src/app/globals.css'), 'utf8');
const rustApi = readFileSync(
  join(root, 'frontend/src-tauri/src/api/api.rs'),
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
  assert.match(recoveryHook, /setRecoverableMeetings\(prev => prev\.map/);
});

test('recovery remains in the dialog and renders authoritative result actions', () => {
  assert.match(recoveryDialog, /setRecoveryResult\(result\)/);
  assert.doesNotMatch(
    recoveryDialog,
    /const handleRecover[\s\S]*?await onRecover\([^)]*\);[\s\S]{0,120}onClose\(\)/,
  );
  assert.match(recoveryDialog, /Meeting recovered\. No recorded gaps remain\./);
  assert.match(recoveryDialog, /Meeting recovered with[\s\S]*gap/);
  assert.match(recoveryDialog, />\s*View meeting\s*</);
  assert.match(recoveryDialog, />\s*Close recovery\s*</);
  assert.match(recoveryDialog, />\s*Review gaps\s*</);
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
  assert.match(recoveryDialog, />\s*Keep meeting\s*</);
  assert.match(recoveryDialog, />\s*Delete meeting\s*</);
});

test('shared completeness renders exactly the four authoritative lifecycle labels', () => {
  for (const copy of [
    'Complete',
    'Incomplete ·',
    'Recovered with gaps ·',
    'Completion not verified',
  ]) {
    assert.match(completeness, new RegExp(copy.replace('·', '\\·')));
  }
  for (const icon of ['CheckCircle2', 'AlertTriangle', 'RotateCcw', 'CircleHelp']) {
    assert.match(completeness, new RegExp(`\\b${icon}\\b`));
  }
  assert.match(completeness, /aria-label=\{label\}/);
});

test('history and detail project Rust lifecycle and completeness without dropping fields', () => {
  assert.match(rustApi, /pub lifecycle:\s*MeetingLifecycle/);
  assert.match(rustApi, /pub completeness:\s*MeetingCompleteness/);
  assert.match(rustApi, /pub gap_count:\s*u64/);
  assert.match(sidebarProvider, /lifecycle:\s*meeting\.lifecycle/);
  assert.match(sidebarProvider, /completeness:\s*meeting\.completeness/);
  assert.match(sidebar, /<MeetingCompleteness/);
  assert.match(sidebar, /line-clamp-2/);
  assert.match(meetingDetails, /<MeetingCompleteness/);
  assert.match(meetingDetails, /variant="detail"/);
});

test('detail notices and gap review preserve missing and unknown facts', () => {
  assert.match(
    completeness,
    /Some audio or transcript content is missing\. Review the recorded gaps before relying on this meeting\./,
  );
  assert.match(
    completeness,
    /Recovery preserved the available content, but some audio or transcript content is still missing\./,
  );
  assert.match(completeness, /Review gaps/);
  assert.match(completeness, /sortGapsByRelativeTime/);
  assert.match(completeness, /Gap type/);
  assert.match(completeness, /Source/);
  assert.match(completeness, /Time range/);
  assert.match(completeness, /Reason/);
  assert.match(completeness, /Unknown/);
  assert.match(completeness, /No recorded gaps/);
  assert.match(
    completeness,
    /Telu has no recorded audio or transcript gaps for this meeting\. The meeting status above remains authoritative\./,
  );
});

test('zero gaps never promote completion and touched surfaces use Telu tokens', () => {
  assert.doesNotMatch(
    completeness,
    /(gaps\.length|gapCount)\s*={2,3}\s*0[\s\S]{0,100}(Complete|'complete'|"complete")/,
  );
  assert.match(completeness, /switch \(completeness\)/);
  assert.match(globals, /--background:\s*60 16\.7% 96\.3%/);
  assert.match(globals, /--primary:\s*239 74\.3% 64\.9%/);
  assert.match(globals, /--destructive:\s*4 100% 69\.2%/);
  assert.doesNotMatch(completeness, /#67E8C5|fresh-mint|Fresh Mint/i);
});
