import { useRef } from "react";
import { Grid, Sparkles, Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Mesh,
  ShaderMaterial,
} from "three";

import type { EnvironmentMode, QualityMode } from "@/src/core/types";
import {
  AURORA_FRAGMENT_SHADER,
  AURORA_VERTEX_SHADER,
  BACKDROP_FRAGMENT_SHADER,
  BACKDROP_VERTEX_SHADER,
} from "./shaders";

interface EnvironmentsProps {
  mode: EnvironmentMode;
  quality: QualityMode;
  boundaryRadius: number;
}

const MODE_INDEX: Record<EnvironmentMode, number> = {
  "deep-space": 0,
  "solar-storm": 1,
  aurora: 2,
  "neon-grid": 3,
};

function Backdrop({ mode }: { mode: EnvironmentMode }) {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh scale={110} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={BACKDROP_VERTEX_SHADER}
        fragmentShader={BACKDROP_FRAGMENT_SHADER}
        uniforms={{
          uTime: { value: 0 },
          uMode: { value: MODE_INDEX[mode] },
        }}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SolarStorm({ quality }: { quality: QualityMode }) {
  const coronaRef = useRef<Mesh>(null);
  const sparks =
    quality === "performance" ? 80 : quality === "balanced" ? 150 : 240;

  useFrame((state, delta) => {
    if (coronaRef.current) {
      coronaRef.current.rotation.y += delta * 0.035;
      coronaRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 0.08) * 0.1;
    }
  });

  return (
    <group>
      <group position={[-29, 13, -38]}>
        <pointLight color="#ff3b0a" intensity={90} distance={95} decay={2} />
        <mesh>
          <sphereGeometry args={[7.5, 40, 32]} />
          <meshBasicMaterial color="#ff4d08" toneMapped={false} />
        </mesh>
        <mesh ref={coronaRef}>
          <icosahedronGeometry args={[9.2, 3]} />
          <meshBasicMaterial
            color="#ff7b12"
            wireframe
            transparent
            opacity={0.15}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <Sparkles
        count={sparks}
        scale={[72, 40, 72]}
        size={quality === "performance" ? 1.1 : 1.7}
        speed={0.45}
        noise={1.4}
        color="#ff5c19"
      />
    </group>
  );
}

function AuroraCurtain({ phase, z }: { phase: number; z: number }) {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 3, z]} rotation={[0, 0, phase * 0.025]}>
      <planeGeometry args={[72, 34, 54, 28]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={AURORA_VERTEX_SHADER}
        fragmentShader={AURORA_FRAGMENT_SHADER}
        uniforms={{
          uTime: { value: 0 },
          uPhase: { value: phase },
          uOpacity: { value: 0.24 },
        }}
        side={DoubleSide}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function AuroraVeil({ quality }: { quality: QualityMode }) {
  const curtainCount =
    quality === "performance" ? 2 : quality === "balanced" ? 3 : 4;
  return (
    <group rotation={[0, -0.18, 0]}>
      {Array.from({ length: curtainCount }, (_, index) => (
        <AuroraCurtain key={index} phase={index * 1.73} z={-28 - index * 6} />
      ))}
      <Sparkles
        count={quality === "cinematic" ? 170 : 90}
        scale={[64, 38, 54]}
        size={1.2}
        speed={0.18}
        noise={0.7}
        color="#58ffd6"
      />
    </group>
  );
}

function NeonLattice({ boundaryRadius }: { boundaryRadius: number }) {
  return (
    <group>
      <Grid
        position={[0, -boundaryRadius * 0.72, 0]}
        args={[boundaryRadius * 6, boundaryRadius * 6]}
        cellSize={1.5}
        cellThickness={0.5}
        cellColor="#123c79"
        sectionSize={7.5}
        sectionThickness={1.1}
        sectionColor="#5d32ff"
        fadeDistance={boundaryRadius * 4}
        fadeStrength={1.5}
        infiniteGrid
      />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[boundaryRadius * 1.15, 0.035, 8, 160]} />
        <meshBasicMaterial color="#42d9ff" toneMapped={false} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[boundaryRadius * 0.72, 0.025, 8, 128]} />
        <meshBasicMaterial color="#8c4dff" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Environments({
  mode,
  quality,
  boundaryRadius,
}: EnvironmentsProps) {
  const starCount =
    quality === "performance" ? 900 : quality === "balanced" ? 1800 : 2800;

  return (
    <group>
      <Backdrop mode={mode} />
      {mode === "deep-space" && (
        <>
          <Stars
            radius={92}
            depth={54}
            count={starCount}
            factor={3.2}
            saturation={0.42}
            fade
            speed={0.12}
          />
          <ambientLight color={new Color("#2e5b8e")} intensity={0.32} />
        </>
      )}
      {mode === "solar-storm" && <SolarStorm quality={quality} />}
      {mode === "aurora" && <AuroraVeil quality={quality} />}
      {mode === "neon-grid" && <NeonLattice boundaryRadius={boundaryRadius} />}
    </group>
  );
}
