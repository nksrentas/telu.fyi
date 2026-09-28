"use client"

import { useCallback, useEffect, useState, type RefObject } from "react"

import { clock } from "@/components/living-doc/meeting-header"
import { Skeleton } from "@/components/telu-ui/indicators"
import { useRecordingState } from "@/contexts/RecordingStateContext"
import type { AgendaMeeting } from "@/lib/agenda-service"
import { onKnowledgeUpdated } from "@/lib/knowledge-service"
import { MEETINGS_CHANGED_EVENT } from "@/lib/meeting-deletion-service"
import type { FinalizationProgressSnapshot } from "@/services/transcriptService"
import { EventCard, type CardSection } from "./event-card"

export type AgendaOrigin = "Today" | "Review"

export function meetingHref(meeting: Pick<AgendaMeeting, "id">, from: AgendaOrigin, section?: CardSection): string {
  const query = `/meeting-details?id=${encodeURIComponent(meeting.id)}&from=${from}`
  return section ? `${query}#${section}` : query
}

export function useAgendaRefresh(load: () => void) {
  const { status } = useRecordingState()

  useEffect(() => {
    load()
  }, [load, status])

  useEffect(() => {
    window.addEventListener(MEETINGS_CHANGED_EVENT, load)
    const unlisten = onKnowledgeUpdated(load).catch((error: unknown) => {
      console.error("Failed to listen for knowledge updates:", error)
      return null
    })
    return () => {
      window.removeEventListener(MEETINGS_CHANGED_EVENT, load)
      void unlisten.then((stop) => stop?.())
    }
  }, [load])
}

function asElement(target: EventTarget | null): HTMLElement | null {
  return target !== null && typeof (target as HTMLElement).getAttribute === "function" ? (target as HTMLElement) : null
}

function isTimelineTarget(target: EventTarget | null, list: HTMLElement | null): boolean {
  const element = asElement(target)
  if (!element) return true
  return element === document.body || element === document.documentElement || Boolean(list?.contains(element))
}

interface TimelineKeys {
  listRef: RefObject<HTMLDivElement>
  onStep?: (direction: -1 | 1) => void
  onMove: (delta: -1 | 1) => void
  onEnter: () => void
}

export function useTimelineKeys({ listRef, onStep, onMove, onEnter }: TimelineKeys) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (!isTimelineTarget(event.target, listRef.current)) return
      if (event.key === "Enter" && asElement(event.target)?.tagName === "BUTTON") return
      const actions: Record<string, (() => void) | undefined> = {
        ArrowLeft: onStep && (() => onStep(-1)),
        ArrowRight: onStep && (() => onStep(1)),
        ArrowUp: () => onMove(-1),
        ArrowDown: () => onMove(1),
        Enter: onEnter,
      }
      const action = actions[event.key]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [listRef, onStep, onMove, onEnter])
}

export function useSelection(
  meetings: AgendaMeeting[],
  optionRefs: RefObject<Map<string, HTMLDivElement>>,
  listRef: RefObject<HTMLDivElement>
) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const move = useCallback(
    (delta: -1 | 1) => {
      if (meetings.length === 0) return
      const index = meetings.findIndex((meeting) => meeting.id === selectedId)
      const next = meetings[index < 0 ? (delta > 0 ? 0 : meetings.length - 1) : Math.min(meetings.length - 1, Math.max(0, index + delta))]
      setSelectedId(next.id)
      if (listRef.current?.contains(document.activeElement)) optionRefs.current?.get(next.id)?.focus()
    },
    [meetings, selectedId, optionRefs, listRef]
  )
  return { selectedId, setSelectedId, move }
}

export function useScrolled(scrollRef: RefObject<HTMLDivElement>) {
  const [scrolled, setScrolled] = useState(false)
  const onScroll = useCallback(() => setScrolled((scrollRef.current?.scrollTop ?? 0) > 2), [scrollRef])
  return { scrolled, onScroll }
}

export function TimelineSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3.5">
          <div className="flex justify-end pt-[13px]">
            <Skeleton active className="w-8" />
          </div>
          <div className="space-y-2 rounded-[12px] bg-surface py-3 pl-[21px] pr-[14px] shadow-card">
            <Skeleton active shape="line-short" />
            <Skeleton active className="w-[34%]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimeColumn({ meeting, dayLabel }: { meeting: AgendaMeeting; dayLabel?: string }) {
  return (
    <div className="flex flex-col items-end whitespace-nowrap pt-[11px] leading-[1.25]">
      {dayLabel && <span className="mb-px text-[10px] font-semibold text-label-3">{dayLabel}</span>}
      <span className="text-[12px] font-semibold tabular-nums tracking-[-0.005em] text-label">
        {clock(new Date(meeting.startedAtUtc))}
      </span>
      {meeting.endedAtUtc && (
        <span className="text-[11px] tabular-nums text-label-3">{clock(new Date(meeting.endedAtUtc))}</span>
      )}
    </div>
  )
}

interface TimelineProps {
  label: string
  meetings: AgendaMeeting[]
  selectedId: string | null
  finalization: FinalizationProgressSnapshot | null
  recordingSeconds: number | null
  optionRefs: RefObject<Map<string, HTMLDivElement>>
  onOpen: (meeting: AgendaMeeting, section?: CardSection) => void
  onOpenPage?: (meeting: AgendaMeeting) => void
  dayLabel?: (meeting: AgendaMeeting) => string
  leaving?: ReadonlySet<string>
}

export function Timeline({ label, meetings, selectedId, finalization, recordingSeconds, optionRefs, onOpen, onOpenPage, dayLabel, leaving }: TimelineProps) {
  const focusId = selectedId ?? meetings[0]?.id
  return (
    <div role="listbox" aria-label={label} className="flex flex-col gap-2">
      {meetings.map((meeting) => (
        <div
          key={meeting.id}
          data-leaving={leaving?.has(meeting.id) || undefined}
          className="group grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-[220ms] ease-out data-[leaving]:grid-rows-[0fr] data-[leaving]:opacity-0 data-[leaving]:delay-500"
        >
          <div className="grid min-h-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3.5 group-data-[leaving]:overflow-hidden">
            <TimeColumn meeting={meeting} dayLabel={dayLabel?.(meeting)} />
            <EventCard
              ref={(node) => {
                if (node) optionRefs.current?.set(meeting.id, node)
                else optionRefs.current?.delete(meeting.id)
              }}
              meeting={meeting}
              selected={meeting.id === selectedId}
              tabIndex={meeting.id === focusId ? 0 : -1}
              finalization={finalization?.meeting_id === meeting.id ? finalization : null}
              recordingSeconds={meeting.cardState === "recording" ? recordingSeconds : null}
              onOpen={(section) => onOpen(meeting, section)}
              onOpenPage={onOpenPage && (() => onOpenPage(meeting))}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
