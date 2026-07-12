import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
} from "three";

import type { BoidSnapshot, ColorTheme } from "@/src/core/types";

interface ConnectionFieldProps {
  snapshotRef: React.RefObject<BoidSnapshot>;
  count: number;
  perceptionRadius: number;
  colorTheme: ColorTheme;
}

const MAX_SAMPLED_BOIDS = 180;
const MAX_CONNECTIONS = 720;

const VERTEX_SHADER = /* glsl */ `
  attribute float aStrength;
  varying float vStrength;

  void main() {
    vStrength = aStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying float vStrength;
  uniform float uTheme;

  vec3 themeColor() {
    if (uTheme < 0.5) return vec3(0.22, 0.78, 1.0);
    if (uTheme < 1.5) return vec3(0.21, 1.0, 0.72);
    if (uTheme < 2.5) return vec3(1.0, 0.38, 0.08);
    return vec3(0.72, 0.86, 1.0);
  }

  void main() {
    float alpha = pow(clamp(vStrength, 0.0, 1.0), 1.8) * 0.34;
    gl_FragColor = vec4(themeColor(), alpha);
  }
`;

function themeIndex(theme: ColorTheme): number {
  return { spectral: 0, aurora: 1, solar: 2, monochrome: 3 }[theme];
}

export function ConnectionField({
  snapshotRef,
  count,
  perceptionRadius,
  colorTheme,
}: ConnectionFieldProps) {
  const materialRef = useRef<import("three").ShaderMaterial>(null);
  const buffers = useMemo(() => {
    const positions = new Float32Array(MAX_CONNECTIONS * 2 * 3);
    const strengths = new Float32Array(MAX_CONNECTIONS * 2);
    const positionAttribute = new BufferAttribute(positions, 3);
    const strengthAttribute = new BufferAttribute(strengths, 1);
    positionAttribute.setUsage(DynamicDrawUsage);
    strengthAttribute.setUsage(DynamicDrawUsage);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("aStrength", strengthAttribute);
    geometry.setDrawRange(0, 0);

    return {
      geometry,
      positions,
      strengths,
      positionAttribute,
      strengthAttribute,
    };
  }, []);
  const buffersRef = useRef(buffers);

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
    const stride = Math.max(1, Math.ceil(visibleCount / MAX_SAMPLED_BOIDS));
    const radiusSquared = perceptionRadius * perceptionRadius * 1.35;
    let connectionCount = 0;

    for (
      let first = 0;
      first < visibleCount && connectionCount < MAX_CONNECTIONS;
      first += stride
    ) {
      const firstOffset = first * 3;
      for (
        let second = first + stride;
        second < visibleCount && connectionCount < MAX_CONNECTIONS;
        second += stride
      ) {
        const secondOffset = second * 3;
        const dx =
          snapshot.positions[firstOffset] - snapshot.positions[secondOffset];
        const dy =
          snapshot.positions[firstOffset + 1] -
          snapshot.positions[secondOffset + 1];
        const dz =
          snapshot.positions[firstOffset + 2] -
          snapshot.positions[secondOffset + 2];
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared >= radiusSquared) continue;

        const vertexOffset = connectionCount * 6;
        runtime.positions[vertexOffset] = snapshot.positions[firstOffset];
        runtime.positions[vertexOffset + 1] =
          snapshot.positions[firstOffset + 1];
        runtime.positions[vertexOffset + 2] =
          snapshot.positions[firstOffset + 2];
        runtime.positions[vertexOffset + 3] = snapshot.positions[secondOffset];
        runtime.positions[vertexOffset + 4] =
          snapshot.positions[secondOffset + 1];
        runtime.positions[vertexOffset + 5] =
          snapshot.positions[secondOffset + 2];

        const strength = 1 - Math.sqrt(distanceSquared / radiusSquared);
        const strengthOffset = connectionCount * 2;
        runtime.strengths[strengthOffset] = strength;
        runtime.strengths[strengthOffset + 1] = strength;
        connectionCount += 1;
      }
    }

    runtime.geometry.setDrawRange(0, connectionCount * 2);
    runtime.positionAttribute.needsUpdate = true;
    runtime.strengthAttribute.needsUpdate = true;
  });

  return (
    <lineSegments
      geometry={buffers.geometry}
      frustumCulled={false}
      renderOrder={1}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={{ uTheme: { value: themeIndex(colorTheme) } }}
        blending={AdditiveBlending}
        depthWrite={false}
        transparent
        toneMapped={false}
      />
    </lineSegments>
  );
}
