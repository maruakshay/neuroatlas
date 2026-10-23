import { create } from "zustand"

/** Live readout of the postsynaptic response, shared by the 3D synapse and the DOM overlay. */
export const useSynapseStats = create<{ bound: number; free: number; peak: number }>(() => ({ bound: 0, free: 0, peak: 0 }))
