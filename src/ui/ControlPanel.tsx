"use client";

import { useState } from "react";
import {
  Aperture,
  Box,
  ChevronDown,
  CircleDot,
  MousePointer2,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { CAMERA_LABELS, ENVIRONMENT_LABELS } from "@/src/core/defaults";
import { useSimulatorStore } from "@/src/core/store";
import type {
  CameraMode,
  ColorTheme,
  EnvironmentMode,
  PointerMode,
  QualityMode,
  SimulationConfig,
} from "@/src/core/types";

type TabId = "flock" | "visual" | "world";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: (value: number) => string;
}

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
  return (
    <label className="control-slider">
      <span className="control-slider__meta">
        <span>{label}</span>
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
).map(([value, label]) => ({ value, label }));
const ENVIRONMENT_OPTIONS = (
  Object.entries(ENVIRONMENT_LABELS) as [EnvironmentMode, string][]
).map(([value, label]) => ({ value, label }));

export function ControlPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("flock");
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

  const simulationSlider = (
    key: keyof SimulationConfig,
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
        <SlidersHorizontal size={17} strokeWidth={1.5} aria-hidden="true" />
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
            {simulationSlider("count", "Boid count", 120, 1200, 20, (value) =>
              value.toLocaleString(),
            )}
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
