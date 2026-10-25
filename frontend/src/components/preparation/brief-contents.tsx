"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, FileText, MessageCircle, Sparkles } from "lucide-react"

import { shortDate } from "@/components/preparation/knowledge-picker"
import { getDocumentVersion } from "@/lib/document-service"
import type { BriefingClaim, SelectedSource, StoredBriefing } from "@/lib/preparation-service"
import { storageService } from "@/services/storageService"
import { cn } from "@/lib/utils"

export interface SourceLabels {
  documents: Record<string, string>
  meetings: Record<string, { title: string; date: string }>
}

const EMPTY_LABELS: SourceLabels = { documents: {}, meetings: {} }
const CHIP =
  "inline-flex h-[18px] max-w-[220px] shrink-0 items-center gap-[3px] whitespace-nowrap rounded-[5px] bg-fill px-1.5 text-[10.5px] font-medium text-label-2"

export function useSourceLabels(briefing: StoredBriefing | null): SourceLabels {
  const [labels, setLabels] = useState<SourceLabels>(EMPTY_LABELS)
  const manifest = briefing?.manifest

  useEffect(() => {
    if (!manifest) return
    let active = true
    const versionIds = Array.from(
      new Set(manifest.flatMap(({ source }) => (source.kind === "document" ? [source.versionId] : [])))
    )
    const hasKnowledge = manifest.some(({ source }) => source.kind === "knowledge")
    Promise.all([
      Promise.all(versionIds.map((versionId) => getDocumentVersion(versionId))),
      hasKnowledge ? storageService.getMeetings().catch(() => []) : Promise.resolve([]),
    ])
      .then(([versions, meetings]) => {
      if (!active) return
      setLabels({
        documents: Object.fromEntries(
          versions.flatMap((result, index) => (result.ok ? [[versionIds[index], result.value.document.title]] : []))
        ),
        meetings: Object.fromEntries(
          meetings.map((meeting) => [meeting.id, { title: meeting.title, date: shortDate(meeting.created_at) }])
        ),
      })
      })
      .catch((error: unknown) => console.error("Failed to load source labels:", error))
    return () => {
      active = false
    }
  }, [manifest])

  return labels
}

export function sourceName(source: SelectedSource, labels: SourceLabels): string {
  if (source.kind === "document") return labels.documents[source.versionId] ?? "Document"
  const meeting = labels.meetings[source.meetingId]
  return meeting ? `${meeting.title} · ${meeting.date}` : "Past meeting"
}

interface CitationChipProps {
  claim: BriefingClaim
  labels: SourceLabels
  onOpen: (claim: BriefingClaim) => void
}

function CitationChip({ claim, labels, onOpen }: CitationChipProps) {
  const name = sourceName(claim.source, labels)
  if (claim.status === "source_unavailable") {
    return (
      <span className={cn(CHIP, "text-label-3")}>
        <AlertTriangle aria-hidden className="size-2.5 text-amber" strokeWidth={2} />
        Source deleted
      </span>
    )
  }
  const Glyph = claim.source.kind === "document" ? FileText : MessageCircle
  const changed = claim.status === "stale"
  return (
    <button
      type="button"
      onClick={() => onOpen(claim)}
      className={cn(
        CHIP,
        "outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent-soft hover:text-accent-strong focus-visible:shadow-[0_0_0_2px_var(--accent)] active:scale-[0.96]"
      )}
    >
      <Glyph aria-hidden className={cn("size-2.5 shrink-0", changed && "text-amber")} strokeWidth={2} />
      <span className="sr-only">Source: </span>
      <span className="truncate">{name}</span>
      {changed && <span className="sr-only"> (changed since this brief)</span>}
    </button>
  )
}

interface BriefContentsProps {
  briefing: StoredBriefing
  labels: SourceLabels
  onOpen: (claim: BriefingClaim) => void
}

export function BriefContents({ briefing, labels, onOpen }: BriefContentsProps) {
  return (
    <div className="space-y-4">
      {briefing.claims.length > 0 && (
        <ul className="m-0 list-none space-y-2.5 p-0">
          {briefing.claims.map((claim, index) => (
            <li key={`${claim.sourceRef}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13.5px] leading-[1.55] text-label">
              <span className="min-w-0">{claim.text}</span>
              <CitationChip claim={claim} labels={labels} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
      {briefing.questions.length > 0 && (
        <section
          aria-labelledby="worth-asking-heading"
          className="relative rounded-card bg-content py-3 pl-4 pr-3.5 shadow-card before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-mint"
        >
          <h3 id="worth-asking-heading" className="m-0 mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-mint-ink">
            <Sparkles aria-hidden className="size-3" strokeWidth={2} />
            Worth asking
          </h3>
          <ul className="m-0 list-none space-y-2.5 p-0">
            {briefing.questions.map(({ claim, rationale }, index) => (
              <li key={`${claim.sourceRef}-${index}`} className="space-y-0.5">
                <p className="m-0 text-[13.5px] leading-[1.5] text-label">{claim.text}</p>
                <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-label-2">
                  <span className="min-w-0">{rationale}</span>
                  <CitationChip claim={claim} labels={labels} onOpen={onOpen} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
