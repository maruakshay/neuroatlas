"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { getDisorder, getStructure } from "@/data"
import { apMode, channelState, CYCLE_MS, useMembraneClock } from "@/lib/action-potential"
import { useAtlas } from "@/store/atlas"
import { PartMaterial, rng, SelectedLabel, TagLabel, useInteract } from "../common"

type V3 = [number, number, number]
const color = (id: string) => getStructure(id)?.color ?? "#ccc"

const NA_CHANNELS: V3[] = [
  [-3.2, 0, -0.6],
  [0.4, 0, 0.8],
  [3.0, 0, -0.9],
]
const K_CHANNELS: V3[] = [
  [-1.4, 0, 0.9],
  [1.9, 0, 0.6],
  [-4.4, 0, 1.0],
]
const PUMPS: V3[] = [
  [4.4, 0, 0.6],
  [-0.9, 0, -1.2],
]
const HEAD_Y = 0.42
/** Membrane milliseconds per real second at speed 1. */
const MS_PER_SEC = 0.7

function Bilayer() {
  const handlers = useInteract("lipid-bilayer")
  const ref = useRef<THREE.InstancedMesh>(null)
  const matrices = useMemo(() => {
    const holes = [...NA_CHANNELS, ...K_CHANNELS, ...PUMPS]
    const out: THREE.Matrix4[] = []
    for (let x = -5.6; x <= 5.6; x += 0.28) {
      for (let z = -2.4; z <= 2.4; z += 0.28) {
        if (holes.some((h) => Math.hypot(h[0] - x, h[2] - z) < 0.42)) continue
        for (const y of [HEAD_Y, -HEAD_Y]) {
          out.push(new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(0.115, 0.115, 0.115)))
        }
      }
    }
    return out
  }, [])
  useEffect(() => {
    matrices.forEach((m, i) => ref.current?.setMatrixAt(i, m))
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [matrices])
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} {...handlers}>
        <sphereGeometry args={[1, 10, 8]} />
        <PartMaterial id="lipid-bilayer" color={color("lipid-bilayer")} roughness={0.4} />
      </instancedMesh>
      <mesh {...handlers}>
        <boxGeometry args={[11.4, 0.62, 4.9]} />
        <PartMaterial id="lipid-bilayer" color="#f6e2b3" opacity={0.35} />
      </mesh>
    </group>
  )
}

/** Four-subunit channel. `spread` opens the pore; `plug` shows the inactivation gate. */
function Channel({ id, position, tint, refs }: { id: string; position: V3; tint: string; refs: { group: (g: THREE.Group | null) => void; plug: (m: THREE.Mesh | null) => void } }) {
  const handlers = useInteract(id)
  return (
    <group position={position}>
      <group ref={refs.group}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 0.18, 0, Math.sin((i * Math.PI) / 2) * 0.18]} {...handlers}>
            <capsuleGeometry args={[0.14, 1.35, 6, 12]} />
            <PartMaterial id={id} color={tint} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {id === "sodium-channel" && (
        <mesh ref={refs.plug} position={[0, -1.05, 0]}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  )
}

function Pump({ position, refFn }: { position: V3; refFn: (g: THREE.Group | null) => void }) {
  const handlers = useInteract("sodium-potassium-pump")
  return (
    <group position={position} ref={refFn}>
      <mesh position={[-0.14, 0, 0]} scale={[0.24, 0.85, 0.3]} {...handlers}>
        <sphereGeometry args={[1, 24, 16]} />
        <PartMaterial id="sodium-potassium-pump" color={color("sodium-potassium-pump")} />
      </mesh>
      <mesh position={[0.14, 0, 0]} scale={[0.24, 0.85, 0.3]} {...handlers}>
        <sphereGeometry args={[1, 24, 16]} />
        <PartMaterial id="sodium-potassium-pump" color="#2d8f6f" />
      </mesh>
    </group>
  )
}

interface Ion {
  home: THREE.Vector3
  phase: number
  /** For crossers: channel/pump they travel through. */
  via?: V3
  pump?: V3
  order: number
}

function makeIons(seed: number, n: number, above: boolean): Ion[] {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => ({
    home: new THREE.Vector3((r() - 0.5) * 10.5, (above ? 1 : -1) * (0.8 + r() * 1.6), (r() - 0.5) * 4.4),
    phase: r() * 10,
    order: i,
  }))
}

export function MembraneScene() {
  const fx = useAtlas((s) => getDisorder(s.disorderId)?.effects.membrane)
  const fireCount = useAtlas((s) => s.fireCount)
  const mode = apMode(fx)
  const cycle = CYCLE_MS[mode]

  const naCrossPer = mode === "persistent" ? 6 : 4
  const ions = useMemo(() => {
    const naOut = makeIons(1, 70, true)
    const naIn = makeIons(2, 10, false)
    const kIn = makeIons(3, 70, false)
    const kOut = makeIons(4, 10, true)
    const naCross: Ion[] = NA_CHANNELS.flatMap((c, ci) =>
      Array.from({ length: naCrossPer }, (_, i) => ({ home: new THREE.Vector3(c[0] + (i - 1.5) * 0.25, 1.1 + i * 0.2, c[2] + 0.2), phase: i, via: c, pump: PUMPS[ci % PUMPS.length], order: i })),
    )
    const kCross: Ion[] = K_CHANNELS.flatMap((c, ci) =>
      Array.from({ length: 3 }, (_, i) => ({ home: new THREE.Vector3(c[0] + (i - 1) * 0.25, -1.1 - i * 0.2, c[2] - 0.2), phase: i, via: c, pump: PUMPS[ci % PUMPS.length], order: i })),
    )
    return { na: [...naOut, ...naIn], k: [...kIn, ...kOut], naCross, kCross }
  }, [naCrossPer])

  const naMesh = useRef<THREE.InstancedMesh>(null)
  const kMesh = useRef<THREE.InstancedMesh>(null)
  const channelGroups = useRef<(THREE.Group | null)[]>([])
  const plugs = useRef<(THREE.Mesh | null)[]>([])
  const pumps = useRef<(THREE.Group | null)[]>([])
  const sim = useRef({ ms: 0 })
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    sim.current.ms = 0
  }, [fireCount, mode])

  useFrame(({ clock }, dt) => {
    const speed = useAtlas.getState().speed
    const s = sim.current
    s.ms += Math.min(dt, 0.05) * speed * MS_PER_SEC
    if (s.ms > cycle + 1.5) s.ms = 0
    const t = Math.min(s.ms, cycle)
    if (Math.abs(useMembraneClock.getState().ms - t) > 0.02) useMembraneClock.setState({ ms: t })
    const st = channelState(t, mode)
    const time = clock.elapsedTime

    // channel conformations
    NA_CHANNELS.forEach((_, i) => {
      const g = channelGroups.current[i]
      if (g) g.scale.set(st.na === "open" ? 1.45 : 1, 1, st.na === "open" ? 1.45 : 1)
      const plug = plugs.current[i]
      if (plug) plug.position.y = THREE.MathUtils.damp(plug.position.y, st.na === "inactivated" ? -0.62 : -1.05, 8, dt)
    })
    K_CHANNELS.forEach((_, i) => {
      const g = channelGroups.current[NA_CHANNELS.length + i]
      if (g) g.scale.set(st.k === "open" ? 1.45 : 1, 1, st.k === "open" ? 1.45 : 1)
    })
    pumps.current.forEach((p, i) => {
      if (p) p.rotation.z = st.pump ? Math.sin(time * 6 + i) * 0.25 : 0
    })

    // Progress of ions through channels (0 = start side, 1 = crossed).
    const naProgress = (order: number) => {
      if (mode === "pumpFailure") return Math.min(1, t / cycle + order * 0.05)
      const open = mode === "persistent" ? [0.5, 6.2] : [0.5, 1.0]
      return (t - open[0] - order * 0.06) / (open[1] - open[0])
    }
    const kProgress = (order: number) => {
      if (mode === "pumpFailure") return Math.min(1, t / cycle + order * 0.08)
      const open = mode === "persistent" ? [1.0, 7.0] : [1.0, 2.6]
      return (t - open[0] - order * 0.1) / (open[1] - open[0])
    }
    const returnK = mode === "pumpFailure" ? 0 : Math.min(1, Math.max(0, (t - (mode === "persistent" ? 7 : 4.6)) / 1.6))

    const place = (ion: Ion, progress: number, down: boolean, back: number) => {
      const c = ion.via!
      const p = Math.min(1, Math.max(0, progress))
      const startY = ion.home.y
      const endY = down ? -1.1 - ion.order * 0.2 : 1.1 + ion.order * 0.2
      let x: number, y: number, z: number
      if (p < 0.3) {
        const k = p / 0.3
        x = THREE.MathUtils.lerp(ion.home.x, c[0], k)
        z = THREE.MathUtils.lerp(ion.home.z, c[2], k)
        y = THREE.MathUtils.lerp(startY, down ? 0.7 : -0.7, k)
      } else if (p < 0.7) {
        const k = (p - 0.3) / 0.4
        x = c[0]
        z = c[2]
        y = THREE.MathUtils.lerp(down ? 0.7 : -0.7, down ? -0.7 : 0.7, k)
      } else {
        const k = (p - 0.7) / 0.3
        x = c[0] + (ion.home.x - c[0]) * k
        z = c[2] + (ion.home.z - c[2]) * k
        y = THREE.MathUtils.lerp(down ? -0.7 : 0.7, endY, k)
      }
      if (back > 0 && ion.pump) {
        // pump carries the ion back across
        const pp = ion.pump
        const b = back
        if (b < 0.5) {
          const k = b / 0.5
          x = THREE.MathUtils.lerp(x, pp[0], k)
          z = THREE.MathUtils.lerp(z, pp[2], k)
          y = THREE.MathUtils.lerp(y, down ? -0.6 : 0.6, k)
        } else {
          const k = (b - 0.5) / 0.5
          x = THREE.MathUtils.lerp(pp[0], ion.home.x, k)
          z = THREE.MathUtils.lerp(pp[2], ion.home.z, k)
          y = THREE.MathUtils.lerp(down ? -0.6 : 0.6, startY, k)
        }
      }
      dummy.position.set(x, y, z)
    }

    const jiggle = (ion: Ion) => {
      dummy.position.copy(ion.home)
      dummy.position.x += Math.sin(time * 1.3 + ion.phase) * 0.12
      dummy.position.y += Math.cos(time * 1.7 + ion.phase) * 0.08
      dummy.position.z += Math.sin(time * 1.1 + ion.phase * 2) * 0.12
    }

    if (naMesh.current) {
      let i = 0
      for (const ion of ions.na) {
        jiggle(ion)
        dummy.scale.setScalar(0.085)
        dummy.updateMatrix()
        naMesh.current.setMatrixAt(i++, dummy.matrix)
      }
      for (const ion of ions.naCross) {
        place(ion, naProgress(ion.order), true, returnK)
        dummy.scale.setScalar(0.1)
        dummy.updateMatrix()
        naMesh.current.setMatrixAt(i++, dummy.matrix)
      }
      naMesh.current.instanceMatrix.needsUpdate = true
    }
    if (kMesh.current) {
      let i = 0
      for (const ion of ions.k) {
        jiggle(ion)
        dummy.scale.setScalar(0.1)
        dummy.updateMatrix()
        kMesh.current.setMatrixAt(i++, dummy.matrix)
      }
      for (const ion of ions.kCross) {
        place(ion, kProgress(ion.order), false, returnK)
        dummy.scale.setScalar(0.115)
        dummy.updateMatrix()
        kMesh.current.setMatrixAt(i++, dummy.matrix)
      }
      kMesh.current.instanceMatrix.needsUpdate = true
    }
  })

  const nNa = ions.na.length + ions.naCross.length
  const nK = ions.k.length + ions.kCross.length
  return (
    <group>
      <Bilayer />
      {NA_CHANNELS.map((p, i) => (
        <Channel
          key={`na${i}`}
          id="sodium-channel"
          position={p}
          tint={color("sodium-channel")}
          refs={{ group: (g) => void (channelGroups.current[i] = g), plug: (m) => void (plugs.current[i] = m) }}
        />
      ))}
      {K_CHANNELS.map((p, i) => (
        <Channel
          key={`k${i}`}
          id="potassium-channel"
          position={p}
          tint={color("potassium-channel")}
          refs={{ group: (g) => void (channelGroups.current[NA_CHANNELS.length + i] = g), plug: () => {} }}
        />
      ))}
      {PUMPS.map((p, i) => (
        <Pump key={i} position={p} refFn={(g) => void (pumps.current[i] = g)} />
      ))}
      <instancedMesh key={`na${nNa}`} ref={naMesh} args={[undefined, undefined, nNa]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#ff7b54" emissive="#ff4d00" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh key={`k${nK}`} ref={kMesh} args={[undefined, undefined, nK]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#b388eb" emissive="#7b2cbf" emissiveIntensity={0.35} />
      </instancedMesh>
      <TagLabel position={[-5.2, 2.6, 0]}>Outside the cell (extracellular)</TagLabel>
      <TagLabel position={[-5.2, -2.6, 0]}>Inside the neuron (cytoplasm)</TagLabel>
      <TagLabel id="sodium-channel" position={[NA_CHANNELS[1][0], 0.95, NA_CHANNELS[1][2]]}>Na⁺ channel</TagLabel>
      <TagLabel id="potassium-channel" position={[K_CHANNELS[1][0], -0.95, K_CHANNELS[1][2]]}>K⁺ channel</TagLabel>
      <TagLabel id="sodium-potassium-pump" position={[PUMPS[0][0], 0.95, PUMPS[0][2]]}>Na⁺/K⁺ pump</TagLabel>
      <TagLabel id="lipid-bilayer" position={[4.8, 0.5, -2.2]}>Lipid bilayer</TagLabel>
      <SelectedLabel
        anchors={{
          "sodium-channel": [NA_CHANNELS[1][0], 0.6, NA_CHANNELS[1][2]],
          "potassium-channel": [K_CHANNELS[1][0], 0.6, K_CHANNELS[1][2]],
          "sodium-potassium-pump": [PUMPS[0][0], 0.6, PUMPS[0][2]],
          "lipid-bilayer": [0, 0.5, -2],
        }}
      />
    </group>
  )
}
