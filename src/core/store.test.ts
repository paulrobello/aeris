import { describe, expect, it } from "vitest";

import {
  createSimulatorConfiguration,
  parseSimulatorConfiguration,
  useSimulatorStore,
} from "./store";

describe("simulator configuration", () => {
  it("round-trips the current tunable state", () => {
    const configuration = createSimulatorConfiguration(
      useSimulatorStore.getState(),
    );

    expect(
      parseSimulatorConfiguration(
        JSON.parse(JSON.stringify(configuration)) as unknown,
      ),
    ).toEqual(configuration);
  });

  it("rejects malformed files and clamps imported boid counts", () => {
    expect(parseSimulatorConfiguration({ version: 1 })).toBeNull();

    const configuration = createSimulatorConfiguration(
      useSimulatorStore.getState(),
    );
    expect(
      parseSimulatorConfiguration({
        ...configuration,
        simulation: { ...configuration.simulation, count: 99_999 },
      })?.simulation.count,
    ).toBe(2400);
  });

  it("migrates legacy configurations with default flock settings", () => {
    const configuration = JSON.parse(
      JSON.stringify(
        createSimulatorConfiguration(useSimulatorStore.getState()),
      ),
    ) as { simulation: Record<string, unknown> };
    delete configuration.simulation.flockCount;
    delete configuration.simulation.flockAvoidance;

    expect(
      parseSimulatorConfiguration(configuration)?.simulation,
    ).toMatchObject({
      flockCount: 1,
      flockAvoidance: 1,
    });
  });

  it("clamps flock settings and rejects malformed explicit values", () => {
    const configuration = createSimulatorConfiguration(
      useSimulatorStore.getState(),
    );

    expect(
      parseSimulatorConfiguration({
        ...configuration,
        simulation: {
          ...configuration.simulation,
          flockCount: 99,
          flockAvoidance: -1,
        },
      })?.simulation,
    ).toMatchObject({ flockCount: 8, flockAvoidance: 0 });
    expect(
      parseSimulatorConfiguration({
        ...configuration,
        simulation: {
          ...configuration.simulation,
          flockCount: null,
        },
      }),
    ).toBeNull();
    expect(
      parseSimulatorConfiguration({
        ...configuration,
        simulation: {
          ...configuration.simulation,
          flockAvoidance: "high",
        },
      }),
    ).toBeNull();
  });

  it("reseeds for population or flock-count changes only", () => {
    const original = createSimulatorConfiguration(useSimulatorStore.getState());
    const initialResetToken = useSimulatorStore.getState().resetToken;

    useSimulatorStore.getState().setSimulation({ separation: 2 });
    expect(useSimulatorStore.getState().resetToken).toBe(initialResetToken);

    useSimulatorStore.getState().setSimulation({ flockCount: 2 });
    expect(useSimulatorStore.getState().resetToken).toBe(initialResetToken + 1);

    useSimulatorStore.getState().setSimulation({ count: 800 });
    expect(useSimulatorStore.getState().resetToken).toBe(initialResetToken + 2);

    useSimulatorStore.getState().applyConfiguration(original);
  });

  it("applies imported settings and reseeds the simulation", () => {
    const store = useSimulatorStore.getState();
    const original = createSimulatorConfiguration(store);
    const resetToken = store.resetToken;
    const imported = {
      ...original,
      simulation: { ...original.simulation, count: 1800 },
      timeScale: 1.5,
    };

    store.applyConfiguration(imported);
    expect(useSimulatorStore.getState()).toMatchObject({
      simulation: expect.objectContaining({ count: 1800 }),
      timeScale: 1.5,
      resetToken: resetToken + 1,
    });

    useSimulatorStore.getState().applyConfiguration(original);
  });

  it("saves and restores an independent User flight program", () => {
    const store = useSimulatorStore.getState();
    const original = createSimulatorConfiguration(store);
    const originalUserProgram = store.userProgram;
    store.applyConfiguration({
      ...original,
      simulation: { ...original.simulation, count: 1740, cohesion: 1.23 },
      visual: { ...original.visual, trailWidth: 0.21 },
      cameraMode: "follow",
      environment: "aurora",
    });

    useSimulatorStore.getState().saveUserProgram();
    expect(useSimulatorStore.getState()).toMatchObject({
      activePreset: "user",
      userProgram: {
        activePreset: "user",
        simulation: expect.objectContaining({ count: 1740, cohesion: 1.23 }),
        visual: expect.objectContaining({ trailWidth: 0.21 }),
        cameraMode: "follow",
        environment: "aurora",
      },
    });

    useSimulatorStore.getState().applyPreset("murmuration");
    useSimulatorStore.getState().applyPreset("user");
    expect(useSimulatorStore.getState()).toMatchObject({
      activePreset: "user",
      simulation: expect.objectContaining({ count: 1740, cohesion: 1.23 }),
      visual: expect.objectContaining({ trailWidth: 0.21 }),
      cameraMode: "follow",
      environment: "aurora",
    });

    useSimulatorStore.getState().setUserProgram(originalUserProgram);
    useSimulatorStore.getState().applyConfiguration(original);
  });
});
