import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from './scrollState'

const SPLASH_COUNT   = 250
const MIST_COUNT     = 100
const NODE_COUNT     = 18
const TOTAL          = SPLASH_COUNT + MIST_COUNT

const rng = () => Math.random()
function randomInCone(minElev, maxElev, speed) {
  const az   = rng() * Math.PI * 2
  const elev = minElev + rng() * (maxElev - minElev)
  return {
    x: Math.cos(az) * Math.cos(elev) * speed,
    y: Math.sin(elev) * speed,
    z: Math.sin(az) * Math.cos(elev) * speed,
  }
}

export function SplashParticles() {
  const splashRef  = useRef()
  const nodesRef   = useRef()
  const linesGeo   = useRef()
  const linesRef   = useRef()

  const dummy     = useMemo(() => new THREE.Object3D(), [])
  const tColor    = useMemo(() => new THREE.Color(), [])

  const ps = useRef({
    px: new Float32Array(TOTAL), py: new Float32Array(TOTAL), pz: new Float32Array(TOTAL),
    vx: new Float32Array(TOTAL), vy: new Float32Array(TOTAL), vz: new Float32Array(TOTAL),
    life: new Float32Array(TOTAL),
    maxLife: new Float32Array(TOTAL),
    alive: new Uint8Array(TOTAL),
    nodeTarget: new Float32Array(NODE_COUNT * 3),
    nodeIdx: new Int32Array(NODE_COUNT),
    nodeToNi: new Map(),
    phase: 0,
    phaseStart: 0,
  })

  function initSplash(time) {
    const s = ps.current
    s.phase      = 1
    s.phaseStart = time

    for (let i = 0; i < SPLASH_COUNT; i++) {
      // Much higher velocity for a dramatic, cinematic burst
      const { x, y, z } = randomInCone(0.05, Math.PI * 0.55, 3.5 + rng() * 7.5)
      s.vx[i] = x; s.vy[i] = y; s.vz[i] = z
      s.px[i] = (rng()-0.5)*0.5;  s.py[i] = -1.25;  s.pz[i] = (rng()-0.5)*0.5
      s.maxLife[i] = 1.2 + rng() * 2.5
      s.life[i]    = s.maxLife[i]
      s.alive[i]   = 1
    }
    for (let i = SPLASH_COUNT; i < TOTAL; i++) {
      // Mist pushes out horizontally along the surface
      const { x, y, z } = randomInCone(0.0, Math.PI * 0.15, 1.5 + rng() * 2.5)
      s.vx[i] = x; s.vy[i] = y * 0.5; s.vz[i] = z
      s.px[i] = (rng()-0.5)*0.6;  s.py[i] = -1.25;  s.pz[i] = (rng()-0.5)*0.6
      s.maxLife[i] = 2.5 + rng() * 2.0
      s.life[i]    = s.maxLife[i]
      s.alive[i]   = 1
    }

    const chosen = new Set()
    while (chosen.size < NODE_COUNT) chosen.add(Math.floor(rng() * SPLASH_COUNT))
    let ni = 0
    s.nodeToNi.clear()
    for (const idx of chosen) {
      s.nodeIdx[ni] = idx
      s.nodeToNi.set(idx, ni)
      const angle = (ni / NODE_COUNT) * Math.PI * 2
      const r     = 1.8 + rng() * 2.0
      s.nodeTarget[ni*3]   = Math.cos(angle) * r + (rng()-0.5) * 1.5
      s.nodeTarget[ni*3+1] = -0.5 + rng() * 3.0
      s.nodeTarget[ni*3+2] = Math.sin(angle) * r * 0.6 + (rng()-0.5) * 0.8
      ni++
    }
    buildEdges()
  }

  function buildEdges() {
    if (!linesGeo.current) return
    const s    = ps.current
    const pts  = []
    for (let a = 0; a < NODE_COUNT; a++) {
      const ax = s.nodeTarget[a*3], ay = s.nodeTarget[a*3+1], az = s.nodeTarget[a*3+2]
      const dists = []
      for (let b = 0; b < NODE_COUNT; b++) {
        if (a === b) continue
        const bx = s.nodeTarget[b*3], by = s.nodeTarget[b*3+1], bz = s.nodeTarget[b*3+2]
        dists.push({ b, d: (ax-bx)**2+(ay-by)**2+(az-bz)**2 })
      }
      dists.sort((x,y) => x.d - y.d)
      dists.slice(0, 2).forEach(({ b }) => {
        pts.push(s.nodeTarget[a*3], s.nodeTarget[a*3+1], s.nodeTarget[a*3+2])
        pts.push(s.nodeTarget[b*3], s.nodeTarget[b*3+1], s.nodeTarget[b*3+2])
      })
    }
    linesGeo.current.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
  }

  const isNode = useMemo(() => new Uint8Array(TOTAL), [])

  useFrame((state, delta) => {
    const s    = ps.current
    const time = state.clock.elapsedTime
    const dt   = Math.min(delta, 0.05)

    if (s.phase === 0 && scrollState.splashFired && scrollState.splashTime > 0) {
      initSplash(time)
      for (let ni = 0; ni < NODE_COUNT; ni++) isNode[s.nodeIdx[ni]] = 1
    }

    if (s.phase > 0 && !scrollState.splashFired) {
      s.phase = 0
      for (let i = 0; i < TOTAL; i++) { s.alive[i] = 0; isNode[i] = 0 }
    }

    if (s.phase === 0) {
      hideAll(); return
    }

    const elapsed = time - s.phaseStart
    if (s.phase === 1 && elapsed > 2.4) { s.phase = 2; s.phaseStart = time }
    if (s.phase === 2 && elapsed > 2.0) { s.phase = 3; s.phaseStart = time }

    const gravity = -4.5
    const drag    = Math.pow(0.93, dt * 60)

    for (let i = 0; i < TOTAL; i++) {
      if (!s.alive[i]) { hideSplash(i); continue }
      const nodeParticle = isNode[i]

      if (s.phase === 1) {
        s.vy[i] += gravity * dt
        s.vx[i] *= drag; s.vy[i] *= drag; s.vz[i] *= drag
        s.px[i] += s.vx[i] * dt; s.py[i] += s.vy[i] * dt; s.pz[i] += s.vz[i] * dt
        if (s.py[i] <= -1.25) {
          s.py[i] = -1.25
          s.vy[i] *= -0.3
          s.vx[i] *= 0.5
          s.vz[i] *= 0.5
        }
        s.life[i] -= dt
        if (s.life[i] <= 0 && !nodeParticle) { s.alive[i] = 0; hideSplash(i); continue }
      } else if (s.phase === 2) {
        if (nodeParticle) {
          const ni = s.nodeToNi.get(i)
          if (ni !== undefined) {
            s.px[i] += (s.nodeTarget[ni*3] - s.px[i]) * 0.025
            s.py[i] += (s.nodeTarget[ni*3+1] - s.py[i]) * 0.025
            s.pz[i] += (s.nodeTarget[ni*3+2] - s.pz[i]) * 0.025
          }
        } else {
          s.vy[i] += gravity * 0.5 * dt
          s.vx[i] *= 0.92; s.vy[i] *= 0.92; s.vz[i] *= 0.92
          s.px[i] += s.vx[i] * dt; s.py[i] += s.vy[i] * dt; s.pz[i] += s.vz[i] * dt
          if (s.py[i] <= -1.25) {
            s.py[i] = -1.25
            s.vy[i] *= -0.3
            s.vx[i] *= 0.5
            s.vz[i] *= 0.5
          }
          s.life[i] -= dt * 1.8
          if (s.life[i] <= 0) { s.alive[i] = 0; hideSplash(i); continue }
        }
      } else if (s.phase === 3) {
        if (!nodeParticle) { hideSplash(i); continue }
        const ni = s.nodeToNi.get(i)
        if (ni === undefined) { hideSplash(i); continue }
        s.px[i] = s.nodeTarget[ni*3]   + Math.sin(time * 0.5 + i * 0.7) * 0.08
        s.py[i] = s.nodeTarget[ni*3+1] + Math.cos(time * 0.4 + i * 1.1) * 0.08
        s.pz[i] = s.nodeTarget[ni*3+2] + Math.sin(time * 0.6 + i * 0.9) * 0.06
      }

      if (i < SPLASH_COUNT) {
        let scale = 0, alpha = 0
        if (s.phase === 1) {
          alpha = Math.max(0, s.life[i] / s.maxLife[i])
          scale = nodeParticle ? 0.06 + alpha * 0.04 : 0.025 + alpha * 0.045
        } else if (s.phase === 2) {
          alpha  = nodeParticle ? Math.min(1, elapsed * 0.6) : Math.max(0, s.life[i] / s.maxLife[i])
          scale  = nodeParticle ? 0.08 + 0.02 * Math.sin(time * 3 + i) : 0.02 * alpha
        } else {
          alpha  = 0.65 + 0.35 * Math.sin(time * 1.8 + i * 0.9)
          scale  = 0.09 + 0.03 * Math.sin(time * 2.2 + i)
        }
        dummy.position.set(s.px[i], s.py[i], s.pz[i])
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        splashRef.current?.setMatrixAt(i, dummy.matrix)
      }
    }

    for (let i = SPLASH_COUNT; i < TOTAL; i++) {
      if (!s.alive[i]) { hideMist(i - SPLASH_COUNT); continue }
      let alpha = Math.max(0, s.life[i] / s.maxLife[i])
      dummy.position.set(s.px[i], s.py[i], s.pz[i])
      dummy.scale.setScalar(alpha * 0.045)
      dummy.updateMatrix()
      splashRef.current?.setMatrixAt(i, dummy.matrix)
    }

    if (splashRef.current) {
      splashRef.current.instanceMatrix.needsUpdate = true
    }

    if (nodesRef.current && s.phase >= 2) {
      const phaseAlpha = Math.min(1, elapsed * 0.5)
      for (let ni = 0; ni < NODE_COUNT; ni++) {
        const i  = s.nodeIdx[ni]
        const pulse = 0.85 + 0.15 * Math.sin(time * 2.5 + ni)
        dummy.position.set(s.px[i], s.py[i], s.pz[i])
        dummy.scale.setScalar(phaseAlpha * 0.14 * pulse)
        dummy.updateMatrix()
        nodesRef.current.setMatrixAt(ni, dummy.matrix)
        tColor.setHSL(0.59 + Math.sin(time*0.1+ni*0.3)*0.05, 1, 0.7)
        nodesRef.current.setColorAt(ni, tColor)
      }
      nodesRef.current.instanceMatrix.needsUpdate = true
      if (nodesRef.current.instanceColor) nodesRef.current.instanceColor.needsUpdate = true
    } else if (nodesRef.current) {
      for (let ni = 0; ni < NODE_COUNT; ni++) {
        dummy.scale.setScalar(0); dummy.updateMatrix()
        nodesRef.current.setMatrixAt(ni, dummy.matrix)
      }
      nodesRef.current.instanceMatrix.needsUpdate = true
    }

    if (linesRef.current) {
      linesRef.current.visible = s.phase === 3
      if (s.phase === 3) {
        linesRef.current.material.opacity = Math.min(0.35, (time - s.phaseStart) * 0.15)
      }
    }
  })

  function hideAll() {
    dummy.scale.setScalar(0); dummy.updateMatrix()
    for (let i = 0; i < TOTAL; i++) splashRef.current?.setMatrixAt(i, dummy.matrix)
    if (splashRef.current) splashRef.current.instanceMatrix.needsUpdate = true
    for (let ni = 0; ni < NODE_COUNT; ni++) nodesRef.current?.setMatrixAt(ni, dummy.matrix)
    if (nodesRef.current) nodesRef.current.instanceMatrix.needsUpdate = true
  }
  function hideSplash(i) {
    dummy.scale.setScalar(0); dummy.updateMatrix()
    splashRef.current?.setMatrixAt(i, dummy.matrix)
  }
  function hideMist(i) {
    dummy.scale.setScalar(0); dummy.updateMatrix()
    splashRef.current?.setMatrixAt(SPLASH_COUNT + i, dummy.matrix)
  }

  return (
    <group>
      <instancedMesh ref={splashRef} args={[undefined, undefined, TOTAL]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshPhysicalMaterial 
          color="#3B82F6"
          transmission={0.9}
          opacity={1}
          metalness={0.1}
          roughness={0.15}
          ior={1.33}
          thickness={1.5}
          envMapIntensity={2.0}
        />
      </instancedMesh>
      <instancedMesh ref={nodesRef} args={[undefined, undefined, NODE_COUNT]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial vertexColors transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <lineSegments ref={linesRef} visible={false}>
        <bufferGeometry ref={linesGeo} />
        <lineBasicMaterial color="#5ab4f5" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </group>
  )
}
