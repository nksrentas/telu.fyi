"use client"

import { Fragment, forwardRef, useState, type ReactNode } from "react"
import { CircleCheck } from "lucide-react"

import { WAITING_FOR_STATUS, finalizationDetail } from "@/app/_components/StatusOverlays"
import { useRecordingControlsContext } from "@/components/app-shell/recording-host"
import { DeleteMeetingAlert, isDeleteDisabled } from "@/components/living-doc/delete-meeting-alert"
import { MeetingCompleteness } from "@/components/MeetingCompleteness"
import { clock, formatMeetingDuration } from "@/components/living-doc/meeting-header"
import { Chip } from "@/components/telu-ui/chip"
import { RecDot, Shimmer, Waveform } from "@/components/telu-ui/indicators"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { AgendaCardState, AgendaMeeting } from "@/lib/agenda-service"
import { formatElapsed } from "@/lib/format-elapsed"
import { cn } from "@/lib/utils"
import type { FinalizationProgressSnapshot } from "@/services/transcriptService"

export type CardSection = "knowledge"

interface CardAction {
  label: string
  tinted: boolean
  section?: CardSection
}

const CARD_ACTIONS: Partial<Record<AgendaCardState, CardAction>> = {
  to_review: { label: "Review", tinted: true, section: "knowledge" },
  no_knowledge: { label: "Find knowledge", tinted: true, section: "knowledge" },
  incomplete: { label: "Open", tinted: false },
}

const DIMMED_STATES: AgendaCardState[] = ["reviewed", "transcript_only"]

function endedParts(meeting: AgendaMeeting): string[] {
  const start = new Date(meeting.startedAtUtc)
  if (!meeting.endedAtUtc) return [`Started ${clock(start)}`]
  const end = new Date(meeting.endedAtUtc)
  const duration = formatMeetingDuration((end.getTime() - start.getTime()) / 1000)
  return duration ? [`Ended ${clock(end)}`, duration] : [`Ended ${clock(end)}`]
}

export function cardMeta(meeting: AgendaMeeting, finalization: FinalizationProgressSnapshot | null): string[] {
  if (meeting.cardState === "recording") return [`Started ${clock(new Date(meeting.startedAtUtc))}`]
  if (meeting.cardState === "finalizing") return [finalization ? finalizationDetail(finalization) : WAITING_FOR_STATUS]
  if (meeting.cardState === "reviewed") return [...endedParts(meeting), `${meeting.acceptedCount} accepted`]
  return endedParts(meeting)
}

function ShimmerChip({ label }: { label: string }) {
  return (
    <Shimmer
      active
      className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-medium text-label-2"
    >
      {label}
    </Shimmer>
  )
}

function CardChip({ meeting }: { meeting: AgendaMeeting }) {
  switch (meeting.cardState) {
    case "recording":
      return null
    case "finalizing":
      return <ShimmerChip label="Finalizing…" />
    case "extracting":
      return <ShimmerChip label="Reading…" />
    case "to_review":
      return <Chip tone="amber">{meeting.pendingCount} to review</Chip>
    case "reviewed":
      return (
        <Chip>
          <CircleCheck aria-hidden className="size-3 text-label-3" strokeWidth={1.8} />
          Reviewed
        </Chip>
      )
    case "incomplete":
      return (
        <MeetingCompleteness
          lifecycle={meeting.lifecycle}
          completeness={meeting.completeness}
          gapCount={meeting.gapCount}
          className="shrink-0 whitespace-nowrap"
        />
      )
    case "no_knowledge":
      return <Chip>Not reviewed yet</Chip>
    case "transcript_only":
      return <Chip>Transcript only</Chip>
  }
}

function LiveEyebrow({ seconds }: { seconds: number | null }) {
  return (
    <div className="mb-[3px] flex items-center gap-1.5 text-[11px] font-semibold text-coral-ink">
      <RecDot active />
      <span>Recording</span>
      {seconds !== null && <span className="tabular-nums">{formatElapsed(seconds)}</span>}
      <Waveform active className="h-[11px] text-coral" />
    </div>
  )
}

function CardMeta({ parts, dim, status }: { parts: string[]; dim: boolean; status: boolean }) {
  return (
    <span
      role={status ? "status" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] text-label-2",
        dim && "opacity-[0.55]"
      )}
    >
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span aria-hidden className="text-label-4">
              ·
            </span>
          )}
          <span className="truncate tabular-nums">{part}</span>
        </Fragment>
      ))}
    </span>
  )
}

function CardActionButton({ meeting, onOpen }: { meeting: AgendaMeeting; onOpen: (section?: CardSection) => void }) {
  const action = CARD_ACTIONS[meeting.cardState]
  if (!action) return null
  return (
    <span className="pointer-events-none absolute right-[-4px] top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 bg-[linear-gradient(90deg,transparent,var(--surface)_26px)] py-0.5 pl-7 pr-1 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-aria-selected:pointer-events-auto group-aria-selected:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
      <Button
        size="sm"
        variant={action.tinted ? "tinted" : "default"}
        onClick={(event) => {
          event.stopPropagation()
          onOpen(action.section)
        }}
      >
        {action.label}
      </Button>
    </span>
  )
}

interface CardMenuProps {
  meeting: AgendaMeeting
  onPeek: () => void
  onOpenPage: () => void
  children: ReactNode
}

export function isCardDeleteDisabled(meeting: AgendaMeeting): boolean {
  return meeting.cardState === "recording" || meeting.cardState === "finalizing" || isDeleteDisabled(meeting.lifecycle)
}

function CardMenu({ meeting, onPeek, onOpenPage, children }: CardMenuProps) {
  const recording = useRecordingControlsContext()
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onPeek}>
            Open in side peek
            <ContextMenuShortcut>↩</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={onOpenPage}>Open as page</ContextMenuItem>
          {meeting.cardState === "recording" && (
            <ContextMenuItem disabled={!recording?.isRecording} onSelect={() => void recording?.stop()}>
              Stop recording
              <ContextMenuShortcut>⌘R</ContextMenuShortcut>
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem variant="danger" disabled={isCardDeleteDisabled(meeting)} onSelect={() => setDeleteOpen(true)}>
            Delete meeting…
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <DeleteMeetingAlert meetingId={meeting.id} title={meeting.title} open={deleteOpen} onOpenChange={setDeleteOpen} navigateHome={false} />
    </>
  )
}

interface EventCardProps {
  meeting: AgendaMeeting
  selected: boolean
  onOpen: (section?: CardSection) => void
  onOpenPage?: () => void
  finalization?: FinalizationProgressSnapshot | null
  recordingSeconds?: number | null
  tabIndex?: number
}

export const EventCard = forwardRef<HTMLDivElement, EventCardProps>(function EventCard(
  { meeting, selected, onOpen, onOpenPage, finalization = null, recordingSeconds = null, tabIndex = -1 },
  ref
) {
  const live = meeting.cardState === "recording"
  const dim = DIMMED_STATES.includes(meeting.cardState)
  const card = (
    <div
      ref={ref}
      role="option"
      aria-selected={selected}
      tabIndex={tabIndex}
      data-card-state={meeting.cardState}
      onClick={() => onOpen()}
      className={cn(
        "group relative min-w-0 cursor-default rounded-[12px] bg-surface pb-[11px] pl-[21px] pr-[14px] pt-[10px] shadow-card transition-[box-shadow,transform] duration-200 ease-out after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-[0_0_0_2px_var(--accent)] active:scale-[0.992] aria-selected:after:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-card-hover",
        live &&
          "shadow-card-hover ring-1 ring-coral before:absolute before:bottom-[11px] before:left-[9px] before:top-[11px] before:w-[3px] before:rounded-[3px] before:bg-coral"
      )}
    >
      {live && <LiveEyebrow seconds={recordingSeconds} />}
      <div className={cn("flex min-h-5 min-w-0 items-center gap-2.5", dim && "opacity-[0.55]")}>
        <span className="min-w-0 flex-1 truncate font-semibold tracking-[-0.003em] text-label">{meeting.title}</span>
        <CardChip meeting={meeting} />
      </div>
      <div className="relative mt-0.5 flex min-h-[22px] min-w-0 items-center gap-2.5">
        <CardMeta parts={cardMeta(meeting, finalization)} dim={dim} status={meeting.cardState === "finalizing"} />
        <CardActionButton meeting={meeting} onOpen={onOpen} />
      </div>
    </div>
  )
  if (!onOpenPage) return card
  return (
    <CardMenu meeting={meeting} onPeek={() => onOpen()} onOpenPage={onOpenPage}>
      {card}
    </CardMenu>
  )
})
