import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { ParticleNetwork } from "./ParticleNetwork";
import { HeroOrb } from "./HeroOrb";
import { SplashParticles } from "./SplashParticles";
import { RippleRings } from "./RippleRings";

export function Scene({ mode = "particles" }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]} // Optimize for pixel density
        performance={{ min: 0.5 }} // Allow downgrading on slow devices
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <Suspense fallback={null}>
          {mode === "particles" && <ParticleNetwork count={1500} />}
          {mode === "hero" && (
            <>
              <ParticleNetwork count={500} />
              <HeroOrb />
              <SplashParticles />
              <RippleRings />
              <Environment preset="city" />
            </>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
