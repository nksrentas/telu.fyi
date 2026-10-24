"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronLeft, Lock, X } from "lucide-react"
import { toast } from "sonner"

import { SourcesPanel } from "@/components/preparation/sources-panel"
import { Button } from "@/components/ui/button"
import {
  getPlannedMeeting,
  planningErrorMessage,
  updatePlannedMeeting,
  type PlannedMeeting,
  type PlannedMeetingDraft,
} from "@/lib/planning-service"
import { cn } from "@/lib/utils"

const AUTOSAVE_DELAY_MS = 700
const LOAD_ERROR = "Couldn't open this meeting."
const SAVE_ERROR = "Couldn't save this meeting."
const TITLE_REQUIRED = "Give the meeting a title."
const EDITABLE =
  "-mx-[7px] w-[calc(100%+14px)] rounded-[7px] bg-transparent px-[7px] py-[3px] text-label outline-none transition-[background-color,box-shadow] duration-150 placeholder:text-label-3 [@media(hover:hover)]:hover:bg-fill focus:bg-accent-softer focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)] [@media(hover:hover)]:focus:bg-accent-softer"

type SaveStatus = "idle" | "saving" | "saved"

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}

function toLocalInput(startUtc: string | null): string {
  if (!startUtc) return ""
  const date = new Date(startUtc)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function useAutosave(meeting: PlannedMeeting) {
  const [draft, setDraft] = useState<PlannedMeetingDraft>({
    title: meeting.title,
    startUtc: meeting.startUtc,
    purpose: meeting.purpose,
  })
  const [status, setStatus] = useState<SaveStatus>("idle")
  const latest = useRef(draft)
  const savedTitle = useRef(meeting.title)
  const edits = useRef({ made: 0, queued: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const save = useCallback(() => {
    const version = edits.current.made
    if (version === edits.current.queued) return
    edits.current.queued = version
    const next = { ...latest.current, title: latest.current.title.trim() ? latest.current.title : savedTitle.current }
    queue.current = queue.current.then(() =>
      updatePlannedMeeting(meeting.id, next)
        .then(() => {
          if (version === edits.current.made) setStatus("saved")
        })
        .catch((error: unknown) => {
          console.error("Failed to save planned meeting:", error)
          if (version === edits.current.queued) edits.current.queued = -1
          setStatus("idle")
          toast.error(planningErrorMessage(error, SAVE_ERROR))
        })
    )
  }, [meeting.id])

  const change = useCallback(
    (patch: Partial<PlannedMeetingDraft>) => {
      const next = { ...latest.current, ...patch }
      latest.current = next
      edits.current.made += 1
      setDraft(next)
      if (timer.current) clearTimeout(timer.current)
      if (!next.title.trim()) {
        setStatus("idle")
        return
      }
      savedTitle.current = next.title
      setStatus("saving")
      timer.current = setTimeout(save, AUTOSAVE_DELAY_MS)
    },
    [save]
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      save()
    },
    [save]
  )

  return { draft, status, change }
}

const CHIP = "inline-flex h-6 items-center gap-1.5 rounded-full bg-fill text-[12px] text-label-2"
const FOCUS_RING = "outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"

function DateChip({ startUtc, onChange }: { startUtc: string | null; onChange: (startUtc: string | null) => void }) {
  const [adding, setAdding] = useState(false)

  if (!startUtc && !adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className={cn(CHIP, FOCUS_RING, "px-2.5 hover:bg-fill-2 active:scale-[0.97]")}>
        <CalendarDays className="size-3" aria-hidden />
        Add date
      </button>
    )
  }

  return (
    <span className={cn(CHIP, "pl-2.5 pr-1")}>
      <CalendarDays className="size-3" aria-hidden />
      <input
        type="datetime-local"
        aria-label="Date and time"
        autoFocus={adding}
        value={toLocalInput(startUtc)}
        onChange={(event) => onChange(fromLocalInput(event.target.value))}
        className={cn(FOCUS_RING, "rounded-[4px] bg-transparent tabular-nums text-label-2")}
      />
      <button
        type="button"
        aria-label="Remove date"
        onClick={() => {
          setAdding(false)
          onChange(null)
        }}
        className={cn(FOCUS_RING, "grid size-6 place-items-center rounded-full text-label-3 hover:text-label-2")}
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span aria-live="polite" className={cn("text-[12px]", status === "saving" ? "text-label-2" : "text-label-3")}>
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved"}
    </span>
  )
}

function PlannedMeetingDoc({ meeting, onBack }: { meeting: PlannedMeeting; onBack: () => void }) {
  const { draft, status, change } = useAutosave(meeting)
  const titleMissing = !draft.title.trim()

  return (
    <>
      <PreparationToolbar onBack={onBack}>
        <SaveIndicator status={status} />
      </PreparationToolbar>
      <main className="min-h-0 flex-1 overflow-y-auto pt-[52px]">
        <div className="mx-auto w-[min(720px,calc(100%-112px))] pb-[160px] pt-[30px]">
          <header className="space-y-3">
            <h1 className="m-0">
              <input
                aria-label="Meeting title"
                aria-invalid={titleMissing}
                aria-describedby={titleMissing ? "planned-title-error" : undefined}
                value={draft.title}
                placeholder="Name this meeting"
                onChange={(event) => change({ title: event.target.value })}
                className={cn(EDITABLE, "font-display text-large")}
              />
            </h1>
            {titleMissing && (
              <p id="planned-title-error" role="alert" className="m-0 text-[12px] text-coral-ink">
                {TITLE_REQUIRED}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <DateChip startUtc={draft.startUtc} onChange={(startUtc) => change({ startUtc })} />
              <span className={cn(CHIP, "px-2.5")}>
                <Lock className="size-3" aria-hidden />
                Stored on this Mac
              </span>
            </div>
          </header>
          <section aria-labelledby="planned-purpose-heading" className="mt-11">
            <h2 id="planned-purpose-heading" className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-label-3">
              Purpose
            </h2>
            <label htmlFor="purpose-why" className="mb-1 block text-[12px] font-semibold text-label-2">
              Why we meet
            </label>
            <textarea
              id="purpose-why"
              rows={3}
              value={draft.purpose}
              placeholder="What should this meeting settle?"
              onChange={(event) => change({ purpose: event.target.value })}
              className={cn(EDITABLE, "block resize-none text-[15px] leading-[1.55] tracking-[-0.005em]")}
            />
          </section>
          <SourcesPanel plannedMeetingId={meeting.id} />
        </div>
      </main>
    </>
  )
}

function PreparationToolbar({ onBack, children }: { onBack: () => void; children?: ReactNode }) {
  return (
    <header data-tauri-drag-region className="absolute inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2 pl-[18px] pr-3">
      <Button variant="plain" size="sm" onClick={onBack} className="-ml-1.5 gap-0.5 pl-[5px] pr-[9px] text-accent">
        <ChevronLeft className="size-[13px]" strokeWidth={2} aria-hidden />
        <span>Today</span>
      </Button>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      {children}
    </header>
  )
}

export function PreparationPage({ id }: { id: string }) {
  const router = useRouter()
  const [meeting, setMeeting] = useState<PlannedMeeting | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const goBack = useCallback(() => router.push("/"), [router])

  useEffect(() => {
    let active = true
    getPlannedMeeting(id)
      .then((loaded) => active && setMeeting(loaded))
      .catch((error: unknown) => {
        console.error("Failed to load planned meeting:", error)
        if (active) setLoadError(planningErrorMessage(error, LOAD_ERROR))
      })
    return () => {
      active = false
    }
  }, [id])

  return (
    <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-content">
      {meeting ? (
        <PlannedMeetingDoc key={meeting.id} meeting={meeting} onBack={goBack} />
      ) : (
        <>
          <PreparationToolbar onBack={goBack} />
          <main className="flex flex-1 items-center justify-center pt-[52px] text-label-2">
            {loadError && <p className="m-0">{loadError}</p>}
          </main>
        </>
      )}
    </div>
  )
}
