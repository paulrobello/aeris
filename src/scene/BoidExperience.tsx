"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  Mesh,
  NoToneMapping,
  SRGBColorSpace,
} from "three";

import { useSimulatorStore } from "@/src/core/store";
import type {
  BoidSnapshot,
  CameraMode,
  EnvironmentMode,
  PointerMode,
  SimulationConfig,
} from "@/src/core/types";
import { BoidSimulation } from "@/src/simulation/BoidSimulation";
import { BoidSwarm } from "./BoidSwarm";
import { CameraRig } from "./CameraRig";
import { ConnectionField } from "./ConnectionField";
import { Environments } from "./Environments";
import { SceneEffects } from "./SceneEffects";
import { TrailField } from "./TrailField";

const INITIAL_SEED = 0xa3e15;

interface PointerInteraction {
  point: [number, number, number];
  mode: PointerMode;
}

interface PublicSceneState {
  version: 1;
  coordinateSystem: string;
  paused: boolean;
  timeScale: number;
  cameraMode: CameraMode;
  environment: EnvironmentMode;
  pointerMode: PointerMode;
  count: number;
  averageSpeed: number;
  coherence: number;
  leadBoid: {
    position: [number, number, number];
    velocity: [number, number, number];
  } | null;
}

type AerisWindow = Window & {
  __aerisAdvanceTime?: (milliseconds: number) => void;
  __aerisSceneState?: PublicSceneState;
};

function seedForReset(resetToken: number): number {
  return (INITIAL_SEED ^ Math.imul(resetToken + 1, 0x9e3779b1)) >>> 0;
}

function PointerPlane({
  boundaryRadius,
  onInteractionPoint,
}: {
  boundaryRadius: number;
  onInteractionPoint: (point: [number, number, number] | null) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.quaternion.copy(camera.quaternion);
  });

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onInteractionPoint([event.point.x, event.point.y, event.point.z]);
    },
    [onInteractionPoint],
  );

  return (
    <mesh
      ref={meshRef}
      onPointerMove={handlePointerMove}
      onPointerOut={() => onInteractionPoint(null)}
      renderOrder={10}
    >
      <planeGeometry args={[boundaryRadius * 5, boundaryRadius * 5]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        colorWrite={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function SimulationScene() {
  const simulation = useSimulatorStore((state) => state.simulation);
  const visual = useSimulatorStore((state) => state.visual);
  const cameraMode = useSimulatorStore((state) => state.cameraMode);
  const environment = useSimulatorStore((state) => state.environment);
  const pointerMode = useSimulatorStore((state) => state.pointerMode);
  const paused = useSimulatorStore((state) => state.paused);
  const timeScale = useSimulatorStore((state) => state.timeScale);
  const resetToken = useSimulatorStore((state) => state.resetToken);
  const setStats = useSimulatorStore((state) => state.setStats);

  const [engine] = useState(() => new BoidSimulation(simulation, INITIAL_SEED));
  const snapshotRef = useRef<BoidSnapshot>(engine.getSnapshot());
  const interactionPointRef = useRef<[number, number, number] | null>(null);
  const simulationRef = useRef<SimulationConfig>(simulation);
  const pausedRef = useRef(paused);
  const timeScaleRef = useRef(timeScale);
  const pointerModeRef = useRef(pointerMode);
  const cameraModeRef = useRef(cameraMode);
  const environmentRef = useRef(environment);
  const telemetryElapsedRef = useRef(0);
  const telemetryFramesRef = useRef(0);
  const latestFpsRef = useRef(60);

  const currentInteraction = useCallback((): PointerInteraction | null => {
    const point = interactionPointRef.current;
    const mode = pointerModeRef.current;
    return point && mode !== "off" ? { point, mode } : null;
  }, []);

  const publishSceneState = useCallback(() => {
    if (typeof window === "undefined") return;
    const snapshot = snapshotRef.current;
    const hasLead = snapshot.count > 0;
    (window as AerisWindow).__aerisSceneState = {
      version: 1,
      coordinateSystem:
        "+X right, +Y up, +Z toward the initial camera; world origin is flock center",
      paused: pausedRef.current,
      timeScale: timeScaleRef.current,
      cameraMode: cameraModeRef.current,
      environment: environmentRef.current,
      pointerMode: pointerModeRef.current,
      count: snapshot.count,
      averageSpeed: snapshot.averageSpeed,
      coherence: snapshot.coherence,
      leadBoid: hasLead
        ? {
            position: [
              snapshot.positions[0],
              snapshot.positions[1],
              snapshot.positions[2],
            ],
            velocity: [
              snapshot.velocities[0],
              snapshot.velocities[1],
              snapshot.velocities[2],
            ],
          }
        : null,
    };
  }, []);

  const advanceMilliseconds = useCallback(
    (milliseconds: number) => {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
      if (pausedRef.current) {
        publishSceneState();
        return;
      }
      const scaledSeconds = (milliseconds / 1000) * timeScaleRef.current;
      const stepSeconds = 1 / 60;
      const fullSteps = Math.floor(scaledSeconds / stepSeconds);
      const remainder = scaledSeconds - fullSteps * stepSeconds;

      for (let step = 0; step < fullSteps; step += 1) {
        snapshotRef.current = engine.step(stepSeconds, currentInteraction());
      }
      if (remainder > 0.00001) {
        snapshotRef.current = engine.step(remainder, currentInteraction());
      }
      publishSceneState();
    },
    [currentInteraction, engine, publishSceneState],
  );

  useEffect(() => {
    simulationRef.current = simulation;
    pausedRef.current = paused;
    timeScaleRef.current = timeScale;
    pointerModeRef.current = pointerMode;
    cameraModeRef.current = cameraMode;
    environmentRef.current = environment;
    publishSceneState();
  }, [
    cameraMode,
    environment,
    paused,
    pointerMode,
    publishSceneState,
    simulation,
    timeScale,
  ]);

  useEffect(() => {
    engine.configure(simulation);
    snapshotRef.current = engine.getSnapshot();
    publishSceneState();
  }, [engine, publishSceneState, simulation]);

  useEffect(() => {
    engine.reset(simulationRef.current, seedForReset(resetToken));
    snapshotRef.current = engine.getSnapshot();
    publishSceneState();
  }, [engine, publishSceneState, resetToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = window as AerisWindow;
    const hook = (milliseconds: number) => advanceMilliseconds(milliseconds);
    target.__aerisAdvanceTime = hook;
    publishSceneState();

    return () => {
      if (target.__aerisAdvanceTime === hook) delete target.__aerisAdvanceTime;
      delete target.__aerisSceneState;
    };
  }, [advanceMilliseconds, publishSceneState]);

  useFrame((_, delta) => {
    telemetryElapsedRef.current += delta;
    telemetryFramesRef.current += 1;

    if (!pausedRef.current) {
      const scaledDelta = Math.min(delta, 0.05) * timeScaleRef.current;
      if (scaledDelta > 0) {
        snapshotRef.current = engine.step(scaledDelta, currentInteraction());
      }
    }

    if (telemetryElapsedRef.current >= 0.35) {
      const snapshot = snapshotRef.current;
      latestFpsRef.current =
        telemetryFramesRef.current / telemetryElapsedRef.current;
      setStats({
        fps: latestFpsRef.current,
        visibleBoids: snapshot.count,
        averageSpeed: snapshot.averageSpeed,
        coherence: snapshot.coherence,
      });
      telemetryElapsedRef.current = 0;
      telemetryFramesRef.current = 0;
      publishSceneState();
    }
  }, -2);

  const handleInteractionPoint = useCallback(
    (point: [number, number, number] | null) => {
      interactionPointRef.current = point;
    },
    [],
  );

  const spectralGlow = visual.glow * (0.82 + visual.bloom * 0.28);
  const trailLength = Math.round(
    visual.trailLength * (0.86 + visual.motionBlur * 0.58),
  );
  const trailOpacity = Math.min(
    1,
    visual.trailOpacity * (0.9 + visual.motionBlur * 0.38),
  );

  return (
    <>
      <Environments
        mode={environment}
        quality={visual.quality}
        boundaryRadius={simulation.boundaryRadius}
      />
      <BoidSwarm
        snapshotRef={snapshotRef}
        count={simulation.count}
        boidScale={visual.boidScale}
        glow={spectralGlow}
        maxSpeed={simulation.maxSpeed}
        colorTheme={visual.colorTheme}
      />
      {visual.showTrails && (
        <TrailField
          snapshotRef={snapshotRef}
          count={simulation.count}
          length={trailLength}
          width={visual.trailWidth}
          opacity={trailOpacity}
          glow={spectralGlow}
          maxSpeed={simulation.maxSpeed}
          colorTheme={visual.colorTheme}
          resetToken={resetToken}
        />
      )}
      {visual.showConnections && (
        <ConnectionField
          snapshotRef={snapshotRef}
          count={simulation.count}
          perceptionRadius={simulation.perceptionRadius}
          colorTheme={visual.colorTheme}
        />
      )}
      <PointerPlane
        boundaryRadius={simulation.boundaryRadius}
        onInteractionPoint={handleInteractionPoint}
      />
      <CameraRig
        mode={cameraMode}
        snapshotRef={snapshotRef}
        boundaryRadius={simulation.boundaryRadius}
      />
      <SceneEffects quality={visual.quality} />
    </>
  );
}

export function BoidExperience() {
  const quality = useSimulatorStore((state) => state.visual.quality);
  const maxDpr =
    quality === "performance" ? 1 : quality === "balanced" ? 1.5 : 2;

  return (
    <Canvas
      dpr={[1, maxDpr]}
      camera={{ position: [0, 7, 38], fov: 54, near: 0.1, far: 240 }}
      gl={{
        alpha: false,
        antialias: quality !== "performance",
        powerPreference: "high-performance",
        toneMapping:
          quality === "performance" ? NoToneMapping : ACESFilmicToneMapping,
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMappingExposure = 1.08;
        gl.setClearColor("#01030a", 1);
      }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <SimulationScene />
    </Canvas>
  );
}

export default BoidExperience;
