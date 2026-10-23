"use client"

import { OrbitControls } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { Suspense, useEffect, useRef } from "react"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import type { Scale } from "@/lib/types"
import { useAtlas } from "@/store/atlas"
import { BrainScene } from "./brain/BrainScene"
import { MembraneScene } from "./membrane/MembraneScene"
import { NeuronScene } from "./neuron/NeuronScene"
import { SynapseScene } from "./synapse/SynapseScene"
import { TissueScene } from "./tissue/TissueScene"

type V3 = [number, number, number]

const CAMERAS: Record<Scale, { position: V3; target: V3; min: number; max: number }> = {
  brain: { position: [-3.7, 1.0, 2.4], target: [0, -0.25, 0], min: 1.2, max: 9 },
  tissue: { position: [1.5, 3, 15], target: [0, 0, 0], min: 2, max: 28 },
  neuron: { position: [0.6, 4.5, 17.5], target: [0.6, 0, 0], min: 1.5, max: 30 },
  synapse: { position: [6.2, 2.4, 8.2], target: [0, 0.2, 0], min: 1.5, max: 18 },
  membrane: { position: [0, 4.8, 11.5], target: [0, 0, 0], min: 2, max: 22 },
}

function CameraRig({ scale }: { scale: Scale }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  // Pull back on tall, narrow (phone) screens so the whole model fits horizontally.
  const fit = aspect < 1 ? Math.min(2.2, Math.pow(aspect, -0.75)) : 1
  const fitBucket = Math.round(fit * 4) / 4
  useEffect(() => {
    const c = CAMERAS[scale]
    camera.position.set(...c.position).sub(new THREE.Vector3(...c.target)).multiplyScalar(fitBucket).add(new THREE.Vector3(...c.target))
    if (controls) {
      controls.target.set(...c.target)
      controls.minDistance = c.min
      controls.maxDistance = c.max * fitBucket
      controls.update()
    }
  }, [scale, camera, controls, fitBucket])
  return null
}

function Scene({ scale }: { scale: Scale }) {
  switch (scale) {
    case "brain":
      return <BrainScene />
    case "tissue":
      return <TissueScene />
    case "neuron":
      return <NeuronScene />
    case "synapse":
      return <SynapseScene />
    case "membrane":
      return <MembraneScene />
  }
}

export default function SceneCanvas() {
  const scale = useAtlas((s) => s.scale)
  const autoRotate = useAtlas((s) => s.autoRotate)
  const select = useAtlas((s) => s.select)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: CAMERAS.brain.position, fov: 40, near: 0.05, far: 200 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={(e) => {
        if (e.type === "click") select(null)
      }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#dfe9ff", "#2a1d2e", 0.7]} />
      <directionalLight position={[-4, 6, 5]} intensity={1.6} />
      <directionalLight position={[5, -2, -4]} intensity={0.5} color="#9ab8ff" />
      <Suspense fallback={null}>
        <Scene scale={scale} />
      </Suspense>
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} autoRotate={autoRotate} autoRotateSpeed={0.8} />
      <CameraRig scale={scale} />
    </Canvas>
  )
}
