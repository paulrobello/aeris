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
  reseed: () => void;
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
  setSimulation: (patch) =>
    set((state) => ({
      simulation: { ...state.simulation, ...patch },
      activePreset: state.activePreset,
      resetToken:
        patch.count === undefined ? state.resetToken : state.resetToken + 1,
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
  reseed: () => set((state) => ({ resetToken: state.resetToken + 1 })),
}));
