"use client"

import { create } from "zustand"
import { getDisorder, getStructure } from "@/data"
import type { NeurotransmitterId, Scale } from "@/lib/types"

export interface BrainView {
  cortexOpacity: number
  cutaway: boolean
  functionalMap: boolean
  showArteries: boolean
  showMeninges: boolean
}

interface AtlasState {
  scale: Scale
  selectedId: string | null
  /** Where to pin the selection label in the current scene (set when picked in 3D). */
  labelPoint: [number, number, number] | null
  hoveredId: string | null
  disorderId: string | null
  brain: BrainView
  showLabels: boolean
  autoRotate: boolean
  transmitter: NeurotransmitterId
  /** Incremented to fire an action potential in the neuron/synapse/membrane scenes. */
  fireCount: number
  /** Animation speed multiplier. */
  speed: number
  setScale: (scale: Scale) => void
  select: (id: string | null, point?: [number, number, number]) => void
  hover: (id: string | null) => void
  setDisorder: (id: string | null) => void
  setBrain: (patch: Partial<BrainView>) => void
  setShowLabels: (v: boolean) => void
  setAutoRotate: (v: boolean) => void
  setTransmitter: (t: NeurotransmitterId) => void
  setSpeed: (v: number) => void
  fire: () => void
}

const defaultBrain: BrainView = {
  cortexOpacity: 1,
  cutaway: false,
  functionalMap: false,
  showArteries: false,
  showMeninges: false,
}

export const useAtlas = create<AtlasState>((set, get) => ({
  scale: "brain",
  selectedId: null,
  labelPoint: null,
  hoveredId: null,
  disorderId: null,
  brain: defaultBrain,
  showLabels: true,
  autoRotate: false,
  transmitter: "glutamate",
  fireCount: 0,
  speed: 1,
  setScale: (scale) => set({ scale, hoveredId: null, selectedId: null, labelPoint: null }),
  /** Selecting a structure from another scale jumps to that scale and adjusts layers so it is visible. */
  select: (id, point) => {
    const s = getStructure(id)
    if (!s) return set({ selectedId: null, labelPoint: null })
    const patch: Partial<AtlasState> = { selectedId: id, scale: s.scale, labelPoint: point ?? null }
    if (s.scale === "brain") {
      const brain = { ...get().brain }
      if (s.category === "Functional cortex") brain.functionalMap = true
      if (s.category === "Cerebral lobes") brain.functionalMap = false
      if (s.category === "Blood supply") brain.showArteries = true
      if (s.id === "meninges") brain.showMeninges = true
      const deep = ["White matter", "Limbic system", "Diencephalon", "Basal ganglia", "CSF system", "Endocrine"]
      if (deep.includes(s.category) && brain.cortexOpacity > 0.5 && !brain.cutaway) brain.cortexOpacity = 0.25
      patch.brain = brain
    }
    set(patch)
  },
  hover: (hoveredId) => set({ hoveredId }),
  setDisorder: (disorderId) => {
    const d = getDisorder(disorderId)
    const patch: Partial<AtlasState> = { disorderId }
    const transmitter = d?.effects.synapse?.transmitter
    if (transmitter) patch.transmitter = transmitter
    const b = d?.effects.brain
    if (b) {
      patch.brain = {
        ...get().brain,
        cortexOpacity: b.xray ? 0.3 : 1,
        showMeninges: !!b.meningealInflammation || get().brain.showMeninges,
        showArteries: b.affected.some((a) => a.id.endsWith("artery")) || get().brain.showArteries,
      }
    }
    set(patch)
  },
  setBrain: (p) => set({ brain: { ...get().brain, ...p } }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setTransmitter: (transmitter) => set({ transmitter }),
  setSpeed: (speed) => set({ speed }),
  fire: () => set({ fireCount: get().fireCount + 1 }),
}))
