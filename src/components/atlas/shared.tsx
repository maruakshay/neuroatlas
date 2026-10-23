"use client"

import { Atom, Brain, CircleDot, Microscope, Waypoints, type LucideIcon } from "lucide-react"
import { getStructure } from "@/data"
import type { Scale } from "@/lib/types"
import { useAtlas } from "@/store/atlas"
import { cn } from "@/lib/utils"

export const SCALE_ICONS: Record<Scale, LucideIcon> = {
  brain: Brain,
  tissue: Microscope,
  neuron: Waypoints,
  synapse: CircleDot,
  membrane: Atom,
}

/** Clickable chip that selects a structure (switching scale if needed). */
export function StructureChip({ id, className }: { id: string; className?: string }) {
  const s = getStructure(id)
  const select = useAtlas((st) => st.select)
  if (!s) return null
  return (
    <button
      onClick={() => select(id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:bg-muted",
        className,
      )}
    >
      <span className="size-2 rounded-full" style={{ background: s.color }} />
      {s.name}
    </button>
  )
}

export function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {Icon && <Icon className="size-3.5" />}
      {children}
    </h4>
  )
}

export function BulletList({ items, tone = "default" }: { items: string[]; tone?: "default" | "danger" }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
          <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-red-400" : "bg-primary/70")} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}
