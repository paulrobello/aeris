import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";

import type { BoidSnapshot, CameraMode } from "@/src/core/types";

interface CameraRigProps {
  mode: CameraMode;
  snapshotRef: React.RefObject<BoidSnapshot>;
  boundaryRadius: number;
}

export function CameraRig({
  mode,
  snapshotRef,
  boundaryRadius,
}: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const workRef = useRef({
    smoothTarget: new Vector3(),
    desiredPosition: new Vector3(),
    desiredTarget: new Vector3(),
    velocity: new Vector3(),
    normalUp: new Vector3(0, 1, 0),
    topUp: new Vector3(0, 0, -1),
  });

  useEffect(() => {
    if (mode === "top") {
      workRef.current.smoothTarget.set(0, 0, 0);
    }
  }, [mode]);

  useFrame((state, delta) => {
    const {
      smoothTarget,
      desiredPosition,
      desiredTarget,
      velocity,
      normalUp,
      topUp,
    } = workRef.current;
    if (mode === "orbit") {
      camera.up.lerp(normalUp, 1 - Math.exp(-delta * 8)).normalize();
      return;
    }

    const elapsed = state.clock.elapsedTime;
    const snapshot = snapshotRef.current;
    const damping = 1 - Math.exp(-delta * (mode === "follow" ? 4.2 : 2.2));

    if (mode === "follow" && snapshot?.count) {
      desiredTarget.set(
        snapshot.positions[0],
        snapshot.positions[1],
        snapshot.positions[2],
      );
      velocity.set(
        snapshot.velocities[0],
        snapshot.velocities[1],
        snapshot.velocities[2],
      );
      if (velocity.lengthSq() < 0.0001) velocity.set(0, 0, 1);
      velocity.normalize();
      desiredPosition
        .copy(desiredTarget)
        .addScaledVector(
          velocity,
          -MathUtils.clamp(boundaryRadius * 0.42, 7, 13),
        );
      desiredPosition.y += MathUtils.clamp(boundaryRadius * 0.16, 3, 6);
      desiredTarget.addScaledVector(velocity, 2.8);
      camera.up.lerp(normalUp, damping).normalize();
    } else if (mode === "top") {
      desiredPosition.set(0, boundaryRadius * 2.25, 0.01);
      desiredTarget.set(0, 0, 0);
      camera.up.lerp(topUp, damping).normalize();
    } else {
      const orbit = boundaryRadius * (1.45 + Math.sin(elapsed * 0.11) * 0.08);
      const azimuth = elapsed * 0.095;
      desiredPosition.set(
        Math.cos(azimuth) * orbit,
        boundaryRadius * (0.25 + Math.sin(elapsed * 0.17) * 0.32),
        Math.sin(azimuth) * orbit,
      );
      desiredTarget.set(
        Math.sin(elapsed * 0.13) * boundaryRadius * 0.08,
        Math.cos(elapsed * 0.19) * boundaryRadius * 0.06,
        0,
      );
      camera.up.lerp(normalUp, damping).normalize();
    }

    camera.position.lerp(desiredPosition, damping);
    smoothTarget.lerp(desiredTarget, damping);
    camera.lookAt(smoothTarget);
  });

  return (
    <OrbitControls
      enabled={mode === "orbit"}
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      minDistance={Math.max(8, boundaryRadius * 0.45)}
      maxDistance={boundaryRadius * 3.4}
      rotateSpeed={0.55}
      zoomSpeed={0.65}
      target={[0, 0, 0]}
    />
  );
}
