'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ProviderBoundary } from '@/components/ProviderBoundary';
import { GlassGroup } from '@/components/telu-ui/glass-group';
import { RecDot, Spinner } from '@/components/telu-ui/indicators';
import { Button } from '@/components/ui/button';
import { formatElapsed } from '@/lib/format-elapsed';
import { EASE } from '@/lib/motion';
import { useRecordingControlsContext, type RecordingControlsValue } from './recording-host';

const CAPSULE_IN = { duration: 0.24, ease: EASE.out };
const CAPSULE_OUT = { duration: 0.15, ease: EASE.out };

export function recordingLabel(title: string, elapsedSeconds: number | null): string {
  const minutes = Math.floor((elapsedSeconds ?? 0) / 60);
  return `Recording ${title}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export function RecordButton({ controls }: { controls: RecordingControlsValue }) {
  const { canRecord, isStarting, isStopping, isRetryingRoute } = controls;
  return (
    <Button
      variant="plain"
      aria-keyshortcuts="Meta+R"
      disabled={!canRecord || isStarting || isStopping || isRetryingRoute}
      onClick={() => void controls.start()}
      className="gap-[7px]"
    >
      {isStarting ? (
        <Spinner active size={10} />
      ) : (
        <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-coral shadow-[0_0_0_2.5px_var(--coral-soft)]" />
      )}
      Record
      <span aria-hidden className="text-[11px] opacity-60">⌘R</span>
    </Button>
  );
}

export function RecordingCapsule({ controls }: { controls: RecordingControlsValue }) {
  return (
    <motion.div
      role="status"
      aria-label={recordingLabel(controls.title, controls.elapsedSeconds)}
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(2px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: CAPSULE_IN }}
      exit={{ opacity: 0, scale: 0.96, transition: CAPSULE_OUT }}
      className="inline-flex h-[30px] max-w-[300px] items-center gap-2 rounded-full bg-coral-soft pl-3 pr-1 text-[12px] text-coral-ink shadow-[inset_0_0_0_0.5px_color-mix(in_srgb,var(--coral)_35%,transparent)]"
    >
      <RecDot active />
      <span className="min-w-0 truncate font-semibold">{controls.title}</span>
      <span aria-hidden className="min-w-[30px] shrink-0 tabular-nums">
        {formatElapsed(controls.elapsedSeconds ?? 0)}
      </span>
      <Button
        variant="record"
        size="sm"
        disabled={controls.isStopping}
        onClick={() => void controls.stop()}
        className="h-[22px] shrink-0 rounded-full px-2.5"
      >
        Stop
      </Button>
    </motion.div>
  );
}

export function RecordSlot() {
  const controls = useRecordingControlsContext();
  if (!controls || controls.isStopping) return null;
  return (
    <AnimatePresence mode="wait" initial={false}>
      {controls.isRecording ? (
        <RecordingCapsule key="capsule" controls={controls} />
      ) : (
        <GlassGroup key="record" aria-label="Recording">
          <ProviderBoundary capability="transcription" compact refreshKey={controls.routeRefreshKey} showUnavailableAlert={false} />
          <RecordButton controls={controls} />
        </GlassGroup>
      )}
    </AnimatePresence>
  );
}
