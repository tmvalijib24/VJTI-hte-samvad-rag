import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ParticleNetwork({ count = 2000 }) {
  const mesh = useRef()
  const mouse = useRef([0, 0])

  // Generate random particles
  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 20
      const y = (Math.random() - 0.5) * 20
      const z = (Math.random() - 0.5) * 20
      temp.push(x, y, z)
    }
    return new Float32Array(temp)
  }, [count])

  useFrame((state) => {
    if (!mesh.current) return
    // Slow continuous rotation
    mesh.current.rotation.x = state.clock.elapsedTime * 0.05
    mesh.current.rotation.y = state.clock.elapsedTime * 0.08

    // Subtle mouse parallax
    mouse.current[0] += (state.mouse.x * 0.5 - mouse.current[0]) * 0.05
    mouse.current[1] += (state.mouse.y * 0.5 - mouse.current[1]) * 0.05
    mesh.current.position.x = mouse.current[0]
    mesh.current.position.y = mouse.current[1]
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#8B5CF6"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
