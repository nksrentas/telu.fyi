"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, Lock, SlidersHorizontal, Sun, Upload, type LucideIcon } from "lucide-react"

import { Icon } from "@/components/telu-ui/icon"
import { useConfig } from "@/contexts/ConfigContext"
import { useImportDialog } from "@/contexts/ImportDialogContext"
import { useRecordingState } from "@/contexts/RecordingStateContext"
import { getAgendaCounts, localDayBounds, type AgendaCounts } from "@/lib/agenda-service"
import { onKnowledgeUpdated } from "@/lib/knowledge-service"
import { MEETINGS_CHANGED_EVENT } from "@/lib/meeting-deletion-service"
import { cn } from "@/lib/utils"

const ROW_CLASS =
  "flex h-7 w-full cursor-default items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-label transition-transform duration-[140ms] ease-out active:scale-[0.985]"

interface SidebarNavItemProps {
  icon: LucideIcon
  label: string
  href?: string
  onSelect?: () => void
  current?: boolean
  plain?: boolean
  trailing?: string
  bumpKey?: number
  accessibleName?: string
  keyShortcuts?: string
}

function SidebarNavItem({
  icon,
  label,
  href,
  onSelect,
  current = false,
  plain = false,
  trailing,
  bumpKey = 0,
  accessibleName,
  keyShortcuts,
}: SidebarNavItemProps) {
  const className = cn(ROW_CLASS, current && "bg-fill-2")
  const content = (
    <>
      <Icon icon={icon} className={plain ? "text-label-2" : "text-accent"} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing && (
        <span
          key={bumpKey}
          aria-hidden
          className={cn("inline-block shrink-0 text-[12px] tabular-nums text-label-3", bumpKey > 0 && "animate-bump")}
        >
          {trailing}
        </span>
      )}
    </>
  )
  if (href) {
    return (
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        aria-label={accessibleName}
        aria-keyshortcuts={keyShortcuts}
        className={className}
      >
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onSelect} aria-label={accessibleName} className={className}>
      {content}
    </button>
  )
}

function useAgendaCounts(): AgendaCounts | null {
  const { status } = useRecordingState()
  const [counts, setCounts] = useState<AgendaCounts | null>(null)
  const latestRequest = useRef(0)

  const refresh = useCallback(() => {
    const request = ++latestRequest.current
    const { fromUtc, toUtc } = localDayBounds(new Date())
    getAgendaCounts(fromUtc, toUtc)
      .then((counts) => {
        if (request === latestRequest.current) setCounts(counts)
      })
      .catch((error: unknown) => {
        console.error("Failed to load agenda counts:", error)
        if (request === latestRequest.current) setCounts(null)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, status])

  useEffect(() => {
    window.addEventListener(MEETINGS_CHANGED_EVENT, refresh)
    const unlisten = onKnowledgeUpdated(refresh).catch((error: unknown) => {
      console.error("Failed to listen for knowledge updates:", error)
      return null
    })
    return () => {
      window.removeEventListener(MEETINGS_CHANGED_EVENT, refresh)
      void unlisten.then((stop) => stop?.())
    }
  }, [refresh])

  return counts
}

function useBumpKey(value: number | null): number {
  const previous = useRef(value)
  const [key, setKey] = useState(0)
  useEffect(() => {
    if (previous.current !== null && value !== null && value !== previous.current) setKey((current) => current + 1)
    previous.current = value
  }, [value])
  return key
}

function itemsLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`
}

function meetingsLabel(count: number): string {
  return count === 1 ? "1 meeting" : `${count} meetings`
}

export function Sidebar() {
  const pathname = usePathname()
  const counts = useAgendaCounts()
  const todayCount = counts?.dayCount ?? null
  const pendingTotal = counts?.pendingTotal ?? 0
  const reviewBump = useBumpKey(counts ? pendingTotal : null)
  const { betaFeatures } = useConfig()
  const { openImportDialog } = useImportDialog()
  const showTodayCount = todayCount !== null && todayCount > 0

  return (
    <nav
      aria-label="Sidebar"
      className="flex w-[var(--sidebar-w)] shrink-0 flex-col overflow-y-auto bg-[var(--sidebar)] px-2.5 pb-2.5"
    >
      <div data-tauri-drag-region className="h-[52px] shrink-0" />
      <div className="flex flex-col gap-px">
        <SidebarNavItem
          href="/"
          icon={Sun}
          label="Today"
          current={pathname === "/"}
          trailing={showTodayCount ? String(todayCount) : undefined}
          accessibleName={showTodayCount ? `Today, ${meetingsLabel(todayCount)}` : undefined}
        />
        <SidebarNavItem
          href="/review"
          icon={Inbox}
          label="Review"
          current={pathname === "/review"}
          trailing={pendingTotal > 0 ? String(pendingTotal) : undefined}
          bumpKey={reviewBump}
          accessibleName={pendingTotal > 0 ? `Review, ${itemsLabel(pendingTotal)}` : undefined}
        />
      </div>
      <div data-tauri-drag-region className="min-h-3 flex-1" />
      <p className="m-0 flex items-center gap-1.5 px-2 pb-1.5 pt-2.5 text-[11px] text-label-3">
        <Icon icon={Lock} size={13} />
        Stored on this Mac
      </p>
      {betaFeatures.importAndRetranscribe && (
        <SidebarNavItem icon={Upload} label="Import audio" plain onSelect={() => openImportDialog()} />
      )}
      <SidebarNavItem
        href="/settings"
        icon={SlidersHorizontal}
        label="Settings"
        plain
        current={pathname === "/settings"}
        trailing="⌘,"
        keyShortcuts="Meta+Comma"
      />
    </nav>
  )
}
