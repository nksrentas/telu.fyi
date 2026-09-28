"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/telu-ui/indicators"
import {
  getKnowledgeItemHistory,
  type KnowledgeItemHistory,
  type KnowledgeItemView,
  type RevisionView,
} from "@/lib/knowledge-service"
import { useEvidenceNavigation } from "./meeting-page"
import { formatRunTime } from "./run-details-popover"
import { SourceChip, claimLinks } from "./source-chip"

type HistoryState = { status: "loading" } | { status: "error" } | { status: "ready"; history: KnowledgeItemHistory }

interface ItemVersion {
  text: string
  ownerText: string | null
  dueText: string | null
}

const EVIDENCE_LABEL = { valid: "Evidence unchanged", changed: "Evidence changed", missing: "Evidence missing" } as const

function fieldChange(label: string, next: string | null, previous: string | null): string | null {
  if (next === previous) return null
  return `${label}: ${next ?? "not stated"} (was ${previous ?? "not stated"})`
}

export function revisionChanges(revision: ItemVersion, previous: ItemVersion): string[] {
  return [
    fieldChange("Owner", revision.ownerText, previous.ownerText),
    fieldChange("Due", revision.dueText, previous.dueText),
  ].filter((change): change is string => change !== null)
}

function proposalFields(version: ItemVersion): string[] {
  return [version.ownerText && `Owner: ${version.ownerText}`, version.dueText && `Due: ${version.dueText}`].filter(
    (field): field is string => Boolean(field)
  )
}

function oldestFirst(revisions: RevisionView[]): RevisionView[] {
  return [...revisions].sort((left, right) => left.createdAtUtc.localeCompare(right.createdAtUtc))
}

function useItemHistory(meetingId: string, itemId: string, open: boolean) {
  const [state, setState] = useState<HistoryState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!open) return
    let current = true
    setState({ status: "loading" })
    getKnowledgeItemHistory(meetingId, itemId)
      .then((history) => {
        if (current) setState({ status: "ready", history })
      })
      .catch((error: unknown) => {
        console.error("Failed to load knowledge item history:", error)
        if (current) setState({ status: "error" })
      })
    return () => {
      current = false
    }
  }, [meetingId, itemId, open, attempt])
  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  return { state, retry }
}

function HistoryEntry({ label, when, text, details }: { label: string; when: string; text: string; details: string[] }) {
  return (
    <li className="space-y-0.5 py-2 [&+&]:shadow-[inset_0_0.5px_0_var(--separator)]">
      <p className="m-0 text-[11px] text-label-3">
        {label} · {formatRunTime(when)}
      </p>
      <p className="selectable m-0 break-words text-[13px] text-label">{text}</p>
      {details.map((detail) => (
        <p key={detail} className="m-0 break-words text-[12px] text-label-2">
          {detail}
        </p>
      ))}
    </li>
  )
}

function HistoryBody({ history, item, onOpenEvidence }: { history: KnowledgeItemHistory; item: KnowledgeItemView; onOpenEvidence: () => void }) {
  const revisions = oldestFirst(history.revisions)
  return (
    <>
      <ol className="m-0 list-none p-0">
        <HistoryEntry
          label="Proposed by Telu"
          when={history.original.createdAtUtc}
          text={history.original.text}
          details={proposalFields(history.original)}
        />
        {revisions.map((revision, index) => (
          <HistoryEntry
            key={revision.revisionId}
            label="Corrected by you"
            when={revision.createdAtUtc}
            text={revision.text}
            details={revisionChanges(revision, index === 0 ? history.original : revisions[index - 1])}
          />
        ))}
      </ol>
      <div className="mt-1 space-y-1.5 pt-2.5 shadow-[inset_0_0.5px_0_var(--separator)]">
        <div className="flex items-center gap-2 text-[12px] text-label-2">
          {EVIDENCE_LABEL[item.evidenceStatus]}
          <SourceChip item={item} onOpen={onOpenEvidence} />
        </div>
        <p className="selectable m-0 text-[11px] text-label-3">
          ID {item.itemId.slice(0, 8)} · run of {formatRunTime(history.runStartedAtUtc)}
        </p>
      </div>
    </>
  )
}

interface HistoryPopoverProps {
  meetingId: string
  item: KnowledgeItemView
  children: ReactNode
}

export function HistoryPopover({ meetingId, item, children }: HistoryPopoverProps) {
  const [open, setOpen] = useState(false)
  const { openEvidence } = useEvidenceNavigation()
  const { state, retry } = useItemHistory(meetingId, item.itemId, open)
  const openItemEvidence = () => {
    setOpen(false)
    openEvidence(claimLinks(item))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="max-h-[60vh] w-[330px] overflow-y-auto p-3.5">
        <p className="m-0 text-[11px] font-semibold text-label-3">History</p>
        {state.status === "loading" && (
          <div aria-busy className="mt-2 space-y-2">
            <Skeleton active />
            <Skeleton active shape="line-short" />
          </div>
        )}
        {state.status === "error" && (
          <div className="mt-2 flex items-center gap-2">
            <p className="m-0 flex-1 text-[12px] text-label-2">Couldn&apos;t load the history.</p>
            <Button variant="plain" size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
        {state.status === "ready" && <HistoryBody history={state.history} item={item} onOpenEvidence={openItemEvidence} />}
      </PopoverContent>
    </Popover>
  )
}
