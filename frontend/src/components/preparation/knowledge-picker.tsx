"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { getMeetingKnowledge, type KnowledgeItemView, type KnowledgeType } from "@/lib/knowledge-service"
import type { SelectedSource } from "@/lib/preparation-service"
import { storageService } from "@/services/storageService"
import { cn } from "@/lib/utils"

const PICKABLE_TYPES: Partial<Record<KnowledgeType, string>> = {
  decision: "Decision",
  commitment: "Commitment",
  question: "Open question",
}
const NOT_ELIGIBLE_TOAST = "That item can no longer be included. The list has been refreshed."
const MEETINGS_ERROR = "Couldn't load past meetings."
const ITEMS_ERROR = "Couldn't load what this meeting found."
const NOTHING_ELIGIBLE = "No accepted decisions, commitments or open questions."

type MeetingItems = KnowledgeItemView[] | "loading" | "error"

interface PastMeeting {
  id: string
  title: string
  date: string
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

async function loadEligible(meetingId: string): Promise<MeetingItems> {
  try {
    const view = await getMeetingKnowledge(meetingId)
    return view.items.filter((item) => item.eligibility)
  } catch {
    console.error("Failed to load meeting knowledge")
    return "error"
  }
}

const sameItem = (source: SelectedSource, meetingId: string, itemId: string) =>
  source.kind === "knowledge" && source.meetingId === meetingId && source.itemId === itemId

interface KnowledgePickerProps {
  selection: SelectedSource[]
  select: (change: (current: SelectedSource[]) => SelectedSource[]) => Promise<string | null>
  onError: (code: string) => void
}

export function KnowledgePicker({ selection, select, onError }: KnowledgePickerProps) {
  const [meetings, setMeetings] = useState<PastMeeting[] | null>(null)
  const [meetingsError, setMeetingsError] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, MeetingItems>>({})

  useEffect(() => {
    storageService
      .getMeetings()
      .then((listed) => setMeetings(listed.map((meeting) => ({ id: meeting.id, title: meeting.title, date: shortDate(meeting.created_at) }))))
      .catch(() => {
        console.error("Failed to load past meetings")
        setMeetingsError(true)
      })
  }, [])

  const load = async (meetingId: string) => {
    const items = await loadEligible(meetingId)
    setExpanded((current) => (meetingId in current ? { ...current, [meetingId]: items } : current))
    return items
  }

  const toggleMeeting = (meetingId: string) => {
    if (meetingId in expanded) {
      setExpanded((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== meetingId)))
      return
    }
    setExpanded((current) => ({ ...current, [meetingId]: "loading" }))
    load(meetingId)
  }

  const refreshAndPrune = async () => {
    const meetingIds = new Set([
      ...Object.keys(expanded),
      ...selection.flatMap((source) => (source.kind === "knowledge" ? [source.meetingId] : [])),
    ])
    const loaded = await Promise.all([...meetingIds].map(async (meetingId) => [meetingId, await load(meetingId)] as const))
    const eligible = new Map(
      loaded.flatMap(([meetingId, items]) => (Array.isArray(items) ? [[meetingId, items] as const] : []))
    )
    const stillEligible = (source: SelectedSource) =>
      source.kind !== "knowledge" ||
      !eligible.has(source.meetingId) ||
      eligible.get(source.meetingId)!.some((item) => item.itemId === source.itemId)
    if (selection.every(stillEligible)) return
    const code = await select((current) => current.filter(stillEligible))
    if (code) onError(code)
  }

  const toggleItem = async (meetingId: string, itemId: string) => {
    const code = await select((current) =>
      current.some((source) => sameItem(source, meetingId, itemId))
        ? current.filter((source) => !sameItem(source, meetingId, itemId))
        : [...current, { kind: "knowledge", meetingId, itemId }]
    )
    if (code === "SOURCE_NOT_ELIGIBLE") {
      toast.error(NOT_ELIGIBLE_TOAST)
      await refreshAndPrune()
    } else if (code) {
      onError(code)
    }
  }

  return (
    <section aria-labelledby="planned-knowledge-heading" className="mt-11">
      <h2 id="planned-knowledge-heading" className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-label-3">
        From past meetings
      </h2>
      {meetingsError && (
        <p role="alert" className="m-0 mb-2 text-[12px] text-coral-ink">
          {MEETINGS_ERROR}
        </p>
      )}
      {meetings?.length === 0 && (
        <p className="m-0 rounded-[12px] bg-surface-sunken px-3.5 py-3 text-[12px] text-label-2">
          No past meetings yet. What you accept after a meeting can be included here.
        </p>
      )}
      {meetings && meetings.length > 0 && (
        <ul className="m-0 list-none space-y-0.5 p-0">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <button
                type="button"
                aria-expanded={meeting.id in expanded}
                onClick={() => toggleMeeting(meeting.id)}
                className="flex h-[38px] w-full items-center gap-2 rounded-[10px] px-1.5 text-left text-[13px] outline-none hover:bg-fill focus-visible:shadow-[0_0_0_2px_var(--accent)]"
              >
                <ChevronRight
                  aria-hidden
                  className={cn("size-3.5 flex-none text-label-3 transition-transform duration-150", meeting.id in expanded && "rotate-90")}
                />
                <span className="flex-none font-semibold tabular-nums text-label">{meeting.date}</span>
                <span className="min-w-0 truncate text-label-2">{meeting.title}</span>
              </button>
              {meeting.id in expanded && (
                <MeetingItemsList
                  meetingId={meeting.id}
                  date={meeting.date}
                  items={expanded[meeting.id]}
                  selection={selection}
                  onToggle={toggleItem}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface MeetingItemsListProps {
  meetingId: string
  date: string
  items: MeetingItems
  selection: SelectedSource[]
  onToggle: (meetingId: string, itemId: string) => void
}

function MeetingItemsList({ meetingId, date, items, selection, onToggle }: MeetingItemsListProps) {
  if (items === "loading") return <p className="m-0 py-2 pl-[29px] text-[12px] text-label-3">Loading…</p>
  if (items === "error") return <p className="m-0 py-2 pl-[29px] text-[12px] text-coral-ink">{ITEMS_ERROR}</p>
  const pickable = items.filter((item) => PICKABLE_TYPES[item.itemType])
  if (pickable.length === 0) return <p className="m-0 py-2 pl-[29px] text-[12px] text-label-3">{NOTHING_ELIGIBLE}</p>

  return (
    <ul className="m-0 mb-2 list-none space-y-1 py-1 pl-[29px]">
      {pickable.map((item) => {
        const included = selection.some((source) => sameItem(source, meetingId, item.itemId))
        return (
          <li key={item.itemId} data-knowledge-item="" className="flex items-center gap-2.5 rounded-[9px] bg-fill px-2.5 py-1.5 text-[12px]">
            <span className="min-w-0 flex-1">
              <span className="block text-label">{item.text}</span>
              <span className="block tabular-nums text-[11px] text-label-3">
                {PICKABLE_TYPES[item.itemType]} · {date}
              </span>
            </span>
            <button
              type="button"
              aria-pressed={included}
              aria-label={included ? `Included in the brief: ${item.text}` : `Not included in the brief: ${item.text}`}
              onClick={() => onToggle(meetingId, item.itemId)}
              className="grid size-6 flex-none place-items-center rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
            >
              <span
                aria-hidden
                className={cn(
                  "size-[7px] rounded-full transition-[background-color,box-shadow] duration-150",
                  included ? "bg-accent" : "shadow-[inset_0_0_0_1.3px_var(--label-3)]"
                )}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
