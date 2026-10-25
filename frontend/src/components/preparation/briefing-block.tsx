"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { CircleX, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { BriefContents, sourceName, useSourceLabels, type SourceLabels } from "@/components/preparation/brief-contents"
import { SourceManifest } from "@/components/preparation/source-manifest"
import type { SourceTarget } from "@/components/preparation/source-viewer"
import { claimLinks, highlightFor, type EvidenceHighlight } from "@/components/living-doc/transcript-drawer"
import { formatRunTime } from "@/components/living-doc/run-details-popover"
import { LOCATION, RunNotice } from "@/components/living-doc/run-notice"
import { ProviderBoundary, type ProviderRouteViewState } from "@/components/ProviderBoundary"
import { Icon } from "@/components/telu-ui/icon"
import { Spinner } from "@/components/telu-ui/indicators"
import { Button } from "@/components/ui/button"
import { getMeetingKnowledge } from "@/lib/knowledge-service"
import {
  cancelBriefing,
  generateBriefing,
  getBriefing,
  onPreparationUpdated,
  type BriefingClaim,
  type BriefingView,
  type StoredBriefing,
} from "@/lib/preparation-service"
import { isProviderRouteFailureError, isRouteAvailable, validateProviderRoute } from "@/services/providerRouteService"

export const BRIEFING_COPY = {
  idle: "Telu prepares a brief from your purpose and the sources you include. Every line links to where it came from.",
  preparing: "Preparing the brief…",
  cancelled: "Stopped. Nothing was saved.",
  stale: "Your sources changed while Telu was preparing. Prepare again to use them.",
  briefStale: "Some sources changed since this brief was prepared.",
  modelFailed: "The model didn't answer. Nothing was saved.",
  parseFailed: "Telu couldn't use the model's answer. Nothing was saved.",
  failed: "Telu couldn't prepare this brief. Nothing was saved.",
  startFailed: "Couldn't start preparing. Try again.",
  stopFailed: "Couldn't stop preparing. Try again.",
  loadFailed: "Couldn't load the brief.",
  itemGone: "That meeting item is no longer available.",
  transcriptFailed: "Couldn't open this meeting's transcript.",
}

const INITIAL_ROUTE: ProviderRouteViewState = { status: "loading", route: null, failure: null }

export interface TranscriptTarget {
  meetingId: string
  title: string
  highlight: EvidenceHighlight
}

interface BriefingBlockProps {
  plannedMeetingId: string
  revision: number
  onOpenSource: (target: SourceTarget) => void
  onOpenTranscript: (target: TranscriptTarget) => void
}

function failureCopy(code: string | null): string {
  if (code === "PREP_MODEL_FAILED") return BRIEFING_COPY.modelFailed
  if (code === "PREP_PARSE_FAILED") return BRIEFING_COPY.parseFailed
  return BRIEFING_COPY.failed
}

function locatorOf(json: string | null): SourceTarget["locator"] {
  if (!json) return undefined
  try {
    const { start, end } = JSON.parse(json) as { start?: unknown; end?: unknown }
    return typeof start === "number" && typeof end === "number" ? { start, end } : undefined
  } catch {
    return undefined
  }
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

const PROVENANCE_NAME_MAX = 48

function shortName(name: string): string {
  return name.length > PROVENANCE_NAME_MAX ? `${name.slice(0, PROVENANCE_NAME_MAX - 1).trimEnd()}…` : name
}

function provenanceLine(briefing: StoredBriefing, labels: SourceLabels, shorten: (name: string) => string): string {
  const used = briefing.manifest.filter((entry) => entry.status === "included" || entry.status === "truncated")
  const documents = used.flatMap(({ source }) => (source.kind === "document" ? [shorten(sourceName(source, labels))] : []))
  const items = used.length - documents.length
  const parts = ["your purpose", ...documents]
  if (items > 0) parts.push(items === 1 ? "1 past-meeting item" : `${items} past-meeting items`)
  const leftOut = briefing.manifest.length - used.length
  const tail = leftOut > 0 ? ` · ${leftOut} left out` : ""
  return `Prepared from ${listNames(parts)} · ${formatRunTime(briefing.createdUtc)}${tail}`
}

function useBriefing(plannedMeetingId: string, revision: number) {
  const [view, setView] = useState<BriefingView | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const reload = useCallback(() => {
    return getBriefing(plannedMeetingId)
      .then((loaded) => {
        setView(loaded)
        setLoadFailed(false)
      })
      .catch((error: unknown) => {
        console.error("Failed to load briefing:", error)
        setLoadFailed(true)
      })
  }, [plannedMeetingId])

  useEffect(() => {
    void reload()
  }, [reload, revision])

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let active = true
    onPreparationUpdated(plannedMeetingId, () => void reload())
      .then((stop) => (active ? (unlisten = stop) : stop()))
      .catch((error: unknown) => console.error("Failed to listen for briefing updates:", error))
    return () => {
      active = false
      unlisten?.()
    }
  }, [plannedMeetingId, reload])

  return { view, setView, loadFailed, reload }
}

function StateLine({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "failed" }) {
  return (
    <p className="m-0 flex items-start gap-2 text-[13px] text-label-2">
      {tone === "failed" && <Icon icon={CircleX} size={16} className="mt-px shrink-0 text-coral-ink" />}
      <span>{children}</span>
    </p>
  )
}

export function BriefingBlock({ plannedMeetingId, revision, onOpenSource, onOpenTranscript }: BriefingBlockProps) {
  const [routeState, setRouteState] = useState<ProviderRouteViewState>(INITIAL_ROUTE)
  const [routeBlocked, setRouteBlocked] = useState(false)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const { view, setView, loadFailed, reload } = useBriefing(plannedMeetingId, revision)
  const briefing = view?.briefing ?? null
  const run = view?.run ?? null
  const labels = useSourceLabels(briefing)
  const running = run?.status === "running"

  const prepare = async () => {
    if (routeState.status !== "validated") return
    setStarting(true)
    try {
      const fresh = await validateProviderRoute(routeState.route)
      if (!isRouteAvailable(fresh)) {
        setRouteBlocked(true)
        return
      }
      const started = await generateBriefing(plannedMeetingId, fresh)
      setRouteBlocked(false)
      setView((current) => ({ briefing: current?.briefing ?? null, run: started }))
    } catch (error: unknown) {
      console.error("Failed to start briefing:", error)
      if (isProviderRouteFailureError(error) || String(error).startsWith("PROVIDER_ROUTE_")) setRouteBlocked(true)
      else toast.error(BRIEFING_COPY.startFailed)
      void reload()
    } finally {
      setStarting(false)
    }
  }

  const stop = () => {
    setStopping(true)
    cancelBriefing(plannedMeetingId)
      .then(() => reload())
      .catch((error: unknown) => {
        console.error("Failed to stop briefing:", error)
        toast.error(BRIEFING_COPY.stopFailed)
      })
      .finally(() => setStopping(false))
  }

  const openTranscript = async (meetingId: string, itemId: string) => {
    try {
      const knowledge = await getMeetingKnowledge(meetingId)
      const item = [...knowledge.items, ...knowledge.rejected].find((candidate) => candidate.itemId === itemId)
      if (!item) {
        toast.error(BRIEFING_COPY.itemGone)
        return
      }
      const title = labels.meetings[meetingId]?.title ?? "Transcript"
      onOpenTranscript({ meetingId, title, highlight: highlightFor(claimLinks(item)) })
    } catch (error: unknown) {
      console.error("Failed to open transcript:", error)
      toast.error(BRIEFING_COPY.transcriptFailed)
    }
  }

  const openClaim = (claim: BriefingClaim) => {
    const { source } = claim
    if (source.kind === "document") {
      onOpenSource({ versionId: source.versionId, locator: locatorOf(claim.locatorJson) })
    } else {
      void openTranscript(source.meetingId, source.itemId)
    }
  }

  const prepareButton = (label: string) => (
    <Button
      variant="primary"
      size="sm"
      disabled={routeState.status !== "validated" || routeBlocked || starting}
      onClick={() => void prepare()}
    >
      {label}
    </Button>
  )
  const notice = (label: string) => <RunNotice routeState={routeState} blocked={routeBlocked} action={prepareButton(label)} />

  const status = () => {
    if (loadFailed) return <StateLine tone="failed">{BRIEFING_COPY.loadFailed}</StateLine>
    if (!view) return null
    if (running) {
      return (
        <div role="status" className="flex items-center gap-2 text-[13px] text-label-2">
          <Spinner active />
          <span>
            {BRIEFING_COPY.preparing} · {LOCATION[run.locationClass].label} · {run.sanitizedOrigin}
          </span>
          <Button variant="plain" size="sm" disabled={stopping} onClick={stop}>
            Stop
          </Button>
        </div>
      )
    }
    const again = briefing ? "Prepare again" : "Prepare"
    if (run?.status === "failed") return <><StateLine tone="failed">{failureCopy(run.failureCode)}</StateLine>{notice("Try again")}</>
    if (run?.status === "cancelled") return <><StateLine>{BRIEFING_COPY.cancelled}</StateLine>{notice(again)}</>
    if (run?.status === "stale") return <><StateLine>{BRIEFING_COPY.stale}</StateLine>{notice(again)}</>
    if (briefing?.stale) {
      return (
        <>
          <p className="m-0 flex items-center gap-1.5 text-[12px] text-label-2">
            <RefreshCw aria-hidden className="size-3 text-amber" strokeWidth={2} />
            {BRIEFING_COPY.briefStale}
          </p>
          {notice(again)}
        </>
      )
    }
    if (briefing) return notice(again)
    return <><StateLine>{BRIEFING_COPY.idle}</StateLine>{notice("Prepare")}</>
  }

  return (
    <section
      aria-labelledby="briefing-heading"
      aria-busy={running || undefined}
      className="relative mt-11 space-y-3 rounded-[16px] bg-accent-softer pb-5 pl-[26px] pr-[22px] pt-[18px] before:absolute before:inset-y-4 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
    >
      <ProviderBoundary capability="summary" className="hidden" showUnavailableAlert={false} onRouteStateChange={setRouteState} />
      <h2 id="briefing-heading" className="m-0 text-[11px] font-semibold uppercase tracking-[0.07em] text-accent-strong">
        Next
      </h2>
      {status()}
      {briefing && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p title={provenanceLine(briefing, labels, (name) => name)} className="m-0 text-[12px] text-label-3">
              {provenanceLine(briefing, labels, shortName)}
            </p>
            <SourceManifest
              manifest={briefing.manifest}
              droppedCount={briefing.droppedCount}
              labels={labels}
            />
          </div>
          <BriefContents briefing={briefing} labels={labels} onOpen={openClaim} />
        </>
      )}
    </section>
  )
}
