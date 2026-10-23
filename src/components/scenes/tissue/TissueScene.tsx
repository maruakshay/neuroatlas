"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { getDisorder, getStructure } from "@/data"
import { useAtlas } from "@/store/atlas"
import { branchesToGeometry, growBranches, lumpySphere, PartMaterial, rng, SelectedLabel, TagLabel, useInteract } from "../common"

type V3 = [number, number, number]
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const color = (id: string) => getStructure(id)?.color ?? "#ccc"

function useTissue() {
  return useAtlas((s) => getDisorder(s.disorderId)?.effects.tissue)
}

function PyramidalNeuron({ position, seed, lost }: { position: V3; seed: number; lost: boolean }) {
  const handlers = useInteract("pyramidal-neuron")
  const tangles = useTissue()?.tangles
  const geometry = useMemo(() => {
    const o = v(0, 0, 0)
    const branches = [
      ...growBranches({ seed, origin: o, direction: v(0, 1, 0), length: 2.2, radius: 0.09, depth: 3, fork: 2, spread: 0.5, bias: v(0, 1, 0) }),
      ...[0, 1, 2, 3].flatMap((i) =>
        growBranches({
          seed: seed + i + 1,
          origin: o,
          direction: v(Math.cos(i * 1.6), -0.6, Math.sin(i * 1.6)),
          length: 0.9,
          radius: 0.05,
          depth: 2,
          spread: 0.8,
        }),
      ),
      ...growBranches({ seed: seed + 9, origin: o, direction: v(0.1, -1, 0.05), length: 2.6, radius: 0.035, depth: 1, fork: 2, spread: 0.9, wiggle: 0.05 }),
    ]
    return branchesToGeometry(branches)
  }, [seed])
  const opacity = lost ? 0.18 : 1
  return (
    <group position={position}>
      <mesh geometry={geometry} {...handlers}>
        <PartMaterial id="pyramidal-neuron" color={lost ? "#777" : color("pyramidal-neuron")} opacity={opacity} />
      </mesh>
      <mesh scale={[0.28, 0.4, 0.28]} position={[0, 0.05, 0]} {...handlers}>
        <coneGeometry args={[1, 1.4, 16]} />
        <PartMaterial id="pyramidal-neuron" color={lost ? "#777" : color("pyramidal-neuron")} opacity={opacity} />
      </mesh>
      {tangles && !lost && (
        <mesh position={[0, 0.05, 0.12]} scale={0.09}>
          <torusKnotGeometry args={[1, 0.18, 64, 8, 2, 5]} />
          <meshStandardMaterial color="#3b1f0b" emissive="#8a3c00" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  )
}

function Interneuron({ position, seed, lost }: { position: V3; seed: number; lost: boolean }) {
  const handlers = useInteract("interneuron")
  const geometry = useMemo(
    () =>
      branchesToGeometry(
        Array.from({ length: 6 }, (_, i) =>
          growBranches({
            seed: seed + i,
            origin: v(0, 0, 0),
            direction: v(Math.cos(i), Math.sin(i * 2.1), Math.sin(i)),
            length: 0.7,
            radius: 0.035,
            depth: 2,
            spread: 0.9,
          }),
        ).flat(),
      ),
    [seed],
  )
  const c = lost ? "#777" : color("interneuron")
  return (
    <group position={position}>
      <mesh geometry={geometry} {...handlers}>
        <PartMaterial id="interneuron" color={c} opacity={lost ? 0.18 : 1} />
      </mesh>
      <mesh scale={0.2} {...handlers}>
        <sphereGeometry args={[1, 20, 16]} />
        <PartMaterial id="interneuron" color={c} opacity={lost ? 0.18 : 1} />
      </mesh>
    </group>
  )
}

function Astrocyte({ position, seed, footTarget }: { position: V3; seed: number; footTarget?: V3 }) {
  const handlers = useInteract("astrocyte")
  const reactive = useTissue()?.reactiveAstrocytes
  const geometry = useMemo(() => {
    const rand = rng(seed)
    const branches = Array.from({ length: 12 }, (_, i) =>
      growBranches({
        seed: seed + i,
        origin: v(0, 0, 0),
        direction: v(rand() - 0.5, rand() - 0.5, rand() - 0.5),
        length: 0.75,
        radius: reactive ? 0.06 : 0.04,
        depth: 2,
        fork: 2,
        spread: 0.9,
        wiggle: 0.25,
      }),
    ).flat()
    if (footTarget) {
      const p = new THREE.Vector3(...footTarget).sub(new THREE.Vector3(...position))
      branches.push({ curve: new THREE.CatmullRomCurve3([v(0, 0, 0), p.clone().multiplyScalar(0.5).add(v(0.1, 0, 0.1)), p]), radius: 0.06, depth: 0 })
    }
    return branchesToGeometry(branches)
  }, [seed, footTarget, position, reactive])
  const footPos = footTarget ? new THREE.Vector3(...footTarget).sub(new THREE.Vector3(...position)) : null
  return (
    <group position={position}>
      <mesh geometry={geometry} {...handlers}>
        <PartMaterial id="astrocyte" color={color("astrocyte")} />
      </mesh>
      <mesh scale={0.22} {...handlers}>
        <icosahedronGeometry args={[1, 2]} />
        <PartMaterial id="astrocyte" color={color("astrocyte")} />
      </mesh>
      {footPos && (
        <mesh position={footPos} scale={[0.22, 0.08, 0.22]} {...handlers}>
          <sphereGeometry args={[1, 16, 12]} />
          <PartMaterial id="astrocyte" color={color("astrocyte")} />
        </mesh>
      )}
    </group>
  )
}

const AXONS: { from: V3; to: V3 }[] = [
  { from: [-6, -0.6, -1.2], to: [6, -0.2, -1.6] },
  { from: [-6, 1.6, -2], to: [6, 1.9, -1.4] },
]

function MyelinatedAxons() {
  const demyelination = useTissue()?.demyelination
  const handlers = useInteract("oligodendrocyte")
  const rand = useMemo(() => rng(42), [])
  const segments = useMemo(() => {
    const out: { pos: THREE.Vector3; quat: THREE.Quaternion; damaged: boolean; axon: number }[] = []
    AXONS.forEach((a, ai) => {
      const from = new THREE.Vector3(...a.from)
      const to = new THREE.Vector3(...a.to)
      const dir = to.clone().sub(from)
      const quat = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), dir.clone().normalize())
      const count = 9
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        out.push({ pos: from.clone().lerp(to, t), quat, damaged: rand() < 0.55, axon: ai })
      }
    })
    return out
  }, [rand])
  const oligo = v(0.3, 0.7, -1.6)
  const linked = segments.filter((_, i) => i % 3 === 1)
  const processGeo = useMemo(
    () =>
      branchesToGeometry(
        linked.map((s) => ({
          curve: new THREE.CatmullRomCurve3([oligo.clone(), oligo.clone().lerp(s.pos, 0.5).add(v(0, 0.3, 0.2)), s.pos.clone()]),
          radius: 0.03,
          depth: 0,
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments],
  )
  return (
    <group>
      {AXONS.map((a, i) => {
        const from = new THREE.Vector3(...a.from)
        const to = new THREE.Vector3(...a.to)
        const mid = from.clone().lerp(to, 0.5)
        const len = from.distanceTo(to)
        const quat = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), to.clone().sub(from).normalize())
        return (
          <mesh key={i} position={mid} quaternion={quat}>
            <cylinderGeometry args={[0.05, 0.05, len, 10]} />
            <meshStandardMaterial color="#f6bd60" />
          </mesh>
        )
      })}
      {segments.map((s, i) =>
        demyelination && s.damaged ? (
          <mesh key={i} position={s.pos} quaternion={s.quat} scale={[1, 0.4, 1]}>
            <cylinderGeometry args={[0.11, 0.11, 0.8, 12, 1, true]} />
            <meshStandardMaterial color="#c9a227" transparent opacity={0.35} wireframe />
          </mesh>
        ) : (
          <mesh key={i} position={s.pos} quaternion={s.quat} {...handlers}>
            <capsuleGeometry args={[0.13, 1.0, 6, 14]} />
            <PartMaterial id="oligodendrocyte" color="#f1faee" roughness={0.3} />
          </mesh>
        ),
      )}
      <mesh geometry={processGeo} {...handlers}>
        <PartMaterial id="oligodendrocyte" color={color("oligodendrocyte")} />
      </mesh>
      <mesh position={oligo} scale={0.2} {...handlers}>
        <sphereGeometry args={[1, 20, 16]} />
        <PartMaterial id="oligodendrocyte" color={color("oligodendrocyte")} />
      </mesh>
      <TagLabel id="oligodendrocyte" position={[oligo.x, oligo.y + 0.4, oligo.z]}>Oligodendrocyte</TagLabel>
      <TagLabel position={[4.5, 2.3, -1.5]}>Myelinated axon</TagLabel>
    </group>
  )
}

function Microglia({ position, seed }: { position: V3; seed: number }) {
  const handlers = useInteract("microglia")
  const activated = useTissue()?.activatedMicroglia
  const ref = useRef<THREE.Group>(null)
  const ramified = useMemo(
    () =>
      branchesToGeometry(
        Array.from({ length: 7 }, (_, i) =>
          growBranches({
            seed: seed + i,
            origin: v(0, 0, 0),
            direction: v(Math.cos(i * 0.9), Math.sin(i * 1.7) * 0.6, Math.sin(i * 0.9)),
            length: 0.6,
            radius: 0.018,
            depth: 3,
            spread: 0.8,
            wiggle: 0.3,
          }),
        ).flat(),
        4,
      ),
    [seed],
  )
  const amoeboid = useMemo(() => lumpySphere(0.28, seed, 0.6, 3), [seed])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime + seed
    ref.current.position.set(position[0] + (activated ? 0.3 * Math.sin(t * 0.7) : 0), position[1], position[2] + (activated ? 0.3 * Math.cos(t * 0.5) : 0))
    ref.current.rotation.y = activated ? t * 0.4 : 0
  })
  return (
    <group ref={ref} position={position}>
      {activated ? (
        <mesh geometry={amoeboid} {...handlers}>
          <PartMaterial id="microglia" color="#d1495b" />
        </mesh>
      ) : (
        <>
          <mesh geometry={ramified} {...handlers}>
            <PartMaterial id="microglia" color={color("microglia")} />
          </mesh>
          <mesh scale={[0.16, 0.1, 0.12]} {...handlers}>
            <sphereGeometry args={[1, 16, 12]} />
            <PartMaterial id="microglia" color={color("microglia")} />
          </mesh>
        </>
      )}
    </group>
  )
}

const CAP_FROM = v(-6, -2.6, 0.6)
const CAP_TO = v(6, -2.3, 1.2)

function Capillary() {
  const handlers = useInteract("blood-brain-barrier")
  const leak = useTissue()?.bbbLeak
  const cells = useRef<THREE.InstancedMesh>(null)
  const leakRef = useRef<THREE.InstancedMesh>(null)
  const dir = CAP_TO.clone().sub(CAP_FROM)
  const len = dir.length()
  const quat = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), dir.clone().normalize())
  const mid = CAP_FROM.clone().lerp(CAP_TO, 0.5)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const rand = useMemo(() => rng(3), [])
  const leakSeeds = useMemo(() => Array.from({ length: 60 }, () => ({ t: rand(), a: rand() * Math.PI * 2, s: 0.5 + rand() })), [rand])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (cells.current) {
      for (let i = 0; i < 18; i++) {
        const k = ((i / 18 + t * 0.06) % 1 + 1) % 1
        dummy.position.copy(CAP_FROM).lerp(CAP_TO, k).add(v(0, Math.sin(i * 3) * 0.12, Math.cos(i * 5) * 0.12))
        dummy.rotation.set(i, t + i, 0)
        dummy.scale.set(0.22, 0.08, 0.22)
        dummy.updateMatrix()
        cells.current.setMatrixAt(i, dummy.matrix)
      }
      cells.current.instanceMatrix.needsUpdate = true
    }
    if (leakRef.current) {
      leakSeeds.forEach((p, i) => {
        const life = (t * 0.25 * p.s + p.t) % 1
        const base = CAP_FROM.clone().lerp(CAP_TO, p.t)
        dummy.position.copy(base).add(v(Math.cos(p.a), Math.sin(p.a), Math.sin(p.a * 2)).multiplyScalar(0.45 + life * 1.6))
        dummy.scale.setScalar(0.06 * (1 - life))
        dummy.updateMatrix()
        leakRef.current!.setMatrixAt(i, dummy.matrix)
      })
      leakRef.current.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      <mesh position={mid} quaternion={quat} {...handlers}>
        <cylinderGeometry args={[0.42, 0.42, len, 32, 1, true]} />
        <PartMaterial id="blood-brain-barrier" color={leak ? "#ff8fa3" : "#e5989b"} opacity={0.45} doubleSide />
      </mesh>
      <instancedMesh ref={cells} args={[undefined, undefined, 18]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#c1121f" />
      </instancedMesh>
      {leak && (
        <instancedMesh ref={leakRef} args={[undefined, undefined, leakSeeds.length]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#ffd166" emissive="#ff9f1c" emissiveIntensity={0.8} />
        </instancedMesh>
      )}
      <TagLabel id="blood-brain-barrier" position={[-4.5, -1.9, 0.7]}>Capillary · blood–brain barrier</TagLabel>
    </group>
  )
}

function Plaques() {
  const geos = useMemo(() => [1, 2, 3, 4, 5, 6].map((s) => lumpySphere(0.35, s * 11, 0.7, 2)), [])
  const spots: V3[] = [
    [-1.6, 0.8, 1.2],
    [1.2, -0.6, 1.6],
    [2.6, 1.4, 0.4],
    [-2.8, -0.8, 0.2],
    [0.2, 2.6, 0.8],
    [-0.4, -1.2, -0.6],
  ]
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={p} geometry={geos[i]}>
          <meshStandardMaterial color="#e0a526" emissive="#b5651d" emissiveIntensity={0.4} roughness={0.9} />
        </mesh>
      ))}
      <TagLabel position={[-1.6, 1.35, 1.2]}>Amyloid-β plaque</TagLabel>
    </group>
  )
}

function TumorCells() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = 140
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: count }, () => {
      const d = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * 1.7)
      return { p: d.add(v(2.6, 0.6, 1.2)), s: 0.12 + r() * 0.12, ph: r() * 6 }
    })
  }, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    seeds.forEach((c, i) => {
      dummy.position.copy(c.p)
      dummy.scale.setScalar(c.s * (1 + 0.15 * Math.sin(clock.elapsedTime * 2 + c.ph)))
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#7b2cbf" emissive="#c77dff" emissiveIntensity={0.25} roughness={0.7} />
      </instancedMesh>
      <TagLabel position={[2.6, 2.6, 1.2]}>Glioblastoma cells</TagLabel>
    </group>
  )
}

export const tissueAnchors: Record<string, V3> = {
  "pyramidal-neuron": [-2, 0.6, 0],
  interneuron: [1.2, 0.4, 0.6],
  astrocyte: [0.4, -0.7, 0.8],
  oligodendrocyte: [0.3, 0.9, -1.6],
  microglia: [-1, 1.8, 1.4],
  "blood-brain-barrier": [0, -2.0, 0.9],
}

export function TissueScene() {
  const tissue = useTissue()
  const loss = tissue?.neuronLoss ?? 0
  const neurons: { pos: V3; seed: number }[] = [
    { pos: [-2, -0.2, 0], seed: 11 },
    { pos: [2.2, -0.6, -0.4], seed: 23 },
    { pos: [-0.2, 0.2, -2.6], seed: 37 },
    { pos: [-4, 0.3, -1.8], seed: 51 },
    { pos: [4, 0, 1.4], seed: 67 },
  ]
  return (
    <group>
      {neurons.map((n, i) => (
        <PyramidalNeuron key={n.seed} position={n.pos} seed={n.seed} lost={i / neurons.length < loss} />
      ))}
      <TagLabel id="pyramidal-neuron" position={[-2, 2.6, 0]}>Pyramidal neuron</TagLabel>
      <Interneuron position={[1.2, 0.4, 0.6]} seed={81} lost={loss > 0.5} />
      <Interneuron position={[-3.4, 1.4, 1.4]} seed={91} lost={false} />
      <TagLabel id="interneuron" position={[1.2, 1.1, 0.6]}>Interneuron</TagLabel>
      <Astrocyte position={[0.4, -0.9, 0.8]} seed={101} footTarget={[0.5, -2.1, 0.95]} />
      <Astrocyte position={[-3, -1.2, 1]} seed={111} footTarget={[-3.1, -2.2, 0.75]} />
      <TagLabel id="astrocyte" position={[0.4, -0.35, 0.8]}>Astrocyte</TagLabel>
      <MyelinatedAxons />
      <Microglia position={[-1, 1.8, 1.4]} seed={131} />
      <Microglia position={[3, 2.2, -0.6]} seed={141} />
      <TagLabel id="microglia" position={[-1, 2.35, 1.4]}>Microglia</TagLabel>
      <Capillary />
      {tissue?.plaques && <Plaques />}
      {tissue?.tumorCells && <TumorCells />}
      <SelectedLabel anchors={tissueAnchors} />
    </group>
  )
}
