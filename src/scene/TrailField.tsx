import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  LineSegments,
} from "three";

import type { BoidSnapshot, ColorTheme } from "@/src/core/types";
import { TRAIL_FRAGMENT_SHADER, TRAIL_VERTEX_SHADER } from "./shaders";

interface TrailFieldProps {
  snapshotRef: React.RefObject<BoidSnapshot>;
  count: number;
  length: number;
  opacity: number;
  glow: number;
  maxSpeed: number;
  colorTheme: ColorTheme;
  resetToken: number;
}

function themeIndex(theme: ColorTheme): number {
  return { spectral: 0, aurora: 1, solar: 2, monochrome: 3 }[theme];
}

export function TrailField({
  snapshotRef,
  count,
  length,
  opacity,
  glow,
  maxSpeed,
  colorTheme,
  resetToken,
}: TrailFieldProps) {
  const lineRef = useRef<LineSegments>(null);
  const materialRef = useRef<import("three").ShaderMaterial>(null);
  const segments = Math.max(2, Math.round(length));

  const buffers = useMemo(() => {
    const history = new Float32Array(count * segments * 3);
    const historySpeed = new Float32Array(count * segments);
    const vertexCount = count * (segments - 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const life = new Float32Array(vertexCount);
    const speed = new Float32Array(vertexCount);

    for (let boid = 0; boid < count; boid += 1) {
      for (let segment = 0; segment < segments - 1; segment += 1) {
        const vertexOffset = (boid * (segments - 1) + segment) * 2;
        const age = segment / (segments - 1);
        life[vertexOffset] = age;
        life[vertexOffset + 1] = (segment + 1) / (segments - 1);
      }
    }

    const positionAttribute = new BufferAttribute(positions, 3);
    const speedAttribute = new BufferAttribute(speed, 1);
    positionAttribute.setUsage(DynamicDrawUsage);
    speedAttribute.setUsage(DynamicDrawUsage);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("aLife", new BufferAttribute(life, 1));
    geometry.setAttribute("aSpeed", speedAttribute);

    return {
      geometry,
      history,
      historySpeed,
      positions,
      speed,
      positionAttribute,
      speedAttribute,
    };
  }, [count, segments]);
  const buffersRef = useRef(buffers);

  const uniforms = useMemo(
    () => ({
      uOpacity: { value: opacity },
      uTheme: { value: themeIndex(colorTheme) },
      uGlow: { value: glow },
    }),
    [colorTheme, glow, opacity],
  );

  useEffect(() => {
    buffersRef.current = buffers;
    buffers.history.fill(Number.NaN);
    buffers.historySpeed.fill(0);
  }, [buffers, resetToken]);

  useEffect(
    () => () => {
      buffers.geometry.dispose();
    },
    [buffers.geometry],
  );

  useFrame(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    const runtime = buffersRef.current;

    const visibleCount = Math.min(count, snapshot.count);
    for (let boid = 0; boid < visibleCount; boid += 1) {
      const sourceOffset = boid * 3;
      const historyOffset = boid * segments * 3;
      const speedHistoryOffset = boid * segments;

      runtime.history.copyWithin(
        historyOffset,
        historyOffset + 3,
        historyOffset + segments * 3,
      );
      runtime.historySpeed.copyWithin(
        speedHistoryOffset,
        speedHistoryOffset + 1,
        speedHistoryOffset + segments,
      );

      const tailOffset = historyOffset + (segments - 1) * 3;
      runtime.history[tailOffset] = snapshot.positions[sourceOffset];
      runtime.history[tailOffset + 1] = snapshot.positions[sourceOffset + 1];
      runtime.history[tailOffset + 2] = snapshot.positions[sourceOffset + 2];
      runtime.historySpeed[speedHistoryOffset + segments - 1] =
        Math.hypot(
          snapshot.velocities[sourceOffset],
          snapshot.velocities[sourceOffset + 1],
          snapshot.velocities[sourceOffset + 2],
        ) / Math.max(maxSpeed, 0.001);

      for (let segment = 0; segment < segments - 1; segment += 1) {
        const fromHistory = historyOffset + segment * 3;
        const toHistory = fromHistory + 3;
        const vertexOffset = (boid * (segments - 1) + segment) * 6;
        const speedOffset = (boid * (segments - 1) + segment) * 2;

        const fallbackX = snapshot.positions[sourceOffset];
        const fallbackY = snapshot.positions[sourceOffset + 1];
        const fallbackZ = snapshot.positions[sourceOffset + 2];
        runtime.positions[vertexOffset] = Number.isFinite(
          runtime.history[fromHistory],
        )
          ? runtime.history[fromHistory]
          : fallbackX;
        runtime.positions[vertexOffset + 1] = Number.isFinite(
          runtime.history[fromHistory + 1],
        )
          ? runtime.history[fromHistory + 1]
          : fallbackY;
        runtime.positions[vertexOffset + 2] = Number.isFinite(
          runtime.history[fromHistory + 2],
        )
          ? runtime.history[fromHistory + 2]
          : fallbackZ;
        runtime.positions[vertexOffset + 3] = Number.isFinite(
          runtime.history[toHistory],
        )
          ? runtime.history[toHistory]
          : fallbackX;
        runtime.positions[vertexOffset + 4] = Number.isFinite(
          runtime.history[toHistory + 1],
        )
          ? runtime.history[toHistory + 1]
          : fallbackY;
        runtime.positions[vertexOffset + 5] = Number.isFinite(
          runtime.history[toHistory + 2],
        )
          ? runtime.history[toHistory + 2]
          : fallbackZ;
        runtime.speed[speedOffset] =
          runtime.historySpeed[speedHistoryOffset + segment];
        runtime.speed[speedOffset + 1] =
          runtime.historySpeed[speedHistoryOffset + segment + 1];
      }
    }

    runtime.geometry.setDrawRange(0, visibleCount * (segments - 1) * 2);
    runtime.positionAttribute.needsUpdate = true;
    runtime.speedAttribute.needsUpdate = true;
  }, -1);

  return (
    <lineSegments
      ref={lineRef}
      args={[buffers.geometry]}
      frustumCulled={false}
      renderOrder={2}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={TRAIL_VERTEX_SHADER}
        fragmentShader={TRAIL_FRAGMENT_SHADER}
        uniforms={uniforms}
        blending={AdditiveBlending}
        depthWrite={false}
        transparent
        toneMapped={false}
      />
    </lineSegments>
  );
}
