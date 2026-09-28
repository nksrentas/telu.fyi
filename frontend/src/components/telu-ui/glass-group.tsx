"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface GlassGroupProps extends React.ComponentProps<"div"> {
  "aria-label": string
}

export function GlassGroup({ className, ...props }: GlassGroupProps) {
  return (
    <div
      role="group"
      data-slot="glass-group"
      className={cn(
        "inline-flex h-[34px] items-center rounded-full bg-glass-strong p-[3px] shadow-[0_0_0_0.5px_var(--glass-edge),inset_0_0.5px_0_var(--glass-rim),0_2px_10px_rgba(23,25,31,0.06)] backdrop-blur-[16px] backdrop-saturate-[1.6] [&_[data-slot=button]]:bg-transparent [&_[data-slot=button]:hover]:bg-fill-2",
        className
      )}
      {...props}
    />
  )
}
