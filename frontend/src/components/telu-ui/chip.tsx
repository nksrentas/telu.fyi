"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-fill-2 text-label-2",
        accent: "bg-accent-soft text-accent-strong",
        amber: "bg-amber-soft text-amber",
        coral: "bg-coral-soft text-coral-ink",
        dashed: "bg-transparent text-label-3 outline-dashed outline-1 -outline-offset-1 outline-label-4",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

interface ChipProps extends React.ComponentProps<"span">, VariantProps<typeof chipVariants> {
  icon?: LucideIcon
}

export function Chip({ tone, icon: Glyph, className, children, ...props }: ChipProps) {
  return (
    <span data-slot="chip" className={cn(chipVariants({ tone }), className)} {...props}>
      {Glyph && <Glyph size={12} strokeWidth={1.8} aria-hidden />}
      {children}
    </span>
  )
}
