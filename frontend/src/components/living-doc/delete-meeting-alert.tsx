'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/telu-ui/indicators';
import {
  MEETINGS_CHANGED_EVENT,
  deleteMeeting,
  getDeletionImpact,
  type KnowledgeDeletionImpact,
} from '@/lib/meeting-deletion-service';
import type { MeetingLifecycle } from '@/types';

const DELETE_FAILED = "Couldn't delete this meeting. Nothing was removed.";
const AUDIO_NOTE = "The audio file isn't deleted yet.";

type ImpactState = { status: 'loading' } | { status: 'ready'; impact: KnowledgeDeletionImpact } | { status: 'error' };

export function isDeleteDisabled(lifecycle: MeetingLifecycle | undefined): boolean {
  return lifecycle === 'recording' || lifecycle === 'finalizing';
}

export function deletionBody(impact: KnowledgeDeletionImpact): string {
  if (impact.accepted === 0 && impact.suggestions === 0) {
    return "Its transcript and summary will be removed from this Mac. This can't be undone.";
  }
  const accepted = impact.accepted === 1 ? '1 accepted item' : `${impact.accepted} accepted items`;
  const suggestions = impact.suggestions === 1 ? '1 suggestion' : `${impact.suggestions} suggestions`;
  return `${accepted} and ${suggestions} from this meeting will be removed from this Mac, along with its transcript and summary. This can't be undone.`;
}

function useDeletionImpact(meetingId: string, open: boolean) {
  const [state, setState] = useState<ImpactState>({ status: 'loading' });
  useEffect(() => {
    if (!open) return;
    let current = true;
    setState({ status: 'loading' });
    getDeletionImpact(meetingId)
      .then((impact) => {
        if (current) setState({ status: 'ready', impact });
      })
      .catch((error: unknown) => {
        console.error('Failed to load deletion impact:', error);
        if (current) setState({ status: 'error' });
      });
    return () => {
      current = false;
    };
  }, [meetingId, open]);
  return state;
}

interface DeleteMeetingAlertProps {
  meetingId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteMeetingAlert({ meetingId, title, open, onOpenChange, onDeleted }: DeleteMeetingAlertProps) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const impactState = useDeletionImpact(meetingId, open);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) setFailed(false);
  }, [open]);

  const confirmDelete = async () => {
    setDeleting(true);
    setFailed(false);
    try {
      await deleteMeeting(meetingId);
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent(MEETINGS_CHANGED_EVENT, { detail: { meetingId } }));
      onDeleted?.();
      toast.success(`Deleted ${title} from this Mac`);
      router.push('/');
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      setFailed(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[220ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-[140ms]" />
        <AlertDialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
          className="fixed left-1/2 top-[42%] z-50 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-glass-strong px-[18px] pb-4 pt-[22px] text-center shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8] ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 data-[state=open]:duration-[220ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=closed]:duration-[140ms]"
        >
          <span aria-hidden className="mx-auto mb-3 grid size-14 place-items-center rounded-[13px] bg-accent-foreground shadow-card">
            <Image src="/telu-icon.png" alt="" width={40} height={40} loading="eager" className="size-10" />
          </span>
          <AlertDialog.Title className="m-0 break-words text-[13px] font-bold text-label">
            Delete &ldquo;{title}&rdquo;?
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-1.5 space-y-1.5 text-[11px] leading-[1.4] text-label-2">
              {impactState.status === 'loading' && (
                <span className="flex justify-center" role="status" aria-label="Loading what will be removed">
                  <Spinner active size={10} />
                </span>
              )}
              {impactState.status === 'ready' && <p className="m-0">{deletionBody(impactState.impact)}</p>}
              {impactState.status === 'error' && <p className="m-0">Couldn&apos;t load what will be removed.</p>}
              <p className="m-0">{AUDIO_NOTE}</p>
            </div>
          </AlertDialog.Description>
          {failed && <p role="alert" className="m-0 mt-2 text-[11px] text-coral-ink">{DELETE_FAILED}</p>}
          <div className="mt-4 flex gap-2">
            <AlertDialog.Cancel asChild>
              <Button ref={cancelRef} className="h-7 flex-1 px-2">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              className="h-7 flex-1 px-2"
              disabled={impactState.status !== 'ready' || deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
