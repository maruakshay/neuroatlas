"use client"

import { Activity, ChevronRight, Info, ListTree } from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/Logo"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SCALES } from "@/data"
import { cn } from "@/lib/utils"
import { useAtlas } from "@/store/atlas"
import { InfoPanel } from "./InfoPanel"
import { HelpButton, ScaleHint, SelectionCard, TipsDialog, useFirstVisitTips } from "./MobileGuide"
import { HoverChip, NeuronStatus, SynapsePanel, VoltageChart, ViewControls } from "./Overlays"
import { SearchCommand } from "./SearchCommand"
import { SCALE_ICONS } from "./shared"
import { Sidebar } from "./Sidebar"

const SceneCanvas = dynamic(() => import("@/components/scenes/SceneCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <span className="animate-pulse">Building 3D anatomy…</span>
    </div>
  ),
})

function ScaleNav() {
  const scale = useAtlas((s) => s.scale)
  const setScale = useAtlas((s) => s.setScale)
  return (
    <nav aria-label="Zoom level" className="flex items-center gap-0.5 rounded-xl border border-border bg-muted/30 p-1">
      {SCALES.map((s, i) => {
        const Icon = SCALE_ICONS[s.id]
        const active = s.id === scale
        return (
          <div key={s.id} className="flex items-center">
            {i > 0 && <ChevronRight className="hidden size-3 shrink-0 text-muted-foreground/50 sm:block" />}
            <button
              onClick={() => setScale(s.id)}
              title={`${s.name} · ${s.size}`}
              aria-label={s.name}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-2.5",
                active && "bg-background text-foreground shadow-sm",
              )}
            >
              <Icon className="size-4 sm:size-3.5" />
              <span className="hidden md:inline">{s.name}</span>
              <span className={cn("hidden font-mono text-[10px] text-muted-foreground xl:inline", !active && "opacity-60")}>{s.size}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}

/** On phones the live readouts (voltage chart, transmitter panel) are tucked behind a toggle. */
function LivePanel() {
  const scale = useAtlas((s) => s.scale)
  const [open, setOpen] = useState(false)
  const panel = scale === "membrane" ? <VoltageChart /> : scale === "synapse" ? <SynapsePanel /> : scale === "neuron" ? <NeuronStatus /> : null
  if (!panel) return null
  const label = scale === "membrane" ? "Voltage" : scale === "synapse" ? "Transmitters" : "Signal"
  return (
    <div className="pointer-events-none absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
      <Button size="sm" variant="secondary" className="pointer-events-auto lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Activity data-icon="inline-start" /> {open ? "Hide" : label}
      </Button>
      <div className={cn("max-w-[calc(100vw-1.5rem)] origin-top-right max-lg:scale-90", !open && "max-lg:hidden")}>{panel}</div>
    </div>
  )
}

export function AtlasApp() {
  const disorderId = useAtlas((s) => s.disorderId)
  const selectedId = useAtlas((s) => s.selectedId)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useFirstVisitTips()

  // On phones, close the Explore drawer once something is picked so the result is visible.
  const pickKey = `${selectedId}|${disorderId}`
  const [lastPick, setLastPick] = useState(pickKey)
  if (pickKey !== lastPick) {
    setLastPick(pickKey)
    setExploreOpen(false)
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <h1>
          <Logo />
        </h1>
        <div className="flex min-w-0 flex-1 justify-center">
          <ScaleNav />
        </div>
        <SearchCommand />
        <HelpButton onClick={() => setTipsOpen(true)} />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border p-3 lg:flex">
          <Sidebar />
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#1d1b2e_0%,#0b0b12_70%)]">
          <SceneCanvas />
          {disorderId && <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(239,68,68,0.18)]" />}
          <div className="pointer-events-none absolute top-3 left-3 z-20 hidden flex-col gap-2 lg:flex">
            <HoverChip />
          </div>
          <LivePanel />

          <div className="absolute top-3 left-3 z-20 flex gap-2 lg:hidden">
            <Sheet open={exploreOpen} onOpenChange={setExploreOpen}>
              <SheetTrigger render={<Button size="sm" variant="secondary" />}>
                <ListTree data-icon="inline-start" /> Explore
              </SheetTrigger>
              <SheetContent side="left" className="p-4">
                <SheetHeader className="p-0">
                  <SheetTitle>Browse the atlas</SheetTitle>
                </SheetHeader>
                <Sidebar />
              </SheetContent>
            </Sheet>
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetTrigger render={<Button size="sm" variant="secondary" />}>
                <Info data-icon="inline-start" /> Details
              </SheetTrigger>
              <SheetContent side="right" className="w-[92%] overflow-y-auto p-4">
                <SheetHeader className="p-0">
                  <SheetTitle>Details</SheetTitle>
                </SheetHeader>
                <InfoPanel />
              </SheetContent>
            </Sheet>
          </div>
          <div className="pointer-events-none absolute inset-x-3 top-14 z-10 lg:hidden">
            <ScaleHint />
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col items-stretch gap-2 lg:items-center">
            <div className="lg:hidden">
              <SelectionCard onDetails={() => setDetailsOpen(true)} />
            </div>
            <ViewControls />
          </div>
        </main>

        <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-l border-border p-4 lg:block">
          <InfoPanel />
        </aside>
      </div>
      <TipsDialog open={tipsOpen} onOpenChange={setTipsOpen} />
    </div>
  )
}
