"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Copy, FolderOpen, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/telu-ui/indicators"
import { usePaginatedTranscripts } from "@/hooks/usePaginatedTranscripts"
import { listMeetingEvidence, type EvidenceSegmentView } from "@/lib/knowledge-service"
import { cn } from "@/lib/utils"
import type { Transcript } from "@/types"

export interface EvidenceSpan {
  evidenceId: string
  start: number
  end: number
}

export interface EvidenceHighlight {
  evidenceIds: string[]
  spans: EvidenceSpan[]
}

export interface TranscriptDrawerHandle {
  scrollToEvidence: (evidenceId: string) => void
}

interface TranscriptDrawerProps {
  meetingId: string
  title: string
  dateLabel?: string
  open: boolean
  onClose: () => void
  highlight: EvidenceHighlight | null
  onCopyTranscript?: () => void
  onOpenRecordingFolder?: () => void
}

export interface DrawerLine {
  id: string
  text: string
  start: number
  end: number
  partial: boolean
}

type EvidenceState = { status: "loading" } | { status: "error" } | { status: "ready"; lines: DrawerLine[] }

const LINE_ESTIMATE = 52
const INITIAL_RECT = { width: 340, height: 600 }

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`
}

function formatDuration(lines: DrawerLine[]): string {
  const seconds = lines.reduce((longest, line) => Math.max(longest, line.end), 0)
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

function fromEvidence(segments: EvidenceSegmentView[]): DrawerLine[] {
  return [...segments]
    .sort((left, right) => left.sequence - right.sequence)
    .map((segment) => ({
      id: segment.evidenceId,
      text: segment.text,
      start: segment.audioStartTime,
      end: segment.audioEndTime,
      partial: segment.captureCompleteness === "incomplete",
    }))
}

function fromLegacy(transcripts: Transcript[]): DrawerLine[] {
  return transcripts.map((transcript) => ({
    id: transcript.id,
    text: transcript.text,
    start: transcript.audio_start_time ?? 0,
    end: transcript.audio_end_time ?? transcript.audio_start_time ?? 0,
    partial: false,
  }))
}

export function useEvidenceLines(meetingId: string) {
  const [state, setState] = useState<EvidenceState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    setState({ status: "loading" })
    listMeetingEvidence(meetingId)
      .then((segments) => {
        if (current) setState({ status: "ready", lines: fromEvidence(segments) })
      })
      .catch((error: unknown) => {
        console.error("Failed to load transcript evidence:", error)
        if (current) setState({ status: "error" })
      })
    return () => {
      current = false
    }
  }, [meetingId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { state, retry }
}

export function useTranscriptLines(meetingId: string) {
  const { state, retry } = useEvidenceLines(meetingId)
  const evidenceEmpty = state.status === "ready" && state.lines.length === 0
  const legacy = usePaginatedTranscripts({ meetingId: evidenceEmpty ? meetingId : null })
  const legacyMode = evidenceEmpty && legacy.transcripts.length > 0
  const lines = useMemo(
    () => (state.status !== "ready" ? [] : legacyMode ? fromLegacy(legacy.transcripts) : state.lines),
    [state, legacyMode, legacy.transcripts]
  )
  const loading = state.status === "loading" || (evidenceEmpty && legacy.isLoading && !legacyMode)
  const failed = state.status === "error" || (evidenceEmpty && Boolean(legacy.error))
  const retryLines = state.status === "error" ? retry : () => void legacy.refetch()
  return { lines, legacyMode, loading, failed, retry: retryLines }
}

export function QuotedText({ text, span }: { text: string; span?: EvidenceSpan }) {
  const points = Array.from(text)
  if (!span || span.start < 0 || span.end > points.length || span.start >= span.end) {
    return <>{text}</>
  }
  return (
    <>
      {points.slice(0, span.start).join("")}
      <mark className="rounded-[3px] bg-accent-soft text-accent-strong">{points.slice(span.start, span.end).join("")}</mark>
      {points.slice(span.end).join("")}
    </>
  )
}

function DrawerMessage({ children }: { children: ReactNode }) {
  return <div className="px-3 py-6 text-center text-[13px] text-label-2">{children}</div>
}

function LoadingLines() {
  return (
    <div aria-busy className="space-y-3 px-3 py-4">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
          <Skeleton active className="w-8" />
          <Skeleton active shape={index % 2 === 0 ? "line" : "line-short"} />
        </div>
      ))}
    </div>
  )
}

function useEscapeToClose(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, close])
}

export const TranscriptDrawer = forwardRef<TranscriptDrawerHandle, TranscriptDrawerProps>(function TranscriptDrawer(
  { meetingId, title, dateLabel, open, onClose, highlight, onCopyTranscript, onOpenRecordingFolder },
  ref
) {
  const { lines, legacyMode, loading, failed, retry } = useTranscriptLines(meetingId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [instantClose, setInstantClose] = useState(false)

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_ESTIMATE,
    overscan: 8,
    initialRect: INITIAL_RECT,
  })

  const scrollToEvidence = useCallback(
    (evidenceId: string) => {
      const index = lines.findIndex((line) => line.id === evidenceId)
      if (index >= 0) virtualizer.scrollToIndex(index, { align: "center" })
    },
    [lines, virtualizer]
  )
  useImperativeHandle(ref, () => ({ scrollToEvidence }), [scrollToEvidence])

  const highlighted = useMemo(() => new Set(legacyMode ? [] : highlight?.evidenceIds ?? []), [highlight, legacyMode])
  const spans = useMemo(
    () => new Map((legacyMode ? [] : highlight?.spans ?? []).map((span) => [span.evidenceId, span])),
    [highlight, legacyMode]
  )

  const firstHighlight = highlight?.evidenceIds[0]
  useEffect(() => {
    if (open && firstHighlight && lines.length > 0) scrollToEvidence(firstHighlight)
  }, [open, firstHighlight, lines.length, scrollToEvidence])

  useEffect(() => {
    if (open) setInstantClose(false)
  }, [open])

  const closeInstantly = useCallback(() => {
    setInstantClose(true)
    onClose()
  }, [onClose])
  useEscapeToClose(open, closeInstantly)

  const caption = legacyMode ? "Transcript only · no evidence" : "Stored on this Mac · evidence highlighted"
  const meta = [dateLabel, lines.length > 0 ? formatDuration(lines) : null].filter(Boolean).join(" · ")

  return (
    <aside
      role="complementary"
      aria-label="Transcript"
      data-state={open ? "open" : "closed"}
      data-instant={instantClose || undefined}
      className="fixed bottom-2.5 right-2.5 top-[calc(var(--toolbar-h)+2px)] z-40 flex w-[340px] flex-col rounded-[18px] bg-glass-strong shadow-float backdrop-blur-[30px] backdrop-saturate-[1.8] transition-[transform,visibility] ease-drawer data-[instant]:duration-0 data-[state=closed]:invisible data-[state=closed]:translate-x-[calc(100%+24px)] data-[state=closed]:duration-200 data-[state=open]:duration-300"
    >
      <header className="flex items-start gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-semibold text-label">{title}</h2>
          {meta && <p className="text-[11px] tabular-nums text-label-2">{meta}</p>}
          <p className="text-[11px] text-label-3">{caption}</p>
        </div>
        {onCopyTranscript && (
          <Button variant="plain" size="sm" icon aria-label="Copy transcript" onClick={onCopyTranscript}>
            <Copy aria-hidden />
          </Button>
        )}
        {onOpenRecordingFolder && (
          <Button variant="plain" size="sm" icon aria-label="Open recording folder" onClick={onOpenRecordingFolder}>
            <FolderOpen aria-hidden />
          </Button>
        )}
        <Button variant="plain" size="sm" icon aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>

      <div ref={scrollRef} data-slot="transcript-scroll" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <LoadingLines />
        ) : failed ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-3 py-6 text-center">
            <p className="text-[13px] text-label-2">Couldn&apos;t load the transcript.</p>
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <DrawerMessage>No transcript lines yet.</DrawerMessage>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const line = lines[item.index]
              const cited = highlighted.has(line.id)
              return (
                <div
                  key={line.id}
                  data-index={item.index}
                  data-line={line.id}
                  ref={virtualizer.measureElement}
                  className={cn(
                    "absolute left-0 top-0 grid w-full grid-cols-[42px_minmax(0,1fr)] gap-x-2 gap-y-px rounded-[10px] p-2 transition-colors duration-300",
                    cited && "bg-accent-soft"
                  )}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <span className="pt-px text-[11px] tabular-nums text-label-3">{formatTime(line.start)}</span>
                  <p className="selectable m-0 text-[13px] leading-[1.45] text-label">
                    <QuotedText text={line.text} span={spans.get(line.id)} />
                  </p>
                  {line.partial && <span className="col-start-2 text-[11px] text-label-3">Partial capture</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
})
