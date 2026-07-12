"use client";

import {
  Aperture,
  Atom,
  Orbit,
  Save,
  SlidersHorizontal,
  SunMedium,
} from "lucide-react";

import { FLIGHT_PROGRAMS } from "@/src/core/defaults";
import { useSimulatorStore } from "@/src/core/store";
import type { PresetId } from "@/src/core/types";

const PRESET_ICONS = {
  murmuration: Aperture,
  singularity: Atom,
  "solar-drift": SunMedium,
  zenith: Orbit,
  user: SlidersHorizontal,
} satisfies Record<
  PresetId,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
>;

export function PresetRail() {
  const activePreset = useSimulatorStore((state) => state.activePreset);
  const userProgram = useSimulatorStore((state) => state.userProgram);
  const applyPreset = useSimulatorStore((state) => state.applyPreset);
  const saveUserProgram = useSimulatorStore((state) => state.saveUserProgram);

  return (
    <nav className="preset-rail glass-panel" aria-label="Simulation presets">
      <div className="preset-rail__heading">
        <span>Flight programs</span>
        <span className="preset-rail__index">05</span>
      </div>
      <div className="preset-rail__list">
        {FLIGHT_PROGRAMS.map((preset, index) => {
          const Icon = PRESET_ICONS[preset.id];
          const isActive = activePreset === preset.id;
          const isUser = preset.id === "user";
          const eyebrow = isUser
            ? userProgram
              ? "Custom / Saved"
              : "Custom / Empty"
            : preset.eyebrow;
          const description = isUser
            ? userProgram
              ? "Local snapshot ready. Select to restore or save to overwrite."
              : "Tune any controls, then save the current state to this slot."
            : preset.description;
          return (
            <div
              key={preset.id}
              className={`preset-card-slot ${isUser ? "preset-card-slot--user" : ""}`}
            >
              <button
                className={`preset-card ${isActive ? "preset-card--active" : ""} ${isUser ? "preset-card--user" : ""}`}
                type="button"
                aria-pressed={isActive}
                onClick={() => applyPreset(preset.id)}
              >
                <span className="preset-card__number">0{index + 1}</span>
                <span className="preset-card__icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.45} />
                </span>
                <span className="preset-card__body">
                  <span className="preset-card__eyebrow">{eyebrow}</span>
                  <span className="preset-card__name">{preset.name}</span>
                  <span className="preset-card__description">
                    {description}
                  </span>
                </span>
                <span className="preset-card__signal" aria-hidden="true" />
              </button>
              {isUser ? (
                <button
                  className="preset-card__save"
                  type="button"
                  aria-label={
                    userProgram
                      ? "Overwrite User flight program"
                      : "Save current settings to User flight program"
                  }
                  title="Save current tuning to the User flight program"
                  onClick={saveUserProgram}
                >
                  <Save size={11} aria-hidden="true" />
                  <span>Save</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
