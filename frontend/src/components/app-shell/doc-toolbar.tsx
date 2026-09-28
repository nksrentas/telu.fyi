"use client"

import { Fragment } from "react"
import { ChevronLeft, MoreHorizontal, PanelRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GlassGroup } from "@/components/telu-ui/glass-group"
import { cn } from "@/lib/utils"

export interface DocToolbarMenuItem {
  id: string
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

interface DocToolbarProps {
  originLabel: string
  title: string
  showCompactTitle: boolean
  scrolled: boolean
  drawerOpen: boolean
  onBack: () => void
  onToggleDrawer: () => void
  menuItems: DocToolbarMenuItem[]
}

export function DocToolbar({
  originLabel,
  title,
  showCompactTitle,
  scrolled,
  drawerOpen,
  onBack,
  onToggleDrawer,
  menuItems,
}: DocToolbarProps) {
  return (
    <header
      data-tauri-drag-region
      data-scrolled={scrolled || undefined}
      className="absolute inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2 pl-[18px] pr-3 transition-[background-color,box-shadow] duration-200 data-[scrolled]:bg-[color:color-mix(in_srgb,var(--content-bg)_76%,transparent)] data-[scrolled]:shadow-[0_0.5px_0_var(--separator)] data-[scrolled]:backdrop-blur-[18px] data-[scrolled]:backdrop-saturate-[1.6]"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="plain" size="sm" onClick={onBack} className="-ml-1.5 gap-0.5 pl-[5px] pr-[9px] text-accent">
            <ChevronLeft className="size-[13px]" strokeWidth={2} aria-hidden />
            <span>{originLabel}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back · ⌘[</TooltipContent>
      </Tooltip>
      <div
        data-tauri-drag-region
        aria-hidden={!showCompactTitle}
        className={cn(
          "min-w-0 truncate text-[15px] font-semibold text-label transition-[opacity,transform] duration-[180ms] ease-out",
          showCompactTitle ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
        )}
      >
        {title}
      </div>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      {menuItems.length > 0 && (
        <GlassGroup aria-label="Document actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="plain" icon aria-label="More">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuItems.map((item) => (
                <Fragment key={item.id}>
                  {item.separatorBefore && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    variant={item.danger ? "danger" : "default"}
                    disabled={item.disabled}
                    onSelect={item.onSelect}
                  >
                    {item.label}
                  </DropdownMenuItem>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </GlassGroup>
      )}
      <GlassGroup aria-label="Panels">
        <Button
          variant="plain"
          icon
          aria-label="Transcript"
          aria-expanded={drawerOpen}
          onClick={onToggleDrawer}
          className={cn(drawerOpen && "text-accent")}
        >
          <PanelRight aria-hidden />
        </Button>
      </GlassGroup>
    </header>
  )
}
