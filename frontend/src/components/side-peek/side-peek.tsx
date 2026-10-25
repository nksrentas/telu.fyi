"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, X } from "lucide-react"

import PageContent from "@/app/meeting-details/page-content"
import { meetingHref, type AgendaOrigin } from "@/components/agenda/agenda-timeline"
import { EvidenceNavigationContext } from "@/components/living-doc/meeting-page"
import { highlightFor } from "@/components/living-doc/transcript-drawer"
import type { EvidenceHighlight } from "@/components/living-doc/transcript-drawer"
import { Skeleton } from "@/components/telu-ui/indicators"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMeetingDocument } from "@/hooks/meeting-details/use-meeting-document"
import type { EvidenceLinkView } from "@/lib/knowledge-service"
import { MEETINGS_CHANGED_EVENT } from "@/lib/meeting-deletion-service"
import { DURATION, EASE, INSTANT } from "@/lib/motion"
import { InlineTranscript } from "./inline-transcript"

export const PEEK_WIDTH = "max(440px,44%)"
export const PEEK_PADDING_CLASS = "pr-[calc(max(440px,44%)+24px)]"
const EVIDENCE_SCROLL_DELAY_MS = 280
const OFFSCREEN = "calc(100% + 48px)"

const peekVariants = {
  hidden: (instant: boolean) => ({ x: OFFSCREEN, transition: instant ? INSTANT : { duration: DURATION.drawerClose, ease: EASE.drawer } }),
  shown: (instant: boolean) => ({ x: 0, transition: instant ? INSTANT : { duration: DURATION.drawerOpen, ease: EASE.drawer } }),
}

const swapVariants = {
  hidden: (instant: boolean) => ({ opacity: 0, transition: instant ? INSTANT : { duration: DURATION.crossfadeOut, ease: EASE.out } }),
  shown: (instant: boolean) => ({ opacity: 1, transition: instant ? INSTANT : { duration: DURATION.crossfadeIn, ease: EASE.out } }),
}

export interface PeekTarget {
  meetingId: string
  instant: boolean
  focusKnowledge: boolean
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function usePeekEvidence(meetingStartedAt: string | null) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [highlight, setHighlight] = useState<EvidenceHighlight | null>(null)
  const lineRefs = useRef(new Map<string, HTMLElement>())
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const openEvidence = useCallback((links: EvidenceLinkView[]) => {
    if (links.length === 0) return
    setHighlight(highlightFor(links))
    setTranscriptOpen(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const behavior = prefersReducedMotion() ? "auto" : "smooth"
      lineRefs.current.get(links[0].evidenceId)?.scrollIntoView?.({ block: "center", behavior })
    }, EVIDENCE_SCROLL_DELAY_MS)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])
  const navigation = useMemo(() => ({ meetingStartedAt, openEvidence }), [meetingStartedAt, openEvidence])
  return { navigation, transcriptOpen, setTranscriptOpen, highlight, lineRefs }
}

function PeekSkeleton() {
  return (
    <div aria-busy className="space-y-3 pt-2">
      <Skeleton active shape="line-short" className="h-5" />
      <Skeleton active className="w-[40%]" />
      <Skeleton active />
      <Skeleton active shape="line-short" />
    </div>
  )
}

interface PeekBodyProps {
  meetingId: string
  focusKnowledge: boolean
  scrollRef: RefObject<HTMLDivElement>
}

function PeekBody({ meetingId, focusKnowledge, scrollRef }: PeekBodyProps) {
  const document = useMeetingDocument(meetingId)
  const evidence = usePeekEvidence(document.meeting?.created_at ?? null)
  const loaded = document.meeting !== null

  useEffect(() => {
    if (focusKnowledge && loaded) scrollRef.current?.querySelector?.("#knowledge")?.scrollIntoView?.({ block: "start" })
  }, [focusKnowledge, loaded, scrollRef])

  if (document.error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 pt-2 text-[13px] text-label-2">
        Couldn&apos;t load this meeting.
        <Button size="sm" onClick={() => void document.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (!document.meeting) return <PeekSkeleton />
  return (
    <EvidenceNavigationContext.Provider value={evidence.navigation}>
      <PageContent
        meeting={document.meeting}
        summaryData={document.meetingSummary}
        initialSummary={document.summaryResponse}
        onMeetingUpdated={document.refetch}
        surface="peek"
        hasEvidence={document.hasEvidence}
        durationSeconds={document.durationSeconds}
      />
      <InlineTranscript
        meetingId={meetingId}
        open={evidence.transcriptOpen}
        onOpenChange={evidence.setTranscriptOpen}
        highlight={evidence.highlight}
        lineRefs={evidence.lineRefs}
      />
    </EvidenceNavigationContext.Provider>
  )
}

function PeekBar({ scrolled, onOpenPage, onClose }: { scrolled: boolean; onOpenPage: () => void; onClose: () => void }) {
  return (
    <div
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-[3] flex h-[46px] items-center gap-1 rounded-tl-[14px] pl-5 pr-2.5 transition-[background-color,box-shadow] duration-200 data-[scrolled]:bg-[color:color-mix(in_srgb,var(--content-bg)_82%,transparent)] data-[scrolled]:shadow-[0_0.5px_0_var(--separator)] data-[scrolled]:backdrop-blur-[18px] data-[scrolled]:backdrop-saturate-[1.6]"
    >
      <span className="flex-1" />
      <Button variant="plain" size="sm" className="gap-1 text-label-2" onClick={onOpenPage}>
        Open as page
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="plain" size="sm" icon aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close · esc</TooltipContent>
      </Tooltip>
    </div>
  )
}

interface SidePeekProps {
  target: PeekTarget
  origin: AgendaOrigin
  onClose: (instant: boolean) => void
}

export function SidePeek({ target, origin, onClose }: SidePeekProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const openPage = () => router.push(meetingHref({ id: target.meetingId }, origin))

  return (
    <motion.aside
      aria-label="Side peek"
      custom={target.instant}
      variants={peekVariants}
      initial={target.instant ? false : "hidden"}
      animate="shown"
      exit="hidden"
      style={{ width: PEEK_WIDTH }}
      className="absolute bottom-0 right-0 top-[52px] z-[35] flex flex-col rounded-tl-[14px] bg-content shadow-[-0.5px_0_0_var(--separator),0_-0.5px_0_var(--separator),-22px_0_44px_-24px_rgba(0,0,0,0.22)]"
    >
      <div
        ref={scrollRef}
        onScroll={() => setScrolled((scrollRef.current?.scrollTop ?? 0) > 2)}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <PeekBar scrolled={scrolled} onOpenPage={openPage} onClose={() => onClose(false)} />
        {target.instant ? (
          <div key={target.meetingId} className="px-6 pb-12 pt-1">
            <PeekBody meetingId={target.meetingId} focusKnowledge={target.focusKnowledge} scrollRef={scrollRef} />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={target.meetingId}
              custom={false}
              variants={swapVariants}
              initial="hidden"
              animate="shown"
              exit="hidden"
              className="px-6 pb-12 pt-1"
            >
              <PeekBody meetingId={target.meetingId} focusKnowledge={target.focusKnowledge} scrollRef={scrollRef} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.aside>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.getAttribute !== "function") return false
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable === true
}

function isLayerOpen(): boolean {
  return typeof document !== "undefined" && typeof document.querySelector === "function"
    && document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]') !== null
}

export function usePeek(selectedId: string | null) {
  const [peek, setPeek] = useState<PeekTarget | null>(null)
  const [closeInstant, setCloseInstant] = useState(false)

  const openPeek = useCallback((meetingId: string, options: { instant: boolean; focusKnowledge?: boolean }) => {
    setPeek({ meetingId, instant: options.instant, focusKnowledge: options.focusKnowledge ?? false })
  }, [])

  const closePeek = useCallback((instant: boolean) => {
    setCloseInstant(instant)
    setPeek(null)
  }, [])

  useEffect(() => {
    if (peek && selectedId && selectedId !== peek.meetingId) setPeek({ meetingId: selectedId, instant: true, focusKnowledge: false })
  }, [peek, selectedId])

  useEffect(() => {
    if (!peek) return
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<{ meetingId?: string }>).detail?.meetingId === peek.meetingId) closePeek(true)
    }
    window.addEventListener(MEETINGS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(MEETINGS_CHANGED_EVENT, onChanged)
  }, [peek, closePeek])

  useEffect(() => {
    if (!peek) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isLayerOpen()) return
      if (isTypingTarget(event.target)) {
        const field = event.target as HTMLElement
        field.blur?.()
        return
      }
      event.preventDefault()
      closePeek(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [peek, closePeek])

  return { peek, closeInstant, openPeek, closePeek }
}

export function PeekLayer({ peek, closeInstant, origin, onClose }: { peek: PeekTarget | null; closeInstant: boolean; origin: AgendaOrigin; onClose: (instant: boolean) => void }) {
  if (!peek && closeInstant) return null
  return (
    <AnimatePresence custom={closeInstant}>
      {peek && <SidePeek key="peek" target={peek} origin={origin} onClose={onClose} />}
    </AnimatePresence>
  )
}
