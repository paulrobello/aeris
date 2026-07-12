export type CameraMode = "orbit" | "follow" | "cinematic" | "top";

export type EnvironmentMode =
  "deep-space" | "solar-storm" | "aurora" | "neon-grid";

export type ColorTheme = "spectral" | "aurora" | "solar" | "monochrome";

export type PointerMode = "attract" | "repel" | "off";

export type QualityMode = "performance" | "balanced" | "cinematic";

export interface SimulationConfig {
  count: number;
  separation: number;
  alignment: number;
  cohesion: number;
  perceptionRadius: number;
  maxSpeed: number;
  maxForce: number;
  boundaryRadius: number;
  turbulence: number;
  pointerForce: number;
}

export interface VisualConfig {
  boidScale: number;
  trailLength: number;
  trailWidth: number;
  trailOpacity: number;
  glow: number;
  bloom: number;
  motionBlur: number;
  colorTheme: ColorTheme;
  quality: QualityMode;
  showTrails: boolean;
  showConnections: boolean;
}

export interface SimulationStats {
  fps: number;
  visibleBoids: number;
  averageSpeed: number;
  coherence: number;
}

export interface SimulatorPreset {
  id: PresetId;
  name: string;
  eyebrow: string;
  description: string;
  simulation: SimulationConfig;
  visual: VisualConfig;
  camera: CameraMode;
  environment: EnvironmentMode;
}

export type PresetId =
  "murmuration" | "singularity" | "solar-drift" | "zenith" | "user";

export interface BoidSnapshot {
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
  averageSpeed: number;
  coherence: number;
}
