"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { AlertDialog } from "radix-ui"
import { toast } from "sonner"

import { Spinner } from "@/components/telu-ui/indicators"
import { Button } from "@/components/ui/button"
import { deleteDocument, deleteDocumentImpact } from "@/lib/document-service"

export const DELETE_SOURCE_COPY = {
  impactFailed: "Couldn't check which briefs cite this source.",
  deleteFailed: "Couldn't delete this source. Nothing was removed.",
}

type ImpactState = { status: "loading" } | { status: "ready"; briefings: number } | { status: "error" }

export function deleteSourceBody(briefings: number): string {
  const removal = "Its text will be removed from this Mac. This can't be undone."
  if (briefings === 0) return `No brief cites this source. ${removal}`
  const cited = briefings === 1 ? "1 brief cites this source" : `${briefings} briefs cite this source`
  return `${cited}. Those lines will show the source as deleted. ${removal}`
}

function useDeleteImpact(documentId: string, open: boolean) {
  const [state, setState] = useState<ImpactState>({ status: "loading" })
  const request = useRef(0)

  const load = useCallback(async () => {
    const current = ++request.current
    setState({ status: "loading" })
    const result = await deleteDocumentImpact(documentId)
    if (current !== request.current) return
    if (result.ok) setState({ status: "ready", briefings: result.value })
    else {
      console.error("Failed to load source delete impact:", result.code)
      setState({ status: "error" })
    }
  }, [documentId])

  useEffect(() => {
    if (open) void load()
    return () => {
      request.current++
    }
  }, [open, load])

  return { state, retry: load }
}

interface DeleteSourceAlertProps {
  documentId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteSourceAlert({ documentId, title, open, onOpenChange, onDeleted }: DeleteSourceAlertProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const { state, retry } = useDeleteImpact(documentId, open)
  const [deleting, setDeleting] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (open) setFailed(false)
  }, [open])

  const confirmDelete = async () => {
    setDeleting(true)
    setFailed(false)
    const result = await deleteDocument(documentId)
    setDeleting(false)
    if (!result.ok) {
      console.error("Failed to delete source:", result.code)
      setFailed(true)
      return
    }
    onOpenChange(false)
    onDeleted()
    toast.success(`Deleted ${title} from this Mac`)
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[220ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-[140ms]" />
        <AlertDialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          className="fixed left-1/2 top-[42%] z-50 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-glass-strong px-[18px] pb-4 pt-[22px] text-center shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8] ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 data-[state=open]:duration-[220ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=closed]:duration-[140ms]"
        >
          <span aria-hidden className="mx-auto mb-3 grid size-14 place-items-center rounded-[13px] bg-accent-foreground shadow-card">
            <Image src="/telu-icon.png" alt="" width={40} height={40} loading="eager" className="size-10" />
          </span>
          <AlertDialog.Title className="m-0 break-words text-[13px] font-bold text-label">
            Delete &ldquo;{title}&rdquo;?
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-1.5 text-[11px] leading-[1.4] text-label-2">
              {state.status === "loading" && (
                <span className="flex justify-center" role="status" aria-label="Checking which briefs cite this source">
                  <Spinner active size={10} />
                </span>
              )}
              {state.status === "ready" && <p className="m-0">{deleteSourceBody(state.briefings)}</p>}
              {state.status === "error" && <p className="m-0">{DELETE_SOURCE_COPY.impactFailed}</p>}
            </div>
          </AlertDialog.Description>
          {state.status === "error" && (
            <Button variant="plain" size="sm" className="mt-1 text-accent" onClick={() => void retry()}>
              Retry
            </Button>
          )}
          {failed && (
            <p role="alert" className="m-0 mt-2 text-[11px] text-coral-ink">
              {DELETE_SOURCE_COPY.deleteFailed}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <AlertDialog.Cancel asChild>
              <Button ref={cancelRef} className="h-7 flex-1 px-2" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              className="h-7 flex-1 px-2"
              disabled={state.status !== "ready" || deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
