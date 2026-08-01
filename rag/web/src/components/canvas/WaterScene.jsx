import React, { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { HeroOrb }         from './HeroOrb'
import { SplashParticles } from './SplashParticles'
import { RippleRings }     from './RippleRings'
import { scrollState }     from './scrollState'

function BackgroundDust() {
  const ref = useRef()
  const pts = useMemo(() => {
    const a = new Float32Array(600 * 3)
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() - 0.5) * 22
    return a
  }, [])
  useFrame((s) => {
    if (!ref.current) return
    ref.current.rotation.y = s.clock.elapsedTime * 0.012
    ref.current.rotation.x = s.clock.elapsedTime * 0.006
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={pts} count={600} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#5ab0e0" transparent opacity={0.28}
        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function WaterSurface() {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    if (!scrollState.splashFired || scrollState.splashTime < 0) {
      ref.current.material.opacity = 0; return
    }
    const elapsed = state.clock.elapsedTime - scrollState.splashTime
    const base    = Math.min(0.15, elapsed * 0.08)
    const wave    = Math.sin(elapsed * 5.5) * Math.exp(-elapsed * 0.9) * 0.05
    ref.current.material.opacity = Math.max(0, base + wave)
  })
  return (
    <mesh ref={ref} position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[18, 18]} />
      <meshStandardMaterial color="#2a6faa" transparent opacity={0}
        roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

function CameraController() {
  const { camera } = useThree()
  useFrame((state) => {
    const p    = scrollState.progress
    const time = state.clock.elapsedTime

    const targetZ = THREE.MathUtils.lerp(5.0, 4.2, Math.max(0, p - 0.65) / 0.35)
    const targetY = THREE.MathUtils.lerp(0.0, -0.5, Math.max(0, p - 0.70) / 0.30)
    camera.position.z += (targetZ - camera.position.z) * 0.03
    camera.position.y += (targetY - camera.position.y) * 0.03

    camera.position.x += (state.mouse.x * 0.15 - camera.position.x) * 0.02

    if (scrollState.splashFired && scrollState.splashTime > 0) {
      const elapsed = time - scrollState.splashTime
      if (elapsed < 0.4) {
        const intensity = Math.pow(1 - elapsed / 0.4, 2) * 0.05
        camera.position.x += (Math.random() - 0.5) * intensity
        camera.position.y += (Math.random() - 0.5) * intensity * 0.5
      }
    }
    camera.lookAt(0, targetY * 0.4, 0)
  })
  return null
}

function DynamicLight() {
  const lightRef = useRef()
  useFrame((state) => {
    if (!lightRef.current) return
    let intensity = 1.0
    if (scrollState.splashFired && scrollState.splashTime > 0) {
      const elapsed = state.clock.elapsedTime - scrollState.splashTime
      intensity = elapsed < 0.15
        ? 1.0 + (elapsed / 0.15) * 3.0
        : 4.0 * Math.exp(-elapsed * 2.5) + 1.0
    }
    lightRef.current.intensity = intensity
  })
  return <pointLight ref={lightRef} position={[2, 3, 4]} color="#a8d8ff" intensity={1.0} />
}

export function WaterScene() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <DynamicLight />

        <Suspense fallback={null}>
          <Environment preset="city" background={false} />
          <BackgroundDust />
          <CameraController />
          <WaterSurface />
          <RippleRings />
          <HeroOrb />
          <SplashParticles />
        </Suspense>
      </Canvas>
    </div>
  )
}
