"use client"

import { useState, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { KnowledgeItemView, KnowledgeRunView } from "@/lib/knowledge-service"
import { cn } from "@/lib/utils"
import { useEvidenceNavigation } from "./meeting-page"
import { LOCATION_LABEL, formatRunTime } from "./run-details-popover"
import { claimLinks, formatEvidenceDay, formatEvidenceOffset } from "./source-chip"

export const EVIDENCE_CHANGED = "This line has changed since Telu quoted it."
export const EVIDENCE_MISSING = "This line is no longer in the transcript."
export const EVIDENCE_GAP = "Captured with gaps around this line"

export function foundLine(item: KnowledgeItemView, run: KnowledgeRunView | null): string {
  if (!run) return `Found ${formatRunTime(item.createdAtUtc)}`
  return `Found ${formatRunTime(run.startedAtUtc)} · ${LOCATION_LABEL[run.locationClass] ?? run.locationClass}`
}

function StatusNote({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mt-2 flex items-start gap-1.5 text-[12px] leading-[1.35] text-label">
      <AlertTriangle aria-hidden className="mt-px size-[13px] shrink-0 text-amber" strokeWidth={1.8} />
      {children}
    </p>
  )
}

interface EvidencePopoverProps {
  item: KnowledgeItemView
  run?: KnowledgeRunView | null
  children: ReactNode
}

export function EvidencePopover({ item, run = null, children }: EvidencePopoverProps) {
  const [open, setOpen] = useState(false)
  const { meetingStartedAt, openEvidence } = useEvidenceNavigation()
  const links = claimLinks(item)
  const missing = item.evidenceStatus === "missing" || links.length === 0
  const day = formatEvidenceDay(meetingStartedAt ?? item.createdAtUtc)
  const time = links.length > 0 ? ` · ${formatEvidenceOffset(links[0].audioStartTime)}` : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent arrowPadding={12} className="max-h-[60vh] w-[320px] overflow-y-auto p-3">
        <PopoverArrow />
        <p className="m-0 text-[11px] font-semibold tracking-[0.01em] text-label-3">
          EVIDENCE · {day}
          {time}
        </p>
        {item.evidenceStatus === "changed" && <StatusNote>{EVIDENCE_CHANGED}</StatusNote>}
        {missing && <StatusNote>{EVIDENCE_MISSING}</StatusNote>}
        {links.map((link) => (
          <div key={link.linkId}>
            <blockquote
              className={cn(
                "selectable m-0 mt-2 whitespace-pre-wrap break-words pl-2.5 text-[14px] leading-[1.45] shadow-[inset_2px_0_0_var(--accent-soft)]",
                item.evidenceStatus === "valid" ? "text-label" : "text-label-2"
              )}
            >
              “{link.quoteText}”
            </blockquote>
            {link.segmentCaptureIncomplete && <p className="m-0 mt-1 pl-2.5 text-[11px] text-label-3">{EVIDENCE_GAP}</p>}
          </div>
        ))}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-label-3">{foundLine(item, run)}</span>
          {!missing && (
            <Button
              variant="plain"
              size="sm"
              onClick={() => {
                setOpen(false)
                openEvidence(links)
              }}
            >
              Open transcript
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
