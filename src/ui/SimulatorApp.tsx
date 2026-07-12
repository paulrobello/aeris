"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Maximize2,
  Menu,
  Pause,
  Play,
  RefreshCw,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";

import { useSimulatorStore } from "@/src/core/store";
import { BoidExperience } from "@/src/scene/BoidExperience";
import { ControlPanel } from "@/src/ui/ControlPanel";
import { PresetRail } from "@/src/ui/PresetRail";
import { Telemetry } from "@/src/ui/Telemetry";

declare global {
  interface Window {
    __aerisAdvanceTime?: (milliseconds: number) => void;
    __aerisSceneState?: Record<string, unknown>;
    advanceTime?: (milliseconds: number) => void;
    render_game_to_text?: () => string;
  }
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await document.documentElement.requestFullscreen();
}

export function SimulatorApp() {
  const paused = useSimulatorStore((state) => state.paused);
  const cinemaMode = useSimulatorStore((state) => state.cinemaMode);
  const controlsOpen = useSimulatorStore((state) => state.controlsOpen);
  const environment = useSimulatorStore((state) => state.environment);
  const pointerMode = useSimulatorStore((state) => state.pointerMode);
  const setPaused = useSimulatorStore((state) => state.setPaused);
  const setCinemaMode = useSimulatorStore((state) => state.setCinemaMode);
  const setControlsOpen = useSimulatorStore((state) => state.setControlsOpen);
  const reseed = useSimulatorStore((state) => state.reseed);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setControlsOpen(false);
    }
  }, [setControlsOpen]);

  useEffect(() => {
    const handleFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, [contenteditable='true']"))
        return;

      if (event.code === "Space") {
        event.preventDefault();
        const state = useSimulatorStore.getState();
        state.setPaused(!state.paused);
      } else if (event.key.toLowerCase() === "r") {
        useSimulatorStore.getState().reseed();
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      } else if (event.key.toLowerCase() === "c") {
        const state = useSimulatorStore.getState();
        state.setCinemaMode(!state.cinemaMode);
      } else if (event.key.toLowerCase() === "h") {
        const state = useSimulatorStore.getState();
        state.setControlsOpen(!state.controlsOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, []);

  useEffect(() => {
    window.render_game_to_text = () => {
      const state = useSimulatorStore.getState();
      return JSON.stringify({
        mode: state.paused ? "paused" : "running",
        coordinateSystem: "right-handed; +Y up; origin at flock volume center",
        simulation: state.simulation,
        visual: state.visual,
        cameraMode: state.cameraMode,
        environment: state.environment,
        pointerMode: state.pointerMode,
        activePreset: state.activePreset,
        cinemaMode: state.cinemaMode,
        controlsOpen: state.controlsOpen,
        timeScale: state.timeScale,
        resetToken: state.resetToken,
        stats: state.stats,
        scene: window.__aerisSceneState ?? null,
      });
    };
    window.advanceTime = (milliseconds: number) =>
      window.__aerisAdvanceTime?.(milliseconds);

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, []);

  return (
    <main
      className={`simulator-shell ${cinemaMode ? "simulator-shell--cinema" : ""} ${
        controlsOpen
          ? "simulator-shell--controls-open"
          : "simulator-shell--controls-closed"
      }`}
    >
      <div
        className="scene-viewport"
        aria-label="Three-dimensional boid simulation"
      >
        <BoidExperience />
      </div>
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-grain" aria-hidden="true" />
      <div className="scene-reticle" aria-hidden="true">
        <span />
      </div>

      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={17} strokeWidth={1.4} />
          </span>
          <div>
            <h1 className="brand-name">AERIS</h1>
            <div className="brand-subtitle">Flock dynamics laboratory</div>
          </div>
        </div>

        <div
          className="environment-readout"
          aria-label={`Active environment: ${environment}`}
        >
          <span className="environment-readout__line" />
          <span>Sector 07</span>
          <strong>{environment.replaceAll("-", " ")}</strong>
          <span className="environment-readout__line" />
        </div>

        <div className="header-actions">
          <div className="pointer-badge" title="Pointer interaction mode">
            <ScanLine size={13} aria-hidden="true" />
            <span>{pointerMode}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={paused ? "Resume simulation" : "Pause simulation"}
            title={`${paused ? "Resume" : "Pause"} (Space)`}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Reseed simulation"
            title="Reseed (R)"
            onClick={reseed}
          >
            <RefreshCw size={16} />
          </button>
          <button
            className={`icon-button ${cinemaMode ? "icon-button--active" : ""}`}
            type="button"
            aria-label={cinemaMode ? "Exit cinema mode" : "Enter cinema mode"}
            aria-pressed={cinemaMode}
            title="Cinema mode (C)"
            onClick={() => setCinemaMode(!cinemaMode)}
          >
            {cinemaMode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className={`icon-button ${fullscreen ? "icon-button--active" : ""}`}
            type="button"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title="Fullscreen (F)"
            onClick={() => void toggleFullscreen()}
          >
            <Maximize2 size={16} />
          </button>
          <button
            className="icon-button icon-button--menu"
            type="button"
            aria-label={controlsOpen ? "Close controls" : "Open controls"}
            aria-expanded={controlsOpen}
            title="Toggle controls (H)"
            onClick={() => setControlsOpen(!controlsOpen)}
          >
            {controlsOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </header>

      <div className="simulation-title" aria-hidden="true">
        <span>Realtime study</span>
        <strong>
          Emergent
          <br />
          intelligence
        </strong>
      </div>

      <PresetRail />
      <div
        className="controls-scrim"
        onClick={() => setControlsOpen(false)}
        aria-hidden="true"
      />
      <ControlPanel />
      <Telemetry />

      <div className="shortcut-strip" aria-label="Keyboard shortcuts">
        <span>
          <kbd>Space</kbd> pause
        </span>
        <span>
          <kbd>R</kbd> reseed
        </span>
        <span>
          <kbd>C</kbd> cinema
        </span>
        <span>
          <kbd>F</kbd> fullscreen
        </span>
        <span>
          <kbd>H</kbd> controls
        </span>
      </div>

      {paused ? (
        <div className="pause-indicator" role="status">
          <span className="pause-indicator__line" />
          <span>Temporal field suspended</span>
          <button type="button" onClick={() => setPaused(false)}>
            Resume
          </button>
        </div>
      ) : null}
    </main>
  );
}
