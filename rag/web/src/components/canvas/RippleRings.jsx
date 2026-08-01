import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from './scrollState'

const RING_COUNT    = 10
const RING_DURATION = 4.0
const RING_MAX_R    = 8.5

export function RippleRings() {
  const groupRef = useRef()
  const rings    = useRef(
    Array.from({ length: RING_COUNT }, (_, i) => ({
      delay:    i * (RING_DURATION / RING_COUNT) * 0.65,
      speed:    0.9 + i * 0.15,
      opacity:  0.45 - i * 0.04,
      startWidth: 0.08 - i * 0.005,
    }))
  )

  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime

    if (!scrollState.splashFired || scrollState.splashTime < 0) {
      groupRef.current.children.forEach(c => { c.visible = false })
      return
    }

    const splashElapsed = time - scrollState.splashTime

    groupRef.current.children.forEach((mesh, i) => {
      const ring    = rings.current[i]
      const elapsed = splashElapsed - ring.delay

      if (elapsed < 0 || elapsed > RING_DURATION) {
        mesh.visible = false
        return
      }

      mesh.visible = true
      const t      = elapsed / RING_DURATION
      const ease   = 1 - Math.pow(1 - t, 2)
      const scale  = ease * RING_MAX_R * ring.speed

      mesh.scale.set(scale, 1, scale)

      const alpha  = t < 0.08
        ? t / 0.08
        : ring.opacity * (1 - (t - 0.08) / 0.92)
      mesh.material.opacity = Math.max(0, alpha)
      mesh.position.y = -1.25 + Math.sin(t * Math.PI) * 0.04
    })
  })

  const ringMeshes = useMemo(() =>
    Array.from({ length: RING_COUNT }, (_, i) => {
      const inner = 0.90 - i * 0.04
      const outer = 1.00 - i * 0.04
      return { inner: Math.max(0.5, inner), outer }
    }), []
  )

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      {ringMeshes.map(({ inner, outer }, i) => (
        <mesh key={i} visible={false}>
          <ringGeometry args={[inner, outer, 80]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}
