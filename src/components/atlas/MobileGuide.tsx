"use client"

import { AlertTriangle, ArrowRight, Hand, HelpCircle, Info, ListTree, MousePointerClick, X, ZoomIn } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getDisorder, getStructure, SCALES } from "@/data"
import type { Scale } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAtlas } from "@/store/atlas"
import { SCALE_ICONS } from "./shared"

const TIPS_KEY = "neuroatlas.tips.v1"

const STEPS = [
  {
    icon: Hand,
    title: "Move around the model",
    body: "Drag with one finger to rotate. Pinch to zoom in and out. Drag with two fingers to pan.",
    visual: "gestures",
  },
  {
    icon: MousePointerClick,
    title: "Tap anything to identify it",
    body: "Tap a lobe, cell or channel. Its name appears at the bottom; tap Details for the full explanation, functions and what happens when it's damaged.",
    visual: "tap",
  },
  {
    icon: ZoomIn,
    title: "Zoom through five scales",
    body: "The icons at the top take you from the whole brain down to tissue, a single neuron, a synapse and ion channels.",
    visual: "scales",
  },
  {
    icon: AlertTriangle,
    title: "Simulate a disease",
    body: "Open Explore → Disorders and pick a condition. Affected parts pulse red, and every scale shows what goes wrong there.",
    visual: "disease",
  },
] as const

/** What to look for at each scale, shown briefly when you arrive there on a phone. */
const SCALE_HINTS: Record<Scale, string> = {
  brain: "Tap a lobe. Open Controls to see inside or show functional areas.",
  tissue: "Tap a cell to learn what it does. Glia are as important as neurons.",
  neuron: "Watch the spike leap along the myelin. Tap Fire to send another, or Signal for its status.",
  synapse: "Watch vesicles release transmitter. Tap Transmitters (top right) to switch chemicals.",
  membrane: "Na⁺ is orange, K⁺ purple. Tap Voltage (top right) for the live trace.",
}

function readSeen() {
  try {
    return localStorage.getItem(TIPS_KEY) === "1"
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(TIPS_KEY, "1")
  } catch {
    // storage blocked (private mode): the tour will simply show again next visit
  }
}

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  if (kind === "scales") {
    return (
      <div className="flex items-center justify-center gap-1.5">
        {SCALES.map((s, i) => {
          const Icon = SCALE_ICONS[s.id]
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              {i > 0 && <ArrowRight className="size-3 text-muted-foreground/60" />}
              <div className="flex flex-col items-center gap-1">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">{s.size}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  if (kind === "disease") {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs">
          <ListTree className="size-3.5" /> Explore
        </span>
        <ArrowRight className="size-3 text-muted-foreground" />
        <span className="rounded-md bg-muted px-2.5 py-1.5 text-xs">Disorders</span>
        <ArrowRight className="size-3 text-muted-foreground" />
        <span className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs">
          <span className="size-2 animate-ping rounded-full bg-red-400" /> Pick one
        </span>
      </div>
    )
  }
  if (kind === "tap") {
    return (
      <div className="mx-auto flex w-56 items-center gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
        <span className="size-3 rounded-full bg-[#ffd166]" />
        <span className="flex-1 text-xs font-medium">Hippocampus</span>
        <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">Details</span>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
      {[
        ["☝️", "Drag", "rotate"],
        ["🤏", "Pinch", "zoom"],
        ["✌️", "Two-finger drag", "pan"],
      ].map(([emoji, gesture, action]) => (
        <div key={gesture} className="rounded-lg bg-muted/50 px-1 py-2">
          <div className="text-2xl">{emoji}</div>
          <div className="mt-1 font-medium text-foreground">{gesture}</div>
          <div>{action}</div>
        </div>
      ))}
    </div>
  )
}

/** First-visit walkthrough explaining gestures, tapping, scales and disease mode. */
export function TipsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const close = () => {
    markSeen()
    onOpenChange(false)
    setStep(0)
  }
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="gap-5 p-5" showCloseButton={false}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Tip {step + 1} of {STEPS.length}
          </span>
          <button onClick={close} className="text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <s.icon className="size-5" />
          </div>
          <DialogTitle className="text-lg">{s.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{s.body}</DialogDescription>
        </div>
        <StepVisual kind={s.visual} />
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                aria-label={`Tip ${i + 1}`}
                onClick={() => setStep(i)}
                className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? close() : setStep(step + 1))}>
              {last ? "Start exploring" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Opens the tour automatically on a visitor's first phone/tablet visit. */
export function useFirstVisitTips() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches && !readSeen()) {
      const t = setTimeout(() => setOpen(true), 900)
      return () => clearTimeout(t)
    }
  }, [])
  return [open, setOpen] as const
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon-sm" variant="secondary" onClick={onClick} aria-label="How to use NeuroAtlas">
      <HelpCircle />
    </Button>
  )
}

/** Brief "what to look for here" hint shown when arriving at a scale on mobile. */
export function ScaleHint() {
  const scale = useAtlas((s) => s.scale)
  const [visible, setVisible] = useState<Scale | null>(null)
  const first = useRef(true)
  useEffect(() => {
    // the tour covers the first screen; only hint on later scale changes
    if (first.current) {
      first.current = false
      return
    }
    setVisible(scale)
    const t = setTimeout(() => setVisible(null), 5000)
    return () => clearTimeout(t)
  }, [scale])
  if (!visible) return null
  const info = SCALES.find((s) => s.id === visible)!
  const Icon = SCALE_ICONS[visible]
  return (
    <div className="pointer-events-auto mx-auto flex max-w-sm animate-in items-start gap-2.5 rounded-xl border border-white/10 bg-background/85 p-3 shadow-xl backdrop-blur-md fade-in slide-in-from-top-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-xs font-semibold">
          {info.name} <span className="font-mono font-normal text-muted-foreground">{info.size}</span>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{SCALE_HINTS[visible]}</p>
      </div>
      <button onClick={() => setVisible(null)} aria-label="Dismiss" className="text-muted-foreground">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** Bottom card on phones naming what was tapped, with a shortcut to its details. */
export function SelectionCard({ onDetails }: { onDetails: () => void }) {
  const selected = getStructure(useAtlas((s) => s.selectedId))
  const disorder = getDisorder(useAtlas((s) => s.disorderId))
  const select = useAtlas((s) => s.select)
  const setDisorder = useAtlas((s) => s.setDisorder)
  if (!selected && !disorder) {
    return (
      <p className="pointer-events-none mx-auto w-fit rounded-full bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        Tap any part to identify it
      </p>
    )
  }
  const color = selected?.color ?? "#ef4444"
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-background/85 p-3 shadow-xl backdrop-blur-md">
      <span className={cn("size-3 shrink-0 rounded-full", !selected && "animate-pulse")} style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{selected?.name ?? disorder?.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {selected ? selected.summary : `Simulating · ${disorder?.category}`}
          {selected && disorder ? ` · ${disorder.name} active` : ""}
        </p>
      </div>
      <Button size="sm" onClick={onDetails}>
        <Info data-icon="inline-start" /> Details
      </Button>
      <button
        aria-label={selected ? "Clear selection" : "End simulation"}
        onClick={() => (selected ? select(null) : setDisorder(null))}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
