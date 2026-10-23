"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { getDisorder, getStructure } from "@/data"
import { useAtlas } from "@/store/atlas"
import { branchesToGeometry, growBranches, lumpySphere, PartMaterial, rng, SelectedLabel, TagLabel, useInteract, type BranchSegment } from "../common"

type V3 = [number, number, number]
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const color = (id: string) => getStructure(id)?.color ?? "#ccc"

const SOMA = v(-4, 0, 0)
const SOMA_R = 0.65
const AXON_START = -2.9
const MYELIN_START = -2.6
const SEG_LEN = 0.85
const GAP = 0.14
const SEGMENTS = 7
const MYELIN_END = MYELIN_START + SEGMENTS * (SEG_LEN + GAP) - GAP
const TERMINAL_X = MYELIN_END + 0.35
/** Beyond this point the axon degenerates when the disorder says so. */
const DEGEN_X = 1.4

const BOUTONS: V3[] = [
  [TERMINAL_X + 1.1, 0.55, 0.3],
  [TERMINAL_X + 1.25, 0.05, -0.45],
  [TERMINAL_X + 1.1, -0.5, 0.25],
  [TERMINAL_X + 0.9, 0.15, 0.6],
]

function useNeuronFx() {
  return useAtlas((s) => getDisorder(s.disorderId)?.effects.neuron)
}

/** Which myelin segments are lost, given the disorder's demyelination fraction. */
function useDamagedSegments(fraction: number) {
  return useMemo(() => {
    if (!fraction) return new Set<number>()
    const r = rng(9)
    const set = new Set<number>()
    for (let i = 1; i < SEGMENTS; i++) if (r() < fraction) set.add(i)
    if (set.size === 0) set.add(2)
    return set
  }, [fraction])
}

function useDendrites() {
  return useMemo(() => {
    const dirs: V3[] = [
      [-1, 0.6, 0.2],
      [-1, -0.5, -0.3],
      [-0.3, 1, -0.2],
      [-0.2, -1, 0.3],
      [-0.6, 0.1, 1],
      [-0.5, 0.2, -1],
      [0.3, 0.9, 0.5],
      [0.2, -0.9, -0.6],
    ]
    const trees = dirs.map((d, i) => {
      const dir = v(...d).normalize()
      return growBranches({
        seed: 200 + i * 7,
        origin: SOMA.clone().addScaledVector(dir, SOMA_R * 0.8),
        direction: dir,
        length: 1.5,
        radius: 0.12,
        depth: 3,
        fork: 2,
        spread: 0.6,
        wiggle: 0.2,
      })
    })
    return { trees, geometry: branchesToGeometry(trees.flat(), 8) }
  }, [])
}

function Dendrites({ trees, geometry }: { trees: BranchSegment[][]; geometry: THREE.BufferGeometry }) {
  const handlers = useInteract("dendrites")
  const spineHandlers = useInteract("dendritic-spines")
  const spines = useRef<THREE.InstancedMesh>(null)
  const spinePoints = useMemo(() => {
    const r = rng(77)
    const out: THREE.Matrix4[] = []
    trees.flat().forEach((b) => {
      if (b.depth > 2) return
      for (let i = 0; i < 6; i++) {
        const t = 0.15 + r() * 0.8
        const p = b.curve.getPointAt(t)
        const tan = b.curve.getTangentAt(t)
        const perp = v(r() - 0.5, r() - 0.5, r() - 0.5).cross(tan).normalize()
        p.addScaledVector(perp, b.radius * 0.9)
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), perp), v(0.035, 0.07, 0.035))
        out.push(m)
      }
    })
    return out
  }, [trees])
  useEffect(() => {
    spinePoints.forEach((m, i) => spines.current?.setMatrixAt(i, m))
    if (spines.current) spines.current.instanceMatrix.needsUpdate = true
  }, [spinePoints])
  return (
    <group>
      <mesh geometry={geometry} {...handlers}>
        <PartMaterial id="dendrites" color={color("dendrites")} />
      </mesh>
      <instancedMesh ref={spines} args={[undefined, undefined, spinePoints.length]} {...spineHandlers}>
        <sphereGeometry args={[1, 8, 6]} />
        <PartMaterial id="dendritic-spines" color={color("dendritic-spines")} />
      </instancedMesh>
    </group>
  )
}

function Soma({ glow }: { glow: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const soma = useInteract("soma")
  const nucleus = useInteract("nucleus")
  const nissl = useInteract("nissl-bodies")
  const mito = useInteract("mitochondrion")
  const fx = useNeuronFx()
  const nisslRef = useRef<THREE.InstancedMesh>(null)
  const nisslMatrices = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 22 }, () => {
      const d = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.38 + r() * 0.18)
      return new THREE.Matrix4().compose(SOMA.clone().add(d), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), v(0.08, 0.02, 0.06))
    })
  }, [])
  useEffect(() => {
    nisslMatrices.forEach((m, i) => nisslRef.current?.setMatrixAt(i, m))
    if (nisslRef.current) nisslRef.current.instanceMatrix.needsUpdate = true
  }, [nisslMatrices])
  return (
    <group>
      <mesh position={SOMA} {...soma} renderOrder={5}>
        <sphereGeometry args={[SOMA_R, 48, 36]} />
        <PartMaterial id="soma" color={color("soma")} opacity={0.38} roughness={0.25} />
      </mesh>
      <mesh position={SOMA}>
        <sphereGeometry args={[SOMA_R * 0.98, 32, 24]} />
        <meshStandardMaterial ref={glow} color="#000" emissive="#ffd166" emissiveIntensity={0} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh position={SOMA.clone().add(v(-0.05, 0.05, 0))} {...nucleus}>
        <sphereGeometry args={[0.26, 32, 24]} />
        <PartMaterial id="nucleus" color={color("nucleus")} />
      </mesh>
      <mesh position={SOMA.clone().add(v(-0.05, 0.12, 0.2))}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#2d1e2f" />
      </mesh>
      <instancedMesh ref={nisslRef} args={[undefined, undefined, nisslMatrices.length]} {...nissl}>
        <sphereGeometry args={[1, 10, 6]} />
        <PartMaterial id="nissl-bodies" color={color("nissl-bodies")} />
      </instancedMesh>
      {[
        [0.3, -0.25, 0.25],
        [0.1, 0.35, -0.3],
        [-0.35, -0.2, -0.25],
      ].map((p, i) => (
        <mesh key={i} position={SOMA.clone().add(v(p[0], p[1], p[2]))} rotation={[i, i * 2, 0]} {...mito}>
          <capsuleGeometry args={[0.04, 0.14, 4, 10]} />
          <PartMaterial id="mitochondrion" color={color("mitochondrion")} />
        </mesh>
      ))}
      {fx?.cytoplasmicInclusions && (
        <group position={SOMA.clone().add(v(0.25, -0.2, 0.3))}>
          <mesh>
            <sphereGeometry args={[0.13, 24, 16]} />
            <meshStandardMaterial color={fx.cytoplasmicInclusions.color} emissive={fx.cytoplasmicInclusions.color} emissiveIntensity={0.6} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.19, 24, 16]} />
            <meshStandardMaterial color={fx.cytoplasmicInclusions.color} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <TagLabel position={[0, -0.35, 0]}>{fx.cytoplasmicInclusions.label}</TagLabel>
        </group>
      )}
      {fx?.nuclearAggregates && (
        <group>
          {[
            [0.08, 0.05, 0.15],
            [-0.1, -0.08, 0.14],
            [0.02, 0.14, 0.1],
          ].map((p, i) => (
            <mesh key={i} position={SOMA.clone().add(v(p[0] - 0.05, p[1] + 0.05, p[2] + 0.06))}>
              <icosahedronGeometry args={[0.045, 1]} />
              <meshStandardMaterial color="#111" emissive="#ff006e" emissiveIntensity={0.7} />
            </mesh>
          ))}
          <TagLabel position={[SOMA.x, SOMA.y - 0.9, SOMA.z]}>Mutant huntingtin aggregates</TagLabel>
        </group>
      )}
      {fx?.tangles && (
        <group>
          <mesh position={SOMA.clone().add(v(0.3, 0.05, 0.15))} rotation={[0, 0, Math.PI / 2]} scale={[0.09, 0.09, 0.09]}>
            <torusKnotGeometry args={[1, 0.15, 96, 8, 3, 7]} />
            <meshStandardMaterial color="#3b1f0b" emissive="#b5470b" emissiveIntensity={0.7} />
          </mesh>
          <TagLabel position={[SOMA.x + 0.4, SOMA.y + 0.85, SOMA.z]}>Tau tangles</TagLabel>
        </group>
      )}
    </group>
  )
}

function Axon({ damaged, nodeMats, degenerate }: { damaged: Set<number>; nodeMats: React.RefObject<(THREE.MeshStandardMaterial | null)[]>; degenerate: boolean }) {
  const hillock = useInteract("axon-hillock")
  const axon = useInteract("axon")
  const myelin = useInteract("myelin-sheath")
  const node = useInteract("node-of-ranvier")
  const terminal = useInteract("axon-terminal")
  const mito = useInteract("mitochondrion")
  const axonLen = TERMINAL_X - AXON_START
  const terminalGeo = useMemo(
    () =>
      branchesToGeometry(
        BOUTONS.map((b) => ({
          curve: new THREE.CatmullRomCurve3([v(TERMINAL_X, 0, 0), v(TERMINAL_X + 0.4, b[1] * 0.4, b[2] * 0.4), v(...b)]),
          radius: 0.05,
          depth: 0,
        })),
      ),
    [],
  )
  return (
    <group>
      <mesh position={[AXON_START - 0.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]} {...hillock}>
        <cylinderGeometry args={[0.07, 0.24, 0.6, 24]} />
        <PartMaterial id="axon-hillock" color={color("axon-hillock")} />
      </mesh>
      {degenerate ? (
        <>
          <mesh position={[(AXON_START + DEGEN_X) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...axon}>
            <cylinderGeometry args={[0.07, 0.07, DEGEN_X - AXON_START, 16]} />
            <PartMaterial id="axon" color={color("axon")} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[DEGEN_X + 0.25 + i * 0.42, Math.sin(i) * 0.05, 0]} rotation={[0, 0, Math.PI / 2 + Math.sin(i * 3) * 0.3]} {...axon}>
              <capsuleGeometry args={[0.06, 0.15, 4, 10]} />
              <PartMaterial id="axon" color="#8d6e48" opacity={0.7} />
            </mesh>
          ))}
          <TagLabel position={[DEGEN_X + 1.6, -0.5, 0]}>Axon degenerating</TagLabel>
        </>
      ) : (
        <mesh position={[(AXON_START + TERMINAL_X) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...axon}>
          <cylinderGeometry args={[0.07, 0.07, axonLen, 16]} />
          <PartMaterial id="axon" color={color("axon")} />
        </mesh>
      )}
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const x = MYELIN_START + i * (SEG_LEN + GAP) + SEG_LEN / 2
        if (damaged.has(i))
          return (
            <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, SEG_LEN * 0.9, 16, 3, true]} />
              <meshStandardMaterial color="#c9a227" wireframe transparent opacity={0.3} />
            </mesh>
          )
        if (degenerate && x > DEGEN_X) return null
        return (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...myelin}>
            <capsuleGeometry args={[0.2, SEG_LEN - 0.36, 8, 24]} />
            <PartMaterial id="myelin-sheath" color={color("myelin-sheath")} roughness={0.25} />
          </mesh>
        )
      })}
      {Array.from({ length: SEGMENTS + 1 }, (_, i) => {
        const x = MYELIN_START + i * (SEG_LEN + GAP) - GAP / 2
        if (degenerate && x > DEGEN_X) return null
        return (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...node}>
            <cylinderGeometry args={[0.095, 0.095, GAP, 16]} />
            <meshStandardMaterial ref={(m) => void (nodeMats.current[i] = m)} color={color("node-of-ranvier")} emissive="#ffd166" emissiveIntensity={0} />
          </mesh>
        )
      })}
      {!degenerate && (
        <group>
          <mesh geometry={terminalGeo} {...terminal}>
            <PartMaterial id="axon-terminal" color={color("axon-terminal")} />
          </mesh>
          {BOUTONS.map((b, i) => (
            <mesh key={i} position={b} {...terminal}>
              <sphereGeometry args={[0.16, 20, 16]} />
              <PartMaterial id="axon-terminal" color={color("axon-terminal")} />
            </mesh>
          ))}
          <mesh position={BOUTONS[1]} rotation={[0.3, 0.4, 1]} {...mito}>
            <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
            <PartMaterial id="mitochondrion" color={color("mitochondrion")} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Plaques() {
  const geo = useMemo(() => lumpySphere(0.22, 3, 0.7, 2), [])
  const spots: V3[] = [
    [-5.2, 1.3, 0.4],
    [-5.6, -1.0, -0.5],
    [-3.2, 1.6, -0.6],
  ]
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={p} geometry={geo}>
          <meshStandardMaterial color="#e0a526" emissive="#b5651d" emissiveIntensity={0.4} roughness={0.9} />
        </mesh>
      ))}
      <TagLabel position={[-5.2, 1.75, 0.4]}>Amyloid plaque</TagLabel>
    </group>
  )
}

interface Hop {
  x0: number
  x1: number
  dur: number
  slow: boolean
}

/** Build the timeline of the spike travelling down the axon. */
function buildHops(damaged: Set<number>, degenerate: boolean): { hops: Hop[]; blockAt: number | null } {
  const hops: Hop[] = [{ x0: AXON_START - 0.4, x1: MYELIN_START - GAP / 2, dur: 0.12, slow: false }]
  let blockAt: number | null = null
  for (let i = 0; i < SEGMENTS; i++) {
    const x0 = MYELIN_START + i * (SEG_LEN + GAP) - GAP / 2
    const x1 = x0 + SEG_LEN + GAP
    const slow = damaged.has(i)
    if (degenerate && x1 > DEGEN_X) {
      hops.push({ x0, x1: DEGEN_X, dur: 0.3, slow: true })
      blockAt = hops.length - 1
      break
    }
    hops.push({ x0, x1, dur: slow ? 0.75 : 0.09, slow })
    if (slow && blockAt === null && [...damaged].filter((d) => d <= i).length === 2) blockAt = hops.length - 1
  }
  if (!degenerate) hops.push({ x0: MYELIN_END + GAP / 2, x1: TERMINAL_X + 1.1, dur: 0.25, slow: false })
  return { hops, blockAt }
}

function ActionPotential({ trees, damaged, nodeMats, somaGlow }: { trees: BranchSegment[][]; damaged: Set<number>; nodeMats: React.RefObject<(THREE.MeshStandardMaterial | null)[]>; somaGlow: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const fx = useNeuronFx()
  const fireCount = useAtlas((s) => s.fireCount)
  const pulse = useRef<THREE.Group>(null)
  const sparks = useRef<THREE.InstancedMesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const sim = useRef({ t: 0, start: -10, lastAuto: -10, count: 0 })
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const degenerate = !!fx?.axonDegeneration
  const { hops, blockAt } = useMemo(() => buildHops(damaged, degenerate), [damaged, degenerate])
  const sparkCurves = useMemo(() => trees.map((t) => t.slice(0, 2)).flat().slice(0, 12), [trees])
  const total = hops.reduce((a, h) => a + h.dur, 0)

  useEffect(() => {
    if (fireCount > 0) {
      sim.current.start = sim.current.t
      sim.current.count++
    }
  }, [fireCount])

  useFrame((_, dt) => {
    const s = sim.current
    const speed = useAtlas.getState().speed
    s.t += Math.min(dt, 0.05) * speed
    const interval = fx?.hyperexcitable ? 0.95 : 4.2
    if (s.t - s.start > interval && s.t - s.lastAuto > interval) {
      s.start = s.t
      s.lastAuto = s.t
      s.count++
    }
    const tau = s.t - s.start
    const integrate = fx?.hyperexcitable ? 0.25 : 0.7
    const failed = (fx?.conductionBlock ?? false) && (degenerate || s.count % 2 === 0)

    // dendritic EPSPs flowing toward the soma
    if (sparks.current) {
      sparkCurves.forEach((c, i) => {
        const k = 1 - Math.min(1, Math.max(0, (tau - i * 0.02) / integrate))
        const visible = tau < integrate + 0.1 && k > 0
        dummy.position.copy(c.curve.getPointAt(Math.min(1, k)))
        dummy.scale.setScalar(visible ? 0.07 : 0)
        dummy.updateMatrix()
        sparks.current!.setMatrixAt(i, dummy.matrix)
      })
      sparks.current.instanceMatrix.needsUpdate = true
    }
    if (somaGlow.current) {
      const rise = tau < integrate ? tau / integrate : Math.max(0, 1 - (tau - integrate) * 4)
      somaGlow.current.emissiveIntensity = (fx?.hyperexcitable ? 1.4 : 1) * rise
    }

    // the spike travelling down the axon
    let x: number | null = null
    let fade = 1
    let elapsed = tau - integrate
    let activeHop = -1
    if (elapsed >= 0 && elapsed < total + 0.4) {
      for (let i = 0; i < hops.length; i++) {
        const h = hops[i]
        if (elapsed <= h.dur) {
          const k = h.slow ? elapsed / h.dur : 1 - Math.pow(1 - elapsed / h.dur, 3)
          x = THREE.MathUtils.lerp(h.x0, h.x1, k)
          activeHop = i
          if (failed && blockAt === i) {
            fade = 1 - elapsed / h.dur
            x = THREE.MathUtils.lerp(h.x0, h.x1, k * 0.5)
          }
          break
        }
        if (failed && blockAt === i) {
          x = null
          break
        }
        elapsed -= h.dur
      }
    }
    const last = hops[hops.length - 1]
    const onTerminal = activeHop === hops.length - 1 && !degenerate
    if (pulse.current) {
      pulse.current.visible = x !== null
      if (x !== null) {
        const y = onTerminal ? THREE.MathUtils.lerp(0, BOUTONS[0][1] * 0.5, (x - last.x0) / (last.x1 - last.x0)) : 0
        pulse.current.position.set(x, y, 0)
        pulse.current.scale.setScalar(fade * (hops[activeHop]?.slow ? 0.8 : 1.1))
      }
    }
    if (light.current) light.current.intensity = x !== null ? 3 * fade : 0
    nodeMats.current.forEach((m, i) => {
      if (!m) return
      const nx = MYELIN_START + i * (SEG_LEN + GAP) - GAP / 2
      const near = x === null ? 0 : Math.max(0, 1 - Math.abs(x - nx) / 0.35)
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, near * 2.5 * fade, 10, dt)
    })
  })

  return (
    <group>
      <instancedMesh ref={sparks} args={[undefined, undefined, sparkCurves.length]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#9bf6ff" toneMapped={false} />
      </instancedMesh>
      <group ref={pulse} visible={false}>
        <mesh>
          <sphereGeometry args={[0.16, 20, 16]} />
          <meshBasicMaterial color="#fff1a8" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.32, 20, 16]} />
          <meshBasicMaterial color="#ffd166" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} color="#ffd166" distance={2.5} intensity={0} />
    </group>
  )
}

export const neuronAnchors: Record<string, V3> = {
  dendrites: [-5.4, 1.1, 0],
  "dendritic-spines": [-5.1, 0.9, 0.2],
  soma: [SOMA.x, SOMA.y + SOMA_R, 0],
  nucleus: [SOMA.x, SOMA.y + 0.3, 0],
  "nissl-bodies": [SOMA.x + 0.3, SOMA.y + 0.4, 0],
  "axon-hillock": [AXON_START - 0.25, 0.2, 0],
  axon: [0, 0.1, 0],
  "myelin-sheath": [MYELIN_START + SEG_LEN * 1.5, 0.22, 0],
  "node-of-ranvier": [MYELIN_START + SEG_LEN + GAP / 2, 0.12, 0],
  "axon-terminal": BOUTONS[0],
  mitochondrion: [SOMA.x + 0.3, SOMA.y - 0.2, 0.25],
}

export function NeuronScene() {
  const fx = useNeuronFx()
  const { trees, geometry } = useDendrites()
  const damaged = useDamagedSegments(fx?.demyelination ?? 0)
  const nodeMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const somaGlow = useRef<THREE.MeshStandardMaterial>(null)
  return (
    <group>
      <Dendrites trees={trees} geometry={geometry} />
      <Soma glow={somaGlow} />
      <Axon damaged={damaged} nodeMats={nodeMats} degenerate={!!fx?.axonDegeneration} />
      <ActionPotential trees={trees} damaged={damaged} nodeMats={nodeMats} somaGlow={somaGlow} />
      {fx?.plaques && <Plaques />}
      <TagLabel id="dendrites" position={[-6.0, 1.6, 0]}>Dendrites</TagLabel>
      <TagLabel id="soma" position={[SOMA.x, SOMA.y - 0.95, 0]}>Soma</TagLabel>
      <TagLabel id="axon-hillock" position={[AXON_START - 0.25, -0.45, 0]}>Axon hillock</TagLabel>
      <TagLabel id="myelin-sheath" position={[MYELIN_START + 1.5 * (SEG_LEN + GAP), 0.5, 0]}>Myelin sheath</TagLabel>
      <TagLabel id="node-of-ranvier" position={[MYELIN_START + 3 * (SEG_LEN + GAP) - GAP / 2, -0.4, 0]}>Node of Ranvier</TagLabel>
      <TagLabel id="axon" position={[MYELIN_START + 5 * (SEG_LEN + GAP), 0.5, 0]}>Axon</TagLabel>
      {!fx?.axonDegeneration && <TagLabel id="axon-terminal" position={[TERMINAL_X + 1.3, 1.0, 0]}>Axon terminals</TagLabel>}
      <SelectedLabel anchors={neuronAnchors} />
    </group>
  )
}
