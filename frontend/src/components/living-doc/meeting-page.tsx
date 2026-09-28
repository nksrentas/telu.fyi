"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { useRouter } from "next/navigation"

import { DocToolbar, type DocToolbarMenuItem } from "@/components/app-shell/doc-toolbar"
import { RetranscribeDialog } from "@/components/MeetingDetails/RetranscribeDialog"
import { useSidebar } from "@/components/Sidebar/SidebarProvider"
import { useConfig } from "@/contexts/ConfigContext"
import { useCopyOperations } from "@/hooks/meeting-details/useCopyOperations"
import { useMeetingOperations } from "@/hooks/meeting-details/useMeetingOperations"
import Analytics from "@/lib/analytics"
import type { MeetingLifecycle } from "@/types"
import { DeleteMeetingAlert, isDeleteDisabled } from "./delete-meeting-alert"
import { formatMeetingDay } from "./meeting-header"
import { TranscriptDrawer, type EvidenceHighlight, type TranscriptDrawerHandle } from "./transcript-drawer"

const TOOLBAR_HEIGHT = 52
const DRAWER_SPACE = 366

export interface MeetingPageMeeting {
  id: string
  title: string
  created_at: string
  folder_path?: string
  lifecycle?: MeetingLifecycle
}

interface MeetingPageProps {
  meeting: MeetingPageMeeting
  originLabel: string
  hasEvidence: boolean
  initialEvidenceId?: string | null
  onRefetchTranscripts?: () => Promise<void>
  children: ReactNode
}

function drawerShift(mainWidth: number): number {
  const column = Math.min(720, mainWidth - 112)
  const left = (mainWidth - column) / 2
  return Math.max(0, Math.min(left + column + 24 - (mainWidth - DRAWER_SPACE), left - 24))
}

function useScrollState(scrollRef: RefObject<HTMLDivElement>) {
  const [scrolled, setScrolled] = useState(false)
  const [compactTitle, setCompactTitle] = useState(false)
  const onScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    setScrolled(container.scrollTop > 2)
    const title = container.querySelector("[data-doc-title]")
    const top = container.getBoundingClientRect().top + TOOLBAR_HEIGHT
    setCompactTitle(title ? title.getBoundingClientRect().bottom <= top : false)
  }, [scrollRef])
  return { scrolled, compactTitle, onScroll }
}

function useMainWidth(scrollRef: RefObject<HTMLDivElement>) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (typeof window === "undefined") return
    const update = () => setWidth(scrollRef.current?.clientWidth ?? 0)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [scrollRef])
  return width
}

export function MeetingPage({
  meeting,
  originLabel,
  hasEvidence,
  initialEvidenceId = null,
  onRefetchTranscripts,
  children,
}: MeetingPageProps) {
  const router = useRouter()
  const { betaFeatures } = useConfig()
  const scrollRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<TranscriptDrawerHandle>(null)
  const blockNoteRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(initialEvidenceId !== null)
  const [highlight] = useState<EvidenceHighlight | null>(
    initialEvidenceId ? { evidenceIds: [initialEvidenceId], spans: [] } : null
  )
  const [retranscribeOpen, setRetranscribeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { refetchMeetings } = useSidebar()
  const { scrolled, compactTitle, onScroll } = useScrollState(scrollRef)
  const mainWidth = useMainWidth(scrollRef)
  const { handleOpenMeetingFolder } = useMeetingOperations({ meeting })
  const { handleCopyTranscript } = useCopyOperations({
    meeting,
    transcripts: [],
    meetingTitle: meeting.title,
    aiSummary: null,
    blockNoteSummaryRef: blockNoteRef,
  })

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back()
    else router.push("/")
  }, [router])

  useEffect(() => {
    if (typeof document === "undefined") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "[") {
        event.preventDefault()
        goBack()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [goBack])

  const copyTranscript = useCallback(() => {
    Analytics.trackButtonClick("copy_transcript", "meeting_details")
    void handleCopyTranscript()
  }, [handleCopyTranscript])

  const openRecordingFolder = useCallback(() => {
    Analytics.trackButtonClick("open_recording_folder", "meeting_details")
    void handleOpenMeetingFolder()
  }, [handleOpenMeetingFolder])

  const canRetranscribe = !hasEvidence && betaFeatures.importAndRetranscribe && Boolean(meeting.folder_path)
  const menuItems = useMemo<DocToolbarMenuItem[]>(() => {
    const items: DocToolbarMenuItem[] = [
      { id: "copy-transcript", label: "Copy transcript", onSelect: copyTranscript },
      { id: "open-recording-folder", label: "Open recording folder", onSelect: openRecordingFolder },
    ]
    const retranscribe: DocToolbarMenuItem[] = canRetranscribe
      ? [
          {
            id: "retranscribe",
            label: "Retranscribe…",
            onSelect: () => {
              Analytics.trackButtonClick("enhance_transcript", "meeting_details")
              setRetranscribeOpen(true)
            },
          },
        ]
      : []
    const deletion: DocToolbarMenuItem = {
      id: "delete-meeting",
      label: "Delete meeting…",
      danger: true,
      separatorBefore: true,
      disabled: isDeleteDisabled(meeting.lifecycle),
      onSelect: () => setDeleteOpen(true),
    }
    return [...items, ...retranscribe, deletion]
  }, [canRetranscribe, copyTranscript, openRecordingFolder, meeting.lifecycle])

  const shift = drawerOpen ? drawerShift(mainWidth) : 0

  return (
    <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-content">
      <DocToolbar
        originLabel={originLabel}
        title={meeting.title}
        showCompactTitle={compactTitle}
        scrolled={scrolled}
        drawerOpen={drawerOpen}
        onBack={goBack}
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
        menuItems={menuItems}
      />
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pt-[52px]">
        <div
          className="transition-transform ease-drawer"
          style={{ transform: shift > 0 ? `translateX(-${shift}px)` : undefined, transitionDuration: drawerOpen ? "300ms" : "200ms" }}
        >
          <div className="mx-auto w-[min(720px,calc(100%-112px))] pb-[160px] pt-[30px]">{children}</div>
        </div>
      </div>
      <TranscriptDrawer
        ref={drawerRef}
        meetingId={meeting.id}
        title={meeting.title}
        dateLabel={formatMeetingDay(meeting.created_at) ?? undefined}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        highlight={highlight}
        onCopyTranscript={copyTranscript}
        onOpenRecordingFolder={openRecordingFolder}
      />
      <DeleteMeetingAlert
        meetingId={meeting.id}
        title={meeting.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => void refetchMeetings()}
      />
      {canRetranscribe && meeting.folder_path && (
        <RetranscribeDialog
          open={retranscribeOpen}
          onOpenChange={setRetranscribeOpen}
          meetingId={meeting.id}
          meetingFolderPath={meeting.folder_path}
          onComplete={async () => {
            await onRefetchTranscripts?.()
          }}
        />
      )}
    </div>
  )
}
