"use client"

import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlassGroup } from "@/components/telu-ui/glass-group"
import type { AgendaOrigin } from "@/components/agenda/agenda-timeline"
import { RecordSlot } from "./recording-capsule"
import { SearchPopover } from "./search-popover"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export interface DayHeading {
  title: string
  subtitle: string
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function isSameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime()
}

export function weekdayName(date: Date): string {
  return WEEKDAYS[date.getDay()]
}

export function dayHeading(day: Date, now: Date = new Date()): DayHeading {
  const long = `${weekdayName(day)}, ${day.getDate()} ${MONTHS[day.getMonth()]}`
  if (isSameDay(day, now)) return { title: "Today", subtitle: long }
  if (isSameDay(day, addDays(now, -1))) return { title: "Yesterday", subtitle: long }
  return { title: weekdayName(day), subtitle: `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}` }
}

interface DayStepperProps {
  isToday: boolean
  onStep: (direction: -1 | 1) => void
  onToday: () => void
}

export function DayStepper({ isToday, onStep, onToday }: DayStepperProps) {
  return (
    <GlassGroup aria-label="Day">
      <Button variant="plain" icon aria-label="Previous day" onClick={() => onStep(-1)}>
        <ChevronLeft aria-hidden />
      </Button>
      <Button variant="plain" onClick={onToday}>
        Today
      </Button>
      <Button variant="plain" icon aria-label="Next day" disabled={isToday} onClick={() => onStep(1)}>
        <ChevronRight aria-hidden />
      </Button>
    </GlassGroup>
  )
}

interface AgendaToolbarProps {
  title: string
  subtitle?: string
  scrolled: boolean
  origin: AgendaOrigin
  children?: ReactNode
}

export function AgendaToolbar({ title, subtitle, scrolled, origin, children }: AgendaToolbarProps) {
  return (
    <header
      data-tauri-drag-region
      data-scrolled={scrolled || undefined}
      className="absolute inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2 pl-[18px] pr-3 transition-[background-color,box-shadow] duration-200 data-[scrolled]:bg-[color:color-mix(in_srgb,var(--content-bg)_76%,transparent)] data-[scrolled]:shadow-[0_0.5px_0_var(--separator)] data-[scrolled]:backdrop-blur-[18px] data-[scrolled]:backdrop-saturate-[1.6]"
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-col justify-center leading-[1.15]">
        <h1 data-tauri-drag-region aria-live="polite" className="m-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-label">
          {title}
        </h1>
        {subtitle && (
          <p data-tauri-drag-region className="m-0 truncate text-[11px] text-label-2">
            {subtitle}
          </p>
        )}
      </div>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      {children}
      <RecordSlot>
        <SearchPopover origin={origin} />
      </RecordSlot>
    </header>
  )
}
