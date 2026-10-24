"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"

import { clock, formatMeetingDay } from "@/components/living-doc/meeting-header"
import { GlassGroup } from "@/components/telu-ui/glass-group"
import { Button } from "@/components/ui/button"
import { localDayBounds } from "@/lib/agenda-service"
import {
  createPlannedMeeting,
  listUpcomingPlanned,
  PLANNED_MEETINGS_CHANGED_EVENT,
  planningErrorMessage,
  planningHref,
  type PlannedMeeting,
} from "@/lib/planning-service"

const NEW_MEETING_TITLE = "New meeting"
const CREATE_ERROR = "Couldn't plan a meeting."
const LIST_ERROR = "Couldn't load planned meetings."

export function usePlannedMeetings() {
  const [planned, setPlanned] = useState<PlannedMeeting[]>([])

  useEffect(() => {
    let active = true
    const load = () =>
      listUpcomingPlanned(localDayBounds(new Date()).fromUtc)
        .then((meetings) => active && setPlanned(meetings))
        .catch((error: unknown) => {
          console.error("Failed to load planned meetings:", error)
          if (active) toast.error(LIST_ERROR)
        })
    void load()
    window.addEventListener(PLANNED_MEETINGS_CHANGED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(PLANNED_MEETINGS_CHANGED_EVENT, load)
    }
  }, [])

  return planned
}

export function PlanMeetingButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const plan = useCallback(() => {
    setCreating(true)
    createPlannedMeeting({ title: NEW_MEETING_TITLE, startUtc: null, purpose: "" })
      .then((meeting) => router.push(planningHref(meeting.id)))
      .catch((error: unknown) => {
        console.error("Failed to plan a meeting:", error)
        setCreating(false)
        toast.error(planningErrorMessage(error, CREATE_ERROR))
      })
  }, [router])

  return (
    <GlassGroup aria-label="Plan">
      <Button variant="plain" disabled={creating} onClick={plan}>
        <Plus aria-hidden />
        Plan a meeting
      </Button>
    </GlassGroup>
  )
}

function plannedWhen(startUtc: string | null): string {
  if (!startUtc) return "No date yet"
  return `${formatMeetingDay(startUtc)} · ${clock(new Date(startUtc))}`
}

export function PlannedMeetings({ meetings }: { meetings: PlannedMeeting[] }) {
  const router = useRouter()
  if (meetings.length === 0) return null

  return (
    <section aria-labelledby="planned-heading" className="mt-7">
      <h2 id="planned-heading" className="m-0 mb-2 pl-[58px] text-[11px] font-semibold uppercase tracking-[0.07em] text-label-3">
        Planned
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {meetings.map((meeting) => (
          <li key={meeting.id} className="pl-[58px]">
            <button
              type="button"
              onClick={() => router.push(planningHref(meeting.id))}
              className="flex w-full items-center gap-3 rounded-[12px] bg-surface py-3 pl-[21px] pr-[14px] text-left shadow-card transition-transform duration-150 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-label">{meeting.title}</span>
                <span className="block text-[12px] tabular-nums text-label-2">{plannedWhen(meeting.startUtc)}</span>
              </span>
              <ChevronRight className="size-3.5 text-label-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
