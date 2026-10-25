"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { ClipboardPaste, FileUp, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteSourceAlert } from "@/components/preparation/delete-source-alert"
import { KnowledgePicker } from "@/components/preparation/knowledge-picker"
import {
  importDocument,
  listDocuments,
  getDocumentVersion,
  pasteDocument,
  replaceDocument,
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
  DOCUMENT_NOT_FOUND: "This source was deleted.",
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

function selectedVersionIds(sources: SelectedSource[]): string[] {
  return sources.flatMap((source) => (source.kind === "document" ? [source.versionId] : []))
}

function isOneOf(versionIds: Set<string>) {
  return (source: SelectedSource) => source.kind === "document" && versionIds.has(source.versionId)
}

async function selectedVersionsOf(document: DocumentSummary, listed: DocumentSummary[], selected: string[]): Promise<Set<string>> {
  const latestIds = new Set(listed.map((summary) => summary.latestVersionId))
  const owned = await Promise.all(
    selected.map(async (versionId) => {
      if (versionId === document.latestVersionId) return versionId
      if (latestIds.has(versionId)) return null
      const view = await getDocumentVersion(versionId)
      return view.ok && view.value.document.id === document.id ? versionId : null
    })
  )
  return new Set(owned.filter((versionId): versionId is string => versionId !== null))
}

function useSources(plannedMeetingId: string, onChanged: () => void) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null)
  const [selection, setSelection] = useState<SelectedSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<SelectedSource[]>([])
  const queue = useRef<Promise<string | null>>(Promise.resolve(null))

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
    (change: (current: SelectedSource[]) => SelectedSource[]): Promise<string | null> => {
      queue.current = queue.current.then(async () => {
        try {
          show(await selectSources(plannedMeetingId, change(latest.current)))
          setError(null)
          return null
        } catch (selectError) {
          return String(selectError)
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
      if (result.value.extractionStatus === "extracted") {
        const code = await select((current) => [...current, { kind: "document", versionId }])
        if (code) setError(sourceErrorMessage(code))
      }
      return null
    },
    [reload, select]
  )

  const replace = useCallback(
    async (previous: DocumentSummary, result: DocumentResult<DocumentVersion | null>): Promise<string | null> => {
      if (!result.ok) return result.code
      if (!result.value) return null
      const owned = await selectedVersionsOf(previous, documents ?? [], selectedVersionIds(latest.current))
      await reload()
      const next = result.value
      if (next.extractionStatus === "extracted" && owned.size > 0) {
        const code = await select((current) => {
          const first = current.findIndex(isOneOf(owned))
          return current.flatMap((source, index): SelectedSource[] => {
            if (!isOneOf(owned)(source)) return [source]
            return index === first ? [{ kind: "document", versionId: next.id }] : []
          })
        })
        if (code) setError(sourceErrorMessage(code))
      }
      onChanged()
      return null
    },
    [documents, reload, select, onChanged]
  )

  const removed = useCallback(
    async (document: DocumentSummary) => {
      const owned = await selectedVersionsOf(document, documents ?? [], selectedVersionIds(latest.current))
      await reload()
      if (owned.size > 0) {
        const code = await select((current) => current.filter((source) => !isOneOf(owned)(source)))
        if (code) setError(sourceErrorMessage(code))
      }
      onChanged()
    },
    [documents, reload, select, onChanged]
  )

  return { documents, selection, error, setError, select, add, replace, removed }
}

interface SourcesPanelProps {
  plannedMeetingId: string
  onOpenSource: (versionId: string) => void
  onSourcesChanged: () => void
}

export function SourcesPanel({ plannedMeetingId, onOpenSource, onSourcesChanged }: SourcesPanelProps) {
  const { documents, selection, error, setError, select, add, replace, removed } = useSources(plannedMeetingId, onSourcesChanged)
  const [pasting, setPasting] = useState(false)
  const [replacing, setReplacing] = useState<DocumentSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const included = new Set(selectedVersionIds(selection))

  const showError = (code: string) => setError(sourceErrorMessage(code))

  const toggle = async (versionId: string) => {
    const code = await select((current) =>
      current.some((source) => source.kind === "document" && source.versionId === versionId)
        ? current.filter((source) => source.kind !== "document" || source.versionId !== versionId)
        : [...current, { kind: "document", versionId }]
    )
    if (code) showError(code)
  }

  const runImport = async () => {
    const code = await add(await importDocument())
    if (code) showError(code)
  }

  const runReplaceImport = async (document: DocumentSummary) => {
    const code = await replace(document, await replaceDocument(document.id, { kind: "import" }))
    if (code) showError(code)
  }

  return (
    <>
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
                onReplacePaste={() => setReplacing(document)}
                onReplaceImport={() => void runReplaceImport(document)}
                onDelete={() => {
                  setDeleteTarget(document)
                  setDeleteOpen(true)
                }}
              />
            ))}
          </ul>
        )}
        <PasteSourceDialog open={pasting} onOpenChange={setPasting} onSubmit={(title, text) => pasteDocument(title, text).then(add)} />
        <PasteSourceDialog
          replacing={replacing}
          open={replacing !== null}
          onOpenChange={(open) => !open && setReplacing(null)}
          onSubmit={(_title, text) =>
            replacing ? replaceDocument(replacing.id, { kind: "paste", text }).then((result) => replace(replacing, result)) : Promise.resolve(null)
          }
        />
        {deleteTarget && (
          <DeleteSourceAlert
            documentId={deleteTarget.id}
            title={deleteTarget.title}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onDeleted={() => void removed(deleteTarget)}
          />
        )}
      </section>
      <KnowledgePicker selection={selection} select={select} onError={showError} />
    </>
  )
}

interface SourceRowProps {
  document: DocumentSummary
  included: boolean
  onToggle: () => void
  onOpen: () => void
  onReplacePaste: () => void
  onReplaceImport: () => void
  onDelete: () => void
}

function SourceRow({ document, included, onToggle, onOpen, onReplacePaste, onReplaceImport, onDelete }: SourceRowProps) {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="plain" icon aria-label={`More for ${document.title}`} className="size-6 flex-none">
            <MoreHorizontal className="size-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onReplacePaste}>Replace with pasted text…</DropdownMenuItem>
          <DropdownMenuItem onSelect={onReplaceImport}>Replace from a file…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="danger" onSelect={onDelete}>
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

interface PasteSourceDialogProps {
  replacing?: DocumentSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (title: string, text: string) => Promise<string | null>
}

function PasteSourceDialog({ replacing, open, onOpenChange, onSubmit }: PasteSourceDialogProps) {
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
            <DialogTitle>{replacing ? `Replace “${replacing.title}”` : "Paste a source"}</DialogTitle>
            <DialogDescription>
              {replacing
                ? `Adds version ${replacing.latestVersion + 1}. Earlier versions and the briefs built from them are kept.`
                : "Stored on this Mac. Every version is kept."}
            </DialogDescription>
          </DialogHeader>
          {!replacing && (
            <>
              <label htmlFor="paste-source-title" className="text-[12px] font-semibold text-label-2">
                Title
              </label>
              <input
                id="paste-source-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-8 rounded-[7px] bg-fill px-2.5 text-[13px] text-label outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
              />
            </>
          )}
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
            <Button type="submit" size="sm" disabled={saving || (!replacing && !title.trim()) || !text.trim()}>
              {replacing ? "Add version" : "Add source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
