import { create } from "zustand"
import type { MembraneEffects } from "./types"

export type APMode = "normal" | "persistent" | "pumpFailure"

export function apMode(fx?: MembraneEffects): APMode {
  if (fx?.pumpFailure) return "pumpFailure"
  if (fx?.persistentSodium) return "persistent"
  return "normal"
}

/** Length of one simulated cycle in milliseconds of membrane time. */
export const CYCLE_MS: Record<APMode, number> = { normal: 7, persistent: 9, pumpFailure: 10 }

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** A single stereotyped spike starting at t0 (ms), returned as an offset from rest. */
function spike(t: number, t0: number) {
  const x = t - t0
  if (x < 0) return 0
  if (x < 0.5) return 15 * ease(x / 0.5) // stimulus to threshold
  if (x < 1.0) return 15 + 95 * ease((x - 0.5) / 0.5) // rising phase to +40
  if (x < 2.0) return 110 - 120 * ease((x - 1.0) / 1.0) // falling phase to -80
  if (x < 4.5) return -10 + 10 * ease((x - 2.0) / 2.5) // after-hyperpolarisation back to rest
  return 0
}

/** Membrane potential (mV) at time t (ms) into the cycle. */
export function voltageAt(t: number, mode: APMode): number {
  const rest = -70
  if (mode === "pumpFailure") return rest + 50 * (1 - Math.exp(-t / 3))
  if (mode === "persistent") {
    // Na+ current that fails to inactivate keeps the membrane near threshold, triggering repeated spikes
    const plateau = t > 2 && t < 6.5 ? 22 * ease((t - 2) / 0.4) * (1 - ease((t - 6) / 0.5)) : 0
    const s = (t0: number) => {
      const x = t - t0
      if (x < 0 || x > 2) return 0
      if (x < 0.4) return 90 * ease(x / 0.4)
      return 90 - 95 * ease((x - 0.4) / 1.2)
    }
    const first = t < 2 ? spike(t, 0) : 0
    return rest + first + plateau + s(2.5) + s(4.3) + (t > 6.5 && t < 8 ? -8 * (1 - ease((t - 6.5) / 1.5)) : 0)
  }
  return rest + spike(t, 0)
}

export interface ChannelState {
  na: "closed" | "open" | "inactivated"
  k: "closed" | "open"
  pump: boolean
  phase: string
}

export function channelState(t: number, mode: APMode): ChannelState {
  if (mode === "pumpFailure") {
    return { na: t > 3 ? "inactivated" : "closed", k: "closed", pump: false, phase: "ATP exhausted: pump stopped, gradients running down" }
  }
  if (mode === "persistent") {
    if (t < 0.5) return { na: "closed", k: "closed", pump: false, phase: "Stimulus: depolarising toward threshold" }
    if (t < 6.2) return { na: "open", k: t > 1 ? "open" : "closed", pump: false, phase: "Na⁺ channels fail to inactivate → repetitive firing" }
    if (t < 7) return { na: "inactivated", k: "open", pump: false, phase: "Repolarisation" }
    return { na: "closed", k: "closed", pump: true, phase: "Na⁺/K⁺ pump restores gradients" }
  }
  if (t < 0.5) return { na: "closed", k: "closed", pump: false, phase: "Stimulus: depolarising toward threshold (−55 mV)" }
  if (t < 1.0) return { na: "open", k: "closed", pump: false, phase: "Depolarisation: Na⁺ channels open, Na⁺ rushes in" }
  if (t < 2.0) return { na: "inactivated", k: "open", pump: false, phase: "Repolarisation: Na⁺ inactivated, K⁺ flows out" }
  if (t < 4.5) return { na: "closed", k: t < 3 ? "open" : "closed", pump: false, phase: "Hyperpolarisation: brief undershoot (refractory)" }
  return { na: "closed", k: "closed", pump: true, phase: "Resting: Na⁺/K⁺ pump restores gradients (−70 mV)" }
}

/** Current membrane time, shared between the 3D scene and the DOM chart. */
export const useMembraneClock = create<{ ms: number }>(() => ({ ms: 0 }))
