"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { ClipboardPaste, FileUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  importDocument,
  listDocuments,
  pasteDocument,
  type DocumentFormat,
  type DocumentResult,
  type DocumentSummary,
  type DocumentVersion,
  type ExtractionStatus,
} from "@/lib/document-service"
import { listSelectedSources, selectSources, type SelectedSource } from "@/lib/preparation-service"
import { cn } from "@/lib/utils"

const SOURCE_ERRORS: Record<string, string> = {
  "SOURCE_TOO_LARGE:MAX_SOURCE_BYTES": "This source is over 1 MB. Split it or paste a shorter part.",
  "SOURCE_TOO_LARGE:MAX_SOURCE_CHARS": "This source is over 200,000 characters. Split it or paste a shorter part.",
  "SOURCE_TOO_LARGE:MAX_PASSAGES": "This source has over 2,000 paragraphs. Split it or paste a shorter part.",
  UNSUPPORTED_FORMAT: "Telu reads Markdown and plain text files only.",
  EMPTY_SOURCE: "This source has no text.",
  DOCUMENT_TITLE_REQUIRED: "Give the source a title.",
  SOURCE_UNREADABLE: "Couldn't read that file. Check that it still exists.",
  SELECTION_TOO_LARGE: "A meeting can include up to 12 documents.",
  SOURCE_NOT_ELIGIBLE: "That source can no longer be included.",
}
const FALLBACK_ERROR = "Couldn't add this source."
const LOAD_ERROR = "Couldn't load sources."
const UNREADABLE_NOT_INCLUDED = "Couldn't read the text of this source, so it can't be included."

const FORMAT_LABEL: Record<DocumentFormat, string> = { markdown: "Markdown", text: "Text" }
const FORMAT_BADGE: Record<DocumentFormat, string> = { markdown: "MD", text: "TXT" }
const STATUS_LABEL: Record<ExtractionStatus, string> = { extracted: "Ready", pending: "Reading…", failed: "Couldn't read text" }

function sourceErrorMessage(code: string): string {
  return SOURCE_ERRORS[code] ?? FALLBACK_ERROR
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function useSources(plannedMeetingId: string) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null)
  const [selection, setSelection] = useState<SelectedSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<SelectedSource[]>([])
  const queue = useRef<Promise<void>>(Promise.resolve())

  const show = useCallback((sources: SelectedSource[]) => {
    latest.current = sources
    setSelection(sources)
  }, [])

  const reload = useCallback(async () => {
    const listed = await listDocuments()
    if (!listed.ok) {
      setError(LOAD_ERROR)
      return
    }
    setDocuments(listed.value.filter((document) => document.availability === "available"))
  }, [])

  useEffect(() => {
    reload()
    listSelectedSources(plannedMeetingId)
      .then(show)
      .catch((loadError: unknown) => {
        console.error("Failed to load selected sources:", loadError)
        setError(LOAD_ERROR)
      })
  }, [plannedMeetingId, reload, show])

  const select = useCallback(
    (change: (current: SelectedSource[]) => SelectedSource[]) => {
      queue.current = queue.current.then(async () => {
        try {
          show(await selectSources(plannedMeetingId, change(latest.current)))
          setError(null)
        } catch (selectError) {
          setError(sourceErrorMessage(String(selectError)))
        }
      })
      return queue.current
    },
    [plannedMeetingId, show]
  )

  const add = useCallback(
    async (result: DocumentResult<DocumentVersion | null>): Promise<string | null> => {
      if (!result.ok) return result.code
      if (!result.value) return null
      await reload()
      const versionId = result.value.id
      if (result.value.extractionStatus === "extracted") await select((current) => [...current, { kind: "document", versionId }])
      return null
    },
    [reload, select]
  )

  return { documents, selection, error, setError, select, add }
}

interface SourcesPanelProps {
  plannedMeetingId: string
  onOpenSource: (versionId: string) => void
}

export function SourcesPanel({ plannedMeetingId, onOpenSource }: SourcesPanelProps) {
  const { documents, selection, error, setError, select, add } = useSources(plannedMeetingId)
  const [pasting, setPasting] = useState(false)
  const included = new Set(selection.flatMap((source) => (source.kind === "document" ? [source.versionId] : [])))

  const toggle = (versionId: string) =>
    select((current) =>
      current.some((source) => source.kind === "document" && source.versionId === versionId)
        ? current.filter((source) => source.kind !== "document" || source.versionId !== versionId)
        : [...current, { kind: "document", versionId }]
    )

  const runImport = async () => {
    const code = await add(await importDocument())
    if (code) setError(sourceErrorMessage(code))
  }

  return (
    <section aria-labelledby="planned-sources-heading" className="mt-11">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="planned-sources-heading" className="m-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-label-3">
          Sources
        </h2>
        <Button variant="plain" size="sm" onClick={() => setPasting(true)} className="gap-1 text-accent">
          <ClipboardPaste className="size-3" aria-hidden />
          Paste
        </Button>
        <Button variant="plain" size="sm" onClick={runImport} className="gap-1 text-accent">
          <FileUp className="size-3" aria-hidden />
          Import
        </Button>
      </div>
      {error && (
        <p role="alert" className="m-0 mb-2 text-[12px] text-coral-ink">
          {error}
        </p>
      )}
      {documents?.length === 0 && (
        <p className="m-0 rounded-[12px] bg-surface-sunken px-3.5 py-3 text-[12px] text-label-2">
          No sources yet. Paste notes or import a Markdown or text file.
        </p>
      )}
      {documents && documents.length > 0 && (
        <ul className="m-0 list-none space-y-1 p-0">
          {documents.map((document) => (
            <SourceRow
              key={document.id}
              document={document}
              included={included.has(document.latestVersionId)}
              onToggle={() => toggle(document.latestVersionId)}
              onOpen={() => onOpenSource(document.latestVersionId)}
            />
          ))}
        </ul>
      )}
      <PasteSourceDialog open={pasting} onOpenChange={setPasting} onSubmit={(title, text) => pasteDocument(title, text).then(add)} />
    </section>
  )
}

interface SourceRowProps {
  document: DocumentSummary
  included: boolean
  onToggle: () => void
  onOpen: () => void
}

function SourceRow({ document, included, onToggle, onOpen }: SourceRowProps) {
  const failed = document.extractionStatus === "failed"
  const label = included ? `Included in the brief: ${document.title}` : `Not included in the brief: ${document.title}`

  return (
    <li className="flex items-center gap-2.5 rounded-[9px] bg-fill px-2.5 py-1.5 text-[12px]">
      <span aria-hidden className="grid h-[22px] w-[28px] flex-none place-items-center rounded-[4px] bg-content text-[8px] font-semibold text-label-2">
        {FORMAT_BADGE[document.format]}
      </span>
      <span className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block min-h-6 max-w-full truncate rounded-[4px] text-left text-label outline-none hover:underline focus-visible:shadow-[0_0_0_2px_var(--accent)]"
        >
          {document.title}
        </button>
        <span className="block tabular-nums text-[11px] text-label-3">
          {FORMAT_LABEL[document.format]} · {formatSize(document.byteSize)} · v{document.latestVersion} ·{" "}
          <span className={cn(failed && "text-coral-ink")}>{STATUS_LABEL[document.extractionStatus]}</span>
        </span>
      </span>
      <button
        type="button"
        aria-pressed={included}
        aria-label={failed ? UNREADABLE_NOT_INCLUDED : label}
        disabled={failed}
        onClick={onToggle}
        className="grid size-6 flex-none place-items-center rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)] disabled:opacity-40"
      >
        <span
          aria-hidden
          className={cn(
            "size-[7px] rounded-full transition-[background-color,box-shadow] duration-150",
            included ? "bg-accent" : "shadow-[inset_0_0_0_1.3px_var(--label-3)]"
          )}
        />
      </button>
    </li>
  )
}

interface PasteSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (title: string, text: string) => Promise<string | null>
}

function PasteSourceDialog({ open, onOpenChange, onSubmit }: PasteSourceDialogProps) {
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const close = (next: boolean) => {
    onOpenChange(next)
    if (next) return
    setTitle("")
    setText("")
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const code = await onSubmit(title, text)
    setSaving(false)
    if (code) setError(sourceErrorMessage(code))
    else close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-3">
          <DialogHeader>
            <DialogTitle>Paste a source</DialogTitle>
            <DialogDescription>Stored on this Mac. Every version is kept.</DialogDescription>
          </DialogHeader>
          <label htmlFor="paste-source-title" className="text-[12px] font-semibold text-label-2">
            Title
          </label>
          <input
            id="paste-source-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-8 rounded-[7px] bg-fill px-2.5 text-[13px] text-label outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
          />
          <label htmlFor="paste-source-text" className="text-[12px] font-semibold text-label-2">
            Text
          </label>
          <textarea
            id="paste-source-text"
            rows={8}
            value={text}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "paste-source-error" : undefined}
            onChange={(event) => setText(event.target.value)}
            className="resize-none rounded-[7px] bg-fill px-2.5 py-2 text-[13px] leading-[1.5] text-label outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
          />
          {error && (
            <p id="paste-source-error" role="alert" className="m-0 text-[12px] text-coral-ink">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="plain" size="sm" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim() || !text.trim()}>
              Add source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
