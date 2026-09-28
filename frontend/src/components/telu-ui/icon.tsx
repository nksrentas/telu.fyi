"use client"

import type { LucideIcon, LucideProps } from "lucide-react"

import { cn } from "@/lib/utils"

type IconSize = 13 | 16 | 20 | 28

const SIZE_CLASS: Record<IconSize, string> = {
  13: "size-[13px]",
  16: "size-4",
  20: "size-5",
  28: "size-7",
}

interface IconProps extends Omit<LucideProps, "size" | "strokeWidth" | "ref"> {
  icon: LucideIcon
  size?: IconSize
}

export function Icon({ icon: Glyph, size = 16, className, ...props }: IconProps) {
  return (
    <Glyph
      data-slot="icon"
      size={size}
      strokeWidth={size === 28 ? 1.4 : 1.6}
      className={cn(SIZE_CLASS[size], className)}
      {...props}
      aria-hidden
    />
  )
}
