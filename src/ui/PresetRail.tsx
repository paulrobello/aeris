"use client";

import { Aperture, Atom, Orbit, SunMedium } from "lucide-react";

import { PRESETS } from "@/src/core/defaults";
import { useSimulatorStore } from "@/src/core/store";
import type { PresetId } from "@/src/core/types";

const PRESET_ICONS = {
  murmuration: Aperture,
  singularity: Atom,
  "solar-drift": SunMedium,
  zenith: Orbit,
} satisfies Record<
  PresetId,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
>;

export function PresetRail() {
  const activePreset = useSimulatorStore((state) => state.activePreset);
  const applyPreset = useSimulatorStore((state) => state.applyPreset);

  return (
    <nav className="preset-rail glass-panel" aria-label="Simulation presets">
      <div className="preset-rail__heading">
        <span>Flight programs</span>
        <span className="preset-rail__index">04</span>
      </div>
      <div className="preset-rail__list">
        {Object.values(PRESETS).map((preset, index) => {
          const Icon = PRESET_ICONS[preset.id];
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              className={`preset-card ${isActive ? "preset-card--active" : ""}`}
              type="button"
              aria-pressed={isActive}
              onClick={() => applyPreset(preset.id)}
            >
              <span className="preset-card__number">0{index + 1}</span>
              <span className="preset-card__icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.45} />
              </span>
              <span className="preset-card__body">
                <span className="preset-card__eyebrow">{preset.eyebrow}</span>
                <span className="preset-card__name">{preset.name}</span>
                <span className="preset-card__description">
                  {preset.description}
                </span>
              </span>
              <span className="preset-card__signal" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
