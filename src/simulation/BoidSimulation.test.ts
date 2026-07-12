import { describe, expect, it } from "vitest";
import type { SimulationConfig } from "../core/types";
import { BoidSimulation } from "./BoidSimulation";
import { SpatialHash } from "./SpatialHash";

const BASE_CONFIG: SimulationConfig = {
  count: 96,
  separation: 1.2,
  alignment: 1,
  cohesion: 0.8,
  perceptionRadius: 5,
  maxSpeed: 8,
  maxForce: 1.4,
  boundaryRadius: 20,
  turbulence: 0.1,
  pointerForce: 2,
};

function runSteps(simulation: BoidSimulation, count: number): void {
  for (let index = 0; index < count; index += 1) {
    simulation.step(1 / 60);
  }
}

function meanRadialVelocity(simulation: BoidSimulation): number {
  const { positions, velocities, count } = simulation.getSnapshot();
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const px = positions[offset];
    const py = positions[offset + 1];
    const pz = positions[offset + 2];
    const distance = Math.sqrt(px * px + py * py + pz * pz);
    if (distance === 0) continue;
    total +=
      (velocities[offset] * px +
        velocities[offset + 1] * py +
        velocities[offset + 2] * pz) /
      distance;
  }
  return total / count;
}

describe("BoidSimulation", () => {
  it("keeps distinct cells separate when their numeric hashes collide", () => {
    const hash = new SpatialHash(1);
    const positions = new Float32Array([
      -127.5, -0.5, 127.5, -127.5, 1.5, -126.5,
    ]);

    hash.rebuild(positions, 2);

    expect(hash.query(-127.5, -0.5, 127.5, 0.1, [])).toEqual([0]);
    expect(hash.query(-127.5, 1.5, -126.5, 0.1, [])).toEqual([1]);
  });

  it("produces deterministic initialization and stepping for a seed", () => {
    const first = new BoidSimulation(BASE_CONFIG, 42);
    const second = new BoidSimulation(BASE_CONFIG, 42);

    for (let index = 0; index < 120; index += 1) {
      const interaction: {
        point: [number, number, number];
        mode: "attract";
      } | null = index > 40 ? { point: [2, -1, 3], mode: "attract" } : null;
      first.step(1 / 60, interaction);
      second.step(1 / 60, interaction);
    }

    expect(first.getSnapshot().positions).toEqual(
      second.getSnapshot().positions,
    );
    expect(first.getSnapshot().velocities).toEqual(
      second.getSnapshot().velocities,
    );
    expect(first.getSnapshot().coherence).toBe(second.getSnapshot().coherence);
  });

  it("keeps every value finite, speed limited, and position inside the sphere", () => {
    const simulation = new BoidSimulation(
      { ...BASE_CONFIG, boundaryRadius: 4, maxSpeed: 12, turbulence: 4 },
      17,
    );

    for (let index = 0; index < 300; index += 1) {
      simulation.step(index % 3 === 0 ? 10 : 1 / 30, {
        point: [100, -100, 50],
        mode: index % 2 === 0 ? "attract" : "repel",
      });
    }

    const snapshot = simulation.getSnapshot();
    for (let index = 0; index < snapshot.count; index += 1) {
      const offset = index * 3;
      const x = snapshot.positions[offset];
      const y = snapshot.positions[offset + 1];
      const z = snapshot.positions[offset + 2];
      const vx = snapshot.velocities[offset];
      const vy = snapshot.velocities[offset + 1];
      const vz = snapshot.velocities[offset + 2];
      expect([x, y, z, vx, vy, vz].every(Number.isFinite)).toBe(true);
      expect(Math.sqrt(x * x + y * y + z * z)).toBeLessThanOrEqual(4);
      expect(Math.sqrt(vx * vx + vy * vy + vz * vz)).toBeLessThanOrEqual(
        12.000_01,
      );
    }
    expect(snapshot.averageSpeed).toBeGreaterThanOrEqual(0);
    expect(snapshot.coherence).toBeGreaterThanOrEqual(0);
    expect(snapshot.coherence).toBeLessThanOrEqual(1);
  });

  it("responds measurably to alignment and cohesion parameters", () => {
    const loose = new BoidSimulation(
      {
        ...BASE_CONFIG,
        separation: 0,
        alignment: 0,
        cohesion: 0,
        turbulence: 0,
        perceptionRadius: 40,
      },
      2026,
    );
    const flocking = new BoidSimulation(
      {
        ...BASE_CONFIG,
        separation: 0,
        alignment: 3,
        cohesion: 1.5,
        turbulence: 0,
        perceptionRadius: 40,
      },
      2026,
    );

    runSteps(loose, 360);
    runSteps(flocking, 360);

    expect(flocking.getSnapshot().coherence).toBeGreaterThan(
      loose.getSnapshot().coherence + 0.15,
    );
  });

  it("pulls toward and pushes away from an interaction point", () => {
    const config: SimulationConfig = {
      ...BASE_CONFIG,
      separation: 0,
      alignment: 0,
      cohesion: 0,
      turbulence: 0,
      pointerForce: 8,
      boundaryRadius: 40,
    };
    const attract = new BoidSimulation(config, 91);
    const repel = new BoidSimulation(config, 91);

    for (let index = 0; index < 120; index += 1) {
      attract.step(1 / 60, { point: [0, 0, 0], mode: "attract" });
      repel.step(1 / 60, { point: [0, 0, 0], mode: "repel" });
    }

    expect(meanRadialVelocity(attract)).toBeLessThan(meanRadialVelocity(repel));
    expect(
      meanRadialVelocity(repel) - meanRadialVelocity(attract),
    ).toBeGreaterThan(1);
  });

  it("preserves state while reconfiguring and reuses arrays on same-size reset", () => {
    const simulation = new BoidSimulation({ ...BASE_CONFIG, count: 12 }, 77);
    const initial = simulation.getSnapshot();
    const initialPositions = initial.positions;
    const initialVelocities = initial.velocities;

    simulation.reset(undefined, 77);
    expect(simulation.getSnapshot().positions).toBe(initialPositions);
    expect(simulation.getSnapshot().velocities).toBe(initialVelocities);

    const preservedPositions = Array.from(initialPositions);
    simulation.configure({ ...BASE_CONFIG, count: 20, maxSpeed: 0.5 });
    const resized = simulation.getSnapshot();
    expect(resized.count).toBe(20);
    expect(resized.positions).not.toBe(initialPositions);
    expect(Array.from(resized.positions.subarray(0, 12 * 3))).toEqual(
      preservedPositions,
    );

    simulation.step(1 / 60);
    expect(simulation.getSnapshot().averageSpeed).toBeLessThanOrEqual(0.500_01);

    simulation.reset({ ...BASE_CONFIG, count: 20 }, 1234);
    const resetPositions = Array.from(simulation.getSnapshot().positions);
    simulation.reset(undefined, 1234);
    expect(Array.from(simulation.getSnapshot().positions)).toEqual(
      resetPositions,
    );
  });
});
