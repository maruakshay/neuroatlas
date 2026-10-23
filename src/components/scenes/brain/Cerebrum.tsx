"use client"

import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { brainStructures } from "@/data/brain"
import { getDisorder } from "@/data"
import { useAtlas } from "@/store/atlas"
import { buildHemisphere, regionOf, type CortexData } from "./cortex-geometry"

const colorOf = new Map(brainStructures.map((s) => [s.id, new THREE.Color(s.color)]))
const MAX_SPOTS = 8

/** Shared uniforms so every hemisphere animates in sync. */
function useCortexUniforms() {
  return useMemo(
    () => ({
      uTime: { value: 0 },
      uWave: { value: 0 },
      uWaveOrigin: { value: new THREE.Vector3() },
      uSpots: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uSpotColor: { value: new THREE.Color("#3a0a0a") },
    }),
    [],
  )
}

type Uniforms = ReturnType<typeof useCortexUniforms>

function patchShader(uniforms: Uniforms) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec2 aState;
varying vec2 vState;
varying vec3 vBrainPos;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vState = aState;
vBrainPos = position;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime;
uniform int uWave;
uniform vec3 uWaveOrigin;
uniform vec4 uSpots[${MAX_SPOTS}];
uniform vec3 uSpotColor;
varying vec2 vState;
varying vec3 vBrainPos;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float spotK = 0.0;
for (int i = 0; i < ${MAX_SPOTS}; i++) {
  vec4 s = uSpots[i];
  if (s.w <= 0.0) continue;
  float d = distance(vBrainPos, s.xyz);
  float k = 1.0 - smoothstep(s.w * 0.55, s.w, d);
  spotK = max(spotK, k);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSpotColor, k * 0.85);
}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0) * vState.x;
float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
totalEmissiveRadiance += vec3(1.0, 0.07, 0.07) * vState.y * (0.18 + 0.45 * pulse) * (1.0 - 0.85 * spotK);
if (uWave == 1) {
  float d = distance(vBrainPos, uWaveOrigin);
  float front = mod(uTime * 0.8, 2.6);
  float band = 1.0 - smoothstep(0.0, 0.35, abs(d - front));
  float behind = step(d, front) * 0.25;
  float flicker = 0.6 + 0.4 * sin(uTime * 38.0 + d * 20.0);
  totalEmissiveRadiance += vec3(1.0, 0.8, 0.15) * (band + behind) * flicker * 0.9;
}
if (uWave == 2) {
  float d = distance(vBrainPos, uWaveOrigin);
  float front = mod(uTime * 0.18, 1.8);
  float band = 1.0 - smoothstep(0.0, 0.12, abs(d - front));
  float trail = smoothstep(front, front - 0.5, d) * step(d, front);
  totalEmissiveRadiance += vec3(0.6, 0.85, 1.0) * band * 1.2;
  diffuseColor.rgb *= 1.0 - 0.45 * trail;
}`,
      )
  }
}

function Hemisphere({ sign, uniforms }: { sign: 1 | -1; uniforms: Uniforms }) {
  const side = sign < 0 ? "left" : "right"
  const atrophy = useAtlas((s) => getDisorder(s.disorderId)?.effects.brain?.corticalAtrophy ?? 0)
  const data: CortexData = useMemo(() => buildHemisphere(sign, atrophy), [sign, atrophy])
  useEffect(() => () => data.geometry.dispose(), [data])

  const functional = useAtlas((s) => s.brain.functionalMap)
  const opacity = useAtlas((s) => s.brain.cortexOpacity)
  const hovered = useAtlas((s) => s.hoveredId)
  const selected = useAtlas((s) => s.selectedId)
  const disorderId = useAtlas((s) => s.disorderId)
  const hover = useAtlas((s) => s.hover)
  const select = useAtlas((s) => s.select)

  // Repaint vertex colours and highlight state when anything relevant changes.
  useEffect(() => {
    const color = data.geometry.attributes.color as THREE.BufferAttribute
    const state = data.geometry.attributes.aState as THREE.BufferAttribute
    const affected = new Set(
      getDisorder(disorderId)
        ?.effects.brain?.affected.filter((a) => !a.side || a.side === side)
        .map((a) => a.id) ?? [],
    )
    const c = new THREE.Color()
    const n = color.count
    for (let i = 0; i < n; i++) {
      const lobeId = regionOf(data, i, false)
      const areaId = regionOf(data, i, true)
      const id = functional ? areaId : lobeId
      c.copy(colorOf.get(id) ?? colorOf.get(lobeId)!)
      if (!functional) c.lerp(new THREE.Color("#f3d1c4"), 0.25)
      c.multiplyScalar(0.55 + 0.45 * data.cavity[i])
      color.setXYZ(i, c.r, c.g, c.b)
      const isSel = selected === id || selected === lobeId || (functional && selected === areaId)
      const isHov = hovered === id
      state.setXY(i, isSel ? 0.16 : isHov ? 0.09 : 0, affected.has(lobeId) || affected.has(areaId) ? 1 : 0)
    }
    color.needsUpdate = true
    state.needsUpdate = true
  }, [data, functional, hovered, selected, disorderId, side])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 })
    m.onBeforeCompile = patchShader(uniforms)
    m.customProgramCacheKey = () => "cortex"
    return m
  }, [uniforms])

  useEffect(() => {
    material.transparent = opacity < 1
    material.opacity = opacity
    material.depthWrite = opacity >= 1
    material.needsUpdate = true
  }, [material, opacity])

  const regionAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.face ? regionOf(data, e.face.a, useAtlas.getState().brain.functionalMap) : null

  return (
    <mesh
      geometry={data.geometry}
      material={material}
      renderOrder={2}
      raycast={opacity < 0.5 ? () => null : THREE.Mesh.prototype.raycast}
      onPointerMove={(e) => {
        e.stopPropagation()
        const id = regionAt(e)
        if (id && useAtlas.getState().hoveredId !== id) hover(id)
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        hover(null)
        document.body.style.cursor = ""
      }}
      onClick={(e) => {
        if (e.delta > 4) return
        e.stopPropagation()
        const id = regionAt(e)
        if (id) select(id, e.point.toArray() as [number, number, number])
      }}
    />
  )
}

export function Cerebrum() {
  const uniforms = useCortexUniforms()
  const cutaway = useAtlas((s) => s.brain.cutaway)
  const disorder = useAtlas((s) => getDisorder(s.disorderId))

  useEffect(() => {
    const b = disorder?.effects.brain
    uniforms.uWave.value = b?.corticalWave === "seizure" ? 1 : b?.corticalWave === "spreading-depression" ? 2 : 0
    if (b?.corticalWave === "seizure") uniforms.uWaveOrigin.value.set(-0.6, -0.3, 0.2)
    else uniforms.uWaveOrigin.value.set(-0.25, 0.0, -1.1)
    const spots = [...(b?.infarct ? [b.infarct] : []), ...(b?.lesions ?? [])].slice(0, MAX_SPOTS)
    uniforms.uSpots.value.forEach((v, i) => {
      const s = spots[i]
      if (s) v.set(s.position[0], s.position[1], s.position[2], s.radius)
      else v.set(0, 0, 0, 0)
    })
    uniforms.uSpotColor.value.set(b?.infarct ? "#4a0d12" : "#5a2a10")
  }, [disorder, uniforms])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <group>
      {!cutaway && <Hemisphere sign={-1} uniforms={uniforms} />}
      <Hemisphere sign={1} uniforms={uniforms} />
    </group>
  )
}

/** Smooth translucent shell standing in for the meninges. */
export function Meninges() {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  const show = useAtlas((s) => s.brain.showMeninges)
  const inflamed = useAtlas((s) => !!getDisorder(s.disorderId)?.effects.brain?.meningealInflammation)
  const selected = useAtlas((s) => s.selectedId === "meninges")
  const hover = useAtlas((s) => s.hover)
  const select = useAtlas((s) => s.select)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)
    ref.current.emissiveIntensity = inflamed ? 0.3 + 0.5 * p : selected ? 0.3 : 0
  })
  if (!show && !inflamed) return null
  return (
    <group>
      {[-1, 1].map((sign) => (
        <mesh
          key={sign}
          position={[0.2 * sign, 0.07, 0]}
          scale={[0.73, 0.74, 1.18]}
          renderOrder={3}
          onPointerOver={(e) => {
            e.stopPropagation()
            hover("meninges")
          }}
          onPointerOut={() => hover(null)}
          onClick={(e) => {
            if (e.delta > 4) return
            e.stopPropagation()
            select("meninges", e.point.toArray() as [number, number, number])
          }}
        >
          <sphereGeometry args={[1, 64, 48]} />
          <meshStandardMaterial
            ref={ref}
            color={inflamed ? "#ff6b4a" : "#e8cfa8"}
            emissive="#ff2a00"
            transparent
            opacity={inflamed ? 0.32 : 0.18}
            depthWrite={false}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}
