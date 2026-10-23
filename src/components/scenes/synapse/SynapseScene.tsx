"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { getDisorder, getStructure, neurotransmitters } from "@/data"
import { useSynapseStats } from "@/lib/synapse-stats"
import { useAtlas } from "@/store/atlas"
import { lumpySphere, PartMaterial, rng, SelectedLabel, TagLabel, useInteract } from "../common"

type V3 = [number, number, number]
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const color = (id: string) => getStructure(id)?.color ?? "#ccc"

const PRE_Y = 0.3
const POST_Y = -0.3
const RECEPTOR_TOP = -0.12
const MAX_PARTICLES = 420
const PER_VESICLE = 28


function useSynapseFx() {
  return useAtlas((s) => getDisorder(s.disorderId)?.effects.synapse)
}

function lathe(points: [number, number][]) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    64,
  )
}

const RECEPTORS: V3[] = (() => {
  const out: V3[] = []
  const rings = [
    [0, 1],
    [0.42, 6],
    [0.85, 10],
    [1.25, 12],
  ] as const
  rings.forEach(([r, n]) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r
      out.push([Math.cos(a) * r, RECEPTOR_TOP, Math.sin(a) * r])
    }
  })
  return out
})()

const CA_CHANNELS: V3[] = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + 0.3
  return [Math.cos(a) * 1.05, PRE_Y, Math.sin(a) * 1.05]
})

const TRANSPORTERS: V3[] = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2 + 0.6
  return [Math.cos(a) * 1.78, PRE_Y + 0.14, Math.sin(a) * 1.78]
})

const DOCK_SITES: V3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2
  const r = i % 2 ? 0.75 : 0.4
  return [Math.cos(a) * r, PRE_Y + 0.2, Math.sin(a) * r]
})

function Membranes() {
  const pre = useInteract("presynaptic-terminal")
  const cleft = useInteract("synaptic-cleft")
  const psd = useInteract("postsynaptic-density")
  const preGeo = useMemo(
    () =>
      lathe([
        [0, PRE_Y],
        [1.65, PRE_Y],
        [1.95, PRE_Y + 0.3],
        [2.05, PRE_Y + 0.9],
        [1.85, PRE_Y + 1.7],
        [1.25, PRE_Y + 2.35],
        [0.65, PRE_Y + 2.75],
        [0.5, PRE_Y + 3.8],
      ]),
    [],
  )
  const postGeo = useMemo(
    () =>
      lathe([
        [0.55, POST_Y - 3.4],
        [0.65, POST_Y - 2.2],
        [1.35, POST_Y - 1.75],
        [1.95, POST_Y - 1.1],
        [2.05, POST_Y - 0.4],
        [1.75, POST_Y],
        [0, POST_Y],
      ]),
    [],
  )
  return (
    <group>
      <mesh geometry={preGeo} {...pre} renderOrder={5}>
        <PartMaterial id="presynaptic-terminal" color={color("presynaptic-terminal")} opacity={0.28} roughness={0.2} doubleSide />
      </mesh>
      <mesh geometry={postGeo} renderOrder={5}>
        <meshStandardMaterial color="#f4a261" transparent opacity={0.28} roughness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, POST_Y - 0.06, 0]} {...psd}>
        <cylinderGeometry args={[1.45, 1.45, 0.1, 48]} />
        <PartMaterial id="postsynaptic-density" color={color("postsynaptic-density")} />
      </mesh>
      {/* invisible slab so the cleft itself is clickable */}
      <mesh position={[0, 0, 0]} {...cleft}>
        <cylinderGeometry args={[2.0, 2.0, PRE_Y - POST_Y - 0.05, 48, 1, true]} />
        <PartMaterial id="synaptic-cleft" color={color("synaptic-cleft")} opacity={0.08} doubleSide />
      </mesh>
      {[
        [0.9, PRE_Y + 1.3, 0.3],
        [-0.8, PRE_Y + 1.6, -0.4],
      ].map((p, i) => (
        <mesh key={i} position={p as V3} rotation={[0.4, i, 1.2]}>
          <capsuleGeometry args={[0.16, 0.6, 6, 14]} />
          <meshStandardMaterial color={color("mitochondrion")} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

interface Sim {
  t: number
  start: number
  lastAuto: number
  pos: Float32Array
  vel: Float32Array
  age: Float32Array
  mode: Uint8Array
  target: Int16Array
  timer: Float32Array
  reuptake: Uint8Array
  receptorGlow: Float32Array
  receptorBusy: Uint8Array
  docked: number
}

export function SynapseScene() {
  const fx = useSynapseFx()
  const transmitterId = useAtlas((s) => s.transmitter)
  const fireCount = useAtlas((s) => s.fireCount)
  const nt = neurotransmitters.find((n) => n.id === transmitterId)!
  const releaseScale = fx?.releaseScale ?? 1
  const blockFrac = fx?.receptorBlock ?? 0
  const reuptakeImpaired = fx?.reuptakeImpaired ?? 0
  const enzymatic = transmitterId === "acetylcholine"

  const vesicleHandlers = useInteract("synaptic-vesicle")
  const receptorHandlers = useInteract("postsynaptic-receptor")
  const caHandlers = useInteract("voltage-gated-calcium-channel")
  const transporterHandlers = useInteract("reuptake-transporter")

  const blocked = useMemo(() => {
    const r = rng(17)
    return RECEPTORS.map(() => r() < blockFrac)
  }, [blockFrac])

  // reserve vesicles scattered in the bouton (fewer when release is impaired)
  const reserve = useMemo(() => {
    const r = rng(4)
    const n = Math.round(40 * Math.min(1.3, Math.max(0.2, releaseScale)))
    return Array.from({ length: n }, () => {
      const a = r() * Math.PI * 2
      const rad = Math.sqrt(r()) * 1.35
      return v(Math.cos(a) * rad, PRE_Y + 0.6 + r() * 1.4, Math.sin(a) * rad)
    })
  }, [releaseScale])
  const dockCount = Math.max(1, Math.min(8, Math.round(4 * releaseScale)))

  const sim = useRef<Sim>({
    t: 0,
    start: -10,
    lastAuto: -10,
    pos: new Float32Array(MAX_PARTICLES * 3),
    vel: new Float32Array(MAX_PARTICLES * 3),
    age: new Float32Array(MAX_PARTICLES),
    mode: new Uint8Array(MAX_PARTICLES),
    target: new Int16Array(MAX_PARTICLES),
    timer: new Float32Array(MAX_PARTICLES),
    reuptake: new Uint8Array(MAX_PARTICLES),
    receptorGlow: new Float32Array(RECEPTORS.length),
    receptorBusy: new Uint8Array(RECEPTORS.length),
    docked: 0,
  })

  const particles = useRef<THREE.InstancedMesh>(null)
  const vesicles = useRef<THREE.InstancedMesh>(null)
  const calcium = useRef<THREE.InstancedMesh>(null)
  const receptorMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const caMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const rand = useMemo(() => rng(99), [])
  const ntColor = useMemo(() => new THREE.Color(nt.color), [nt.color])

  const trigger = () => {
    const s = sim.current
    s.start = s.t
    s.docked = 0
  }
  useEffect(() => {
    if (fireCount > 0) trigger()
  }, [fireCount])

  const release = (site: V3) => {
    const s = sim.current
    let spawned = 0
    for (let i = 0; i < MAX_PARTICLES && spawned < PER_VESICLE; i++) {
      if (s.mode[i] !== 0) continue
      s.mode[i] = 1
      s.age[i] = 0
      s.pos.set([site[0] + (rand() - 0.5) * 0.1, PRE_Y - 0.02, site[2] + (rand() - 0.5) * 0.1], i * 3)
      const a = rand() * Math.PI * 2
      const sp = 0.4 + rand() * 1.2
      s.vel.set([Math.cos(a) * sp, -0.6 - rand() * 1.2, Math.sin(a) * sp], i * 3)
      s.reuptake[i] = rand() > reuptakeImpaired ? 1 : 0
      s.timer[i] = 0.7 + rand() * 0.8
      spawned++
    }
  }

  useFrame((_, rawDt) => {
    const s = sim.current
    const speed = useAtlas.getState().speed
    const dt = Math.min(rawDt, 0.05) * speed * 0.5
    s.t += dt
    if (s.t - s.start > 4 && s.t - s.lastAuto > 4) {
      s.lastAuto = s.t
      trigger()
    }
    const tau = s.t - s.start

    // calcium channels open and Ca2+ flows in
    caMats.current.forEach((m) => {
      if (m) m.emissiveIntensity = tau < 0.4 ? 1.5 * (1 - tau / 0.4) : 0
    })
    if (calcium.current) {
      for (let i = 0; i < 36; i++) {
        const ch = CA_CHANNELS[i % CA_CHANNELS.length]
        const k = (tau - (i / 36) * 0.15) / 0.3
        const vis = k > 0 && k < 1
        dummy.position.set(ch[0] * (1 - k * 0.3) + Math.sin(i) * 0.08, PRE_Y - 0.25 + k * 0.7, ch[2] * (1 - k * 0.3) + Math.cos(i) * 0.08)
        dummy.scale.setScalar(vis ? 0.035 : 0)
        dummy.updateMatrix()
        calcium.current.setMatrixAt(i, dummy.matrix)
      }
      calcium.current.instanceMatrix.needsUpdate = true
    }

    // docked vesicles fuse, releasing transmitter
    if (vesicles.current) {
      let idx = 0
      for (let d = 0; d < dockCount; d++) {
        const site = DOCK_SITES[d]
        const fuseAt = 0.3 + d * 0.03
        const k = Math.min(1, Math.max(0, (tau - fuseAt) / 0.12))
        const redock = tau > 2.2 ? Math.min(1, (tau - 2.2) / 0.5) : 0
        if (k >= 1 && s.docked <= d) {
          s.docked = d + 1
          release(site)
        }
        dummy.position.set(site[0], site[1] - 0.15 * k, site[2])
        dummy.scale.setScalar(0.13 * (k >= 1 ? redock : 1 - k * 0.6))
        dummy.updateMatrix()
        vesicles.current.setMatrixAt(idx++, dummy.matrix)
      }
      for (const p of reserve) {
        dummy.position.copy(p).add(v(Math.sin(s.t + p.x * 5) * 0.03, Math.cos(s.t * 1.3 + p.z * 5) * 0.03, 0))
        dummy.scale.setScalar(0.13)
        dummy.updateMatrix()
        vesicles.current.setMatrixAt(idx++, dummy.matrix)
      }
      vesicles.current.count = idx
      vesicles.current.instanceMatrix.needsUpdate = true
    }

    // neurotransmitter particles: diffuse, bind, then reuptake or breakdown
    let bound = 0
    let free = 0
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const m = s.mode[i]
      if (!m) continue
      s.age[i] += dt
      const o = i * 3
      if (m === 1) {
        free++
        s.vel[o] += (rand() - 0.5) * 6 * dt
        s.vel[o + 1] += (rand() - 0.5) * 6 * dt - 0.3 * dt
        s.vel[o + 2] += (rand() - 0.5) * 6 * dt
        s.pos[o] += s.vel[o] * dt
        s.pos[o + 1] += s.vel[o + 1] * dt
        s.pos[o + 2] += s.vel[o + 2] * dt
        // stay inside the cleft
        if (s.pos[o + 1] > PRE_Y - 0.04) {
          s.pos[o + 1] = PRE_Y - 0.04
          s.vel[o + 1] = -Math.abs(s.vel[o + 1])
        }
        if (s.pos[o + 1] < RECEPTOR_TOP - 0.02) {
          s.pos[o + 1] = RECEPTOR_TOP - 0.02
          s.vel[o + 1] = Math.abs(s.vel[o + 1]) * 0.5
          // try to bind to a nearby receptor
          for (let r = 0; r < RECEPTORS.length; r++) {
            if (blocked[r] || s.receptorBusy[r]) continue
            const dx = RECEPTORS[r][0] - s.pos[o]
            const dz = RECEPTORS[r][2] - s.pos[o + 2]
            if (dx * dx + dz * dz < 0.05) {
              s.mode[i] = 2
              s.target[i] = r
              s.timer[i] = 0.25 + rand() * 0.35
              s.receptorBusy[r] = 1
              break
            }
          }
        }
        s.vel[o] *= 0.985
        s.vel[o + 2] *= 0.985
        const rr = Math.hypot(s.pos[o], s.pos[o + 2])
        if (rr > 2.3 || s.age[i] > 4.5) s.mode[i] = 0
        else if (s.age[i] > s.timer[i] && s.mode[i] === 1) {
          if (enzymatic && rand() < 0.08) s.mode[i] = 0
          else if (!enzymatic && s.reuptake[i]) s.mode[i] = 3
        }
      } else if (m === 2) {
        bound++
        const r = s.target[i]
        s.pos[o] = RECEPTORS[r][0]
        s.pos[o + 1] = RECEPTOR_TOP + 0.04
        s.pos[o + 2] = RECEPTORS[r][2]
        s.receptorGlow[r] = 1
        s.timer[i] -= dt
        if (s.timer[i] <= 0) {
          s.mode[i] = 1
          s.receptorBusy[r] = 0
          s.vel[o + 1] = 0.8
          s.timer[i] = s.age[i] + 0.3 + rand() * 0.6
        }
      } else if (m === 3) {
        const t = TRANSPORTERS[i % TRANSPORTERS.length]
        const dx = t[0] - s.pos[o]
        const dy = t[1] - s.pos[o + 1]
        const dz = t[2] - s.pos[o + 2]
        const d = Math.hypot(dx, dy, dz)
        if (d < 0.08) s.mode[i] = 0
        else {
          const k = Math.min(1, (2.2 * dt) / d)
          s.pos[o] += dx * k
          s.pos[o + 1] += dy * k
          s.pos[o + 2] += dz * k
        }
      }
    }
    if (particles.current) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const o = i * 3
        dummy.position.set(s.pos[o], s.pos[o + 1], s.pos[o + 2])
        dummy.scale.setScalar(s.mode[i] ? 0.035 : 0)
        dummy.updateMatrix()
        particles.current.setMatrixAt(i, dummy.matrix)
      }
      particles.current.instanceMatrix.needsUpdate = true
    }
    receptorMats.current.forEach((mat, r) => {
      if (!mat) return
      s.receptorGlow[r] = Math.max(0, s.receptorGlow[r] - dt * 2.5)
      mat.emissiveIntensity = blocked[r] ? 0 : s.receptorGlow[r] * 1.6
    })
    const prev = useSynapseStats.getState()
    if (prev.bound !== bound || prev.free !== free) {
      useSynapseStats.setState({ bound, free, peak: tau < 0.2 ? bound : Math.max(prev.peak, bound) })
    }
  })

  const ampa = useMemo(() => new THREE.CylinderGeometry(0.075, 0.09, 0.22, 12), [])
  return (
    <group>
      <Membranes />
      <instancedMesh ref={vesicles} args={[undefined, undefined, 64]} {...vesicleHandlers}>
        <sphereGeometry args={[1, 16, 12]} />
        <PartMaterial id="synaptic-vesicle" color={nt.color} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={particles} args={[undefined, undefined, MAX_PARTICLES]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={ntColor} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={calcium} args={[undefined, undefined, 36]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#4cc9f0" toneMapped={false} />
      </instancedMesh>
      {CA_CHANNELS.map((p, i) => (
        <mesh key={i} position={p} {...caHandlers}>
          <cylinderGeometry args={[0.07, 0.07, 0.18, 12]} />
          <meshStandardMaterial ref={(m) => void (caMats.current[i] = m)} color={color("voltage-gated-calcium-channel")} emissive="#4cc9f0" emissiveIntensity={0} />
        </mesh>
      ))}
      {TRANSPORTERS.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, -Math.atan2(p[2], p[0]), Math.PI / 2.6]} {...transporterHandlers}>
          <cylinderGeometry args={[0.09, 0.09, 0.22, 12]} />
          <PartMaterial id="reuptake-transporter" color={reuptakeImpaired > 0.3 ? "#5c5c6e" : color("reuptake-transporter")} />
        </mesh>
      ))}
      {RECEPTORS.map((p, i) => (
        <group key={i} position={[p[0], p[1] - 0.09, p[2]]}>
          <mesh geometry={ampa} {...receptorHandlers}>
            <meshStandardMaterial
              ref={(m) => void (receptorMats.current[i] = m)}
              color={blocked[i] ? "#555" : color("postsynaptic-receptor")}
              emissive={nt.color}
              emissiveIntensity={0}
            />
          </mesh>
          {blocked[i] && fx?.antibodies && <Antibody />}
        </group>
      ))}
      {fx?.amyloid && <Amyloid />}
      <TagLabel id="presynaptic-terminal" position={[1.6, PRE_Y + 2.4, 0]}>Presynaptic terminal</TagLabel>
      <TagLabel id="synaptic-vesicle" position={[-0.6, PRE_Y + 1.1, 1.2]}>Vesicles</TagLabel>
      <TagLabel id="voltage-gated-calcium-channel" position={[CA_CHANNELS[0][0], PRE_Y + 0.25, CA_CHANNELS[0][2] + 0.4]}>Ca²⁺ channel</TagLabel>
      <TagLabel id="reuptake-transporter" position={[TRANSPORTERS[0][0] + 0.3, TRANSPORTERS[0][1] + 0.3, TRANSPORTERS[0][2]]}>Reuptake transporter</TagLabel>
      <TagLabel id="synaptic-cleft" position={[2.4, 0, 0]}>Synaptic cleft</TagLabel>
      <TagLabel id="postsynaptic-receptor" position={[0.4, POST_Y - 0.35, 1.5]}>Receptors</TagLabel>
      <TagLabel id="postsynaptic-density" position={[-1.4, POST_Y - 0.5, -0.6]}>Postsynaptic density</TagLabel>
      <SelectedLabel anchors={synapseAnchors} />
    </group>
  )
}

function Antibody() {
  return (
    <group position={[0, 0.2, 0]} scale={0.6}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.22, 8]} />
        <meshStandardMaterial color="#80ffdb" emissive="#80ffdb" emissiveIntensity={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.08 * s, 0.28, 0]} rotation={[0, 0, -0.6 * s]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
          <meshStandardMaterial color="#80ffdb" emissive="#80ffdb" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Amyloid() {
  const geo = useMemo(() => lumpySphere(0.12, 8, 0.8, 2), [])
  const spots: V3[] = [
    [0.6, 0, 0.5],
    [-0.9, -0.05, 0.2],
    [0.2, 0.05, -1.0],
    [-0.3, -0.02, 1.1],
    [1.3, 0.02, -0.4],
  ]
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={p} geometry={geo}>
          <meshStandardMaterial color="#e0a526" emissive="#b5651d" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <TagLabel position={[0.6, 0.35, 0.5]}>Aβ oligomers</TagLabel>
    </group>
  )
}

export const synapseAnchors: Record<string, V3> = {
  "presynaptic-terminal": [0, PRE_Y + 2.2, 0],
  "synaptic-vesicle": [0.4, PRE_Y + 0.25, 0],
  "voltage-gated-calcium-channel": CA_CHANNELS[0],
  "synaptic-cleft": [1.8, 0, 0],
  "postsynaptic-receptor": RECEPTORS[3],
  "postsynaptic-density": [0, POST_Y - 0.1, 1.2],
  "reuptake-transporter": TRANSPORTERS[0],
}
