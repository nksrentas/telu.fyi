"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { ChevronRight } from "lucide-react"
import { Collapsible } from "radix-ui"

import { Button } from "@/components/ui/button"
import {
  QuotedText,
  formatTime,
  useTranscriptLines,
  type EvidenceHighlight,
} from "@/components/living-doc/transcript-drawer"
import { cn } from "@/lib/utils"

interface InlineTranscriptProps {
  meetingId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  highlight: EvidenceHighlight | null
  lineRefs: MutableRefObject<Map<string, HTMLElement>>
}

function TranscriptLines({ meetingId, highlight, lineRefs }: Omit<InlineTranscriptProps, "open" | "onOpenChange">) {
  const { lines, legacyMode, loading, failed, retry } = useTranscriptLines(meetingId)
  const cited = new Set(legacyMode ? [] : highlight?.evidenceIds ?? [])
  const spans = new Map((legacyMode ? [] : highlight?.spans ?? []).map((span) => [span.evidenceId, span]))
  if (loading) return <p className="m-0 px-2 py-3 text-[12px] text-label-3">Loading transcript…</p>
  if (failed) {
    return (
      <div role="alert" className="flex items-center gap-2 px-2 py-3 text-[12px] text-label-2">
        Couldn&apos;t load the transcript.
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      </div>
    )
  }
  if (lines.length === 0) return <p className="m-0 px-2 py-3 text-[12px] text-label-3">No transcript lines yet.</p>
  return (
    <ol className="m-0 list-none space-y-0.5 p-0">
      {lines.map((line) => (
        <li
          key={line.id}
          ref={(node) => {
            if (node) lineRefs.current.set(line.id, node)
            else lineRefs.current.delete(line.id)
          }}
          data-line={line.id}
          data-cited={cited.has(line.id) || undefined}
          className="grid grid-cols-[42px_minmax(0,1fr)] gap-x-2 rounded-[10px] p-2 transition-colors duration-300 data-[cited]:bg-accent-soft"
        >
          <span className="pt-px text-[11px] tabular-nums text-label-3">{formatTime(line.start)}</span>
          <span className="selectable break-words text-[13px] leading-[1.4] text-label">
            <QuotedText text={line.text} span={spans.get(line.id)} />
          </span>
        </li>
      ))}
    </ol>
  )
}

export function InlineTranscript({ meetingId, open, onOpenChange, highlight, lineRefs }: InlineTranscriptProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    contentRef.current?.toggleAttribute?.("inert", !open)
  }, [open])
  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} className="mt-10 space-y-2">
      <Collapsible.Trigger asChild>
        <button type="button" className="sec-eyebrow inline-flex items-center gap-1 rounded-[6px] py-1">
          <ChevronRight aria-hidden className={cn("size-[13px] transition-transform duration-200", open && "rotate-90")} strokeWidth={1.8} />
          Transcript
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content
        forceMount
        ref={contentRef}
        className="grid transition-[grid-template-rows,opacity] duration-[260ms] ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr] data-[state=closed]:opacity-0"
      >
        <div className="min-h-0 overflow-hidden">
          {open && <TranscriptLines meetingId={meetingId} highlight={highlight} lineRefs={lineRefs} />}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
