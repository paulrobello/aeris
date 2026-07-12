import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  ConeGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import type { BoidSnapshot, ColorTheme } from "@/src/core/types";
import { BOID_FRAGMENT_SHADER, BOID_VERTEX_SHADER } from "./shaders";

interface BoidSwarmProps {
  snapshotRef: React.RefObject<BoidSnapshot>;
  count: number;
  boidScale: number;
  glow: number;
  maxSpeed: number;
  colorTheme: ColorTheme;
}

const FORWARD = new Vector3(0, 0, 1);

function themeIndex(theme: ColorTheme): number {
  return { spectral: 0, aurora: 1, solar: 2, monochrome: 3 }[theme];
}

export function BoidSwarm({
  snapshotRef,
  count,
  boidScale,
  glow,
  maxSpeed,
  colorTheme,
}: BoidSwarmProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const materialRef = useRef<import("three").ShaderMaterial>(null);

  const { geometry, speedAttribute } = useMemo(() => {
    const nextGeometry = new ConeGeometry(0.34, 1.45, 3, 1, false);
    nextGeometry.rotateX(Math.PI / 2);
    nextGeometry.translate(0, 0, 0.18);
    nextGeometry.computeVertexNormals();

    const speeds = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      seeds[index] = ((index * 16807) % 2147483647) / 2147483647;
    }

    const nextSpeedAttribute = new InstancedBufferAttribute(speeds, 1);
    nextSpeedAttribute.setUsage(DynamicDrawUsage);
    nextGeometry.setAttribute("aSpeed", nextSpeedAttribute);
    nextGeometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));

    return { geometry: nextGeometry, speedAttribute: nextSpeedAttribute };
  }, [count]);
  const speedAttributeRef = useRef(speedAttribute);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMaxSpeed: { value: maxSpeed },
      uGlow: { value: glow },
      uTheme: { value: themeIndex(colorTheme) },
    }),
    [colorTheme, glow, maxSpeed],
  );

  const workRef = useRef({
    position: new Vector3(),
    direction: new Vector3(),
    quaternion: new Quaternion(),
    scale: new Vector3(),
    matrix: new Matrix4(),
  });

  useEffect(() => {
    const mesh = meshRef.current;
    speedAttributeRef.current = speedAttribute;
    if (mesh) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    return () => {
      geometry.dispose();
    };
  }, [geometry, speedAttribute]);

  useFrame((state) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    const snapshot = snapshotRef.current;
    if (!mesh || !material || !snapshot) return;
    const speedValues = speedAttributeRef.current;
    const work = workRef.current;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    const visibleCount = Math.min(count, snapshot.count);

    for (let index = 0; index < visibleCount; index += 1) {
      const offset = index * 3;
      const vx = snapshot.velocities[offset];
      const vy = snapshot.velocities[offset + 1];
      const vz = snapshot.velocities[offset + 2];
      const speed = Math.hypot(vx, vy, vz);
      const normalizedSpeed = Math.min(speed / Math.max(maxSpeed, 0.001), 1.3);

      work.position.set(
        snapshot.positions[offset],
        snapshot.positions[offset + 1],
        snapshot.positions[offset + 2],
      );
      if (speed > 0.0001) {
        work.direction.set(vx / speed, vy / speed, vz / speed);
        work.quaternion.setFromUnitVectors(FORWARD, work.direction);
      } else {
        work.quaternion.identity();
      }

      const width = boidScale * (0.84 + normalizedSpeed * 0.16);
      work.scale.set(width, width, boidScale * (0.9 + normalizedSpeed * 0.48));
      work.matrix.compose(work.position, work.quaternion, work.scale);
      mesh.setMatrixAt(index, work.matrix);
      speedValues.setX(index, speed);
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    speedValues.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      renderOrder={3}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={BOID_VERTEX_SHADER}
        fragmentShader={BOID_FRAGMENT_SHADER}
        uniforms={uniforms}
        side={DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
