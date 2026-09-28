"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck } from "lucide-react"
import { toast } from "sonner"

import { AgendaToolbar, isSameDay } from "@/components/app-shell/agenda-toolbar"
import { useRecordingControlsContext } from "@/components/app-shell/recording-host"
import { PEEK_PADDING_CLASS, PeekLayer, usePeek } from "@/components/side-peek/side-peek"
import { EmptyState } from "@/components/telu-ui/empty-state"
import { Button } from "@/components/ui/button"
import { useRecordingState } from "@/contexts/RecordingStateContext"
import { listReviewMeetings, type AgendaMeeting } from "@/lib/agenda-service"
import { cn } from "@/lib/utils"
import {
  Timeline,
  TimelineSkeleton,
  meetingHref,
  useAgendaRefresh,
  useScrolled,
  useSelection,
  useTimelineKeys,
} from "./agenda-timeline"
import type { CardSection } from "./event-card"

export const REVIEW_LOAD_ERROR = "Couldn't load meetings to review."
export const LEAVE_BEAT_MS = 500
export const LEAVE_COLLAPSE_MS = 220

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function pendingItems(meetings: AgendaMeeting[]): number {
  return meetings.reduce((total, meeting) => total + meeting.pendingCount, 0)
}

export function reviewSubtitle(pending: number): string {
  if (pending === 0) return "All caught up"
  return pending === 1 ? "1 item needs a look" : `${pending} items need a look`
}

export function reviewDayLabel(meeting: AgendaMeeting, now: Date = new Date()): string {
  const day = new Date(meeting.startedAtUtc)
  if (isSameDay(day, now)) return "Today"
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (isSameDay(day, yesterday)) return "Yesterday"
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  return day >= weekAgo ? WEEKDAYS[day.getDay()] : `${MONTHS[day.getMonth()]} ${day.getDate()}`
}

function keepLeavingInPlace(current: AgendaMeeting[], next: AgendaMeeting[], gone: ReadonlySet<string>): AgendaMeeting[] {
  const nextById = new Map(next.map((meeting) => [meeting.id, meeting]))
  const known = new Set(current.map((meeting) => meeting.id))
  const merged = current.flatMap((meeting) => {
    if (gone.has(meeting.id)) return [meeting]
    const updated = nextById.get(meeting.id)
    return updated ? [updated] : []
  })
  return [...merged, ...next.filter((meeting) => !known.has(meeting.id))]
}

function useReviewList() {
  const [meetings, setMeetings] = useState<AgendaMeeting[] | null>(null)
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)
  const current = useRef<AgendaMeeting[]>([])

  const show = useCallback((next: AgendaMeeting[]) => {
    const kept = new Set(next.map((meeting) => meeting.id))
    const gone = new Set(current.current.filter((meeting) => !kept.has(meeting.id)).map((meeting) => meeting.id))
    const shown = gone.size === 0 ? next : keepLeavingInPlace(current.current, next, gone)
    current.current = shown
    setMeetings(shown)
    setLeaving(gone)
    if (gone.size === 0) return
    window.setTimeout(() => {
      current.current = current.current.filter((meeting) => !gone.has(meeting.id) || kept.has(meeting.id))
      setMeetings(current.current)
      setLeaving(new Set())
    }, LEAVE_BEAT_MS + LEAVE_COLLAPSE_MS)
  }, [])

  const load = useCallback(() => {
    const request = ++latest.current
    listReviewMeetings()
      .then((next) => {
        if (request !== latest.current) return
        setFailed(false)
        show(next)
      })
      .catch((error: unknown) => {
        console.error("Failed to load meetings to review:", error)
        if (request !== latest.current) return
        setFailed(true)
        toast.error(REVIEW_LOAD_ERROR, { action: { label: "Try again", onClick: () => load() } })
      })
  }, [show])

  useAgendaRefresh(load)
  return { meetings, leaving, failed, reload: load }
}

function ReviewSection({ count, children }: { count: number; children: ReactNode }) {
  return (
    <section aria-labelledby="to-review-heading" className="pt-1.5">
      <div className="mb-2.5 ml-[58px] flex items-baseline gap-2">
        <h2 id="to-review-heading" className="m-0 whitespace-nowrap text-[15px] font-semibold tracking-[-0.008em] text-label">
          To review
        </h2>
        <span className="min-w-0 truncate text-[12px] text-label-3">
          {count === 1 ? "1 item" : `${count} items`} · accept, correct or reject what Telu found
        </span>
      </div>
      {children}
    </section>
  )
}

export function ReviewView() {
  const router = useRouter()
  const recording = useRecordingState()
  const { meetings, leaving, failed, reload } = useReviewList()
  const finalization = useRecordingControlsContext()?.finalization ?? null
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLDivElement>())
  const rows = useMemo(() => meetings ?? [], [meetings])
  const active = useMemo(() => rows.filter((meeting) => !leaving.has(meeting.id)), [rows, leaving])
  const { selectedId, setSelectedId, move } = useSelection(active, optionRefs, listRef)
  const { peek, closeInstant, openPeek, closePeek } = usePeek(selectedId)
  const { scrolled, onScroll } = useScrolled(scrollRef)
  const pending = pendingItems(active)

  const open = useCallback(
    (meeting: AgendaMeeting, section?: CardSection) => {
      setSelectedId(meeting.id)
      if (section === "knowledge" && meeting.cardState === "no_knowledge") {
        router.push(meetingHref(meeting, "Review", section))
        return
      }
      openPeek(meeting.id, { instant: false, focusKnowledge: true })
    },
    [openPeek, router, setSelectedId]
  )
  const openSelected = useCallback(() => {
    if (selectedId && active.some((candidate) => candidate.id === selectedId)) openPeek(selectedId, { instant: true, focusKnowledge: true })
  }, [active, selectedId, openPeek])
  useTimelineKeys({ listRef, onMove: move, onEnter: openSelected })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgendaToolbar origin="Review" title="Review" subtitle={meetings === null ? "" : reviewSubtitle(pending)} scrolled={scrolled} />
      <div ref={scrollRef} onScroll={onScroll} className="@container min-h-0 flex-1 overflow-y-auto pt-[52px]">
        <div ref={listRef} className={cn("px-5 pb-[72px] pt-1.5 @[901px]:px-7", peek && PEEK_PADDING_CLASS)}>
          {meetings === null && !failed && <TimelineSkeleton />}
          {meetings === null && failed && (
            <div className="flex flex-col items-center gap-2 py-10 text-label-2">
              <p className="m-0">{REVIEW_LOAD_ERROR}</p>
              <Button size="sm" onClick={reload}>
                Try again
              </Button>
            </div>
          )}
          {meetings !== null && rows.length === 0 && (
            <EmptyState
              icon={CircleCheck}
              title="All caught up"
              body="Nothing is waiting for a decision. New items appear here after Telu reads a meeting."
            />
          )}
          {rows.length > 0 && (
            <ReviewSection count={pending}>
              <Timeline
                label="To review"
                meetings={rows}
                leaving={leaving}
                dayLabel={(meeting) => reviewDayLabel(meeting)}
                selectedId={selectedId}
                finalization={finalization}
                recordingSeconds={recording.activeDuration ?? recording.recordingDuration ?? null}
                optionRefs={optionRefs}
                onOpen={open}
              onOpenPage={(meeting) => router.push(meetingHref(meeting, "Review"))}
              />
            </ReviewSection>
          )}
        </div>
      </div>
      <PeekLayer peek={peek} closeInstant={closeInstant} origin="Review" onClose={closePeek} />
    </div>
  )
}
