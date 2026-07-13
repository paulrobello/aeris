import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Quaternion,
  TorusGeometry,
  Vector3,
} from "three";

import type { BoidSnapshot } from "@/src/core/types";

interface PredatorProps {
  snapshotRef: React.RefObject<BoidSnapshot>;
  resetToken: number;
}

const AFTERIMAGE_COUNT = 10;
const FORWARD = new Vector3(0, 0, 1);
const TELEPORT_DISTANCE_SQUARED = 64;

export function Predator({ snapshotRef, resetToken }: PredatorProps) {
  const bodyRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const trailRef = useRef<InstancedMesh>(null);

  const resources = useMemo(() => {
    const bodyGeometry = new ConeGeometry(0.84, 3.8, 4, 1, false);
    bodyGeometry.rotateX(Math.PI / 2);
    bodyGeometry.translate(0, 0, 0.44);
    bodyGeometry.computeVertexNormals();

    return {
      bodyGeometry,
      coreGeometry: new OctahedronGeometry(0.42, 0),
      ringGeometry: new TorusGeometry(1.02, 0.065, 6, 32),
      bodyMaterial: new MeshBasicMaterial({
        color: "#ff451c",
        toneMapped: false,
      }),
      coreMaterial: new MeshBasicMaterial({
        color: "#fff1c7",
        toneMapped: false,
      }),
      ringMaterial: new MeshBasicMaterial({
        color: "#ffb23f",
        transparent: true,
        opacity: 0.52,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      shellMaterial: new MeshBasicMaterial({
        color: "#ff6a32",
        wireframe: true,
        transparent: true,
        opacity: 0.24,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      trailMaterial: new MeshBasicMaterial({
        vertexColors: true,
        color: "#ffffff",
        transparent: true,
        opacity: 0.26,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, []);
  const animatedMaterialsRef = useRef({
    ring: resources.ringMaterial,
    shell: resources.shellMaterial,
  });

  const workRef = useRef({
    initialized: false,
    position: new Vector3(),
    lastPosition: new Vector3(),
    direction: new Vector3(),
    orientation: new Quaternion(),
    scale: new Vector3(),
    matrix: new Matrix4(),
    historyPositions: Array.from(
      { length: AFTERIMAGE_COUNT },
      () => new Vector3(),
    ),
    historyOrientations: Array.from(
      { length: AFTERIMAGE_COUNT },
      () => new Quaternion(),
    ),
  });

  useEffect(() => {
    const trail = trailRef.current;
    if (!trail) return;
    trail.instanceMatrix.setUsage(DynamicDrawUsage);

    const predatorColor = new Color("#ff451c");
    for (let index = 0; index < AFTERIMAGE_COUNT; index += 1) {
      const life = 1 - index / AFTERIMAGE_COUNT;
      trail.setColorAt(index, predatorColor.clone().multiplyScalar(life * 0.7));
    }
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    const work = workRef.current;
    work.initialized = false;
    if (bodyRef.current) bodyRef.current.visible = false;
    if (trailRef.current) trailRef.current.visible = false;
  }, [resetToken]);

  useEffect(
    () => () => {
      resources.bodyGeometry.dispose();
      resources.coreGeometry.dispose();
      resources.ringGeometry.dispose();
      resources.bodyMaterial.dispose();
      resources.coreMaterial.dispose();
      resources.ringMaterial.dispose();
      resources.shellMaterial.dispose();
      resources.trailMaterial.dispose();
    },
    [resources],
  );

  useFrame((state) => {
    const body = bodyRef.current;
    const core = coreRef.current;
    const ring = ringRef.current;
    const trail = trailRef.current;
    const snapshot = snapshotRef.current;
    if (!body || !core || !ring || !trail || !snapshot) return;

    const predator = snapshot.predator;
    const work = workRef.current;
    if (!predator.active) {
      body.visible = false;
      trail.visible = false;
      work.initialized = false;
      return;
    }

    work.position.fromArray(predator.position);
    work.direction.fromArray(predator.velocity);
    const speed = work.direction.length();
    if (speed > 0.0001) {
      work.direction.multiplyScalar(1 / speed);
      work.orientation.setFromUnitVectors(FORWARD, work.direction);
    }

    const teleported =
      work.initialized &&
      work.lastPosition.distanceToSquared(work.position) >
        TELEPORT_DISTANCE_SQUARED;
    if (!work.initialized || teleported) {
      for (let index = 0; index < AFTERIMAGE_COUNT; index += 1) {
        work.historyPositions[index].copy(work.position);
        work.historyOrientations[index].copy(work.orientation);
      }
      work.initialized = true;
    } else {
      for (let index = AFTERIMAGE_COUNT - 1; index > 0; index -= 1) {
        work.historyPositions[index].lerp(
          work.historyPositions[index - 1],
          0.34,
        );
        work.historyOrientations[index].slerp(
          work.historyOrientations[index - 1],
          0.34,
        );
      }
      work.historyPositions[0].copy(work.position);
      work.historyOrientations[0].copy(work.orientation);
    }
    work.lastPosition.copy(work.position);

    body.visible = true;
    body.position.copy(work.position);
    body.quaternion.copy(work.orientation);
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 5.2);
    body.scale.setScalar(1 + pulse * 0.025);
    core.scale.setScalar(0.88 + pulse * 0.22);
    ring.rotation.z = state.clock.elapsedTime * 0.82;
    ring.scale.set(1 + pulse * 0.1, 0.72 + pulse * 0.06, 1);
    animatedMaterialsRef.current.ring.opacity = 0.42 + pulse * 0.2;
    animatedMaterialsRef.current.shell.opacity = 0.15 + pulse * 0.12;

    trail.visible = true;
    for (let index = 0; index < AFTERIMAGE_COUNT; index += 1) {
      const life = 1 - (index + 1) / (AFTERIMAGE_COUNT + 1);
      const trailScale = 0.12 + life * 0.38;
      work.scale.setScalar(trailScale);
      work.matrix.compose(
        work.historyPositions[index],
        work.historyOrientations[index],
        work.scale,
      );
      trail.setMatrixAt(index, work.matrix);
    }
    trail.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={trailRef}
        args={[
          resources.bodyGeometry,
          resources.trailMaterial,
          AFTERIMAGE_COUNT,
        ]}
        frustumCulled={false}
        renderOrder={3}
        visible={false}
        dispose={null}
      />
      <group ref={bodyRef} visible={false} renderOrder={4} dispose={null}>
        <mesh
          geometry={resources.bodyGeometry}
          material={resources.bodyMaterial}
          renderOrder={4}
          dispose={null}
        />
        <mesh
          geometry={resources.bodyGeometry}
          material={resources.shellMaterial}
          scale={1.14}
          renderOrder={5}
          dispose={null}
        />
        <mesh
          ref={coreRef}
          geometry={resources.coreGeometry}
          material={resources.coreMaterial}
          position={[0, 0, -0.18]}
          renderOrder={5}
          dispose={null}
        />
        <mesh
          ref={ringRef}
          geometry={resources.ringGeometry}
          material={resources.ringMaterial}
          position={[0, 0, -0.22]}
          renderOrder={5}
          dispose={null}
        />
      </group>
    </>
  );
}
