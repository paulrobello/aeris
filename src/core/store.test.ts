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
});
