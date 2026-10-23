"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { getDisorder, getStructure } from "@/data"
import type { Side } from "@/lib/types"
import { useAtlas } from "@/store/atlas"
import { lumpySphere, PartMaterial, SelectedLabel, useInteract, useLerpScale } from "../common"
import { Cerebrum, Meninges } from "./Cerebrum"

type V3 = [number, number, number]

const color = (id: string) => getStructure(id)?.color ?? "#ccc"
const curve = (pts: V3[]) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
const mirror = (pts: V3[], sign: number): V3[] => pts.map(([x, y, z]) => [x * sign, y, z])

function useShrink(id: string) {
  return useAtlas((s) => getDisorder(s.disorderId)?.effects.brain?.shrink?.[id] ?? 1)
}

/** Opacity for internal structures: slightly see-through when the cortex is see-through so nothing hides. */
function useDeepOpacity(base = 1) {
  const cortex = useAtlas((s) => s.brain.cortexOpacity)
  return cortex < 1 ? Math.min(base, 0.92) : base
}

/** An ellipsoid or sphere structure, scaled about its own centre. */
function Blob({ id, position, radii, side, rotation }: { id: string; position: V3; radii: V3; side?: Side; rotation?: V3 }) {
  const handlers = useInteract(id)
  const ref = useLerpScale(useShrink(id))
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh scale={radii} {...handlers}>
        <sphereGeometry args={[1, 40, 28]} />
        <PartMaterial id={id} side={side} color={color(id)} opacity={useDeepOpacity()} />
      </mesh>
    </group>
  )
}

/** A tube structure following a curve, scaled about the curve's centroid. */
function Tube({ id, points, radius, side, opacity, flatten }: { id: string; points: V3[]; radius: number; side?: Side; opacity?: number; flatten?: V3 }) {
  const handlers = useInteract(id)
  const { geometry, center } = useMemo(() => {
    const c = curve(points)
    const center = new THREE.Vector3()
    points.forEach((p) => center.add(new THREE.Vector3(...p)))
    center.divideScalar(points.length)
    const g = new THREE.TubeGeometry(c, 64, radius, 14, false)
    g.translate(-center.x, -center.y, -center.z)
    return { geometry: g, center }
  }, [points, radius])
  const ref = useLerpScale(useShrink(id))
  const deep = useDeepOpacity()
  return (
    <group ref={ref} position={center}>
      <mesh geometry={geometry} scale={flatten ?? [1, 1, 1]} {...handlers}>
        <PartMaterial id={id} side={side} color={color(id)} opacity={opacity ?? deep} />
      </mesh>
    </group>
  )
}

const bilateral = (render: (sign: 1 | -1, side: Side) => React.ReactNode) => (
  <>
    {render(-1, "left")}
    {render(1, "right")}
  </>
)

function DeepStructures() {
  return (
    <group>
      {/* Corpus callosum: a flattened arch over the midline */}
      <Tube
        id="corpus-callosum"
        radius={0.05}
        flatten={[3.2, 1, 1]}
        points={[
          [0, 0.1, 0.5],
          [0, 0.24, 0.6],
          [0, 0.36, 0.36],
          [0, 0.4, 0],
          [0, 0.37, -0.32],
          [0, 0.25, -0.55],
        ]}
      />
      {bilateral((s, side) => (
        <Tube
          key={`cg${s}`}
          id="cingulate-gyrus"
          side={side}
          radius={0.04}
          points={mirror(
            [
              [0.06, 0.18, 0.62],
              [0.06, 0.38, 0.6],
              [0.06, 0.5, 0.3],
              [0.06, 0.53, -0.05],
              [0.06, 0.48, -0.4],
              [0.06, 0.3, -0.62],
            ],
            s,
          )}
        />
      ))}
      {bilateral((s, side) => (
        <Blob key={`th${s}`} id="thalamus" side={side} position={[0.1 * s, 0.1, -0.06]} radii={[0.085, 0.08, 0.16]} />
      ))}
      <Blob id="hypothalamus" position={[0, -0.07, 0.12]} radii={[0.07, 0.055, 0.08]} />
      <PituitaryStalk />
      <Blob id="pituitary-gland" position={[0, -0.27, 0.19]} radii={[0.05, 0.04, 0.05]} />
      <Blob id="pineal-gland" position={[0, 0.12, -0.26]} radii={[0.025, 0.025, 0.035]} />
      {bilateral((s, side) => (
        <Tube
          key={`hc${s}`}
          id="hippocampus"
          side={side}
          radius={0.05}
          points={mirror(
            [
              [0.31, -0.22, 0.16],
              [0.31, -0.18, -0.04],
              [0.28, -0.08, -0.24],
              [0.2, 0.06, -0.38],
            ],
            s,
          )}
        />
      ))}
      {bilateral((s, side) => (
        <Blob key={`am${s}`} id="amygdala" side={side} position={[0.3 * s, -0.21, 0.28]} radii={[0.06, 0.055, 0.06]} />
      ))}
      {bilateral((s, side) => (
        <group key={`cn${s}`}>
          <Blob id="caudate-nucleus" side={side} position={[0.14 * s, 0.17, 0.38]} radii={[0.07, 0.09, 0.12]} />
          <Tube
            id="caudate-nucleus"
            side={side}
            radius={0.032}
            points={mirror(
              [
                [0.15, 0.22, 0.3],
                [0.17, 0.27, 0.05],
                [0.22, 0.24, -0.25],
                [0.3, 0.08, -0.32],
                [0.34, -0.06, -0.14],
              ],
              s,
            )}
          />
        </group>
      ))}
      {bilateral((s, side) => (
        <Blob key={`pu${s}`} id="putamen" side={side} position={[0.3 * s, 0.06, 0.12]} radii={[0.055, 0.12, 0.2]} />
      ))}
      {bilateral((s, side) => (
        <Blob key={`gp${s}`} id="globus-pallidus" side={side} position={[0.22 * s, 0.03, 0.08]} radii={[0.04, 0.08, 0.11]} />
      ))}
      {bilateral((s, side) => (
        <Blob
          key={`sn${s}`}
          id="substantia-nigra"
          side={side}
          position={[0.08 * s, -0.2, -0.04]}
          radii={[0.07, 0.022, 0.045]}
          rotation={[0, 0.5 * s, 0]}
        />
      ))}
      <Ventricles />
    </group>
  )
}

function PituitaryStalk() {
  return (
    <mesh position={[0, -0.17, 0.16]} rotation={[0.3, 0, 0]}>
      <cylinderGeometry args={[0.012, 0.018, 0.14, 10]} />
      <meshStandardMaterial color={color("pituitary-gland")} />
    </mesh>
  )
}

function Ventricles() {
  const scale = useAtlas((s) => getDisorder(s.disorderId)?.effects.brain?.ventricleScale ?? 1)
  const ref = useLerpScale(scale)
  const handlers = useInteract("ventricles")
  const opacity = 0.8
  const lateral = (s: number): V3[] =>
    mirror(
      [
        [0.08, 0.2, 0.44],
        [0.1, 0.27, 0.2],
        [0.11, 0.28, -0.05],
        [0.17, 0.2, -0.36],
        [0.3, 0.02, -0.34],
        [0.37, -0.14, -0.1],
        [0.38, -0.2, 0.1],
      ],
      s,
    ).map(([x, y, z]) => [x, y - 0.12, z + 0.05])
  return (
    <group ref={ref} position={[0, 0.12, -0.05]}>
      <Tube id="ventricles" radius={0.045} points={lateral(-1)} opacity={opacity} />
      <Tube id="ventricles" radius={0.045} points={lateral(1)} opacity={opacity} />
      <mesh position={[0, -0.13, 0.08]} {...handlers}>
        <boxGeometry args={[0.025, 0.14, 0.26]} />
        <PartMaterial id="ventricles" color={color("ventricles")} opacity={opacity} />
      </mesh>
      <mesh position={[0, -0.62, -0.38]} rotation={[0.5, 0, 0]} scale={[1.6, 0.6, 1]} {...handlers}>
        <octahedronGeometry args={[0.06, 1]} />
        <PartMaterial id="ventricles" color={color("ventricles")} opacity={opacity} />
      </mesh>
      <Tube
        id="ventricles"
        radius={0.014}
        opacity={opacity}
        points={[
          [0, -0.2, 0.0],
          [0, -0.34, -0.18],
          [0, -0.56, -0.34],
        ]}
      />
    </group>
  )
}

function Cerebellum() {
  const handlers = useInteract("cerebellum")
  const shrink = useShrink("cerebellum")
  const ref = useLerpScale(shrink)
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 128, 96)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const vermis = Math.exp(-Math.pow(v.x / 0.12, 2)) * (v.z < 0.2 ? 1 : 0.3)
      // folia: fine parallel ridges wrapping around the cerebellum
      const angle = Math.atan2(v.y, -v.z)
      const folia = 0.022 * Math.sin(angle * 34) + 0.012 * Math.sin(angle * 71 + v.x * 3)
      const r = 1 + folia - 0.12 * vermis
      pos.setXYZ(i, v.x * r * 0.62, v.y * r * 0.28, v.z * r * 0.38)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group ref={ref} position={[0, -0.5, -0.68]}>
      <mesh geometry={geometry} rotation={[-0.2, 0, 0]} {...handlers}>
        <PartMaterial id="cerebellum" color={color("cerebellum")} />
      </mesh>
    </group>
  )
}

const STEM_CURVE = curve([
  [0, -0.02, -0.04],
  [0, -0.26, -0.1],
  [0, -0.5, -0.17],
  [0, -0.78, -0.27],
  [0, -1.05, -0.34],
  [0, -1.6, -0.42],
])

/** Brainstem parts as consecutive pieces of one tapered tube, so they join seamlessly. */
const STEM_PARTS: { id: string; from: number; to: number; radius: (t: number) => number }[] = [
  { id: "midbrain", from: 0, to: 0.22, radius: () => 0.135 },
  { id: "pons", from: 0.22, to: 0.42, radius: (t) => 0.135 + 0.06 * Math.sin(t * Math.PI) },
  { id: "medulla-oblongata", from: 0.42, to: 0.62, radius: (t) => 0.13 - 0.045 * t },
  { id: "spinal-cord", from: 0.62, to: 1, radius: () => 0.075 },
]

function stemGeometry(from: number, to: number, radius: (t: number) => number) {
  const pts = Array.from({ length: 12 }, (_, i) => STEM_CURVE.getPointAt(from + ((to - from) * i) / 11))
  const c = new THREE.CatmullRomCurve3(pts)
  const tubular = 40
  const radial = 28
  const g = new THREE.TubeGeometry(c, tubular, 1, radial, false)
  const pos = g.attributes.position
  const center = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / (radial + 1)) / tubular
    c.getPointAt(t, center)
    p.fromBufferAttribute(pos, i).sub(center)
    // flatten front-to-back and push the pons forward like the real basilar bulge
    p.multiplyScalar(radius(t))
    p.z *= 0.85
    if (p.z > 0) p.z *= 1 + 0.4 * (radius(t) - 0.135) / 0.06
    p.add(center)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  g.computeVertexNormals()
  return g
}

function Brainstem() {
  const opacity = useDeepOpacity()
  return (
    <group>
      {STEM_PARTS.map((part) => (
        <BrainstemPart key={part.id} id={part.id} from={part.from} to={part.to} radius={part.radius} opacity={opacity} />
      ))}
    </group>
  )
}

function BrainstemPart({ id, from, to, radius, opacity }: { id: string; from: number; to: number; radius: (t: number) => number; opacity: number }) {
  const handlers = useInteract(id)
  const geometry = useMemo(() => stemGeometry(from, to, radius), [from, to, radius])
  return (
    <mesh geometry={geometry} {...handlers}>
      <PartMaterial id={id} color={color(id)} opacity={opacity} />
    </mesh>
  )
}

function Arteries() {
  const show = useAtlas((s) => s.brain.showArteries)
  if (!show) return null
  const r = 0.018
  return (
    <group>
      {bilateral((s, side) => (
        <group key={`a${s}`}>
          <Tube id="internal-carotid-artery" side={side} radius={0.024} opacity={1} points={mirror([[0.13, -0.95, 0.12], [0.14, -0.6, 0.16], [0.13, -0.3, 0.15], [0.12, -0.2, 0.17]], s)} />
          <Tube id="middle-cerebral-artery" side={side} radius={r} opacity={1} points={mirror([[0.12, -0.2, 0.17], [0.4, -0.18, 0.18], [0.7, -0.1, 0.1], [0.86, 0.12, 0.22], [0.82, 0.38, 0.3]], s)} />
          <Tube id="middle-cerebral-artery" side={side} radius={r * 0.8} opacity={1} points={mirror([[0.7, -0.1, 0.1], [0.88, 0.1, -0.05], [0.84, 0.36, -0.12], [0.7, 0.55, -0.15]], s)} />
          <Tube id="middle-cerebral-artery" side={side} radius={r * 0.8} opacity={1} points={mirror([[0.7, -0.1, 0.1], [0.86, -0.05, -0.3], [0.8, 0.12, -0.55], [0.66, 0.25, -0.75]], s)} />
          <Tube id="anterior-cerebral-artery" side={side} radius={r} opacity={1} points={mirror([[0.12, -0.2, 0.17], [0.03, -0.12, 0.45], [0.03, 0.12, 0.85], [0.03, 0.5, 0.65], [0.03, 0.72, 0.2], [0.03, 0.7, -0.3]], s)} />
          <Tube id="posterior-cerebral-artery" side={side} radius={r} opacity={1} points={mirror([[0.0, -0.28, 0.02], [0.17, -0.27, -0.06], [0.3, -0.24, -0.4], [0.22, -0.14, -0.85], [0.08, 0.0, -1.08]], s)} />
          <Tube id="basilar-artery" side={side} radius={0.016} opacity={1} points={mirror([[0.1, -1.25, -0.2], [0.09, -1.05, -0.1], [0.02, -0.85, -0.04]], s)} />
        </group>
      ))}
      <Tube id="basilar-artery" radius={0.022} opacity={1} points={[[0, -0.86, -0.04], [0, -0.6, 0.0], [0, -0.4, 0.0], [0, -0.28, 0.02]]} />
    </group>
  )
}

function DisorderOverlays() {
  const b = useAtlas((s) => getDisorder(s.disorderId)?.effects.brain)
  const tumorRef = useRef<THREE.Mesh>(null)
  const tumorGeo = useMemo(() => lumpySphere(1, 7, 0.35, 4), [])
  useFrame(({ clock }) => {
    if (tumorRef.current) tumorRef.current.scale.setScalar(1 + 0.03 * Math.sin(clock.elapsedTime * 2))
  })
  if (!b) return null
  return (
    <group>
      {b.tumor && (
        <group position={b.tumor.position}>
          <mesh ref={tumorRef} geometry={tumorGeo} scale={b.tumor.radius}>
            <meshStandardMaterial color="#6a1b4d" emissive="#ff2d7a" emissiveIntensity={0.35} roughness={0.8} />
          </mesh>
          <mesh scale={b.tumor.radius * 1.6}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color="#ffd166" transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </group>
      )}
      {b.lesions?.map((l, i) => (
        <mesh key={i} position={l.position} geometry={tumorGeo} scale={l.radius * 0.8}>
          <meshStandardMaterial color="#fff3b0" emissive="#ffb703" emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

export const brainAnchors: Record<string, V3> = {
  "frontal-lobe": [-0.6, 0.45, 0.65],
  "parietal-lobe": [-0.55, 0.65, -0.35],
  "temporal-lobe": [-0.85, -0.2, 0.15],
  "occipital-lobe": [-0.4, 0.2, -1.05],
  "prefrontal-cortex": [-0.45, 0.4, 0.95],
  "premotor-cortex": [-0.6, 0.6, 0.35],
  "primary-motor-cortex": [-0.55, 0.68, 0.1],
  "primary-somatosensory-cortex": [-0.55, 0.68, -0.1],
  "posterior-parietal-cortex": [-0.5, 0.6, -0.55],
  "broca-area": [-0.8, 0.0, 0.5],
  "wernicke-area": [-0.85, 0.05, -0.35],
  "primary-auditory-cortex": [-0.88, -0.08, 0.05],
  "primary-visual-cortex": [-0.1, 0.1, -1.12],
  "visual-association-cortex": [-0.45, 0.15, -0.95],
  "corpus-callosum": [0, 0.42, 0],
  "cingulate-gyrus": [-0.06, 0.55, 0.2],
  thalamus: [-0.1, 0.18, -0.06],
  hypothalamus: [0, -0.07, 0.12],
  "pituitary-gland": [0, -0.3, 0.2],
  "pineal-gland": [0, 0.14, -0.27],
  hippocampus: [-0.31, -0.15, -0.05],
  amygdala: [-0.3, -0.2, 0.28],
  "caudate-nucleus": [-0.14, 0.25, 0.38],
  putamen: [-0.3, 0.18, 0.12],
  "globus-pallidus": [-0.22, 0.1, 0.08],
  "substantia-nigra": [-0.08, -0.2, -0.04],
  ventricles: [-0.1, 0.3, 0.1],
  meninges: [-0.6, 0.7, 0.2],
  cerebellum: [-0.4, -0.5, -0.75],
  midbrain: [0, -0.22, 0.04],
  pons: [0, -0.47, 0.0],
  "medulla-oblongata": [0, -0.76, -0.17],
  "spinal-cord": [0, -1.2, -0.3],
  "internal-carotid-artery": [-0.13, -0.6, 0.16],
  "middle-cerebral-artery": [-0.86, 0.12, 0.22],
  "anterior-cerebral-artery": [-0.03, 0.5, 0.65],
  "posterior-cerebral-artery": [-0.3, -0.24, -0.4],
  "basilar-artery": [0, -0.6, 0.0],
}

export function BrainScene() {
  return (
    <group>
      <Cerebrum />
      <Meninges />
      <DeepStructures />
      <Cerebellum />
      <Brainstem />
      <Arteries />
      <DisorderOverlays />
      <SelectedLabel anchors={brainAnchors} />
    </group>
  )
}
