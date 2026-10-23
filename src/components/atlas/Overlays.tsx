"use client"

import { Eye, Layers, RotateCw, Scissors, SlidersHorizontal, Tag, Zap } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { getDisorder, getStructure, neurotransmitters } from "@/data"
import { apMode, channelState, CYCLE_MS, useMembraneClock, voltageAt } from "@/lib/action-potential"
import { cn } from "@/lib/utils"
import { useAtlas } from "@/store/atlas"
import { useSynapseStats } from "@/lib/synapse-stats"

function Toggle({ label, icon: Icon, checked, onChange }: { label: string; icon: typeof Eye; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/85 select-none">
      <Switch size="sm" checked={checked} onCheckedChange={(v) => onChange(v)} />
      <Icon className="size-3.5 text-muted-foreground" />
      {label}
    </label>
  )
}

const panel = "rounded-xl border border-white/10 bg-background/70 shadow-xl backdrop-blur-md"

export function ViewControls() {
  const scale = useAtlas((s) => s.scale)
  const brain = useAtlas((s) => s.brain)
  const setBrain = useAtlas((s) => s.setBrain)
  const showLabels = useAtlas((s) => s.showLabels)
  const setShowLabels = useAtlas((s) => s.setShowLabels)
  const autoRotate = useAtlas((s) => s.autoRotate)
  const setAutoRotate = useAtlas((s) => s.setAutoRotate)
  const speed = useAtlas((s) => s.speed)
  const setSpeed = useAtlas((s) => s.setSpeed)
  const fire = useAtlas((s) => s.fire)
  const animated = scale === "neuron" || scale === "synapse" || scale === "membrane"
  // On phones the controls collapse to a bar so they don't cover the model.
  const [open, setOpen] = useState(false)

  return (
    <div className="pointer-events-auto flex max-w-full flex-col gap-2 max-lg:w-full">
      <div className="flex gap-2 lg:hidden">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal data-icon="inline-start" /> {open ? "Hide controls" : "Controls"}
        </Button>
        {animated && (
          <Button size="sm" onClick={fire}>
            <Zap data-icon="inline-start" /> Fire
          </Button>
        )}
      </div>
      <div className={cn(panel, "flex max-w-full flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2.5 max-lg:gap-x-4", !open && "max-lg:hidden")}>
        {scale === "brain" && (
          <>
            <div className="flex w-44 items-center gap-2">
              <Eye className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-xs text-foreground/85">Cortex</span>
              <Slider
                min={0.08}
                max={1}
                step={0.01}
                value={[brain.cortexOpacity]}
                onValueChange={(v) => setBrain({ cortexOpacity: Array.isArray(v) ? v[0] : v })}
              />
            </div>
            <Toggle label="Cutaway" icon={Scissors} checked={brain.cutaway} onChange={(v) => setBrain({ cutaway: v })} />
            <Toggle label="Functional areas" icon={Layers} checked={brain.functionalMap} onChange={(v) => setBrain({ functionalMap: v })} />
            <Toggle label="Arteries" icon={Layers} checked={brain.showArteries} onChange={(v) => setBrain({ showArteries: v })} />
            <Toggle label="Meninges" icon={Layers} checked={brain.showMeninges} onChange={(v) => setBrain({ showMeninges: v })} />
          </>
        )}
        {scale !== "brain" && <Toggle label="Labels" icon={Tag} checked={showLabels} onChange={setShowLabels} />}
        <Toggle label="Rotate" icon={RotateCw} checked={autoRotate} onChange={setAutoRotate} />
        {animated && (
          <>
            <div className="flex w-36 items-center gap-2">
              <span className="shrink-0 text-xs text-foreground/85">Speed</span>
              <Slider min={0.2} max={2} step={0.1} value={[speed]} onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : v)} />
            </div>
            <Button size="sm" onClick={fire} className="max-lg:hidden">
              <Zap data-icon="inline-start" /> Fire
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function HoverChip() {
  const hovered = getStructure(useAtlas((s) => s.hoveredId))
  if (!hovered) return null
  return (
    <div className={cn(panel, "pointer-events-none flex max-w-xs items-start gap-2 px-3 py-2")}>
      <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: hovered.color }} />
      <div>
        <p className="text-sm font-medium">{hovered.name}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{hovered.summary}</p>
      </div>
    </div>
  )
}

export function VoltageChart() {
  const fx = useAtlas((s) => getDisorder(s.disorderId)?.effects.membrane)
  const ms = useMembraneClock((s) => s.ms)
  const mode = apMode(fx)
  const cycle = CYCLE_MS[mode]
  const W = 300
  const H = 130
  const x = (t: number) => 30 + (t / cycle) * (W - 40)
  const y = (v: number) => 10 + ((50 - v) / 140) * (H - 30)
  const path = useMemo(() => {
    let d = ""
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * cycle
      d += `${i ? "L" : "M"}${x(t).toFixed(1)},${y(voltageAt(t, mode)).toFixed(1)}`
    }
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cycle])
  const v = voltageAt(ms, mode)
  const st = channelState(ms, mode)
  return (
    <div className={cn(panel, "pointer-events-auto w-[320px] p-3")}>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-xs font-semibold">Membrane potential</p>
        <p className="font-mono text-sm tabular-nums" style={{ color: v > -55 ? "#fbbf24" : "#93c5fd" }}>
          {v.toFixed(0)} mV
        </p>
      </div>
      <svg width={W} height={H} className="overflow-visible">
        {[40, 0, -55, -70].map((mv) => (
          <g key={mv}>
            <line
              x1={30}
              x2={W - 10}
              y1={y(mv)}
              y2={y(mv)}
              stroke="currentColor"
              className={mv === -55 ? "text-amber-400/40" : "text-white/10"}
              strokeDasharray={mv === -55 ? "3 3" : undefined}
            />
            <text x={0} y={y(mv) + 3} className="fill-muted-foreground text-[9px]">
              {mv}
            </text>
          </g>
        ))}
        <text x={W - 10} y={y(-55) - 3} textAnchor="end" className="fill-amber-400/70 text-[9px]">
          threshold
        </text>
        <path d={path} fill="none" stroke="#fb923c" strokeWidth={2} />
        <line x1={x(ms)} x2={x(ms)} y1={6} y2={H - 18} stroke="white" strokeOpacity={0.5} />
        <circle cx={x(ms)} cy={y(v)} r={4} fill="#fff" />
        <text x={W - 10} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[9px]">
          time (ms) →
        </text>
      </svg>
      <p className="mt-1 text-xs leading-snug text-foreground/85">{st.phase}</p>
      <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
        <span>
          Na⁺: <b className={st.na === "open" ? "text-orange-300" : ""}>{st.na}</b>
        </span>
        <span>
          K⁺: <b className={st.k === "open" ? "text-violet-300" : ""}>{st.k}</b>
        </span>
        <span>
          Pump: <b className={st.pump ? "text-emerald-300" : ""}>{fx?.pumpFailure ? "failed" : st.pump ? "active" : "idle"}</b>
        </span>
      </div>
    </div>
  )
}

export function SynapsePanel() {
  const transmitter = useAtlas((s) => s.transmitter)
  const setTransmitter = useAtlas((s) => s.setTransmitter)
  const bound = useSynapseStats((s) => s.bound)
  const peak = useSynapseStats((s) => s.peak)
  const nt = neurotransmitters.find((n) => n.id === transmitter)!
  return (
    <div className={cn(panel, "pointer-events-auto w-[320px] space-y-2.5 p-3")}>
      <div className="flex flex-wrap gap-1">
        {neurotransmitters.map((n) => (
          <button
            key={n.id}
            onClick={() => setTransmitter(n.id)}
            className={cn(
              "rounded-full border border-white/10 px-2 py-0.5 text-[11px] transition-colors hover:bg-white/10",
              n.id === transmitter && "bg-white/15",
            )}
          >
            <span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ background: n.color }} />
            {n.name}
          </button>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: nt.color }}>
          {nt.name} · <span className="font-normal text-muted-foreground">{nt.type}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-foreground/85">{nt.role}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <b className="text-foreground/70">Receptors:</b> {nt.receptors}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <b className="text-foreground/70">Cleared by:</b> {nt.clearedBy}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-red-300/80">{nt.imbalance}</p>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Postsynaptic response (receptors bound)</span>
          <span className="font-mono tabular-nums">{bound}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${Math.min(100, (bound / 29) * 100)}%`, background: nt.color }}
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Peak this spike: {peak}</p>
      </div>
    </div>
  )
}

export function NeuronStatus() {
  const fx = useAtlas((s) => getDisorder(s.disorderId)?.effects.neuron)
  let status = {
    label: "Saltatory conduction",
    detail: "The spike leaps between nodes of Ranvier (~100 m/s in thick myelinated axons).",
    tone: "text-emerald-300",
  }
  if (fx?.axonDegeneration)
    status = { label: "Conduction fails", detail: "The axon is fragmented beyond the injury; spikes cannot reach the terminals.", tone: "text-red-300" }
  else if (fx?.demyelination)
    status = {
      label: "Slowed / intermittent block",
      detail: "Through demyelinated stretches the spike must crawl continuously, and every other spike fails.",
      tone: "text-amber-300",
    }
  else if (fx?.hyperexcitable)
    status = { label: "Hyperexcitable", detail: "Inhibition has failed: the neuron fires in rapid bursts without adequate input.", tone: "text-amber-300" }
  return (
    <div className={cn(panel, "pointer-events-auto w-[300px] p-3")}>
      <p className={cn("text-xs font-semibold", status.tone)}>{status.label}</p>
      <p className="mt-1 text-xs leading-relaxed text-foreground/80">{status.detail}</p>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[#9bf6ff]" /> Synaptic input
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[#ffd166]" /> Action potential
        </span>
      </div>
    </div>
  )
}
