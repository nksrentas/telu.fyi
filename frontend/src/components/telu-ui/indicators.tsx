"use client"

import type * as React from "react"
import { useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

interface IndicatorProps {
  active: boolean
  className?: string
}

const WAVE_DELAYS = ["0ms", "-200ms", "-450ms", "-650ms", "-100ms"]

const SKELETON_SHAPES = {
  line: "h-2.5 w-full rounded-[5px]",
  "line-short": "h-2.5 w-[58%] rounded-[5px]",
  chip: "h-5 w-[92px] rounded-full",
}

function useLooping(active: boolean): boolean {
  const reduced = useReducedMotion()
  return active && !reduced
}

export function Spinner({ active, size = 14, className }: IndicatorProps & { size?: 10 | 13 | 14 }) {
  const looping = useLooping(active)
  return (
    <span
      data-slot="spinner"
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-block shrink-0 rounded-full border-fill-3 border-t-label-2",
        size === 10 ? "border-[1.5px]" : "border-2",
        looping && "animate-spin-ring",
        className
      )}
    />
  )
}

export function Shimmer({ active, className, children }: IndicatorProps & { children?: React.ReactNode }) {
  const looping = useLooping(active)
  return (
    <span
      data-slot="shimmer"
      className={cn(
        "bg-[linear-gradient(90deg,var(--fill)_0%,var(--fill-3)_50%,var(--fill)_100%)] bg-[length:200%_100%]",
        looping && "animate-shimmer",
        className
      )}
    >
      {children}
    </span>
  )
}

export function Skeleton({ active, shape = "line", className }: IndicatorProps & { shape?: keyof typeof SKELETON_SHAPES }) {
  return <Shimmer active={active} className={cn("block", SKELETON_SHAPES[shape], className)} />
}

export function RecDot({ active, className }: IndicatorProps) {
  const reduced = useReducedMotion()
  return (
    <span
      data-slot="rec-dot"
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-coral",
        active && (reduced ? "animate-rec-slow" : "animate-rec"),
        className
      )}
    />
  )
}

export function Waveform({ active, className }: IndicatorProps) {
  const looping = useLooping(active)
  return (
    <span data-slot="waveform" aria-hidden className={cn("inline-flex h-3.5 items-center gap-0.5", className)}>
      {WAVE_DELAYS.map((delay) => (
        <i
          key={delay}
          style={looping ? { animationDelay: delay } : undefined}
          className={cn("h-full w-[2.5px] scale-y-[0.3] rounded-[2px] bg-current", looping && "animate-wave")}
        />
      ))}
    </span>
  )
}
