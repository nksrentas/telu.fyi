"use client"

import type { ReactNode } from "react"
import { Lock } from "lucide-react"

import { MeetingCompleteness } from "@/components/MeetingCompleteness"
import { cn } from "@/lib/utils"
import type { MeetingCompleteness as MeetingCompletenessValue, MeetingLifecycle } from "@/types"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export interface MeetingHeaderMeeting {
  title: string
  createdAt: string
  durationSeconds: number | null
  lifecycle: MeetingLifecycle
  completeness: MeetingCompletenessValue
  gapCount?: number
}

interface MeetingHeaderProps {
  meeting: MeetingHeaderMeeting
  surface: "page" | "peek"
}

export function clock(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}

export function formatMeetingDay(createdAt: string): string | null {
  const start = new Date(createdAt)
  if (Number.isNaN(start.getTime())) return null
  return `${WEEKDAYS[start.getDay()]} ${start.getDate()} ${MONTHS[start.getMonth()]}`
}

export function formatMeetingWhen(createdAt: string, durationSeconds: number | null): string | null {
  const start = new Date(createdAt)
  const day = formatMeetingDay(createdAt)
  if (day === null) return null
  if (durationSeconds === null) return `${day} · ${clock(start)}`
  const end = new Date(start.getTime() + durationSeconds * 1000)
  return `${day} · ${clock(start)}–${clock(end)}`
}

export function formatMeetingDuration(durationSeconds: number | null): string | null {
  if (durationSeconds === null) return null
  return `${Math.max(1, Math.round(durationSeconds / 60))} min`
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-fill px-2.5 text-[12px] text-label-2">
      {children}
    </span>
  )
}

export function MeetingHeader({ meeting, surface }: MeetingHeaderProps) {
  const when = formatMeetingWhen(meeting.createdAt, meeting.durationSeconds)
  const duration = formatMeetingDuration(meeting.durationSeconds)
  const Title = surface === "page" ? "h1" : "h2"

  return (
    <header data-slot="meeting-header" className="space-y-3">
      <Title
        data-doc-title
        className={cn(
          "selectable m-0 min-w-0 break-words font-display text-label",
          surface === "page" ? "text-large" : "text-title1"
        )}
      >
        {meeting.title}
      </Title>
      <div className="flex flex-wrap items-center gap-1.5">
        {when && <MetaChip><span className="tabular-nums">{when}</span></MetaChip>}
        {duration && <MetaChip><span className="tabular-nums">{duration}</span></MetaChip>}
        {meeting.completeness !== "complete" && (
          <MeetingCompleteness
            lifecycle={meeting.lifecycle}
            completeness={meeting.completeness}
            gapCount={meeting.gapCount}
            variant="compact"
          />
        )}
        <MetaChip>
          <Lock className="size-3" aria-hidden />
          Stored on this Mac
        </MetaChip>
      </div>
    </header>
  )
}
