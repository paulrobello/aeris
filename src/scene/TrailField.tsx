import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
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
import { TRAIL_FRAGMENT_SHADER, TRAIL_VERTEX_SHADER } from "./shaders";

interface TrailFieldProps {
  snapshotRef: React.RefObject<BoidSnapshot>;
  count: number;
  length: number;
  width: number;
  opacity: number;
  glow: number;
  maxSpeed: number;
  colorTheme: ColorTheme;
  resetToken: number;
}

const TRAIL_SEGMENTS = 4;
const FORWARD = new Vector3(0, 0, 1);

function themeIndex(theme: ColorTheme): number {
  return { spectral: 0, aurora: 1, solar: 2, monochrome: 3 }[theme];
}

export function TrailField({
  snapshotRef,
  count,
  length,
  width,
  opacity,
  glow,
  maxSpeed,
  colorTheme,
  resetToken,
}: TrailFieldProps) {
  const meshRef = useRef<InstancedMesh>(null);

  const buffers = useMemo(() => {
    const instanceCount = count * TRAIL_SEGMENTS;
    const geometry = new ConeGeometry(0.5, 1, 3, 1, true);
    geometry.rotateX(Math.PI / 2);

    const speedAttribute = new InstancedBufferAttribute(
      new Float32Array(instanceCount),
      1,
    );
    const lifeAttribute = new InstancedBufferAttribute(
      new Float32Array(instanceCount),
      1,
    );
    speedAttribute.setUsage(DynamicDrawUsage);
    for (let boid = 0; boid < count; boid += 1) {
      for (let segment = 0; segment < TRAIL_SEGMENTS; segment += 1) {
        lifeAttribute.setX(
          boid * TRAIL_SEGMENTS + segment,
          (segment + 1) / TRAIL_SEGMENTS,
        );
      }
    }
    geometry.setAttribute("aSpeed", speedAttribute);
    geometry.setAttribute("aLife", lifeAttribute);

    const history = new Float32Array(count * TRAIL_SEGMENTS * 3);
    history.fill(Number.NaN);
    return { geometry, history, speedAttribute };
  }, [count]);
  const buffersRef = useRef(buffers);
  const sampleFrameRef = useRef(0);

  const uniforms = useMemo(
    () => ({
      uOpacity: { value: opacity },
      uTheme: { value: themeIndex(colorTheme) },
      uGlow: { value: glow },
    }),
    [colorTheme, glow, opacity],
  );

  const workRef = useRef({
    from: new Vector3(),
    to: new Vector3(),
    position: new Vector3(),
    direction: new Vector3(),
    quaternion: new Quaternion(),
    scale: new Vector3(),
    matrix: new Matrix4(),
  });

  useEffect(() => {
    buffersRef.current = buffers;
    buffers.history.fill(Number.NaN);
    sampleFrameRef.current = 0;
    const mesh = meshRef.current;
    if (mesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }, [buffers, resetToken]);

  useEffect(
    () => () => {
      buffers.geometry.dispose();
    },
    [buffers.geometry],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    const snapshot = snapshotRef.current;
    if (!mesh || !snapshot) return;

    const runtime = buffersRef.current;
    const work = workRef.current;
    const visibleCount = Math.min(count, snapshot.count);
    const sampleEvery = Math.max(1, Math.round(length / TRAIL_SEGMENTS));
    sampleFrameRef.current += 1;
    const shouldSample = sampleFrameRef.current >= sampleEvery;
    if (shouldSample) sampleFrameRef.current = 0;

    for (let boid = 0; boid < visibleCount; boid += 1) {
      const sourceOffset = boid * 3;
      const historyOffset = boid * TRAIL_SEGMENTS * 3;
      const px = snapshot.positions[sourceOffset];
      const py = snapshot.positions[sourceOffset + 1];
      const pz = snapshot.positions[sourceOffset + 2];

      if (!Number.isFinite(runtime.history[historyOffset])) {
        for (let sample = 0; sample < TRAIL_SEGMENTS; sample += 1) {
          const offset = historyOffset + sample * 3;
          runtime.history[offset] = px;
          runtime.history[offset + 1] = py;
          runtime.history[offset + 2] = pz;
        }
      } else if (shouldSample) {
        runtime.history.copyWithin(
          historyOffset,
          historyOffset + 3,
          historyOffset + TRAIL_SEGMENTS * 3,
        );
        const newestOffset = historyOffset + (TRAIL_SEGMENTS - 1) * 3;
        runtime.history[newestOffset] = px;
        runtime.history[newestOffset + 1] = py;
        runtime.history[newestOffset + 2] = pz;
      }

      const vx = snapshot.velocities[sourceOffset];
      const vy = snapshot.velocities[sourceOffset + 1];
      const vz = snapshot.velocities[sourceOffset + 2];
      const speedRatio = Math.min(
        Math.hypot(vx, vy, vz) / Math.max(maxSpeed, 0.001),
        1.25,
      );

      for (let segment = 0; segment < TRAIL_SEGMENTS; segment += 1) {
        const fromOffset = historyOffset + segment * 3;
        work.from.fromArray(runtime.history, fromOffset);
        if (segment === TRAIL_SEGMENTS - 1) {
          work.to.set(px, py, pz);
        } else {
          work.to.fromArray(runtime.history, fromOffset + 3);
        }

        work.direction.subVectors(work.to, work.from);
        const distance = Math.max(work.direction.length(), 0.0001);
        work.direction.multiplyScalar(1 / distance);
        work.quaternion.setFromUnitVectors(FORWARD, work.direction);
        work.position.addVectors(work.from, work.to).multiplyScalar(0.5);
        const life = (segment + 1) / TRAIL_SEGMENTS;
        const segmentWidth = width * (0.5 + life * 0.5);
        work.scale.set(segmentWidth, segmentWidth, distance);
        work.matrix.compose(work.position, work.quaternion, work.scale);

        const instance = boid * TRAIL_SEGMENTS + segment;
        mesh.setMatrixAt(instance, work.matrix);
        runtime.speedAttribute.setX(instance, speedRatio);
      }
    }

    mesh.count = visibleCount * TRAIL_SEGMENTS;
    mesh.instanceMatrix.needsUpdate = true;
    runtime.speedAttribute.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={meshRef}
      args={[buffers.geometry, undefined, count * TRAIL_SEGMENTS]}
      frustumCulled={false}
      renderOrder={2}
    >
      <shaderMaterial
        vertexShader={TRAIL_VERTEX_SHADER}
        fragmentShader={TRAIL_FRAGMENT_SHADER}
        uniforms={uniforms}
        blending={AdditiveBlending}
        depthWrite={false}
        transparent
        side={DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
