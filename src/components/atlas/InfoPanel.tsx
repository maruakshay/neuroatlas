"use client"

import { AlertTriangle, BookOpen, Cable, Lightbulb, Pill, Search, Sparkles, Stethoscope, ZoomIn, ZoomOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { disordersForStructure, getDisorder, getStructure, SCALES } from "@/data"
import { describeEffects } from "@/data/effects-text"
import type { Disorder, Scale, Structure } from "@/lib/types"
import { useAtlas } from "@/store/atlas"
import { BulletList, SCALE_ICONS, SectionTitle, StructureChip } from "./shared"

const ZOOM_LINKS: Record<string, Scale> = {
  "axon-terminal": "synapse",
  "presynaptic-terminal": "neuron",
  "pyramidal-neuron": "neuron",
  "node-of-ranvier": "membrane",
  "axon-hillock": "membrane",
  "action-potential": "neuron",
  oligodendrocyte: "neuron",
  "postsynaptic-receptor": "membrane",
}

function StructureView({ s }: { s: Structure }) {
  const setDisorder = useAtlas((st) => st.setDisorder)
  const setScale = useAtlas((st) => st.setScale)
  const activeDisorder = useAtlas((st) => st.disorderId)
  const related = disordersForStructure(s.id)
  const zoom = ZOOM_LINKS[s.id]
  const scaleIndex = SCALES.findIndex((x) => x.id === s.scale)
  const deeper = !zoom && s.scale === "brain" ? "tissue" : zoom
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{SCALES[scaleIndex].name}</Badge>
          <Badge variant="secondary">{s.category}</Badge>
        </div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="size-3 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: s.color }} />
          {s.name}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="function">Function</TabsTrigger>
          <TabsTrigger value="clinical">
            Clinical
            {related.length > 0 && <span className="ml-0.5 rounded bg-red-500/20 px-1 text-[10px] text-red-300">{related.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4 pt-2">
          {s.description.map((p) => (
            <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
          {s.details && (
            <dl className="divide-y divide-border rounded-lg border border-border">
              {s.details.map((d) => (
                <div key={d.label} className="grid grid-cols-[110px_1fr] gap-2 px-3 py-2 text-xs">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className="text-foreground/90">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {s.facts && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <SectionTitle icon={Lightbulb}>Did you know</SectionTitle>
              <BulletList items={s.facts} />
            </div>
          )}
        </TabsContent>
        <TabsContent value="function" className="space-y-4 pt-2">
          <div>
            <SectionTitle icon={Sparkles}>What it does</SectionTitle>
            <BulletList items={s.functions} />
          </div>
          {s.connections && s.connections.length > 0 && (
            <div>
              <SectionTitle icon={Cable}>Connected with</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {s.connections.map((id) => (
                  <StructureChip key={id} id={id} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="clinical" className="space-y-4 pt-2">
          {s.damage && (
            <div>
              <SectionTitle icon={AlertTriangle}>When it&apos;s damaged</SectionTitle>
              <BulletList items={s.damage} tone="danger" />
            </div>
          )}
          {related.length > 0 ? (
            <div>
              <SectionTitle icon={Stethoscope}>Related disorders: simulate</SectionTitle>
              <div className="space-y-1.5">
                {related.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDisorder(activeDisorder === d.id ? null : d.id)}
                    data-active={activeDisorder === d.id}
                    className="flex w-full items-start gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted data-[active=true]:border-red-500/50 data-[active=true]:bg-red-500/10"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                    <span>
                      <span className="block text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">{d.summary}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            !s.damage && <p className="text-sm text-muted-foreground">No disorders in this atlas target this structure directly.</p>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        {deeper && (
          <Button size="sm" variant="secondary" onClick={() => setScale(deeper)}>
            <ZoomIn data-icon="inline-start" /> Zoom to {SCALES.find((x) => x.id === deeper)?.name}
          </Button>
        )}
        {scaleIndex > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setScale(SCALES[scaleIndex - 1].id)}>
            <ZoomOut data-icon="inline-start" /> {SCALES[scaleIndex - 1].name}
          </Button>
        )}
      </div>
    </div>
  )
}

export function DisorderView({ d }: { d: Disorder }) {
  const setDisorder = useAtlas((st) => st.setDisorder)
  const setScale = useAtlas((st) => st.setScale)
  const scale = useAtlas((st) => st.scale)
  const effects = describeEffects(d)
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="destructive">{d.category}</Badge>
          <Badge variant="outline" className="capitalize">
            {d.severity}
          </Badge>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{d.name}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.summary}</p>
        {d.prevalence && <p className="mt-2 text-xs text-muted-foreground">📊 {d.prevalence}</p>}
      </div>

      <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-3">
        <SectionTitle icon={Search}>See it at every scale</SectionTitle>
        <div className="space-y-2">
          {effects.map((e) => {
            const Icon = SCALE_ICONS[e.scale]
            const active = scale === e.scale
            return (
              <button
                key={e.scale}
                onClick={() => setScale(e.scale)}
                data-active={active}
                className="w-full rounded-md border border-transparent p-2 text-left transition-colors hover:bg-red-500/10 data-[active=true]:border-red-500/40 data-[active=true]:bg-red-500/10"
              >
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className="size-3.5 text-red-300" /> {SCALES.find((s) => s.id === e.scale)?.name}
                  {active && <span className="ml-auto text-[10px] font-normal text-red-300">viewing</span>}
                </span>
                <ul className="space-y-0.5 pl-5 text-xs leading-relaxed text-foreground/80">
                  {e.items.map((t) => (
                    <li key={t} className="list-disc">
                      {t}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </div>

      <Accordion multiple defaultValue={["overview", "mechanism"]}>
        <AccordionItem value="overview">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <BookOpen className="size-4 text-muted-foreground" /> Overview
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {d.overview.map((p) => (
              <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-foreground/90">
                {p}
              </p>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="mechanism">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" /> What goes wrong, step by step
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="relative ml-2.5 space-y-3 border-l border-red-500/30 pl-5">
              {d.mechanism.map((m, i) => (
                <li key={m.title} className="relative">
                  <span className="absolute top-0 -left-[29px] flex size-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-semibold text-red-200 ring-2 ring-background">
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{m.detail}</p>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="symptoms">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" /> Symptoms
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BulletList items={d.symptoms} tone="danger" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="causes">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" /> Causes & risk factors
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BulletList items={d.causes} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="diagnosis">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Stethoscope className="size-4 text-muted-foreground" /> Diagnosis
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BulletList items={d.diagnosis} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="treatment">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Pill className="size-4 text-muted-foreground" /> Treatment
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BulletList items={d.treatment} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {d.effects.brain && d.effects.brain.affected.length > 0 && (
        <div>
          <SectionTitle>Affected structures</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(d.effects.brain.affected.map((a) => a.id))].map((id) => (
              <StructureChip key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-snug text-muted-foreground">Educational simplification, not medical advice.</p>
        <Button size="sm" variant="outline" onClick={() => setDisorder(null)}>
          End simulation
        </Button>
      </div>
    </div>
  )
}

function ScaleIntro() {
  const scale = useAtlas((st) => st.scale)
  const info = SCALES.find((s) => s.id === scale)!
  const Icon = SCALE_ICONS[scale]
  const tips: Record<Scale, string[]> = {
    brain: [
      "Click a lobe to select it; switch on Functional areas to see motor, sensory, language and visual cortex.",
      "Lower Cortex opacity or use Cutaway to reveal the thalamus, basal ganglia, hippocampus and ventricles.",
      "Turn on Arteries to see the blood supply that strokes interrupt.",
    ],
    tissue: [
      "Neurons are only about half of brain cells: glia make up the rest.",
      "Follow the astrocyte end-feet to the capillary: that's the blood–brain barrier.",
      "Pick a disorder to see plaques, inflammation, demyelination or tumour cells appear.",
    ],
    neuron: [
      "Watch inputs (blue sparks) flow along dendrites, summing at the soma.",
      "The spike starts at the axon hillock and leaps node to node along the myelin.",
      "Press Fire to send a spike; try Multiple Sclerosis to see conduction slow and fail.",
    ],
    synapse: [
      "A spike opens Ca²⁺ channels (cyan), vesicles fuse and release transmitter.",
      "Transmitter binds receptors (they glow), then is cleared by reuptake transporters or enzymes.",
      "Switch neurotransmitters, or pick a disorder to see release, receptors or clearance go wrong.",
    ],
    membrane: [
      "Na⁺ (orange) is concentrated outside; K⁺ (purple) inside. These gradients are the neuron's battery.",
      "Watch Na⁺ channels open, then plug shut (inactivate) as K⁺ channels let K⁺ out.",
      "The pump spends ATP to restore the gradients. Compare with Stroke or Epilepsy.",
    ],
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{info.name}</h2>
          <p className="text-xs text-muted-foreground">Scale {info.size}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{info.blurb}.</p>
      <BulletList items={tips[scale]} />
      <p className="text-xs text-muted-foreground">Click anything in the 3D view, or pick from the list on the left.</p>
    </div>
  )
}

export function InfoPanel() {
  const selected = getStructure(useAtlas((st) => st.selectedId))
  const disorder = getDisorder(useAtlas((st) => st.disorderId))
  if (selected && disorder) {
    return (
      <Tabs defaultValue="structure" key={`${selected.id}-${disorder.id}`}>
        <TabsList className="mb-3 w-full">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="disorder">Disorder</TabsTrigger>
        </TabsList>
        <TabsContent value="structure">
          <StructureView s={selected} />
        </TabsContent>
        <TabsContent value="disorder">
          <DisorderView d={disorder} />
        </TabsContent>
      </Tabs>
    )
  }
  if (selected) return <StructureView key={selected.id} s={selected} />
  if (disorder) return <DisorderView key={disorder.id} d={disorder} />
  return <ScaleIntro />
}
