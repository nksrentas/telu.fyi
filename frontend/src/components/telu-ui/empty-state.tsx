"use client"

import type * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

interface EmptyStateProps {
  title: string
  body: string
  icon?: LucideIcon
  footnote?: React.ReactNode
  actions?: React.ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ title, body, icon, footnote, actions, compact = false, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("grid place-items-center gap-2.5 text-center text-label-2", compact ? "px-3 py-6" : "px-6 py-10", className)}
    >
      {icon && !compact && (
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon icon={icon} size={28} />
        </span>
      )}
      <h3 className="m-0 font-display text-[17px] font-semibold leading-[1.25] tracking-[-0.01em] text-label">{title}</h3>
      <p className="m-0 max-w-[340px]">{body}</p>
      {actions && <div className="mt-1.5 flex flex-wrap justify-center gap-2">{actions}</div>}
      {footnote && <p className="m-0 flex items-center gap-1.5 text-[11px] text-label-3">{footnote}</p>}
    </div>
  )
}
