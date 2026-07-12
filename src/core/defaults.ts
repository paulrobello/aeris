import type { SimulatorPreset } from "./types";

export const PRESETS: Record<
  Exclude<SimulatorPreset["id"], "user">,
  SimulatorPreset
> = {
  murmuration: {
    id: "murmuration",
    name: "Murmuration",
    eyebrow: "Organic / Balanced",
    description: "Tight, living ribbons inspired by starling flocks at dusk.",
    simulation: {
      count: 620,
      separation: 1.35,
      alignment: 0.92,
      cohesion: 0.76,
      perceptionRadius: 3.8,
      maxSpeed: 8.4,
      maxForce: 1.15,
      boundaryRadius: 22,
      turbulence: 0.16,
      pointerForce: 1.8,
    },
    visual: {
      boidScale: 0.72,
      trailLength: 34,
      trailWidth: 0.12,
      trailOpacity: 0.48,
      glow: 1.1,
      bloom: 0.92,
      motionBlur: 0.18,
      colorTheme: "spectral",
      quality: "cinematic",
      showTrails: true,
      showConnections: false,
    },
    camera: "orbit",
    environment: "deep-space",
  },
  singularity: {
    id: "singularity",
    name: "Singularity",
    eyebrow: "Dense / Volatile",
    description: "A violent orbital swarm collapsing around a dark attractor.",
    simulation: {
      count: 900,
      separation: 0.82,
      alignment: 0.44,
      cohesion: 1.42,
      perceptionRadius: 5.4,
      maxSpeed: 11.8,
      maxForce: 1.7,
      boundaryRadius: 18,
      turbulence: 0.42,
      pointerForce: 3.2,
    },
    visual: {
      boidScale: 0.58,
      trailLength: 46,
      trailWidth: 0.1,
      trailOpacity: 0.62,
      glow: 1.48,
      bloom: 1.34,
      motionBlur: 0.3,
      colorTheme: "aurora",
      quality: "cinematic",
      showTrails: true,
      showConnections: false,
    },
    camera: "cinematic",
    environment: "aurora",
  },
  "solar-drift": {
    id: "solar-drift",
    name: "Solar Drift",
    eyebrow: "Fast / Expansive",
    description: "Wide, high-speed streams carving through a stellar storm.",
    simulation: {
      count: 480,
      separation: 1.72,
      alignment: 1.28,
      cohesion: 0.35,
      perceptionRadius: 6.2,
      maxSpeed: 14.2,
      maxForce: 0.92,
      boundaryRadius: 30,
      turbulence: 0.28,
      pointerForce: 1.35,
    },
    visual: {
      boidScale: 0.88,
      trailLength: 56,
      trailWidth: 0.14,
      trailOpacity: 0.44,
      glow: 1.3,
      bloom: 1.16,
      motionBlur: 0.38,
      colorTheme: "solar",
      quality: "balanced",
      showTrails: true,
      showConnections: false,
    },
    camera: "follow",
    environment: "solar-storm",
  },
  zenith: {
    id: "zenith",
    name: "Zenith",
    eyebrow: "Precise / Geometric",
    description:
      "A calm, crystalline formation suspended over an infinite grid.",
    simulation: {
      count: 360,
      separation: 2.1,
      alignment: 1.55,
      cohesion: 0.58,
      perceptionRadius: 7.4,
      maxSpeed: 6.2,
      maxForce: 0.62,
      boundaryRadius: 24,
      turbulence: 0.05,
      pointerForce: 1.1,
    },
    visual: {
      boidScale: 0.82,
      trailLength: 24,
      trailWidth: 0.09,
      trailOpacity: 0.36,
      glow: 0.8,
      bloom: 0.68,
      motionBlur: 0.08,
      colorTheme: "monochrome",
      quality: "cinematic",
      showTrails: true,
      showConnections: true,
    },
    camera: "top",
    environment: "neon-grid",
  },
};

export const DEFAULT_PRESET = PRESETS.murmuration;

export const USER_PRESET: SimulatorPreset = {
  id: "user",
  name: "User",
  eyebrow: "Custom / Local",
  description:
    "Tune any control, then save and recall your own flight program.",
  simulation: DEFAULT_PRESET.simulation,
  visual: DEFAULT_PRESET.visual,
  camera: DEFAULT_PRESET.camera,
  environment: DEFAULT_PRESET.environment,
};

export const FLIGHT_PROGRAMS: readonly SimulatorPreset[] = [
  ...Object.values(PRESETS),
  USER_PRESET,
];

export const CAMERA_LABELS = {
  orbit: "Orbital",
  follow: "Pursuit",
  cinematic: "Director",
  top: "Zenith",
} as const;

export const ENVIRONMENT_LABELS = {
  "deep-space": "Deep space",
  "solar-storm": "Solar storm",
  aurora: "Aurora veil",
  "neon-grid": "Neon lattice",
} as const;
