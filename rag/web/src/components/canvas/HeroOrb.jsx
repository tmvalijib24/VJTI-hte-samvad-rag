import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial } from "@react-three/drei";
import { scrollState } from "./scrollState";
import * as THREE from "three";

export function HeroOrb() {
  const mesh = useRef();
  
  // Used to smooth out the scroll progress so the droplet doesn't jitter
  // when the user scrolls using a stepped mouse wheel
  const smoothedProgress = useRef(0);
  const velocityY = useRef(0);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    
    const targetP = scrollState.progress;
    const time = state.clock.elapsedTime;

    // Smoothly interpolate the progress
    // lambda=10 gives a much snappier chase, reducing the "slow" feeling
    const prevP = smoothedProgress.current;
    smoothedProgress.current = THREE.MathUtils.damp(
      smoothedProgress.current,
      targetP,
      10,
      delta
    );
    const p = smoothedProgress.current;

    // Calculate simulated velocity (change in progress per second)
    const vel = (p - prevP) / delta;
    
    // Smooth the velocity for stretch physics
    velocityY.current = THREE.MathUtils.damp(velocityY.current, vel, 8, delta);

    // ── Reset when user scrolls back up ──────────────────────────────────
    if (scrollState.splashFired && targetP < 0.45) {
      scrollState.splashFired = false;
      scrollState.splashTime = -1;
      mesh.current.visible = true;
    }

    // ── Hide orb after splash fires ───────────────────────────────────────
    if (scrollState.splashFired && scrollState.splashTime > 0) {
      const elapsed = time - scrollState.splashTime;
      if (elapsed < 0.12) {
        // Extreme quick compression right before the splash particle burst
        const cp = elapsed / 0.12;
        // Easing function (ease-out cubic)
        const easeCp = 1 - Math.pow(1 - cp, 3);
        mesh.current.scale.set(
          1.5 * (1 + easeCp * 0.8),
          1.5 * (1 - easeCp * 0.9),
          1.5 * (1 + easeCp * 0.8)
        );
        mesh.current.position.y = -1.25;
      } else {
        mesh.current.visible = false;
      }
      return;
    }

    mesh.current.visible = true;

    // ── Rotation + Cursor Parallax ───────────────────
    mesh.current.rotation.x = time * 0.15;
    mesh.current.rotation.y = time * 0.25;

    // Smooth cursor follow
    mesh.current.position.x = THREE.MathUtils.damp(
      mesh.current.position.x,
      state.mouse.x * 0.4,
      4,
      delta
    );
    mesh.current.position.z = THREE.MathUtils.damp(
      mesh.current.position.z,
      state.mouse.y * 0.4,
      4,
      delta
    );

    // ── Descent behavior (Falling) ────────────────────────────────────────
    let descT = 0;
    if (p > 0.02) {
      descT = Math.min(1, (p - 0.02) / 0.9);
    }
    
    // Ease-in quadratic (descT * descT) instead of cubic makes it start falling earlier
    const easeFall = descT * descT;
    
    // Base idle float
    const idleY = Math.sin(time * 2.5) * 0.12;
    
    // Target Y: starts at idle float, descends to -1.25 (floor)
    const targetY = THREE.MathUtils.lerp(idleY, -1.25, easeFall);
    
    mesh.current.position.y = targetY;

    // ── Dynamic Stretching & Squishing ────────────────────────────────────
    
    // 1. Stretch based on fall velocity (simulating drag)
    // velocityY.current is positive when falling down
    const stretch = Math.max(0, Math.min(velocityY.current * 0.8, 1.2));
    
    // 2. Compress when hitting the surface (last 8% of progress)
    let compression = 0;
    if (p > 0.92) {
      const cp = (p - 0.92) / 0.08;
      // Exponential compression as it gets closer
      compression = Math.pow(cp, 2) * 0.6;
    }

    // Combine stretch and compression
    // X and Z shrink when stretched, expand when compressed
    const scaleXZ = 1.5 * (1 - stretch * 0.45 + compression * 0.5);
    // Y expands when stretched, shrinks when compressed
    const scaleY = 1.5 * (1 + stretch * 1.4 - compression * 0.6);

    mesh.current.scale.set(scaleXZ, scaleY, scaleXZ);

    // Dynamic distort amount - distorts more when falling fast
    const mat = mesh.current.material;
    if (mat) {
      mat.distort = 0.4 + stretch * 0.3;
      mat.speed = 2 + stretch * 4;
    }

    // ── Trigger splash ────────────────────────────────────────────────────
    // Trigger based on smoothed progress so it happens right as the drop hits
    if (p > 0.96 && !scrollState.splashFired) {
      scrollState.splashFired = true;
      scrollState.splashTime = time;
    }
  });

  return (
    <Sphere ref={mesh} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color="#3B82F6"
        attach="material"
        distort={0.4}
        speed={2}
        roughness={0.15}
        metalness={0.85}
        transparent
        opacity={0.9}
        envMapIntensity={1.5}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
    </Sphere>
  );
}
