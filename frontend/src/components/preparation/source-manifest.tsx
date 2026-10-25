"use client"

import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { sourceName, type SourceLabels } from "@/components/preparation/brief-contents"
import type { ManifestEntry } from "@/lib/preparation-service"

const STATUS: Record<ManifestEntry["status"], { label: string; tone: string; fallback: string }> = {
  included: { label: "Included", tone: "bg-accent", fallback: "" },
  truncated: { label: "Truncated", tone: "bg-amber", fallback: "Only part of this source fit." },
  omitted: { label: "Omitted", tone: "bg-label-3", fallback: "this source didn’t fit in the brief." },
  deleted: { label: "Deleted", tone: "bg-amber", fallback: "this source was deleted." },
  missing: { label: "Missing", tone: "bg-amber", fallback: "this source couldn’t be found." },
  unavailable: { label: "Unavailable", tone: "bg-label-3", fallback: "this source is no longer available." },
}

const REASON: Record<string, string> = {
  "omitted:SOURCE_BUDGET": "its first passage is longer than its share of the brief.",
  "omitted:TOTAL_BUDGET": "the brief ran out of room before this source.",
  "truncated:SOURCE_BUDGET": "This source is longer than its share of the brief.",
  "truncated:TOTAL_BUDGET": "The brief ran out of room.",
  "deleted:DOCUMENT_DELETED": "this source was deleted after you picked it.",
  "missing:MANAGED_FILE_MISSING": "the saved copy of this file is gone.",
  "unavailable:VERSION_NOT_FOUND": "this version no longer exists.",
  "unavailable:KNOWLEDGE_NOT_ELIGIBLE": "this item is no longer in what you accepted.",
}

function manifestSentence(entry: ManifestEntry): string {
  const { label, fallback } = STATUS[entry.status]
  if (entry.status === "included") return `${label} in full.`
  const reason = REASON[`${entry.status}:${entry.reason}`] ?? fallback
  if (entry.status === "truncated") return `${label}: ${entry.kept ?? 0} of ${entry.total ?? 0} passages. ${reason}`
  return `${label}: ${reason}`
}

function droppedSentence(count: number): string {
  if (count === 0) return "Every statement matched its source."
  if (count === 1) return "1 statement was left out because its source didn't match."
  return `${count} statements were left out because their source didn't match.`
}

interface SourceManifestProps {
  manifest: ManifestEntry[]
  droppedCount: number
  labels: SourceLabels
}

export function SourceManifest({ manifest, droppedCount, labels }: SourceManifestProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-manifest-trigger
          className="inline-flex min-h-6 items-center rounded-[4px] text-[12px] font-medium text-accent outline-none transition-transform duration-150 ease-out hover:underline focus-visible:shadow-[0_0_0_2px_var(--accent)] active:scale-[0.97]"
        >
          What was used
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" arrowPadding={12} className="w-[340px] space-y-2.5 p-3.5">
        <PopoverArrow />
        <p className="m-0 text-[11px] font-semibold text-label-3">What was used</p>
        <ul className="m-0 list-none space-y-2 p-0">
          {manifest.map((entry, index) => (
            <li key={`${entry.source.kind}-${index}`} className="flex items-start gap-2">
              <span aria-hidden className={`mt-[6px] size-1.5 shrink-0 rounded-full ${STATUS[entry.status].tone}`} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-label">{sourceName(entry.source, labels)}</span>
                <span className="block text-[12px] leading-[1.4] text-label-2">{manifestSentence(entry)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p data-dropped className="m-0 pt-2.5 text-[12px] text-label-2 shadow-[inset_0_0.5px_0_var(--separator)]">
          {droppedSentence(droppedCount)}
        </p>
      </PopoverContent>
    </Popover>
  )
}
