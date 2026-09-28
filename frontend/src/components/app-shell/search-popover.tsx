"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { meetingHref, type AgendaOrigin } from "@/components/agenda/agenda-timeline"
import { useSidebar } from "@/components/Sidebar/SidebarProvider"
import { Button } from "@/components/ui/button"
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export const SEARCH_DEBOUNCE_MS = 200
export const SEARCH_PLACEHOLDER = "Search meetings and transcripts"
export const SEARCH_HINT = "Type to search meetings and transcripts"

function useSearchShortcut(open: (keyboard: boolean) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.key.toLowerCase() !== "f") return
      if (event.defaultPrevented) return
      event.preventDefault()
      open(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])
}

function useDebouncedSearch(query: string, search: (query: string) => Promise<void>) {
  useEffect(() => {
    if (!query) return
    const timer = setTimeout(() => void search(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, search])
}

function SearchMessage({ children }: { children: string }) {
  return <p className="m-0 px-3 py-5 text-center text-[12px] text-label-3">{children}</p>
}

export function SearchPopover({ origin }: { origin: AgendaOrigin }) {
  const router = useRouter()
  const { searchTranscripts, searchResults, isSearching } = useSidebar()
  const [open, setOpen] = useState(false)
  const [instant, setInstant] = useState(false)
  const [query, setQuery] = useState("")
  const trimmed = query.trim()
  useSearchShortcut((keyboard) => {
    setInstant(keyboard)
    setOpen(true)
  })
  useDebouncedSearch(open ? trimmed : "", searchTranscripts)

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) setInstant(false)
    else setQuery("")
  }
  const openMeeting = (meetingId: string) => {
    changeOpen(false)
    router.push(meetingHref({ id: meetingId }, origin))
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="plain" icon aria-label="Search" aria-keyshortcuts="Meta+F">
          <Search aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" instant={instant} className="w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={SEARCH_PLACEHOLDER} />
          <CommandList>
            {!trimmed && <SearchMessage>{SEARCH_HINT}</SearchMessage>}
            {trimmed && isSearching && searchResults.length === 0 && <SearchMessage>Searching…</SearchMessage>}
            {trimmed && !isSearching && searchResults.length === 0 && <SearchMessage>{`No matches for "${trimmed}"`}</SearchMessage>}
            {trimmed &&
              searchResults.map((result) => (
                <CommandItem key={result.id} value={result.id} onSelect={() => openMeeting(result.id)} className="group flex-col items-start gap-0.5 py-2">
                  <span className="max-w-full truncate font-medium">{result.title}</span>
                  <span className="max-w-full truncate text-[12px] text-label-2 group-data-[selected=true]:text-white/85">{result.matchContext}</span>
                </CommandItem>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
