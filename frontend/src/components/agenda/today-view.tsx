"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Lock } from "lucide-react"
import { toast } from "sonner"

import {
  AgendaToolbar,
  DayStepper,
  addDays,
  dayHeading,
  isSameDay,
  startOfDay,
  weekdayName,
} from "@/components/app-shell/agenda-toolbar"
import { useRecordingControlsContext } from "@/components/app-shell/recording-host"
import { clock } from "@/components/living-doc/meeting-header"
import { EmptyState } from "@/components/telu-ui/empty-state"
import { Skeleton } from "@/components/telu-ui/indicators"
import { Button } from "@/components/ui/button"
import { useRecordingState } from "@/contexts/RecordingStateContext"
import { listAgendaDay, localDayBounds, type AgendaMeeting } from "@/lib/agenda-service"
import { onKnowledgeUpdated } from "@/lib/knowledge-service"
import { MEETINGS_CHANGED_EVENT } from "@/lib/meeting-deletion-service"
import { DURATION, EASE, cssEase } from "@/lib/motion"
import type { FinalizationProgressSnapshot } from "@/services/transcriptService"
import { EventCard, type CardSection } from "./event-card"

const LOAD_ERROR = "Couldn't load today's meetings."
const SLIDE_PX = 16
const SLIDE_EASING = cssEase(EASE.out)

interface ShownDay {
  day: Date
  meetings: AgendaMeeting[]
}

function byStart(meetings: AgendaMeeting[]): AgendaMeeting[] {
  return [...meetings].sort((left, right) => Date.parse(left.startedAtUtc) - Date.parse(right.startedAtUtc))
}

function useAgendaDay(day: Date | null) {
  const { status } = useRecordingState()
  const [shown, setShown] = useState<ShownDay | null>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)

  const load = useCallback(() => {
    if (!day) return
    const request = ++latest.current
    const { fromUtc, toUtc } = localDayBounds(day)
    listAgendaDay(fromUtc, toUtc)
      .then((meetings) => {
        if (request !== latest.current) return
        setShown({ day, meetings: byStart(meetings) })
        setFailed(false)
      })
      .catch((error: unknown) => {
        console.error("Failed to load agenda day:", error)
        if (request !== latest.current) return
        setFailed(true)
        toast.error(LOAD_ERROR, { action: { label: "Try again", onClick: () => load() } })
      })
  }, [day])

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

  return { shown, failed, reload: load }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function useDaySlide(listRef: RefObject<HTMLDivElement>, shown: ShownDay | null) {
  const pending = useRef<{ direction: number; out: Animation | null } | null>(null)

  const slideOut = useCallback(
    (direction: number) => {
      pending.current?.out?.cancel()
      pending.current = null
      if (prefersReducedMotion() || !listRef.current?.animate) return
      const out = listRef.current.animate(
        [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: `translateX(${-SLIDE_PX * direction}px)` }],
        { duration: DURATION.dayStepOut * 1000, easing: SLIDE_EASING, fill: "forwards" }
      )
      pending.current = { direction, out }
    },
    [listRef]
  )

  const cancelSlide = useCallback(() => {
    pending.current?.out?.cancel()
    pending.current = null
  }, [])

  useSlideEffect(() => {
    const slide = pending.current
    if (!slide) return
    pending.current = null
    slide.out?.cancel()
    listRef.current?.animate(
      [{ opacity: 0, transform: `translateX(${SLIDE_PX * slide.direction}px)` }, { opacity: 1, transform: "translateX(0)" }],
      { duration: DURATION.dayStepIn * 1000, easing: SLIDE_EASING }
    )
  }, [listRef, shown])

  return { slideOut, cancelSlide }
}

const useSlideEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

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
  onStep: (direction: -1 | 1) => void
  onMove: (delta: -1 | 1) => void
  onEnter: () => void
}

function useTimelineKeys({ listRef, onStep, onMove, onEnter }: TimelineKeys) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (!isTimelineTarget(event.target, listRef.current)) return
      if (event.key === "Enter" && asElement(event.target)?.tagName === "BUTTON") return
      const actions: Record<string, () => void> = {
        ArrowLeft: () => onStep(-1),
        ArrowRight: () => onStep(1),
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

function TimelineSkeleton() {
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

function DayEmpty({ day, isToday }: { day: Date; isToday: boolean }) {
  if (isToday) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No meetings recorded today"
        body="Press Record or ⌘R to start one. Recordings stay on this Mac."
        footnote={
          <>
            <Lock aria-hidden className="size-3" strokeWidth={1.8} />
            Stored on this Mac
          </>
        }
      />
    )
  }
  return (
    <EmptyState
      icon={CalendarDays}
      title={`No meetings recorded on ${weekdayName(day)}`}
      body="Use ‹ and › to step through days, or search with ⌘F."
    />
  )
}

function TimeColumn({ meeting }: { meeting: AgendaMeeting }) {
  return (
    <div className="flex flex-col items-end whitespace-nowrap pt-[11px] leading-[1.25]">
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
}

function Timeline({ label, meetings, selectedId, finalization, recordingSeconds, optionRefs, onOpen }: TimelineProps) {
  const focusId = selectedId ?? meetings[0]?.id
  return (
    <div role="listbox" aria-label={label} className="flex flex-col gap-2">
      {meetings.map((meeting) => (
        <div key={meeting.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3.5">
          <TimeColumn meeting={meeting} />
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
          />
        </div>
      ))}
    </div>
  )
}

function meetingHref(meeting: AgendaMeeting, section?: CardSection): string {
  const query = `/meeting-details?id=${encodeURIComponent(meeting.id)}&from=Today`
  return section ? `${query}#${section}` : query
}

function useSelection(meetings: AgendaMeeting[], optionRefs: RefObject<Map<string, HTMLDivElement>>, listRef: RefObject<HTMLDivElement>) {
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

function useScrolled(scrollRef: RefObject<HTMLDivElement>) {
  const [scrolled, setScrolled] = useState(false)
  const onScroll = useCallback(() => setScrolled((scrollRef.current?.scrollTop ?? 0) > 2), [scrollRef])
  return { scrolled, onScroll }
}

export function TodayView({ notice }: { notice?: ReactNode }) {
  const router = useRouter()
  const recording = useRecordingState()
  const [requestedDay, setRequestedDay] = useState<Date | null>(null)
  const { shown, failed, reload } = useAgendaDay(requestedDay)
  const finalization = useRecordingControlsContext()?.finalization ?? null
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLDivElement>())
  const meetings = useMemo(() => shown?.meetings ?? [], [shown])
  const { selectedId, setSelectedId, move } = useSelection(meetings, optionRefs, listRef)
  const { slideOut, cancelSlide } = useDaySlide(listRef, shown)
  const { scrolled, onScroll } = useScrolled(scrollRef)
  const isToday = requestedDay === null || isSameDay(requestedDay, new Date())
  const headingDay = shown?.day ?? requestedDay
  const heading = headingDay ? dayHeading(headingDay) : { title: "Today", subtitle: "" }

  useEffect(() => {
    setRequestedDay(startOfDay(new Date()))
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [shown?.day])

  const goToDay = useCallback(
    (target: Date, animated: boolean) => {
      const next = startOfDay(target)
      if (!requestedDay || next.getTime() > startOfDay(new Date()).getTime() || next.getTime() === requestedDay.getTime()) return
      if (animated) slideOut(next.getTime() > requestedDay.getTime() ? 1 : -1)
      else cancelSlide()
      setRequestedDay(next)
    },
    [requestedDay, slideOut, cancelSlide]
  )

  const open = useCallback(
    (meeting: AgendaMeeting, section?: CardSection) => {
      setSelectedId(meeting.id)
      router.push(meetingHref(meeting, section))
    },
    [router, setSelectedId]
  )

  const openSelected = useCallback(() => {
    const meeting = meetings.find((candidate) => candidate.id === selectedId)
    if (meeting) open(meeting)
  }, [meetings, selectedId, open])

  useTimelineKeys({
    listRef,
    onStep: (direction) => requestedDay && goToDay(addDays(requestedDay, direction), false),
    onMove: move,
    onEnter: openSelected,
  })

  const recordingSeconds = recording.activeDuration ?? recording.recordingDuration ?? null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgendaToolbar title={heading.title} subtitle={heading.subtitle} scrolled={scrolled}>
        <DayStepper
          isToday={isToday}
          onStep={(direction) => requestedDay && goToDay(addDays(requestedDay, direction), true)}
          onToday={() => goToDay(new Date(), true)}
        />
      </AgendaToolbar>
      <div ref={scrollRef} onScroll={onScroll} className="@container min-h-0 flex-1 overflow-y-auto pt-[52px]">
        {notice && <div className="px-5 pt-1.5 @[901px]:px-7">{notice}</div>}
        <div ref={listRef} className="px-5 pb-[72px] pt-1.5 @[901px]:px-7">
          {shown === null && !failed && <TimelineSkeleton />}
          {shown === null && failed && (
            <div className="flex flex-col items-center gap-2 py-10 text-label-2">
              <p className="m-0">{LOAD_ERROR}</p>
              <Button size="sm" onClick={reload}>
                Try again
              </Button>
            </div>
          )}
          {shown !== null && meetings.length === 0 && <DayEmpty day={shown.day} isToday={isSameDay(shown.day, new Date())} />}
          {shown !== null && meetings.length > 0 && (
            <Timeline
              label={`${heading.title}, ${heading.subtitle}`}
              meetings={meetings}
              selectedId={selectedId}
              finalization={finalization}
              recordingSeconds={recordingSeconds}
              optionRefs={optionRefs}
              onOpen={open}
            />
          )}
        </div>
      </div>
    </div>
  )
}
