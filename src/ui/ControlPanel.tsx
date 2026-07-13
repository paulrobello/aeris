"use client";

import { useRef, useState } from "react";
import {
  Aperture,
  Box,
  ChevronDown,
  CircleDot,
  Download,
  HelpCircle,
  MousePointer2,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Waypoints,
} from "lucide-react";

import { CAMERA_LABELS, ENVIRONMENT_LABELS } from "@/src/core/defaults";
import {
  createSimulatorConfiguration,
  parseSimulatorConfiguration,
  useSimulatorStore,
} from "@/src/core/store";
import type {
  CameraMode,
  ColorTheme,
  EnvironmentMode,
  PointerMode,
  QualityMode,
  SimulationConfig,
} from "@/src/core/types";

type TabId = "flock" | "visual" | "world";
type SimulationNumericKey = {
  [Key in keyof SimulationConfig]: SimulationConfig[Key] extends number
    ? Key
    : never;
}[keyof SimulationConfig];

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: (value: number) => string;
}

const CONTROL_HELP: Record<string, string> = {
  "Boid count":
    "Number of simulated agents. Higher values increase density and GPU/CPU load.",
  "Flock count":
    "Number of distinct, evenly balanced flocks. Each flock is rendered with its own color.",
  "Perception radius":
    "Distance within which each boid can sense and react to neighbors.",
  "World radius":
    "Radius of the invisible containment sphere around the flock.",
  Separation:
    "Strength of collision avoidance between nearby boids within the same flock.",
  "Flock avoidance":
    "Cross-flock repulsion strength that keeps separate flocks from mixing.",
  Alignment:
    "Strength with which boids match the direction of nearby neighbors.",
  Cohesion: "Strength pulling each boid toward the local flock center.",
  "Maximum speed": "Top travel speed allowed for any boid.",
  "Steering force": "Maximum rate at which a boid can change direction.",
  Turbulence: "Procedural noise that adds organic, unpredictable motion.",
  "Pointer force": "Strength of the attract or repel field under the pointer.",
  "Temporal flow": "Global simulation speed without changing flock tuning.",
  "Boid scale": "Physical display size of each rendered boid.",
  "Emissive glow": "Brightness of the boid and trail shader cores.",
  "Spectral bloom":
    "Adds shader-level spectral intensity without the unstable HDR feedback pass.",
  "Motion persistence": "Extends and strengthens trails to emphasize motion.",
  "Trail length": "Number of recent simulation frames retained in each trail.",
  "Trail width": "World-space thickness of each tapered photon trail.",
  "Trail opacity": "Visibility of the velocity-reactive trail ribbons.",
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const help = CONTROL_HELP[label];
  return (
    <label className="control-slider" title={help}>
      <span className="control-slider__meta">
        <span className="control-label">
          {label}
          {help ? <HelpCircle size={11} aria-hidden="true" /> : null}
        </span>
        <output>
          {display ? display(value) : value.toFixed(step < 1 ? 2 : 0)}
        </output>
      </span>
      <span className="control-slider__track">
        <span
          className="control-slider__fill"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          title={help}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
    </label>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <button
      className="control-toggle"
      type="button"
      role="switch"
      aria-checked={checked}
      title={`${label}: ${description}`}
      onClick={() => onChange(!checked)}
    >
      <span>
        <span className="control-toggle__label">{label}</span>
        <span className="control-toggle__description">{description}</span>
      </span>
      <span
        className={`switch ${checked ? "switch--active" : ""}`}
        aria-hidden="true"
      >
        <span />
      </span>
    </button>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
  detail?: string;
  help?: string;
}

interface OptionGridProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

function OptionGrid<T extends string>({
  label,
  value,
  options,
  onChange,
}: OptionGridProps<T>) {
  return (
    <fieldset className="option-fieldset">
      <legend>{label}</legend>
      <div className="option-grid">
        {options.map((option) => (
          <button
            key={option.value}
            className={`option-chip ${value === option.value ? "option-chip--active" : ""}`}
            type="button"
            aria-pressed={value === option.value}
            title={option.help ?? option.detail}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {option.detail ? <small>{option.detail}</small> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const TABS: readonly { id: TabId; label: string; icon: typeof Waypoints }[] = [
  { id: "flock", label: "Flock", icon: Waypoints },
  { id: "visual", label: "Visual", icon: Palette },
  { id: "world", label: "World", icon: Box },
];

const CAMERA_OPTIONS = (
  Object.entries(CAMERA_LABELS) as [CameraMode, string][]
).map(([value, label]) => ({
  value,
  label,
  help: {
    orbit: "Manual orbit and zoom around the flock center.",
    follow: "Track the lead boid from a damped pursuit camera.",
    cinematic: "Automated sweeping camera designed for dramatic views.",
    top: "Fixed overhead view of the entire containment field.",
  }[value],
}));
const ENVIRONMENT_OPTIONS = (
  Object.entries(ENVIRONMENT_LABELS) as [EnvironmentMode, string][]
).map(([value, label]) => ({
  value,
  label,
  help: {
    "deep-space": "Dark stellar volume with subtle nebula lighting.",
    "solar-storm": "Hot, high-energy plasma environment.",
    aurora: "Cool luminous curtains surrounding the flock.",
    "neon-grid": "Geometric reference grid for precise observation.",
  }[value],
}));

export function ControlPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("flock");
  const [configStatus, setConfigStatus] = useState<string>("");
  const configInputRef = useRef<HTMLInputElement>(null);
  const simulation = useSimulatorStore((state) => state.simulation);
  const visual = useSimulatorStore((state) => state.visual);
  const cameraMode = useSimulatorStore((state) => state.cameraMode);
  const environment = useSimulatorStore((state) => state.environment);
  const pointerMode = useSimulatorStore((state) => state.pointerMode);
  const timeScale = useSimulatorStore((state) => state.timeScale);
  const setSimulation = useSimulatorStore((state) => state.setSimulation);
  const setVisual = useSimulatorStore((state) => state.setVisual);
  const setCameraMode = useSimulatorStore((state) => state.setCameraMode);
  const setEnvironment = useSimulatorStore((state) => state.setEnvironment);
  const setPointerMode = useSimulatorStore((state) => state.setPointerMode);
  const setTimeScale = useSimulatorStore((state) => state.setTimeScale);
  const applyConfiguration = useSimulatorStore(
    (state) => state.applyConfiguration,
  );

  const exportConfiguration = () => {
    const configuration = createSimulatorConfiguration(
      useSimulatorStore.getState(),
    );
    const blob = new Blob([JSON.stringify(configuration, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aeris-config-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setConfigStatus("Configuration exported");
  };

  const importConfiguration = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const configuration = parseSimulatorConfiguration(
        JSON.parse(await file.text()),
      );
      if (!configuration) throw new Error("Invalid configuration");
      applyConfiguration(configuration);
      setConfigStatus("Configuration imported");
    } catch {
      setConfigStatus("Import failed — choose a valid AERIS config");
    }
  };

  const simulationSlider = (
    key: SimulationNumericKey,
    label: string,
    min: number,
    max: number,
    step: number,
    display?: (value: number) => string,
  ) => (
    <Slider
      label={label}
      value={simulation[key]}
      min={min}
      max={max}
      step={step}
      display={display}
      onChange={(value) => setSimulation({ [key]: value })}
    />
  );

  const visualSlider = (
    key:
      | "boidScale"
      | "trailLength"
      | "trailWidth"
      | "trailOpacity"
      | "glow"
      | "bloom"
      | "motionBlur",
    label: string,
    min: number,
    max: number,
    step: number,
    display?: (value: number) => string,
  ) => (
    <Slider
      label={label}
      value={visual[key]}
      min={min}
      max={max}
      step={step}
      display={display}
      onChange={(value) => setVisual({ [key]: value })}
    />
  );

  return (
    <aside
      className="control-panel glass-panel"
      aria-label="Simulation controls"
    >
      <div className="control-panel__header">
        <div>
          <span className="section-kicker">Dynamics console</span>
          <h2>Flight controls</h2>
        </div>
        <div className="config-actions">
          <button
            type="button"
            aria-label="Export configuration"
            title="Export all current simulation settings as JSON"
            onClick={exportConfiguration}
          >
            <Download size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Import configuration"
            title="Import simulation settings from an AERIS JSON file"
            onClick={() => configInputRef.current?.click()}
          >
            <Upload size={15} aria-hidden="true" />
          </button>
          <SlidersHorizontal size={17} strokeWidth={1.5} aria-hidden="true" />
          <input
            ref={configInputRef}
            className="visually-hidden"
            type="file"
            aria-label="Configuration file"
            accept="application/json,.json"
            onChange={(event) => void importConfiguration(event)}
          />
        </div>
      </div>

      <div className="config-status" role="status" aria-live="polite">
        {configStatus || "\u00a0"}
      </div>

      <div className="control-tabs" role="tablist" aria-label="Control groups">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            className={
              activeTab === id
                ? "control-tab control-tab--active"
                : "control-tab"
            }
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={14} strokeWidth={1.7} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="control-panel__scroll">
        {activeTab === "flock" ? (
          <div
            className="control-group"
            id="panel-flock"
            role="tabpanel"
            aria-labelledby="tab-flock"
          >
            <div className="control-section-heading">
              <CircleDot size={14} aria-hidden="true" />
              <span>Population</span>
            </div>
            {simulationSlider("count", "Boid count", 120, 2400, 20, (value) =>
              value.toLocaleString(),
            )}
            {simulationSlider("flockCount", "Flock count", 1, 8, 1)}
            <Toggle
              label="Predator"
              description="Hunts one boid at a time; nearby boids boost to escape"
              checked={simulation.predatorEnabled}
              onChange={(predatorEnabled) => setSimulation({ predatorEnabled })}
            />
            {simulationSlider(
              "perceptionRadius",
              "Perception radius",
              1.5,
              10,
              0.1,
              (value) => `${value.toFixed(1)} m`,
            )}
            {simulationSlider(
              "boundaryRadius",
              "World radius",
              12,
              40,
              1,
              (value) => `${value.toFixed(0)} m`,
            )}

            <div className="control-section-heading control-section-heading--spaced">
              <Waypoints size={14} aria-hidden="true" />
              <span>Emergent forces</span>
            </div>
            {simulationSlider("separation", "Separation", 0, 3, 0.01)}
            {simulationSlider("flockAvoidance", "Flock avoidance", 0, 3, 0.01)}
            {simulationSlider("alignment", "Alignment", 0, 3, 0.01)}
            {simulationSlider("cohesion", "Cohesion", 0, 3, 0.01)}
            {simulationSlider(
              "maxSpeed",
              "Maximum speed",
              2,
              18,
              0.1,
              (value) => `${value.toFixed(1)} m/s`,
            )}
            {simulationSlider("maxForce", "Steering force", 0.1, 3, 0.01)}
            {simulationSlider("turbulence", "Turbulence", 0, 1, 0.01)}
            {simulationSlider("pointerForce", "Pointer force", 0, 5, 0.05)}
            <Slider
              label="Temporal flow"
              value={timeScale}
              min={0.1}
              max={2}
              step={0.05}
              display={(value) => `${value.toFixed(2)}×`}
              onChange={setTimeScale}
            />
          </div>
        ) : null}

        {activeTab === "visual" ? (
          <div
            className="control-group"
            id="panel-visual"
            role="tabpanel"
            aria-labelledby="tab-visual"
          >
            <div className="control-section-heading">
              <Sparkles size={14} aria-hidden="true" />
              <span>Light synthesis</span>
            </div>
            {visualSlider("boidScale", "Boid scale", 0.3, 1.5, 0.01)}
            {visualSlider("glow", "Emissive glow", 0, 2.5, 0.01)}
            {visualSlider("bloom", "Spectral bloom", 0, 2, 0.01)}
            {visualSlider("motionBlur", "Motion persistence", 0, 0.75, 0.01)}
            {visualSlider(
              "trailLength",
              "Trail length",
              0,
              80,
              1,
              (value) => `${value.toFixed(0)} frames`,
            )}
            {visualSlider(
              "trailWidth",
              "Trail width",
              0.04,
              0.3,
              0.01,
              (value) => `${value.toFixed(2)} m`,
            )}
            {visualSlider(
              "trailOpacity",
              "Trail opacity",
              0,
              1,
              0.01,
              (value) => `${Math.round(value * 100)}%`,
            )}
            <Toggle
              label="Photon trails"
              description="Velocity-reactive ribbons"
              checked={visual.showTrails}
              onChange={(showTrails) => setVisual({ showTrails })}
            />
            <Toggle
              label="Proximity field"
              description="Reveal local flock links"
              checked={visual.showConnections}
              onChange={(showConnections) => setVisual({ showConnections })}
            />
            <OptionGrid<ColorTheme>
              label="Spectral profile"
              value={visual.colorTheme}
              onChange={(colorTheme) => setVisual({ colorTheme })}
              options={[
                { value: "spectral", label: "Spectral" },
                { value: "aurora", label: "Aurora" },
                { value: "solar", label: "Solar" },
                { value: "monochrome", label: "Mono" },
              ]}
            />
            <OptionGrid<QualityMode>
              label="Render budget"
              value={visual.quality}
              onChange={(quality) => setVisual({ quality })}
              options={[
                { value: "performance", label: "Performance", detail: "Fast" },
                { value: "balanced", label: "Balanced", detail: "Adaptive" },
                { value: "cinematic", label: "Cinematic", detail: "Ultra" },
              ]}
            />
          </div>
        ) : null}

        {activeTab === "world" ? (
          <div
            className="control-group"
            id="panel-world"
            role="tabpanel"
            aria-labelledby="tab-world"
          >
            <div className="control-section-heading">
              <Aperture size={14} aria-hidden="true" />
              <span>Observation rig</span>
            </div>
            <OptionGrid<CameraMode>
              label="Camera mode"
              value={cameraMode}
              options={CAMERA_OPTIONS}
              onChange={setCameraMode}
            />
            <OptionGrid<EnvironmentMode>
              label="Environment"
              value={environment}
              options={ENVIRONMENT_OPTIONS}
              onChange={setEnvironment}
            />
            <div className="control-section-heading control-section-heading--spaced">
              <MousePointer2 size={14} aria-hidden="true" />
              <span>Pointer field</span>
            </div>
            <OptionGrid<PointerMode>
              label="Pointer behavior"
              value={pointerMode}
              onChange={setPointerMode}
              options={[
                { value: "attract", label: "Attract", detail: "Gather" },
                { value: "repel", label: "Repel", detail: "Scatter" },
                { value: "off", label: "Disabled", detail: "Observe" },
              ]}
            />
            <div className="gesture-note">
              <MousePointer2 size={15} aria-hidden="true" />
              <span>
                Move over the field to influence local flock motion. Drag to
                orbit in orbital mode.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="control-panel__footer">
        <span>H</span>
        <p>Hide console</p>
        <ChevronDown size={14} aria-hidden="true" />
      </div>
    </aside>
  );
}
