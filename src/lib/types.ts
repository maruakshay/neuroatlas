export type Scale = "brain" | "tissue" | "neuron" | "synapse" | "membrane"

export type Side = "left" | "right"

export interface Structure {
  id: string
  name: string
  scale: Scale
  /** Grouping used in the sidebar, e.g. "Cerebral cortex", "Limbic system". */
  category: string
  color: string
  /** One-line description shown in lists and tooltips. */
  summary: string
  /** Longer explanation, one string per paragraph. */
  description: string[]
  functions: string[]
  details?: { label: string; value: string }[]
  /** Ids of other structures this one connects to or works with. */
  connections?: string[]
  facts?: string[]
  /** What happens when this structure is damaged or fails. */
  damage?: string[]
}

export interface Affect {
  id: string
  side?: Side
}

export interface BrainEffects {
  /** Structures that pulse red while the disorder is active. */
  affected: Affect[]
  /** Scale multipliers for structures that atrophy or swell. */
  shrink?: Record<string, number>
  ventricleScale?: number
  /** Extra sulcal depth on the cortex to suggest cortical atrophy. */
  corticalAtrophy?: number
  tumor?: { position: [number, number, number]; radius: number }
  lesions?: { position: [number, number, number]; radius: number }[]
  infarct?: { position: [number, number, number]; radius: number }
  meningealInflammation?: boolean
  /** Spreading wave across the cortex (migraine aura / seizure). */
  corticalWave?: "seizure" | "spreading-depression"
  /** Fade the cortex so internal changes are visible. */
  xray?: boolean
}

export interface TissueEffects {
  plaques?: boolean
  tangles?: boolean
  activatedMicroglia?: boolean
  demyelination?: boolean
  tumorCells?: boolean
  /** Fraction (0-1) of neurons lost. */
  neuronLoss?: number
  bbbLeak?: boolean
  reactiveAstrocytes?: boolean
}

export interface NeuronEffects {
  /** Fraction (0-1) of myelin segments destroyed. */
  demyelination?: number
  tangles?: boolean
  /** Misfolded protein clumps in the cytoplasm (Lewy bodies, TDP-43). */
  cytoplasmicInclusions?: { label: string; color: string }
  nuclearAggregates?: boolean
  axonDegeneration?: boolean
  /** Neuron fires repeatedly on its own. */
  hyperexcitable?: boolean
  plaques?: boolean
  /** Conduction fails at a block point. */
  conductionBlock?: boolean
}

export type NeurotransmitterId =
  | "glutamate"
  | "gaba"
  | "dopamine"
  | "serotonin"
  | "acetylcholine"
  | "norepinephrine"

export interface SynapseEffects {
  transmitter?: NeurotransmitterId
  /** Multiplier on vesicles released per spike (1 = normal). */
  releaseScale?: number
  /** Fraction (0-1) of postsynaptic receptors blocked or destroyed. */
  receptorBlock?: number
  /** Antibodies drawn binding receptors. */
  antibodies?: boolean
  amyloid?: boolean
  /** Fraction (0-1) of reuptake transporters impaired. */
  reuptakeImpaired?: number
  note?: string
}

export interface MembraneEffects {
  /** Sodium channels fail to inactivate quickly (channelopathy). */
  persistentSodium?: boolean
  /** Sodium channels blocked (e.g. toxins, local anesthetics). */
  sodiumBlock?: boolean
  /** ATP runs out, so the Na⁺/K⁺ pump stops and gradients collapse. */
  pumpFailure?: boolean
  note?: string
}

export interface Disorder {
  id: string
  name: string
  category: string
  severity: "chronic" | "acute" | "progressive" | "episodic"
  summary: string
  overview: string[]
  /** Ordered steps of how it develops, from cause to symptoms. */
  mechanism: { title: string; detail: string }[]
  symptoms: string[]
  causes: string[]
  diagnosis: string[]
  treatment: string[]
  prevalence?: string
  effects: {
    brain?: BrainEffects
    tissue?: TissueEffects
    neuron?: NeuronEffects
    synapse?: SynapseEffects
    membrane?: MembraneEffects
  }
}

export interface Neurotransmitter {
  id: NeurotransmitterId
  name: string
  color: string
  type: string
  receptors: string
  role: string
  imbalance: string
  clearedBy: string
}
