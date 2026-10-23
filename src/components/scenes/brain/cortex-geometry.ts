import * as THREE from "three"
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js"

/** Region ids assigned to each cortex vertex. Index 0 of each list is unused (no area). */
export const LOBES = ["frontal-lobe", "parietal-lobe", "temporal-lobe", "occipital-lobe"] as const
export const AREAS = [
  "",
  "prefrontal-cortex",
  "premotor-cortex",
  "primary-motor-cortex",
  "primary-somatosensory-cortex",
  "posterior-parietal-cortex",
  "broca-area",
  "wernicke-area",
  "primary-auditory-cortex",
  "primary-visual-cortex",
  "visual-association-cortex",
] as const

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Central sulcus: slopes backward toward the top of the brain. */
const centralZ = (uy: number) => 0.13 - 0.22 * uy
/** Lateral (Sylvian) fissure: rises toward the back. */
const sylvianY = (uz: number) => -0.02 - 0.3 * uz

export interface CortexData {
  geometry: THREE.BufferGeometry
  lobe: Uint8Array
  area: Uint8Array
  /** 0 at the bottom of a sulcus, 1 on a gyral crown; used to darken folds. */
  cavity: Float32Array
}

/**
 * Build one cerebral hemisphere from a deformed sphere.
 * sign = -1 for the patient's left (negative x), +1 for right.
 * Each vertex is classified into a lobe and a functional area from its direction on the unit sphere.
 */
export function buildHemisphere(sign: 1 | -1, atrophy = 0): CortexData {
  const geometry = new THREE.SphereGeometry(1, 180, 130)
  const pos = geometry.attributes.position
  const n = pos.count
  const lobe = new Uint8Array(n)
  const area = new Uint8Array(n)
  const cavity = new Float32Array(n)
  const noise = new ImprovedNoise()
  const offset = sign > 0 ? 0 : 37.1
  const amp = 0.042 + 0.03 * atrophy
  const v = new THREE.Vector3()

  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i)
    const ux = v.x * sign // lateral positive
    const uy = v.y
    const uz = v.z

    // --- classify lobe ---
    const cz = centralZ(uy)
    const sy = sylvianY(uz)
    let l = 0
    if (uz < -0.62 + 0.08 * uy) l = 3
    else if (uy < sy && uz < 0.62 && uz > -0.7) l = 2
    else if (uz > cz) l = 0
    else l = 1
    lobe[i] = l

    // --- classify functional area ---
    const lateral = ux > 0.35
    let a = 0
    if (l === 0) {
      const d = uz - cz
      if (sign < 0 && lateral && d > 0.12 && d < 0.42 && uy > sy - 0.02 && uy < sy + 0.26) a = 6
      else if (d < 0.13) a = 3
      else if (d < 0.32) a = 2
      else a = 1
    } else if (l === 1) {
      const d = cz - uz
      if (sign < 0 && lateral && uy < sy + 0.22 && uz < -0.25) a = 7
      else if (d < 0.14) a = 4
      else a = 5
    } else if (l === 2) {
      if (sign < 0 && lateral && uy > sy - 0.24 && uz < -0.12) a = 7
      else if (lateral && uy > sy - 0.16 && uz > -0.15 && uz < 0.22) a = 8
    } else if (l === 3) {
      a = uz < -0.88 || ux < 0.15 ? 9 : 10
    }
    area[i] = a

    // --- shape: ellipsoid with flat medial wall, flattened base, temporal pole ---
    let px = ux * 0.68
    let py = uy * 0.68
    let pz = uz * 1.12
    const medial = Math.max(0, -ux)
    px *= 1 - 0.74 * smooth(0, 0.55, medial)
    if (uy < 0) py *= 0.72
    // temporal lobe hangs lower and bulges laterally
    const temporal = smooth(0.1, 0.6, ux) * smooth(0.2, -0.3, uy) * smooth(0.75, 0.25, uz) * smooth(-0.8, -0.2, uz)
    py -= 0.2 * temporal
    px += 0.07 * temporal
    pz += 0.06 * temporal * smooth(0.0, 0.6, uz)
    // frontal lobe narrows, occipital pole tapers
    px *= 1 - 0.14 * smooth(0.35, 1, uz) - 0.2 * smooth(-0.5, -1, uz)
    py *= 1 - 0.12 * smooth(-0.5, -1, uz)

    // --- gyri and sulci ---
    const fx = px * 3.6 + offset
    const fy = py * 3.6
    const fz = pz * 3.6
    const n1 = noise.noise(fx, fy, fz) + 0.35 * noise.noise(fx * 2.3, fy * 2.3, fz * 2.3)
    const ridge = Math.abs(n1)
    // narrow sulci between rounded gyri
    let disp = -amp * (1 - smooth(0.0, 0.11, ridge)) + 0.012 * smooth(0.11, 0.45, ridge)
    // deep landmark fissures
    const onSide = smooth(0.15, 0.4, ux)
    disp -= 0.05 * (1 - smooth(0, 0.035, Math.abs(uz - cz))) * smooth(sy, sy + 0.1, uy) * (0.4 + 0.6 * onSide)
    disp -= 0.1 * (1 - smooth(0, 0.07, Math.abs(uy - sy))) * onSide * smooth(-0.6, -0.4, uz) * smooth(0.7, 0.5, uz)

    cavity[i] = Math.min(1, Math.max(0, 1 + disp / (amp * 1.6)))
    const len = Math.hypot(px, py, pz)
    const k = (len + disp) / len
    const shrink = 1 - 0.025 * atrophy
    pos.setXYZ(i, (px * k * shrink + 0.2) * sign, py * k * shrink + 0.1, pz * k * shrink)
  }
  geometry.computeVertexNormals()

  // per-vertex state for highlight (x) and disorder (y), filled in by the component
  geometry.setAttribute("aState", new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  return { geometry, lobe, area, cavity }
}

/** Region id for a vertex, depending on whether functional areas are shown. */
export function regionOf(data: CortexData, index: number, functional: boolean) {
  if (functional && data.area[index]) return AREAS[data.area[index]]
  return LOBES[data.lobe[index]]
}
