import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
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

const HISTORY_POINTS = 6;
const RIBBON_POINTS = 13;
const VERTICES_PER_BOID = RIBBON_POINTS * 2;
const INDICES_PER_BOID = (RIBBON_POINTS - 1) * 6;

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
  const meshRef = useRef<Mesh>(null);

  const buffers = useMemo(() => {
    const vertexCount = count * VERTICES_PER_BOID;
    const positions = new Float32Array(vertexCount * 3);
    const life = new Float32Array(vertexCount);
    const speed = new Float32Array(vertexCount);
    const indices = new Uint32Array(count * INDICES_PER_BOID);

    for (let boid = 0; boid < count; boid += 1) {
      const vertexBase = boid * VERTICES_PER_BOID;
      const indexBase = boid * INDICES_PER_BOID;
      for (let point = 0; point < RIBBON_POINTS; point += 1) {
        const pointLife = point / (RIBBON_POINTS - 1);
        life[vertexBase + point * 2] = pointLife;
        life[vertexBase + point * 2 + 1] = pointLife;
      }
      for (let segment = 0; segment < RIBBON_POINTS - 1; segment += 1) {
        const left = vertexBase + segment * 2;
        const right = left + 1;
        const nextLeft = left + 2;
        const nextRight = left + 3;
        const offset = indexBase + segment * 6;
        indices[offset] = left;
        indices[offset + 1] = right;
        indices[offset + 2] = nextLeft;
        indices[offset + 3] = right;
        indices[offset + 4] = nextRight;
        indices[offset + 5] = nextLeft;
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
    geometry.setIndex(new BufferAttribute(indices, 1));

    const history = new Float32Array(count * HISTORY_POINTS * 3);
    const centerline = new Float32Array(count * RIBBON_POINTS * 3);
    const sides = new Float32Array(count * RIBBON_POINTS * 3);
    history.fill(Number.NaN);
    sides.fill(Number.NaN);
    return {
      geometry,
      history,
      centerline,
      sides,
      positions,
      speed,
      positionAttribute,
      speedAttribute,
    };
  }, [count]);
  const buffersRef = useRef(buffers);

  const uniforms = useMemo(
    () => ({
      uOpacity: { value: opacity },
      uTheme: { value: themeIndex(colorTheme) },
      uGlow: { value: glow },
    }),
    [colorTheme, glow, opacity],
  );

  const workRef = useRef({
    controls: Array.from({ length: HISTORY_POINTS + 1 }, () => new Vector3()),
    curve: new CatmullRomCurve3([], false, "centripetal"),
    point: new Vector3(),
    previous: new Vector3(),
    next: new Vector3(),
    tangent: new Vector3(),
    view: new Vector3(),
    side: new Vector3(),
    stableSide: new Vector3(),
    fallback: new Vector3(0, 1, 0),
  });

  useEffect(() => {
    buffersRef.current = buffers;
    buffers.history.fill(Number.NaN);
    buffers.sides.fill(Number.NaN);
  }, [buffers, resetToken]);

  useEffect(
    () => () => {
      buffers.geometry.dispose();
    },
    [buffers.geometry],
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    const snapshot = snapshotRef.current;
    if (!mesh || !snapshot) return;

    const runtime = buffersRef.current;
    const work = workRef.current;
    const visibleCount = Math.min(count, snapshot.count);
    const follow = Math.min(1, HISTORY_POINTS / Math.max(length, 1));

    for (let boid = 0; boid < visibleCount; boid += 1) {
      const sourceOffset = boid * 3;
      const historyOffset = boid * HISTORY_POINTS * 3;
      const px = snapshot.positions[sourceOffset];
      const py = snapshot.positions[sourceOffset + 1];
      const pz = snapshot.positions[sourceOffset + 2];

      if (!Number.isFinite(runtime.history[historyOffset])) {
        for (let sample = 0; sample < HISTORY_POINTS; sample += 1) {
          const offset = historyOffset + sample * 3;
          runtime.history[offset] = px;
          runtime.history[offset + 1] = py;
          runtime.history[offset + 2] = pz;
        }
      } else {
        for (let sample = HISTORY_POINTS - 1; sample >= 0; sample -= 1) {
          const offset = historyOffset + sample * 3;
          const targetOffset = offset + 3;
          const targetX =
            sample === HISTORY_POINTS - 1 ? px : runtime.history[targetOffset];
          const targetY =
            sample === HISTORY_POINTS - 1
              ? py
              : runtime.history[targetOffset + 1];
          const targetZ =
            sample === HISTORY_POINTS - 1
              ? pz
              : runtime.history[targetOffset + 2];
          runtime.history[offset] +=
            (targetX - runtime.history[offset]) * follow;
          runtime.history[offset + 1] +=
            (targetY - runtime.history[offset + 1]) * follow;
          runtime.history[offset + 2] +=
            (targetZ - runtime.history[offset + 2]) * follow;
        }
      }

      for (let sample = 0; sample < HISTORY_POINTS; sample += 1) {
        work.controls[sample].fromArray(
          runtime.history,
          historyOffset + sample * 3,
        );
      }
      work.controls[HISTORY_POINTS].set(px, py, pz);
      work.curve.points = work.controls;

      const centerlineOffset = boid * RIBBON_POINTS * 3;
      for (let point = 0; point < RIBBON_POINTS; point += 1) {
        work.curve.getPoint(point / (RIBBON_POINTS - 1), work.point);
        work.point.toArray(runtime.centerline, centerlineOffset + point * 3);
      }

      const vx = snapshot.velocities[sourceOffset];
      const vy = snapshot.velocities[sourceOffset + 1];
      const vz = snapshot.velocities[sourceOffset + 2];
      const speedRatio = Math.min(
        Math.hypot(vx, vy, vz) / Math.max(maxSpeed, 0.001),
        1.25,
      );
      const vertexBase = boid * VERTICES_PER_BOID;

      for (let point = 0; point < RIBBON_POINTS; point += 1) {
        const centerOffset = centerlineOffset + point * 3;
        work.point.fromArray(runtime.centerline, centerOffset);
        work.previous.fromArray(
          runtime.centerline,
          centerlineOffset + Math.max(0, point - 1) * 3,
        );
        work.next.fromArray(
          runtime.centerline,
          centerlineOffset + Math.min(RIBBON_POINTS - 1, point + 1) * 3,
        );
        work.tangent.subVectors(work.next, work.previous);
        work.view.subVectors(state.camera.position, work.point);
        work.side.crossVectors(work.tangent, work.view);
        if (work.side.lengthSq() < 0.000001) {
          work.side.crossVectors(work.tangent, work.fallback);
        }
        if (work.side.lengthSq() < 0.000001) work.side.set(1, 0, 0);

        const sideOffset = centerlineOffset + point * 3;
        work.side.normalize();
        if (Number.isFinite(runtime.sides[sideOffset])) {
          work.stableSide.fromArray(runtime.sides, sideOffset);
          if (work.side.dot(work.stableSide) < 0) work.side.multiplyScalar(-1);
          work.side.lerp(work.stableSide, 0.35).normalize();
        }
        work.side.toArray(runtime.sides, sideOffset);

        const pointLife = point / (RIBBON_POINTS - 1);
        const halfWidth = width * (0.12 + pointLife * 0.38);
        work.side.multiplyScalar(halfWidth);
        const positionOffset = (vertexBase + point * 2) * 3;
        runtime.positions[positionOffset] = work.point.x - work.side.x;
        runtime.positions[positionOffset + 1] = work.point.y - work.side.y;
        runtime.positions[positionOffset + 2] = work.point.z - work.side.z;
        runtime.positions[positionOffset + 3] = work.point.x + work.side.x;
        runtime.positions[positionOffset + 4] = work.point.y + work.side.y;
        runtime.positions[positionOffset + 5] = work.point.z + work.side.z;
        runtime.speed[vertexBase + point * 2] = speedRatio;
        runtime.speed[vertexBase + point * 2 + 1] = speedRatio;
      }
    }

    runtime.geometry.setDrawRange(
      0,
      length <= 0 ? 0 : visibleCount * INDICES_PER_BOID,
    );
    runtime.positionAttribute.needsUpdate = true;
    runtime.speedAttribute.needsUpdate = true;
  }, -1);

  return (
    <mesh
      ref={meshRef}
      geometry={buffers.geometry}
      frustumCulled={false}
      renderOrder={2}
      dispose={null}
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
    </mesh>
  );
}
