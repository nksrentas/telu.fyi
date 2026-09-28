"use client"

import type * as React from "react"
import { BadgeCheck, BookOpen, CircleHelp, CornerDownRight, type LucideIcon } from "lucide-react"

import type { KnowledgeType as KnowledgeKind } from "@/lib/knowledge-service"
import { cn } from "@/lib/utils"

interface TypeStyle {
  glyph: LucideIcon
  label: string
  color: string
}

const TYPE_STYLES: Record<KnowledgeKind, TypeStyle> = {
  decision: { glyph: BadgeCheck, label: "Decision", color: "var(--accent)" },
  commitment: { glyph: CornerDownRight, label: "Commitment", color: "var(--series-orange)" },
  question: { glyph: CircleHelp, label: "Question", color: "var(--amber)" },
  fact: { glyph: BookOpen, label: "Fact", color: "var(--series-teal)" },
}

const VARIANT_CLASS = {
  label: "inline-flex items-center gap-1 text-[11px] font-semibold",
  icon: "inline-grid shrink-0 place-items-center",
  tile: "grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-[color:color-mix(in_srgb,var(--kind)_14%,transparent)]",
}

interface KnowledgeTypeProps {
  type: KnowledgeKind
  variant?: keyof typeof VARIANT_CLASS
  className?: string
}

export function KnowledgeType({ type, variant = "label", className }: KnowledgeTypeProps) {
  const { glyph: Glyph, label, color } = TYPE_STYLES[type]
  const labelled = variant === "label"
  return (
    <span
      data-slot="knowledge-type"
      role={labelled ? undefined : "img"}
      aria-label={labelled ? undefined : label}
      style={{ "--kind": color } as React.CSSProperties}
      className={cn(VARIANT_CLASS[variant], "text-[color:var(--kind)]", className)}
    >
      <Glyph size={13} strokeWidth={1.9} aria-hidden />
      {labelled && label}
    </span>
  )
}
