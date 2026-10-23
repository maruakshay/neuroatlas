"use client"

import { Html } from "@react-three/drei"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { disorderTouchesCellPart, getDisorder, getStructure } from "@/data"
import type { Side } from "@/lib/types"
import { useAtlas } from "@/store/atlas"

/** Pointer handlers that hover/select a structure. Drags (orbiting) don't count as clicks. */
export function useInteract(id: string) {
  const hover = useAtlas((s) => s.hover)
  const select = useAtlas((s) => s.select)
  return useMemo(
    () => ({
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        hover(id)
        document.body.style.cursor = "pointer"
      },
      onPointerOut: () => {
        if (useAtlas.getState().hoveredId === id) hover(null)
        document.body.style.cursor = ""
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 4) return
        e.stopPropagation()
        select(id, e.point.toArray() as [number, number, number])
      },
    }),
    [id, hover, select],
  )
}

/** Whether the active disorder affects a structure (optionally on one side of the brain). */
export function useAffected(id: string, side?: Side) {
  return useAtlas((s) => {
    const d = getDisorder(s.disorderId)
    if (!d) return false
    const brain = d.effects.brain?.affected.some((a) => a.id === id && (!a.side || !side || a.side === side))
    return !!brain || disorderTouchesCellPart(d, id)
  })
}

const RED = new THREE.Color("#ff2020")
const WHITE = new THREE.Color("#ffffff")

interface PartMaterialProps {
  id: string
  color: string
  side?: Side
  opacity?: number
  roughness?: number
  metalness?: number
  transmission?: number
  /** Override affected state, e.g. when the disorder effect is drawn separately. */
  affected?: boolean
  emissive?: string
  emissiveIntensity?: number
  wireframe?: boolean
  doubleSide?: boolean
}

/** Standard material that glows on hover/selection and pulses red when a disorder affects it. */
export function PartMaterial({
  id,
  color,
  side,
  opacity = 1,
  roughness = 0.55,
  metalness = 0.05,
  affected: affectedOverride,
  emissive,
  emissiveIntensity = 0,
  wireframe,
  doubleSide,
}: PartMaterialProps) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  const selected = useAtlas((s) => s.selectedId === id)
  const hovered = useAtlas((s) => s.hoveredId === id)
  const isAffected = useAffected(id, side)
  const affected = affectedOverride ?? isAffected
  const base = useMemo(() => new THREE.Color(emissive ?? "#000000"), [emissive])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    if (affected) {
      const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)
      m.emissive.copy(RED)
      m.emissiveIntensity = 0.2 + 0.5 * p + (selected ? 0.2 : 0)
    } else if (selected || hovered) {
      m.emissive.copy(WHITE)
      m.emissiveIntensity = selected ? 0.35 : 0.18
    } else {
      m.emissive.copy(base)
      m.emissiveIntensity = emissiveIntensity
    }
  })

  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 0.95}
      wireframe={wireframe}
      side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
    />
  )
}

/** Floating label pinned to the selected structure (or a fallback anchor). */
export function SelectedLabel({ anchors }: { anchors?: Record<string, [number, number, number]> }) {
  const selectedId = useAtlas((s) => s.selectedId)
  const point = useAtlas((s) => s.labelPoint)
  const s = getStructure(selectedId)
  const pos = point ?? (selectedId ? anchors?.[selectedId] : undefined)
  if (!s || !pos) return null
  return (
    <Html position={pos} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="flex -translate-y-5 flex-col items-center">
        <div className="whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
          {s.name}
        </div>
        <div className="h-4 w-px bg-white/60" />
        <div className="size-1.5 rounded-full bg-white" />
      </div>
    </Html>
  )
}

/** Small static label used when "Labels" is on. */
export function TagLabel({ position, children, id }: { position: [number, number, number]; children: React.ReactNode; id?: string }) {
  const show = useAtlas((s) => s.showLabels)
  const selected = useAtlas((s) => (id ? s.selectedId === id : false))
  if (!show || selected) return null
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/85 backdrop-blur-sm">
        {children}
      </div>
    </Html>
  )
}

/** Deterministic pseudo-random generator so procedural geometry is stable across renders. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BranchOptions {
  seed: number
  origin: THREE.Vector3
  direction: THREE.Vector3
  length: number
  radius: number
  depth: number
  /** Number of child branches at each fork. */
  fork?: number
  spread?: number
  wiggle?: number
  /** Gentle bias applied to child directions (e.g. upward for apical dendrites). */
  bias?: THREE.Vector3
}

export interface BranchSegment {
  curve: THREE.CatmullRomCurve3
  radius: number
  depth: number
}

/** Recursively generate a dendrite/process tree as smooth curves. */
export function growBranches(opts: BranchOptions): BranchSegment[] {
  const rand = rng(opts.seed)
  const out: BranchSegment[] = []
  const fork = opts.fork ?? 2
  const spread = opts.spread ?? 0.7
  const wiggle = opts.wiggle ?? 0.15

  const grow = (start: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number) => {
    const pts = [start.clone()]
    const d = dir.clone().normalize()
    const steps = 4
    let p = start.clone()
    for (let i = 1; i <= steps; i++) {
      const jitter = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(wiggle * length)
      d.add(jitter.multiplyScalar(0.3)).normalize()
      if (opts.bias) d.addScaledVector(opts.bias, 0.08).normalize()
      p = p.clone().addScaledVector(d, length / steps)
      pts.push(p)
    }
    out.push({ curve: new THREE.CatmullRomCurve3(pts), radius, depth })
    if (depth <= 0) return
    for (let i = 0; i < fork; i++) {
      const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize()
      const child = d.clone().applyAxisAngle(axis, spread * (0.5 + rand()))
      grow(p, child, length * (0.6 + rand() * 0.2), radius * 0.68, depth - 1)
    }
  }
  grow(opts.origin, opts.direction, opts.length, opts.radius, opts.depth)
  return out
}

/** Merge branch curves into one tapered tube geometry. */
export function branchesToGeometry(branches: BranchSegment[], radialSegments = 6) {
  const geos = branches.map((b) => {
    const tubular = Math.max(6, Math.round(b.curve.getLength() * 14))
    const g = new THREE.TubeGeometry(b.curve, tubular, b.radius, radialSegments, false)
    // taper toward the tip
    const pos = g.attributes.position
    const center = new THREE.Vector3()
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / (radialSegments + 1))
      const t = ring / tubular
      b.curve.getPointAt(Math.min(t, 1), center)
      v.fromBufferAttribute(pos, i).sub(center).multiplyScalar(1 - 0.45 * t).add(center)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  })
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

/** A sphere whose surface is lumpy, for plaques, tumours and amoeboid cells. */
export function lumpySphere(radius: number, seed: number, amount = 0.25, detail = 3) {
  const g = new THREE.IcosahedronGeometry(radius, detail)
  const rand = rng(seed)
  const bumps = Array.from({ length: 6 }, () => ({
    dir: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
    k: 0.5 + rand(),
  }))
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    let d = 0
    for (const b of bumps) d += Math.pow(Math.max(0, n.dot(b.dir)), 3) * b.k
    v.multiplyScalar(1 + amount * (d - 0.5))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/** Animate an object's scale toward a target (used for atrophy/swelling). */
export function useLerpScale(target: number) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const s = THREE.MathUtils.damp(g.scale.x, target, 3, dt)
    g.scale.setScalar(s)
  })
  return ref
}
