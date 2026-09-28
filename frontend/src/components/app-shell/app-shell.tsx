"use client"

import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { usePathname, useRouter } from "next/navigation"

import { Sidebar } from "@/components/app-shell/sidebar"
import { EASE } from "@/lib/motion"

type ShellRouter = ReturnType<typeof useRouter>

const VIEW_FADE_EASING = `cubic-bezier(${EASE.out.join(", ")})`
const VIEW_FADE_MS = 200

function useShellShortcuts(router: ShellRouter) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
      if (event.key === ",") {
        event.preventDefault()
        router.push("/settings")
      } else if (event.key === "[") {
        event.preventDefault()
        router.back()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router])
}

function usePointerViewFade(pathname: string | null): RefObject<HTMLDivElement> {
  const viewRef = useRef<HTMLDivElement>(null)
  const lastInput = useRef<"pointer" | "keyboard">("keyboard")
  const previousPath = useRef(pathname)

  useEffect(() => {
    const onPointer = () => {
      lastInput.current = "pointer"
    }
    const onKey = () => {
      lastInput.current = "keyboard"
    }
    window.addEventListener("pointerdown", onPointer, true)
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("pointerdown", onPointer, true)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [])

  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    if (lastInput.current !== "pointer") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const frames = reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, filter: "blur(2px)" },
          { opacity: 1, filter: "blur(0px)" },
        ]
    viewRef.current?.animate(frames, { duration: VIEW_FADE_MS, easing: VIEW_FADE_EASING })
  }, [pathname])

  return viewRef
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const viewRef = usePointerViewFade(pathname)
  useShellShortcuts(router)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-content shadow-[-0.5px_0_0_var(--hairline)]">
        <div ref={viewRef} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </main>
    </div>
  )
}
