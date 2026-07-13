import { create } from "zustand";

import { DEFAULT_PRESET, PRESETS } from "./defaults";
import type {
  CameraMode,
  EnvironmentMode,
  PointerMode,
  PresetId,
  SimulationConfig,
  SimulationStats,
  VisualConfig,
} from "./types";

export const SETTINGS_STORAGE_KEY = "aeris:simulator-settings";
export const USER_PROGRAM_STORAGE_KEY = "aeris:user-flight-program";

export interface SimulatorConfiguration {
  version: 1;
  simulation: SimulationConfig;
  visual: VisualConfig;
  cameraMode: CameraMode;
  environment: EnvironmentMode;
  pointerMode: PointerMode;
  activePreset: PresetId;
  timeScale: number;
}

interface SimulatorState {
  simulation: SimulationConfig;
  visual: VisualConfig;
  cameraMode: CameraMode;
  environment: EnvironmentMode;
  pointerMode: PointerMode;
  activePreset: PresetId;
  paused: boolean;
  cinemaMode: boolean;
  controlsOpen: boolean;
  timeScale: number;
  resetToken: number;
  stats: SimulationStats;
  userProgram: SimulatorConfiguration | null;
  setSimulation: (patch: Partial<SimulationConfig>) => void;
  setVisual: (patch: Partial<VisualConfig>) => void;
  setCameraMode: (mode: CameraMode) => void;
  setEnvironment: (mode: EnvironmentMode) => void;
  setPointerMode: (mode: PointerMode) => void;
  setPaused: (paused: boolean) => void;
  setCinemaMode: (enabled: boolean) => void;
  setControlsOpen: (open: boolean) => void;
  setTimeScale: (scale: number) => void;
  setStats: (stats: SimulationStats) => void;
  applyPreset: (preset: PresetId) => void;
  applyConfiguration: (configuration: SimulatorConfiguration) => void;
  setUserProgram: (configuration: SimulatorConfiguration | null) => void;
  saveUserProgram: () => void;
  reseed: () => void;
}

const CAMERA_MODES: readonly CameraMode[] = [
  "orbit",
  "follow",
  "cinematic",
  "top",
];
const ENVIRONMENTS: readonly EnvironmentMode[] = [
  "deep-space",
  "solar-storm",
  "aurora",
  "neon-grid",
];
const POINTER_MODES: readonly PointerMode[] = ["attract", "repel", "off"];
const PRESET_IDS: readonly PresetId[] = [
  "murmuration",
  "singularity",
  "solar-drift",
  "zenith",
  "user",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : null;
}

export function parseSimulatorConfiguration(
  value: unknown,
): SimulatorConfiguration | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const simulation = value.simulation;
  const visual = value.visual;
  if (!isRecord(simulation) || !isRecord(visual)) return null;

  const flockCount =
    simulation.flockCount === undefined
      ? DEFAULT_PRESET.simulation.flockCount
      : finiteNumber(simulation.flockCount, 1, 8);
  const flockAvoidance =
    simulation.flockAvoidance === undefined
      ? DEFAULT_PRESET.simulation.flockAvoidance
      : finiteNumber(simulation.flockAvoidance, 0, 3);
  const numbers = {
    count: finiteNumber(simulation.count, 120, 2400),
    flockCount,
    flockAvoidance,
    separation: finiteNumber(simulation.separation, 0, 3),
    alignment: finiteNumber(simulation.alignment, 0, 3),
    cohesion: finiteNumber(simulation.cohesion, 0, 3),
    perceptionRadius: finiteNumber(simulation.perceptionRadius, 1.5, 10),
    maxSpeed: finiteNumber(simulation.maxSpeed, 2, 18),
    maxForce: finiteNumber(simulation.maxForce, 0.1, 3),
    boundaryRadius: finiteNumber(simulation.boundaryRadius, 12, 40),
    turbulence: finiteNumber(simulation.turbulence, 0, 1),
    pointerForce: finiteNumber(simulation.pointerForce, 0, 5),
    boidScale: finiteNumber(visual.boidScale, 0.3, 1.5),
    trailLength: finiteNumber(visual.trailLength, 0, 80),
    trailWidth: finiteNumber(visual.trailWidth, 0.04, 0.3),
    trailOpacity: finiteNumber(visual.trailOpacity, 0, 1),
    glow: finiteNumber(visual.glow, 0, 2.5),
    bloom: finiteNumber(visual.bloom, 0, 2),
    motionBlur: finiteNumber(visual.motionBlur, 0, 0.75),
    timeScale: finiteNumber(value.timeScale, 0.1, 2),
  };
  if (Object.values(numbers).some((entry) => entry === null)) return null;
  if (
    !CAMERA_MODES.includes(value.cameraMode as CameraMode) ||
    !ENVIRONMENTS.includes(value.environment as EnvironmentMode) ||
    !POINTER_MODES.includes(value.pointerMode as PointerMode) ||
    !PRESET_IDS.includes(value.activePreset as PresetId) ||
    !["spectral", "aurora", "solar", "monochrome"].includes(
      visual.colorTheme as string,
    ) ||
    !["performance", "balanced", "cinematic"].includes(
      visual.quality as string,
    ) ||
    typeof visual.showTrails !== "boolean" ||
    typeof visual.showConnections !== "boolean"
  ) {
    return null;
  }

  return {
    version: 1,
    simulation: {
      count: Math.round(numbers.count!),
      flockCount: Math.round(numbers.flockCount!),
      flockAvoidance: numbers.flockAvoidance!,
      separation: numbers.separation!,
      alignment: numbers.alignment!,
      cohesion: numbers.cohesion!,
      perceptionRadius: numbers.perceptionRadius!,
      maxSpeed: numbers.maxSpeed!,
      maxForce: numbers.maxForce!,
      boundaryRadius: numbers.boundaryRadius!,
      turbulence: numbers.turbulence!,
      pointerForce: numbers.pointerForce!,
    },
    visual: {
      boidScale: numbers.boidScale!,
      trailLength: Math.round(numbers.trailLength!),
      trailWidth: numbers.trailWidth!,
      trailOpacity: numbers.trailOpacity!,
      glow: numbers.glow!,
      bloom: numbers.bloom!,
      motionBlur: numbers.motionBlur!,
      colorTheme: visual.colorTheme as VisualConfig["colorTheme"],
      quality: visual.quality as VisualConfig["quality"],
      showTrails: visual.showTrails,
      showConnections: visual.showConnections,
    },
    cameraMode: value.cameraMode as CameraMode,
    environment: value.environment as EnvironmentMode,
    pointerMode: value.pointerMode as PointerMode,
    activePreset: value.activePreset as PresetId,
    timeScale: numbers.timeScale!,
  };
}

export function createSimulatorConfiguration(
  state: SimulatorState,
): SimulatorConfiguration {
  return {
    version: 1,
    simulation: state.simulation,
    visual: state.visual,
    cameraMode: state.cameraMode,
    environment: state.environment,
    pointerMode: state.pointerMode,
    activePreset: state.activePreset,
    timeScale: state.timeScale,
  };
}

export const useSimulatorStore = create<SimulatorState>((set) => ({
  simulation: DEFAULT_PRESET.simulation,
  visual: DEFAULT_PRESET.visual,
  cameraMode: DEFAULT_PRESET.camera,
  environment: DEFAULT_PRESET.environment,
  pointerMode: "attract",
  activePreset: DEFAULT_PRESET.id,
  paused: false,
  cinemaMode: false,
  controlsOpen: true,
  timeScale: 1,
  resetToken: 0,
  stats: {
    fps: 60,
    visibleBoids: DEFAULT_PRESET.simulation.count,
    averageSpeed: 0,
    coherence: 0,
  },
  userProgram: null,
  setSimulation: (patch) =>
    set((state) => ({
      simulation: { ...state.simulation, ...patch },
      activePreset: state.activePreset,
      resetToken:
        patch.count === undefined && patch.flockCount === undefined
          ? state.resetToken
          : state.resetToken + 1,
    })),
  setVisual: (patch) =>
    set((state) => ({ visual: { ...state.visual, ...patch } })),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setEnvironment: (environment) => set({ environment }),
  setPointerMode: (pointerMode) => set({ pointerMode }),
  setPaused: (paused) => set({ paused }),
  setCinemaMode: (cinemaMode) => set({ cinemaMode }),
  setControlsOpen: (controlsOpen) => set({ controlsOpen }),
  setTimeScale: (timeScale) => set({ timeScale }),
  setStats: (stats) => set({ stats }),
  applyPreset: (presetId) => {
    if (presetId === "user") {
      set((state) => {
        if (!state.userProgram) return { activePreset: "user" };
        return {
          simulation: state.userProgram.simulation,
          visual: state.userProgram.visual,
          cameraMode: state.userProgram.cameraMode,
          environment: state.userProgram.environment,
          pointerMode: state.userProgram.pointerMode,
          activePreset: "user",
          timeScale: state.userProgram.timeScale,
          resetToken: state.resetToken + 1,
        };
      });
      return;
    }
    const preset = PRESETS[presetId];
    set((state) => ({
      simulation: preset.simulation,
      visual: preset.visual,
      cameraMode: preset.camera,
      environment: preset.environment,
      activePreset: preset.id,
      resetToken: state.resetToken + 1,
    }));
  },
  applyConfiguration: (configuration) =>
    set((state) => ({
      simulation: configuration.simulation,
      visual: configuration.visual,
      cameraMode: configuration.cameraMode,
      environment: configuration.environment,
      pointerMode: configuration.pointerMode,
      activePreset: configuration.activePreset,
      timeScale: configuration.timeScale,
      resetToken: state.resetToken + 1,
    })),
  setUserProgram: (userProgram) => set({ userProgram }),
  saveUserProgram: () =>
    set((state) => ({
      userProgram: {
        ...createSimulatorConfiguration(state),
        activePreset: "user",
      },
      activePreset: "user",
    })),
  reseed: () => set((state) => ({ resetToken: state.resetToken + 1 })),
}));
