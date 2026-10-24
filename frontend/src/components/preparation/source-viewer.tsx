"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/telu-ui/indicators"
import { getDocumentVersion, type DocumentVersionView } from "@/lib/document-service"
import { cn } from "@/lib/utils"

interface SourceLocator {
  start: number
  end: number
}

export interface SourceTarget {
  versionId: string
  locator?: SourceLocator
}

interface SourceViewerProps {
  target: SourceTarget | null
  onClose: () => void
}

interface ParsedLocator extends SourceLocator {
  headingPath: string[]
}

type ViewState = { status: "loading" } | { status: "error" } | { status: "ready"; view: DocumentVersionView }
type LoadedState = { target: SourceTarget; state: ViewState }

const LOAD_ERROR = "Couldn't open this source."

function parseLocator(json: string): ParsedLocator {
  try {
    const value = JSON.parse(json) as { start?: unknown; end?: unknown; heading_path?: unknown }
    return {
      start: typeof value.start === "number" ? value.start : -1,
      end: typeof value.end === "number" ? value.end : -1,
      headingPath: Array.isArray(value.heading_path) ? value.heading_path.filter((item): item is string => typeof item === "string") : [],
    }
  } catch {
    return { start: -1, end: -1, headingPath: [] }
  }
}

function overlaps(passage: ParsedLocator, locator: SourceLocator): boolean {
  return passage.start >= 0 && passage.start < locator.end && locator.start < passage.end
}

function newHeadings(previous: string[], current: string[]): { title: string; depth: number }[] {
  let shared = 0
  while (shared < previous.length && shared < current.length && previous[shared] === current[shared]) shared += 1
  return current.slice(shared).map((title, index) => ({ title, depth: shared + index }))
}

function useVersionView(target: SourceTarget | null) {
  const [loaded, setLoaded] = useState<LoadedState | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!target) return
    let current = true
    setLoaded({ target, state: { status: "loading" } })
    getDocumentVersion(target.versionId).then((result) => {
      if (!current) return
      if (result.ok) setLoaded({ target, state: { status: "ready", view: result.value } })
      else {
        console.error("Failed to load source version:", result.code)
        setLoaded({ target, state: { status: "error" } })
      }
    })
    return () => {
      current = false
    }
  }, [target, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const state: ViewState = loaded && loaded.target === target ? loaded.state : { status: "loading" }
  return { state, retry }
}

function isLayerOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null
}

function useReturnFocus(open: boolean) {
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open])
}

function useEscapeToClose(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: Event) => {
      if ((event as KeyboardEvent).key !== "Escape" || isLayerOpen()) return
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [open, close])
}

function SourceText({ view, locator }: { view: DocumentVersionView; locator?: SourceLocator }) {
  const highlightRef = useRef<HTMLElement>(null)
  const markdown = view.document.format === "markdown"
  const passages = useMemo(
    () => view.passages.map((passage) => ({ passage, locator: parseLocator(passage.locatorJson) })),
    [view.passages]
  )
  const highlighted = new Set(locator ? passages.filter((entry) => overlaps(entry.locator, locator)).map((entry) => entry.passage.id) : [])
  const firstHighlighted = passages.find((entry) => highlighted.has(entry.passage.id))?.passage.id

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "center" })
  }, [firstHighlighted])

  return (
    <div className="selectable space-y-2.5 px-2 pb-4 text-[13px] leading-[1.55] text-label">
      {passages.map(({ passage, locator: parsed }, index) => (
        <div key={passage.id}>
          {markdown &&
            newHeadings(index > 0 ? passages[index - 1].locator.headingPath : [], parsed.headingPath).map(({ title, depth }) =>
              depth === 0 ? (
                <h3 key={`${depth}-${title}`} className="m-0 mb-1.5 mt-4 text-[15px] font-semibold text-label first:mt-0">
                  {title}
                </h3>
              ) : (
                <h4 key={`${depth}-${title}`} className="m-0 mb-1 mt-3 text-[13px] font-semibold text-label-2">
                  {title}
                </h4>
              )
            )}
          <p className="m-0 whitespace-pre-wrap">
            {highlighted.has(passage.id) ? (
              <mark
                ref={passage.id === firstHighlighted ? highlightRef : undefined}
                className="rounded-[3px] bg-accent-soft text-accent-strong"
              >
                {passage.text}
              </mark>
            ) : (
              passage.text
            )}
          </p>
        </div>
      ))}
    </div>
  )
}

function LoadingText() {
  return (
    <div aria-busy className="space-y-3 px-2 py-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} active shape={index % 2 === 0 ? "line" : "line-short"} />
      ))}
    </div>
  )
}

export function SourceViewer({ target, onClose }: SourceViewerProps) {
  const open = target !== null
  const [lastTarget, setLastTarget] = useState<SourceTarget | null>(target)
  const shown = target ?? lastTarget
  const [instantClose, setInstantClose] = useState(false)
  const { state, retry } = useVersionView(shown)

  useEffect(() => {
    if (!target) return
    setLastTarget(target)
    setInstantClose(false)
  }, [target])

  const closeInstantly = useCallback(() => {
    setInstantClose(true)
    onClose()
  }, [onClose])
  useEscapeToClose(open, closeInstantly)
  useReturnFocus(open)

  const view = state.status === "ready" ? state.view : null
  const deleted = view?.document.availability === "deleted"
  const older = view && view.version.version < view.latestVersion

  return (
    <aside
      role="complementary"
      aria-label="Source"
      data-state={open ? "open" : "closed"}
      data-instant={instantClose || undefined}
      className="fixed bottom-2.5 right-2.5 top-[calc(var(--toolbar-h)+2px)] z-40 flex w-[340px] flex-col rounded-[18px] bg-glass-strong shadow-float backdrop-blur-[30px] backdrop-saturate-[1.8] transition-[transform,visibility] ease-drawer data-[instant]:duration-0 data-[state=closed]:invisible data-[state=closed]:translate-x-[calc(100%+24px)] data-[state=closed]:duration-200 data-[state=open]:duration-300"
    >
      <header className="flex items-start gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-semibold text-label">{view?.document.title ?? "Source"}</h2>
          {view && !deleted && (
            <p className={cn("text-[11px] tabular-nums", older ? "text-label" : "text-label-2")}>
              {older ? `Version ${view.version.version} of ${view.latestVersion}` : view.document.format === "markdown" ? "Markdown" : "Text"}
            </p>
          )}
          <p className="text-[11px] text-label-3">Stored on this Mac</p>
        </div>
        <Button variant="plain" size="sm" icon aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!shown ? null : state.status === "loading" ? (
          <LoadingText />
        ) : state.status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-3 py-6 text-center">
            <p className="m-0 text-[13px] text-label-2">{LOAD_ERROR}</p>
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : deleted ? (
          <p className="m-0 px-3 py-6 text-center text-[13px] text-label-2">This source was deleted</p>
        ) : (
          <SourceText view={state.view} locator={shown.locator} />
        )}
      </div>
    </aside>
  )
}
