"use client"

import { AlertTriangle, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { allStructures, disorders, SCALES } from "@/data"
import { useAtlas } from "@/store/atlas"

/** Rank exact name matches above incidental mentions in summaries (cmdk's default is fuzzy and noisy). */
function rank(value: string, search: string, keywords: string[] = []) {
  const q = search.trim().toLowerCase()
  if (!q) return 1
  const name = value.toLowerCase()
  if (name.startsWith(q)) return 1
  if (name.split(/[\s(–-]+/).some((w) => w.startsWith(q))) return 0.9
  if (name.includes(q)) return 0.8
  if (keywords.some((k) => k.toLowerCase().includes(q))) return 0.3
  return 0
}

export function SearchCommand() {
  const [open, setOpenState] = useState(false)
  const [query, setQuery] = useState("")
  /** Start each search fresh instead of appending to the last query. */
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenState((o) => {
      const value = typeof next === "function" ? next(o) : next
      if (value && !o) setQuery("")
      return value
    })
  const select = useAtlas((s) => s.select)
  const setDisorder = useAtlas((s) => s.setDisorder)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="justify-start text-muted-foreground max-sm:size-7 max-sm:px-0 max-sm:justify-center sm:w-56"
        onClick={() => setOpen(true)}
        aria-label="Search atlas"
      >
        <Search data-icon="inline-start" />
        <span className="flex-1 text-left max-sm:hidden">Search atlas…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search the atlas" description="Find structures, cells and disorders">
        <Command filter={rank}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Hippocampus, myelin, Parkinson's…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {SCALES.map((scale) => (
              <CommandGroup key={scale.id} heading={scale.name}>
                {allStructures
                  .filter((s) => s.scale === scale.id)
                  .map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.name}
                      keywords={[s.category, s.summary]}
                      onSelect={() => {
                        select(s.id)
                        setOpen(false)
                      }}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span>{s.name}</span>
                      <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">{s.category}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
            <CommandGroup heading="Disorders">
              {disorders.map((d) => (
                <CommandItem
                  key={d.id}
                  value={d.name}
                  keywords={[d.category, d.summary]}
                  onSelect={() => {
                    setDisorder(d.id)
                    select(null)
                    setOpen(false)
                  }}
                >
                  <AlertTriangle className="text-red-400" />
                  <span>{d.name}</span>
                  <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">{d.category}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
