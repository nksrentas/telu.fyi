const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const root = join(__dirname, '..');
const recordSlot = readFileSync(join(root, 'frontend/src/components/app-shell/recording-capsule.tsx'), 'utf8');
const host = readFileSync(join(root, 'frontend/src/components/app-shell/recording-host.tsx'), 'utf8');
const liveTranscript = readFileSync(join(root, 'frontend/src/components/living-doc/live-transcript.tsx'), 'utf8');
const meetingPage = readFileSync(join(root, 'frontend/src/app/meeting-details/page-content.tsx'), 'utf8');
const overlays = readFileSync(join(root, 'frontend/src/app/_components/StatusOverlays.tsx'), 'utf8');

test('stop swaps controls for in-place finalization while the transcript remains mounted', () => {
  assert.match(recordSlot, /controls\.isStopping\) return null/);
  assert.match(recordSlot, /disabled=\{[^}]*isStopping/);
  assert.match(host, /<StatusOverlays/);
  assert.match(liveTranscript, /isRecording \|\| isStopping \|\| isProcessing \|\| isSaving/);
  assert.match(meetingPage, /\{live && <LiveTranscript/);
  assert.match(overlays, /Finalizing recording/);
  assert.match(overlays, /h-4 w-4/);
});

test('finalization renders authoritative zero, one, many, and oldest-age copy', () => {
  assert.match(overlays, /snapshot\.queue\.depth/);
  assert.match(overlays, /snapshot\.queue\.oldest_age_ms/);
  assert.match(overlays, /depth === 1 \? 'item' : 'items'/);
  assert.match(overlays, /No transcript work pending · saving meeting/);
  assert.match(overlays, /oldest waiting/);
  assert.match(overlays, /<1s/);
  assert.match(overlays, /2m 04s/);
});

test('incomplete terminal state remains visible with deliberate meeting and gap actions', () => {
  assert.match(overlays, /Meeting saved as incomplete/);
  assert.match(overlays, /Incomplete ·/);
  assert.match(overlays, /Some audio or transcript content is missing\. Review the recorded gaps before relying on this meeting\./);
  assert.match(overlays, />View meeting</);
  assert.match(overlays, />Review gaps</);
  assert.match(overlays, /dismissedMeetingId/);
  assert.doesNotMatch(overlays, /autoDismiss|AUTO_DISMISS|duration:\s*\d/);
});

test('status is polite and throttled without percentage or completion inference', () => {
  assert.match(overlays, /aria-live="polite"/);
  assert.match(overlays, /role="status"/);
  assert.match(overlays, /ANNOUNCEMENT_THROTTLE_MS = 5_000/);
  assert.doesNotMatch(overlays, /<Progress\b|aria-valuenow|%\s*(complete|remaining|done)/i);
  assert.doesNotMatch(overlays, /last_activity|quiet|setInterval|queue\.depth === 0[\s\S]{0,80}(complete|Complete)/);
  assert.match(overlays, /transcriptService\.onFinalizationProgress/);
  assert.match(overlays, /transcriptService\.onRecordingStopped/);
});
