"use client"

import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { AlertTriangle, MessageCircle } from "lucide-react"

import type { EvidenceLinkView, KnowledgeItemView } from "@/lib/knowledge-service"
import { cn } from "@/lib/utils"
import { useEvidenceNavigation } from "./meeting-page"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatEvidenceOffset(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = (total % 60).toString().padStart(2, "0")
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${rest}` : `${minutes}:${rest}`
}

export function formatEvidenceDay(isoTime: string, now: Date = new Date()): string {
  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) return isoTime
  return date.toDateString() === now.toDateString() ? "Today" : `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

export function claimLinks(item: KnowledgeItemView): EvidenceLinkView[] {
  return item.evidence.filter((link) => link.role === "claim")
}

interface SourceChipProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  item: KnowledgeItemView
  onOpen?: () => void
}

export const SourceChip = forwardRef<HTMLButtonElement, SourceChipProps>(function SourceChip(
  { item, onOpen, onClick, className, ...props },
  ref
) {
  const { meetingStartedAt } = useEvidenceNavigation()
  const links = claimLinks(item)
  const time = links.length > 0 ? formatEvidenceOffset(links[0].audioStartTime) : null
  const day = formatEvidenceDay(meetingStartedAt ?? item.createdAtUtc)
  const Glyph = item.evidenceStatus === "valid" ? MessageCircle : AlertTriangle

  return (
    <button
      ref={ref}
      type="button"
      {...props}
      aria-label={time ? `Source: ${day}, ${time}` : `Source: ${day}`}
      onClick={(event) => {
        onClick?.(event)
        onOpen?.()
      }}
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-[3px] whitespace-nowrap rounded-[5px] bg-fill px-1.5 text-[10.5px] font-medium tabular-nums text-label-2 transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent-soft hover:text-accent-strong active:scale-[0.96]",
        className
      )}
    >
      <Glyph
        aria-hidden
        data-evidence-alert={item.evidenceStatus === "valid" ? undefined : item.evidenceStatus}
        className={cn("size-2.5", item.evidenceStatus !== "valid" && "text-amber")}
        strokeWidth={2}
      />
      {time}
      {links.length > 1 && <span>+{links.length - 1}</span>}
    </button>
  )
})
