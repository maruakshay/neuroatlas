"use client"

import { AlertTriangle, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { disorders, structuresForScale } from "@/data"
import { cn } from "@/lib/utils"
import { useAtlas } from "@/store/atlas"

function ExploreList() {
  const scale = useAtlas((s) => s.scale)
  const selectedId = useAtlas((s) => s.selectedId)
  const select = useAtlas((s) => s.select)
  const hover = useAtlas((s) => s.hover)
  const [q, setQ] = useState("")
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = structuresForScale(scale).filter((s) => !term || s.name.toLowerCase().includes(term) || s.summary.toLowerCase().includes(term))
    const map = new Map<string, typeof list>()
    list.forEach((s) => map.set(s.category, [...(map.get(s.category) ?? []), s]))
    return [...map.entries()]
  }, [scale, q])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter structures…" className="h-8 pl-8 text-sm" />
      </div>
      <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
        {groups.map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{cat}</p>
            {items.map((s) => (
              <button
                key={s.id}
                onClick={() => select(selectedId === s.id ? null : s.id)}
                onMouseEnter={() => hover(s.id)}
                onMouseLeave={() => hover(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  selectedId === s.id && "bg-muted font-medium",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="px-2 text-sm text-muted-foreground">No matches.</p>}
      </div>
    </div>
  )
}

function DisorderList() {
  const disorderId = useAtlas((s) => s.disorderId)
  const setDisorder = useAtlas((s) => s.setDisorder)
  const select = useAtlas((s) => s.select)
  const [q, setQ] = useState("")
  const list = disorders.filter((d) => !q || (d.name + d.category + d.summary).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter disorders…" className="h-8 pl-8 text-sm" />
      </div>
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">Pick a condition to simulate it. Then switch scales to see what changes from whole brain down to ion channels.</p>
      <div className="-mr-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-2">
        {list.map((d) => {
          const active = d.id === disorderId
          return (
            <button
              key={d.id}
              onClick={() => {
                setDisorder(active ? null : d.id)
                select(null)
              }}
              className={cn(
                "w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted",
                active && "border-red-500/50 bg-red-500/10 hover:bg-red-500/15",
              )}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className={cn("size-3.5 shrink-0", active ? "text-red-400" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{d.name}</span>
              </span>
              <span className="mt-0.5 block pl-5.5 text-[11px] text-muted-foreground">{d.category}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const disorderId = useAtlas((s) => s.disorderId)
  const setDisorder = useAtlas((s) => s.setDisorder)
  const active = disorders.find((d) => d.id === disorderId)
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {active && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          <span className="flex-1 truncate text-xs">
            Simulating <b>{active.name}</b>
          </span>
          <button onClick={() => setDisorder(null)} className="text-muted-foreground hover:text-foreground" aria-label="End simulation">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <Tabs defaultValue="explore" className="min-h-0 flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="explore">Explore</TabsTrigger>
          <TabsTrigger value="disorders">Disorders</TabsTrigger>
        </TabsList>
        <TabsContent value="explore" className="flex min-h-0 flex-col pt-2">
          <ExploreList />
        </TabsContent>
        <TabsContent value="disorders" className="flex min-h-0 flex-col pt-2">
          <DisorderList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
