"use client";

import { Activity, Gauge, Radio, Waves } from "lucide-react";

import { useSimulatorStore } from "@/src/core/store";

interface MetricProps {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  unit?: string;
  tone?: "cyan" | "violet";
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  tone = "cyan",
}: MetricProps) {
  return (
    <div className="telemetry__metric">
      <span
        className={`telemetry__icon telemetry__icon--${tone}`}
        aria-hidden="true"
      >
        <Icon size={13} strokeWidth={1.8} />
      </span>
      <span className="telemetry__copy">
        <span className="telemetry__label">{label}</span>
        <span className="telemetry__value">
          {value}
          {unit ? <span className="telemetry__unit">{unit}</span> : null}
        </span>
      </span>
    </div>
  );
}

export function Telemetry() {
  const stats = useSimulatorStore((state) => state.stats);
  const paused = useSimulatorStore((state) => state.paused);

  return (
    <section
      className="telemetry glass-panel"
      aria-label="Live simulation telemetry"
    >
      <div className="telemetry__status">
        <span
          className={`status-pulse ${paused ? "status-pulse--paused" : ""}`}
        />
        <span>{paused ? "Simulation held" : "Telemetry live"}</span>
      </div>
      <div className="telemetry__metrics">
        <Metric
          icon={Activity}
          label="Frame rate"
          value={Math.round(stats.fps).toString()}
          unit="fps"
        />
        <Metric
          icon={Radio}
          label="Agents"
          value={stats.visibleBoids.toLocaleString()}
        />
        <Metric
          icon={Gauge}
          label="Mean velocity"
          value={stats.averageSpeed.toFixed(1)}
          unit="m/s"
          tone="violet"
        />
        <Metric
          icon={Waves}
          label="Coherence"
          value={`${Math.round(stats.coherence * 100)}`}
          unit="%"
          tone="violet"
        />
      </div>
    </section>
  );
}
