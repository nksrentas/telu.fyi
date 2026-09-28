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
import { PEEK_PADDING_CLASS, PeekLayer, usePeek } from "@/components/side-peek/side-peek"
import { EmptyState } from "@/components/telu-ui/empty-state"
import { Button } from "@/components/ui/button"
import { useRecordingState } from "@/contexts/RecordingStateContext"
import { listAgendaDay, localDayBounds, type AgendaMeeting } from "@/lib/agenda-service"
import { DURATION, EASE, cssEase } from "@/lib/motion"
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

  useAgendaRefresh(load)
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
  const { peek, closeInstant, openPeek, closePeek } = usePeek(selectedId)
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
      if (section === "knowledge" && meeting.cardState === "no_knowledge") {
        router.push(meetingHref(meeting, "Today", section))
        return
      }
      openPeek(meeting.id, { instant: false, focusKnowledge: section === "knowledge" })
    },
    [openPeek, router, setSelectedId]
  )

  const openSelected = useCallback(() => {
    if (selectedId && meetings.some((candidate) => candidate.id === selectedId)) openPeek(selectedId, { instant: true })
  }, [meetings, selectedId, openPeek])

  useTimelineKeys({
    listRef,
    onStep: (direction) => requestedDay && goToDay(addDays(requestedDay, direction), false),
    onMove: move,
    onEnter: openSelected,
  })

  const recordingSeconds = recording.activeDuration ?? recording.recordingDuration ?? null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgendaToolbar origin="Today" title={heading.title} subtitle={heading.subtitle} scrolled={scrolled}>
        <DayStepper
          isToday={isToday}
          onStep={(direction) => requestedDay && goToDay(addDays(requestedDay, direction), true)}
          onToday={() => goToDay(new Date(), true)}
        />
      </AgendaToolbar>
      <div ref={scrollRef} onScroll={onScroll} className="@container min-h-0 flex-1 overflow-y-auto pt-[52px]">
        {notice && <div className="px-5 pt-1.5 @[901px]:px-7">{notice}</div>}
        <div ref={listRef} className={cn("px-5 pb-[72px] pt-1.5 @[901px]:px-7", peek && PEEK_PADDING_CLASS)}>
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
              onOpenPage={(meeting) => router.push(meetingHref(meeting, "Today"))}
            />
          )}
        </div>
      </div>
      <PeekLayer peek={peek} closeInstant={closeInstant} origin="Today" onClose={closePeek} />
    </div>
  )
}
