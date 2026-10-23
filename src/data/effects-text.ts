import type { Disorder, Scale } from "@/lib/types"
import { getStructure } from "."

/** Plain-language description of what the 3D view shows for a disorder at each scale. */
export function describeEffects(d: Disorder): { scale: Scale; items: string[] }[] {
  const out: { scale: Scale; items: string[] }[] = []
  const { brain, tissue, neuron, synapse, membrane } = d.effects

  if (brain) {
    const items: string[] = []
    const names = [...new Set(brain.affected.map((a) => getStructure(a.id)?.name + (a.side ? ` (${a.side})` : "")))]
    if (names.length) items.push(`Affected (pulsing red): ${names.join(", ")}`)
    if (brain.shrink) items.push(`Atrophy: ${Object.keys(brain.shrink).map((id) => getStructure(id)?.name).join(", ")} visibly shrink`)
    if (brain.ventricleScale && brain.ventricleScale > 1) items.push("Ventricles enlarge")
    if (brain.corticalAtrophy) items.push("Cortex thins and sulci widen")
    if (brain.tumor) items.push("Tumour mass (magenta) with surrounding oedema (yellow halo)")
    if (brain.infarct) items.push("Infarcted cortex (dark red) in the artery's territory")
    if (brain.lesions) items.push(`${brain.lesions.length} lesions (glowing spots)`)
    if (brain.meningealInflammation) items.push("Inflamed meninges glow red")
    if (brain.corticalWave === "seizure") items.push("Seizure: a flickering wave of synchronous activity spreads from the temporal lobe")
    if (brain.corticalWave === "spreading-depression") items.push("Aura: a slow wave of depolarisation followed by silence creeps forward from the occipital pole")
    out.push({ scale: "brain", items })
  }
  if (tissue) {
    const items: string[] = []
    if (tissue.plaques) items.push("Amyloid plaques between cells")
    if (tissue.tangles) items.push("Tau tangles inside neurons")
    if (tissue.neuronLoss) items.push(`~${Math.round(tissue.neuronLoss * 100)}% of neurons lost (faded)`)
    if (tissue.activatedMicroglia) items.push("Microglia switch from branched to amoeboid, roaming and inflammatory")
    if (tissue.reactiveAstrocytes) items.push("Reactive astrocytes thicken their processes")
    if (tissue.demyelination) items.push("Myelin stripped from axons (wireframe remnants)")
    if (tissue.tumorCells) items.push("Dense mass of dividing tumour cells")
    if (tissue.bbbLeak) items.push("Blood–brain barrier leaks plasma into tissue")
    out.push({ scale: "tissue", items })
  }
  if (neuron) {
    const items: string[] = []
    if (neuron.demyelination) items.push("Myelin segments missing: the spike crawls slowly through bare stretches")
    if (neuron.conductionBlock) items.push("Some spikes fail before reaching the terminal (conduction block)")
    if (neuron.axonDegeneration) items.push("Distal axon breaks into fragments; signals stop")
    if (neuron.tangles) items.push("Tau tangles in the cell body")
    if (neuron.cytoplasmicInclusions) items.push(`${neuron.cytoplasmicInclusions.label} in the cytoplasm`)
    if (neuron.nuclearAggregates) items.push("Protein aggregates inside the nucleus")
    if (neuron.hyperexcitable) items.push("Neuron fires in rapid, repeated bursts")
    if (neuron.plaques) items.push("Plaques crowd the dendrites")
    out.push({ scale: "neuron", items })
  }
  if (synapse) {
    const items: string[] = []
    const rs = synapse.releaseScale ?? 1
    if (rs < 1) items.push(`Less transmitter released (${Math.round(rs * 100)}% of normal)`)
    if (rs > 1) items.push(`Excess transmitter released (${Math.round(rs * 100)}% of normal)`)
    if (synapse.receptorBlock) items.push(`${Math.round(synapse.receptorBlock * 100)}% of receptors blocked or lost (grey)`)
    if (synapse.reuptakeImpaired) items.push("Reuptake impaired: transmitter lingers in the cleft")
    if (synapse.amyloid) items.push("Amyloid-β oligomers in the cleft")
    if (synapse.note) items.push(synapse.note)
    out.push({ scale: "synapse", items })
  }
  if (membrane) {
    const items: string[] = []
    if (membrane.persistentSodium) items.push("Na⁺ channels stay open too long → repeated spikes")
    if (membrane.pumpFailure) items.push("Na⁺/K⁺ pump stops; ions leak down their gradients and the membrane depolarises")
    if (membrane.note) items.push(membrane.note)
    out.push({ scale: "membrane", items })
  }
  return out.filter((e) => e.items.length)
}
