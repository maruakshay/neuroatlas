import type { Disorder, Scale, Structure } from "@/lib/types"
import { brainStructures } from "./brain"
import { membraneStructures, neuronStructures, neurotransmitters, synapseStructures, tissueStructures } from "./cells"
import { disorders } from "./disorders"

export const allStructures: Structure[] = [
  ...brainStructures,
  ...tissueStructures,
  ...neuronStructures,
  ...synapseStructures,
  ...membraneStructures,
]

const byId = new Map(allStructures.map((s) => [s.id, s]))
const disorderById = new Map(disorders.map((d) => [d.id, d]))

export const getStructure = (id: string | null | undefined) => (id ? byId.get(id) : undefined)
export const getDisorder = (id: string | null | undefined) => (id ? disorderById.get(id) : undefined)
export const structuresForScale = (scale: Scale) => allStructures.filter((s) => s.scale === scale)

/** Disorders that list this structure as affected at any scale. */
export function disordersForStructure(id: string): Disorder[] {
  return disorders.filter((d) => d.effects.brain?.affected.some((a) => a.id === id) || disorderTouchesCellPart(d, id))
}

export function disorderTouchesCellPart(d: Disorder, id: string) {
  const e = d.effects
  switch (id) {
    case "myelin-sheath":
    case "oligodendrocyte":
      return !!(e.neuron?.demyelination || e.tissue?.demyelination)
    case "microglia":
      return !!e.tissue?.activatedMicroglia
    case "astrocyte":
      return !!(e.tissue?.reactiveAstrocytes || e.tissue?.tumorCells)
    case "blood-brain-barrier":
      return !!e.tissue?.bbbLeak
    case "axon":
      return !!(e.neuron?.axonDegeneration || e.neuron?.tangles)
    case "soma":
      return !!e.neuron?.cytoplasmicInclusions
    case "nucleus":
      return !!e.neuron?.nuclearAggregates
    case "postsynaptic-receptor":
      return !!e.synapse?.receptorBlock
    case "reuptake-transporter":
      return !!e.synapse?.reuptakeImpaired
    case "synaptic-vesicle":
      return e.synapse?.releaseScale !== undefined && e.synapse.releaseScale !== 1
    case "sodium-channel":
      return !!(e.membrane?.persistentSodium || e.membrane?.sodiumBlock)
    case "sodium-potassium-pump":
      return !!e.membrane?.pumpFailure
    default:
      return false
  }
}

export const SCALES: { id: Scale; name: string; size: string; blurb: string }[] = [
  { id: "brain", name: "Whole Brain", size: "~15 cm", blurb: "Lobes, deep nuclei, brainstem, cerebellum and blood supply" },
  { id: "tissue", name: "Neural Tissue", size: "~100 µm", blurb: "Neurons, glia and the blood–brain barrier" },
  { id: "neuron", name: "Neuron", size: "~1 mm", blurb: "Anatomy of a single neuron and how it fires" },
  { id: "synapse", name: "Synapse", size: "~1 µm", blurb: "Chemical transmission between two neurons" },
  { id: "membrane", name: "Ion Channels", size: "~10 nm", blurb: "The molecular machinery of the action potential" },
]

export { disorders, neurotransmitters }
