import type {
  BoidSnapshot,
  PointerMode,
  SimulationConfig,
} from "../core/types";
import { SeededRandom, normalizeSeed, turbulenceNoise } from "./noise";
import { SpatialHash } from "./SpatialHash";

const DEFAULT_SEED = 0xa3e15;
const MAX_DELTA_SECONDS = 1 / 20;
const MAX_BOIDS = 20_000;
const MAX_FLOCKS = 8;
const EPSILON = 1e-8;
const PREDATOR_SEED_SALT = 0x51f15e5d;
const PREDATOR_TARGET_SECONDS_MIN = 10;
const PREDATOR_TARGET_SECONDS_MAX = 30;
const PREDATOR_THREAT_RADIUS_MULTIPLIER = 1.6;
const PREDATOR_CATCH_RADIUS_MULTIPLIER = 0.12;
const PREDATOR_MIN_CATCH_RADIUS = 0.2;
const PREDATOR_SPEED_MULTIPLIER = 1.35;
const PREDATOR_FORCE_MULTIPLIER = 2.4;
const ESCAPE_SPEED_MULTIPLIER = 1.6;
const ESCAPE_FORCE_MULTIPLIER = 3;

type Interaction = {
  point: [number, number, number];
  mode: PointerMode;
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sanitizeConfig(config: SimulationConfig): SimulationConfig {
  return {
    count: clamp(Math.trunc(finiteOr(config.count, 0)), 0, MAX_BOIDS),
    flockCount: clamp(
      Math.trunc(finiteOr(config.flockCount, 1)),
      1,
      MAX_FLOCKS,
    ),
    flockAvoidance: clamp(finiteOr(config.flockAvoidance, 0), 0, 3),
    predatorEnabled: config.predatorEnabled === true,
    separation: clamp(finiteOr(config.separation, 0), 0, 10),
    alignment: clamp(finiteOr(config.alignment, 0), 0, 10),
    cohesion: clamp(finiteOr(config.cohesion, 0), 0, 10),
    perceptionRadius: clamp(finiteOr(config.perceptionRadius, 1), 0.05, 100),
    maxSpeed: clamp(finiteOr(config.maxSpeed, 0), 0, 100),
    maxForce: clamp(finiteOr(config.maxForce, 0), 0, 100),
    boundaryRadius: clamp(finiteOr(config.boundaryRadius, 1), 0.1, 10_000),
    turbulence: clamp(finiteOr(config.turbulence, 0), 0, 10),
    pointerForce: clamp(finiteOr(config.pointerForce, 0), 0, 100),
  };
}

function limitVector(
  x: number,
  y: number,
  z: number,
  maximum: number,
): [number, number, number] {
  const magnitudeSquared = x * x + y * y + z * z;
  const maximumSquared = maximum * maximum;
  if (magnitudeSquared <= maximumSquared || magnitudeSquared <= EPSILON) {
    return [x, y, z];
  }

  const scale = maximum / Math.sqrt(magnitudeSquared);
  return [x * scale, y * scale, z * scale];
}

export class BoidSimulation {
  private config: SimulationConfig;
  private seed: number;
  private elapsedSeconds = 0;
  private positions = new Float32Array();
  private velocities = new Float32Array();
  private accelerations = new Float32Array();
  private flockIds = new Uint16Array();
  private boostingBoids = new Uint8Array();
  private readonly predatorPosition = new Float32Array(3);
  private readonly predatorVelocity = new Float32Array(3);
  private readonly predatorAcceleration = new Float32Array(3);
  private predatorRandom: SeededRandom;
  private predatorTargetIndex = -1;
  private predatorTargetDeadlineSeconds = 0;
  private predatorCatchCount = 0;
  private readonly spatialHash: SpatialHash;
  private readonly neighborCandidates: number[] = [];
  private readonly steeringScratch = new Float64Array(3);
  private readonly snapshot: BoidSnapshot;

  constructor(config: SimulationConfig, seed = DEFAULT_SEED) {
    this.config = sanitizeConfig(config);
    this.seed = normalizeSeed(seed);
    this.predatorRandom = new SeededRandom(this.predatorSeed());
    this.spatialHash = new SpatialHash(this.config.perceptionRadius);
    this.snapshot = {
      positions: this.positions,
      velocities: this.velocities,
      flockIds: this.flockIds,
      boostingBoids: this.boostingBoids,
      predator: {
        active: false,
        position: this.predatorPosition,
        velocity: this.predatorVelocity,
        targetIndex: -1,
        targetSecondsRemaining: 0,
        catchCount: 0,
      },
      count: 0,
      boostingBoidCount: 0,
      averageSpeed: 0,
      coherence: 0,
    };
    this.reset();
  }

  configure(config: SimulationConfig): void {
    const nextConfig = sanitizeConfig(config);
    const previousCount = this.config.count;
    const previousFlockCount = this.config.flockCount;
    const previousPredatorEnabled = this.config.predatorEnabled;
    this.config = nextConfig;
    this.spatialHash.setCellSize(nextConfig.perceptionRadius);

    if (nextConfig.count !== previousCount) {
      this.resize(nextConfig.count);
    } else if (nextConfig.flockCount !== previousFlockCount) {
      this.assignFlocks();
    }

    this.boostingBoids.fill(0);
    this.constrainCurrentState();
    if (!nextConfig.predatorEnabled || nextConfig.count === 0) {
      this.deactivatePredator();
    } else if (!previousPredatorEnabled || previousCount === 0) {
      this.initializePredator();
    } else if (
      this.predatorTargetIndex < 0 ||
      this.predatorTargetIndex >= nextConfig.count
    ) {
      this.selectPredatorTarget(this.predatorTargetIndex);
    }
    this.constrainPredatorState();
    this.updateMetrics();
  }

  reset(config?: SimulationConfig, seed?: number): void {
    if (config !== undefined) {
      this.config = sanitizeConfig(config);
    }
    if (seed !== undefined) {
      this.seed = normalizeSeed(seed);
    }

    const requiredLength = this.config.count * 3;
    if (this.positions.length !== requiredLength) {
      this.positions = new Float32Array(requiredLength);
      this.velocities = new Float32Array(requiredLength);
      this.accelerations = new Float32Array(requiredLength);
      this.flockIds = new Uint16Array(this.config.count);
      this.boostingBoids = new Uint8Array(this.config.count);
      this.syncSnapshotArrays();
    }

    this.elapsedSeconds = 0;
    this.spatialHash.setCellSize(this.config.perceptionRadius);
    this.initializeRange(0, this.config.count, new SeededRandom(this.seed));
    this.assignFlocks();
    this.accelerations.fill(0);
    this.boostingBoids.fill(0);
    this.predatorRandom = new SeededRandom(this.predatorSeed());
    this.predatorCatchCount = 0;
    if (this.config.predatorEnabled && this.config.count > 0) {
      this.initializePredator(false);
    } else {
      this.deactivatePredator();
    }
    this.updateMetrics();
  }

  step(deltaSeconds: number, interaction?: Interaction | null): BoidSnapshot {
    const delta = clamp(finiteOr(deltaSeconds, 0), 0, MAX_DELTA_SECONDS);
    const count = this.config.count;
    if (delta <= 0 || count === 0) return this.snapshot;

    this.elapsedSeconds += delta;
    if (this.config.predatorEnabled) {
      this.preparePredatorTarget();
    }
    this.spatialHash.rebuild(this.positions, count);
    this.computeAccelerations(interaction);
    if (this.config.predatorEnabled) {
      this.computePredatorAcceleration();
    }

    const catchTargetIndex = this.config.predatorEnabled
      ? this.predatorTargetIndex
      : -1;
    const targetOffset = Math.max(0, catchTargetIndex * 3);
    const relativeStartX = this.config.predatorEnabled
      ? this.predatorPosition[0] - this.positions[targetOffset]
      : 0;
    const relativeStartY = this.config.predatorEnabled
      ? this.predatorPosition[1] - this.positions[targetOffset + 1]
      : 0;
    const relativeStartZ = this.config.predatorEnabled
      ? this.predatorPosition[2] - this.positions[targetOffset + 2]
      : 0;
    this.integrate(delta);
    if (this.config.predatorEnabled) {
      this.integratePredator(delta);
      if (
        this.didPredatorCatch(
          catchTargetIndex,
          relativeStartX,
          relativeStartY,
          relativeStartZ,
        )
      ) {
        this.predatorCatchCount += 1;
        this.selectPredatorTarget(catchTargetIndex);
      }
    }
    this.updateMetrics();
    return this.snapshot;
  }

  getSnapshot(): BoidSnapshot {
    return this.snapshot;
  }

  private resize(count: number): void {
    const oldPositions = this.positions;
    const oldVelocities = this.velocities;
    const oldCount = Math.min(oldPositions.length / 3, count);

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.accelerations = new Float32Array(count * 3);
    this.flockIds = new Uint16Array(count);
    this.boostingBoids = new Uint8Array(count);
    this.positions.set(oldPositions.subarray(0, oldCount * 3));
    this.velocities.set(oldVelocities.subarray(0, oldCount * 3));

    if (count > oldCount) {
      const growthSeed = normalizeSeed(
        this.seed ^ Math.imul(oldCount + 1, 0x9e3779b1),
      );
      this.initializeRange(oldCount, count, new SeededRandom(growthSeed));
    }

    this.assignFlocks();
    this.syncSnapshotArrays();
  }

  private assignFlocks(): void {
    for (let index = 0; index < this.config.count; index += 1) {
      this.flockIds[index] = index % this.config.flockCount;
    }
  }

  private initializeRange(
    start: number,
    end: number,
    random: SeededRandom,
  ): void {
    const spawnRadius = this.config.boundaryRadius * 0.72;
    const initialSpeed = this.config.maxSpeed * 0.55;

    for (let index = start; index < end; index += 1) {
      const offset = index * 3;
      let x = 0;
      let y = 0;
      let z = 0;
      let distanceSquared = 0;

      do {
        x = random.signed();
        y = random.signed();
        z = random.signed();
        distanceSquared = x * x + y * y + z * z;
      } while (distanceSquared > 1 || distanceSquared <= EPSILON);

      this.positions[offset] = x * spawnRadius;
      this.positions[offset + 1] = y * spawnRadius;
      this.positions[offset + 2] = z * spawnRadius;

      do {
        x = random.signed();
        y = random.signed();
        z = random.signed();
        distanceSquared = x * x + y * y + z * z;
      } while (distanceSquared > 1 || distanceSquared <= EPSILON);

      const velocityScale = initialSpeed / Math.sqrt(distanceSquared);
      this.velocities[offset] = x * velocityScale;
      this.velocities[offset + 1] = y * velocityScale;
      this.velocities[offset + 2] = z * velocityScale;
    }
  }

  private computeAccelerations(interaction?: Interaction | null): void {
    const { perceptionRadius, maxForce } = this.config;
    const perceptionSquared = perceptionRadius * perceptionRadius;
    const predatorThreatRadius =
      perceptionRadius * PREDATOR_THREAT_RADIUS_MULTIPLIER;
    const predatorThreatSquared = predatorThreatRadius * predatorThreatRadius;

    this.boostingBoids.fill(0);

    for (let index = 0; index < this.config.count; index += 1) {
      const offset = index * 3;
      const px = this.positions[offset];
      const py = this.positions[offset + 1];
      const pz = this.positions[offset + 2];
      const vx = this.velocities[offset];
      const vy = this.velocities[offset + 1];
      const vz = this.velocities[offset + 2];
      const flockId = this.flockIds[index];
      let sameFlockNeighborCount = 0;
      let otherFlockNeighborCount = 0;
      let separationX = 0;
      let separationY = 0;
      let separationZ = 0;
      let alignmentX = 0;
      let alignmentY = 0;
      let alignmentZ = 0;
      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;
      let flockAvoidanceX = 0;
      let flockAvoidanceY = 0;
      let flockAvoidanceZ = 0;

      const candidates = this.spatialHash.query(
        px,
        py,
        pz,
        perceptionRadius,
        this.neighborCandidates,
      );

      for (
        let candidateIndex = 0;
        candidateIndex < candidates.length;
        candidateIndex += 1
      ) {
        const neighborIndex = candidates[candidateIndex];
        if (neighborIndex === index) continue;
        const neighborOffset = neighborIndex * 3;
        const dx = px - this.positions[neighborOffset];
        const dy = py - this.positions[neighborOffset + 1];
        const dz = pz - this.positions[neighborOffset + 2];
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared > perceptionSquared || distanceSquared <= EPSILON)
          continue;

        const inverseDistanceSquared = 1 / distanceSquared;
        if (this.flockIds[neighborIndex] !== flockId) {
          flockAvoidanceX += dx * inverseDistanceSquared;
          flockAvoidanceY += dy * inverseDistanceSquared;
          flockAvoidanceZ += dz * inverseDistanceSquared;
          otherFlockNeighborCount += 1;
          continue;
        }

        separationX += dx * inverseDistanceSquared;
        separationY += dy * inverseDistanceSquared;
        separationZ += dz * inverseDistanceSquared;
        alignmentX += this.velocities[neighborOffset];
        alignmentY += this.velocities[neighborOffset + 1];
        alignmentZ += this.velocities[neighborOffset + 2];
        centerX += this.positions[neighborOffset];
        centerY += this.positions[neighborOffset + 1];
        centerZ += this.positions[neighborOffset + 2];
        sameFlockNeighborCount += 1;
      }

      let accelerationX = 0;
      let accelerationY = 0;
      let accelerationZ = 0;

      if (sameFlockNeighborCount > 0 && maxForce > 0) {
        this.steer(
          separationX / sameFlockNeighborCount,
          separationY / sameFlockNeighborCount,
          separationZ / sameFlockNeighborCount,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.separation;
        accelerationY += this.steeringScratch[1] * this.config.separation;
        accelerationZ += this.steeringScratch[2] * this.config.separation;

        this.steer(
          alignmentX / sameFlockNeighborCount,
          alignmentY / sameFlockNeighborCount,
          alignmentZ / sameFlockNeighborCount,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.alignment;
        accelerationY += this.steeringScratch[1] * this.config.alignment;
        accelerationZ += this.steeringScratch[2] * this.config.alignment;

        this.steer(
          centerX / sameFlockNeighborCount - px,
          centerY / sameFlockNeighborCount - py,
          centerZ / sameFlockNeighborCount - pz,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.cohesion;
        accelerationY += this.steeringScratch[1] * this.config.cohesion;
        accelerationZ += this.steeringScratch[2] * this.config.cohesion;
      }

      if (
        otherFlockNeighborCount > 0 &&
        this.config.flockAvoidance > 0 &&
        maxForce > 0
      ) {
        this.steer(
          flockAvoidanceX / otherFlockNeighborCount,
          flockAvoidanceY / otherFlockNeighborCount,
          flockAvoidanceZ / otherFlockNeighborCount,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.flockAvoidance;
        accelerationY += this.steeringScratch[1] * this.config.flockAvoidance;
        accelerationZ += this.steeringScratch[2] * this.config.flockAvoidance;
      }

      if (this.config.predatorEnabled && maxForce > 0) {
        let predatorDx = px - this.predatorPosition[0];
        let predatorDy = py - this.predatorPosition[1];
        let predatorDz = pz - this.predatorPosition[2];
        const predatorDistanceSquared =
          predatorDx * predatorDx +
          predatorDy * predatorDy +
          predatorDz * predatorDz;
        if (predatorDistanceSquared <= predatorThreatSquared) {
          if (predatorDistanceSquared <= EPSILON) {
            predatorDx = index % 2 === 0 ? 1 : -1;
            predatorDy = index % 3 === 0 ? 1 : -1;
            predatorDz = index % 5 === 0 ? 1 : -1;
          }
          const predatorDistance = Math.sqrt(
            Math.max(predatorDistanceSquared, EPSILON),
          );
          const proximity =
            1 - Math.min(1, predatorDistance / predatorThreatRadius);
          this.steer(
            predatorDx,
            predatorDy,
            predatorDz,
            vx,
            vy,
            vz,
            this.config.maxSpeed * ESCAPE_SPEED_MULTIPLIER,
            maxForce * ESCAPE_FORCE_MULTIPLIER,
          );
          const avoidanceScale = 1 + proximity * 2;
          accelerationX += this.steeringScratch[0] * avoidanceScale;
          accelerationY += this.steeringScratch[1] * avoidanceScale;
          accelerationZ += this.steeringScratch[2] * avoidanceScale;
          this.boostingBoids[index] = 1;
        }
      }

      const distanceFromCenter = Math.sqrt(px * px + py * py + pz * pz);
      const boundaryStart = this.config.boundaryRadius * 0.78;
      if (distanceFromCenter > boundaryStart && maxForce > 0) {
        const boundaryRange = Math.max(
          EPSILON,
          this.config.boundaryRadius - boundaryStart,
        );
        const boundaryStrength = clamp(
          (distanceFromCenter - boundaryStart) / boundaryRange,
          0,
          2,
        );
        this.steer(-px, -py, -pz, vx, vy, vz);
        accelerationX += this.steeringScratch[0] * (1 + boundaryStrength * 2.5);
        accelerationY += this.steeringScratch[1] * (1 + boundaryStrength * 2.5);
        accelerationZ += this.steeringScratch[2] * (1 + boundaryStrength * 2.5);
      }

      if (
        interaction !== null &&
        interaction !== undefined &&
        interaction.mode !== "off" &&
        interaction.point.every(Number.isFinite) &&
        this.config.pointerForce > 0 &&
        maxForce > 0
      ) {
        const direction = interaction.mode === "repel" ? -1 : 1;
        const dx = (interaction.point[0] - px) * direction;
        const dy = (interaction.point[1] - py) * direction;
        const dz = (interaction.point[2] - pz) * direction;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance > EPSILON) {
          const falloff = 1 / (1 + distance / this.config.boundaryRadius);
          const pointerScale =
            (maxForce * this.config.pointerForce * falloff) / distance;
          accelerationX += dx * pointerScale;
          accelerationY += dy * pointerScale;
          accelerationZ += dz * pointerScale;
        }
      }

      if (this.config.turbulence > 0 && maxForce > 0) {
        const turbulenceScale = maxForce * this.config.turbulence;
        accelerationX +=
          turbulenceNoise(index, this.elapsedSeconds, 0) * turbulenceScale;
        accelerationY +=
          turbulenceNoise(index, this.elapsedSeconds, 1) * turbulenceScale;
        accelerationZ +=
          turbulenceNoise(index, this.elapsedSeconds, 2) * turbulenceScale;
      }

      const accelerationMagnitudeSquared =
        accelerationX * accelerationX +
        accelerationY * accelerationY +
        accelerationZ * accelerationZ;
      const maximumAcceleration = maxForce * 6;
      if (
        accelerationMagnitudeSquared >
        maximumAcceleration * maximumAcceleration
      ) {
        const scale =
          maximumAcceleration / Math.sqrt(accelerationMagnitudeSquared);
        accelerationX *= scale;
        accelerationY *= scale;
        accelerationZ *= scale;
      }
      this.accelerations[offset] = accelerationX;
      this.accelerations[offset + 1] = accelerationY;
      this.accelerations[offset + 2] = accelerationZ;
    }
  }

  private steer(
    desiredX: number,
    desiredY: number,
    desiredZ: number,
    velocityX: number,
    velocityY: number,
    velocityZ: number,
    desiredSpeed = this.config.maxSpeed,
    maximumForce = this.config.maxForce,
  ): void {
    const magnitudeSquared =
      desiredX * desiredX + desiredY * desiredY + desiredZ * desiredZ;
    if (magnitudeSquared <= EPSILON || desiredSpeed <= 0) {
      this.steeringScratch.fill(0);
      return;
    }

    const scale = desiredSpeed / Math.sqrt(magnitudeSquared);
    let steerX = desiredX * scale - velocityX;
    let steerY = desiredY * scale - velocityY;
    let steerZ = desiredZ * scale - velocityZ;
    const steerMagnitudeSquared =
      steerX * steerX + steerY * steerY + steerZ * steerZ;
    const maximumSquared = maximumForce * maximumForce;
    if (steerMagnitudeSquared > maximumSquared) {
      const steerScale = maximumForce / Math.sqrt(steerMagnitudeSquared);
      steerX *= steerScale;
      steerY *= steerScale;
      steerZ *= steerScale;
    }
    this.steeringScratch[0] = steerX;
    this.steeringScratch[1] = steerY;
    this.steeringScratch[2] = steerZ;
  }

  private integrate(delta: number): void {
    const boundaryRadius = this.config.boundaryRadius;
    const containmentRadius = boundaryRadius * 0.999;
    const boundarySquared = boundaryRadius * boundaryRadius;

    for (let index = 0; index < this.config.count; index += 1) {
      const offset = index * 3;
      let velocityX =
        this.velocities[offset] + this.accelerations[offset] * delta;
      let velocityY =
        this.velocities[offset + 1] + this.accelerations[offset + 1] * delta;
      let velocityZ =
        this.velocities[offset + 2] + this.accelerations[offset + 2] * delta;
      const speedSquared =
        velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ;
      const maximumSpeed =
        this.config.predatorEnabled && this.boostingBoids[index] === 1
          ? this.config.maxSpeed * ESCAPE_SPEED_MULTIPLIER
          : this.config.maxSpeed;
      const maximumSpeedSquared = maximumSpeed * maximumSpeed;
      if (speedSquared > maximumSpeedSquared) {
        const velocityScale = maximumSpeed / Math.sqrt(speedSquared);
        velocityX *= velocityScale;
        velocityY *= velocityScale;
        velocityZ *= velocityScale;
      }

      let positionX = this.positions[offset] + velocityX * delta;
      let positionY = this.positions[offset + 1] + velocityY * delta;
      let positionZ = this.positions[offset + 2] + velocityZ * delta;
      const distanceSquared =
        positionX * positionX + positionY * positionY + positionZ * positionZ;

      if (distanceSquared > boundarySquared) {
        const distance = Math.sqrt(distanceSquared);
        const normalX = positionX / distance;
        const normalY = positionY / distance;
        const normalZ = positionZ / distance;
        positionX = normalX * containmentRadius;
        positionY = normalY * containmentRadius;
        positionZ = normalZ * containmentRadius;
        const outwardSpeed =
          velocityX * normalX + velocityY * normalY + velocityZ * normalZ;
        if (outwardSpeed > 0) {
          velocityX -= normalX * outwardSpeed * 1.45;
          velocityY -= normalY * outwardSpeed * 1.45;
          velocityZ -= normalZ * outwardSpeed * 1.45;
        }
      }

      this.positions[offset] = Number.isFinite(positionX) ? positionX : 0;
      this.positions[offset + 1] = Number.isFinite(positionY) ? positionY : 0;
      this.positions[offset + 2] = Number.isFinite(positionZ) ? positionZ : 0;
      this.velocities[offset] = Number.isFinite(velocityX) ? velocityX : 0;
      this.velocities[offset + 1] = Number.isFinite(velocityY) ? velocityY : 0;
      this.velocities[offset + 2] = Number.isFinite(velocityZ) ? velocityZ : 0;
    }
  }

  private predatorSeed(): number {
    return normalizeSeed(this.seed ^ PREDATOR_SEED_SALT);
  }

  private initializePredator(resetRandom = true): void {
    if (resetRandom) {
      this.predatorRandom = new SeededRandom(this.predatorSeed());
      this.predatorCatchCount = 0;
    }
    this.boostingBoids.fill(0);
    this.predatorAcceleration.fill(0);

    if (!this.config.predatorEnabled || this.config.count === 0) {
      this.deactivatePredator();
      return;
    }

    this.selectPredatorTarget(-1);
    const targetOffset = this.predatorTargetIndex * 3;
    const targetX = this.positions[targetOffset];
    const targetY = this.positions[targetOffset + 1];
    const targetZ = this.positions[targetOffset + 2];
    const targetDistanceSquared =
      targetX * targetX + targetY * targetY + targetZ * targetZ;
    let spawnDirectionX: number;
    let spawnDirectionY: number;
    let spawnDirectionZ: number;

    if (targetDistanceSquared > EPSILON) {
      const inverseTargetDistance = 1 / Math.sqrt(targetDistanceSquared);
      spawnDirectionX = -targetX * inverseTargetDistance;
      spawnDirectionY = -targetY * inverseTargetDistance;
      spawnDirectionZ = -targetZ * inverseTargetDistance;
    } else {
      do {
        spawnDirectionX = this.predatorRandom.signed();
        spawnDirectionY = this.predatorRandom.signed();
        spawnDirectionZ = this.predatorRandom.signed();
      } while (
        spawnDirectionX * spawnDirectionX +
          spawnDirectionY * spawnDirectionY +
          spawnDirectionZ * spawnDirectionZ <=
        EPSILON
      );
      const inverseDirectionLength =
        1 /
        Math.sqrt(
          spawnDirectionX * spawnDirectionX +
            spawnDirectionY * spawnDirectionY +
            spawnDirectionZ * spawnDirectionZ,
        );
      spawnDirectionX *= inverseDirectionLength;
      spawnDirectionY *= inverseDirectionLength;
      spawnDirectionZ *= inverseDirectionLength;
    }

    const spawnRadius = this.config.boundaryRadius * 0.72;
    this.predatorPosition[0] = spawnDirectionX * spawnRadius;
    this.predatorPosition[1] = spawnDirectionY * spawnRadius;
    this.predatorPosition[2] = spawnDirectionZ * spawnRadius;

    const chaseX = targetX - this.predatorPosition[0];
    const chaseY = targetY - this.predatorPosition[1];
    const chaseZ = targetZ - this.predatorPosition[2];
    const chaseDistanceSquared =
      chaseX * chaseX + chaseY * chaseY + chaseZ * chaseZ;
    if (chaseDistanceSquared > EPSILON && this.config.maxSpeed > 0) {
      const initialSpeed =
        this.config.maxSpeed * PREDATOR_SPEED_MULTIPLIER * 0.55;
      const velocityScale = initialSpeed / Math.sqrt(chaseDistanceSquared);
      this.predatorVelocity[0] = chaseX * velocityScale;
      this.predatorVelocity[1] = chaseY * velocityScale;
      this.predatorVelocity[2] = chaseZ * velocityScale;
    } else {
      this.predatorVelocity.fill(0);
    }
    this.constrainPredatorState();
  }

  private deactivatePredator(): void {
    this.predatorTargetIndex = -1;
    this.predatorTargetDeadlineSeconds = this.elapsedSeconds;
    this.predatorCatchCount = 0;
    this.predatorPosition.fill(0);
    this.predatorVelocity.fill(0);
    this.predatorAcceleration.fill(0);
    this.boostingBoids.fill(0);
  }

  private preparePredatorTarget(): void {
    if (this.config.count === 0) {
      this.deactivatePredator();
      return;
    }
    if (
      this.predatorTargetIndex < 0 ||
      this.predatorTargetIndex >= this.config.count ||
      this.elapsedSeconds >= this.predatorTargetDeadlineSeconds
    ) {
      this.selectPredatorTarget(this.predatorTargetIndex);
    }
  }

  private selectPredatorTarget(previousTargetIndex: number): void {
    const count = this.config.count;
    if (!this.config.predatorEnabled || count === 0) {
      this.predatorTargetIndex = -1;
      this.predatorTargetDeadlineSeconds = this.elapsedSeconds;
      return;
    }

    if (count === 1) {
      this.predatorTargetIndex = 0;
    } else if (previousTargetIndex >= 0 && previousTargetIndex < count) {
      const candidate = Math.floor(this.predatorRandom.next() * (count - 1));
      this.predatorTargetIndex =
        candidate >= previousTargetIndex ? candidate + 1 : candidate;
    } else {
      this.predatorTargetIndex = Math.floor(this.predatorRandom.next() * count);
    }

    const duration =
      PREDATOR_TARGET_SECONDS_MIN +
      this.predatorRandom.next() *
        (PREDATOR_TARGET_SECONDS_MAX - PREDATOR_TARGET_SECONDS_MIN);
    this.predatorTargetDeadlineSeconds = this.elapsedSeconds + duration;
  }

  private computePredatorAcceleration(): void {
    const targetIndex = this.predatorTargetIndex;
    if (
      targetIndex < 0 ||
      targetIndex >= this.config.count ||
      this.config.maxForce <= 0
    ) {
      this.predatorAcceleration.fill(0);
      return;
    }

    const targetOffset = targetIndex * 3;
    this.steer(
      this.positions[targetOffset] - this.predatorPosition[0],
      this.positions[targetOffset + 1] - this.predatorPosition[1],
      this.positions[targetOffset + 2] - this.predatorPosition[2],
      this.predatorVelocity[0],
      this.predatorVelocity[1],
      this.predatorVelocity[2],
      this.config.maxSpeed * PREDATOR_SPEED_MULTIPLIER,
      this.config.maxForce * PREDATOR_FORCE_MULTIPLIER,
    );
    this.predatorAcceleration[0] = this.steeringScratch[0];
    this.predatorAcceleration[1] = this.steeringScratch[1];
    this.predatorAcceleration[2] = this.steeringScratch[2];
  }

  private integratePredator(delta: number): void {
    const maximumSpeed = this.config.maxSpeed * PREDATOR_SPEED_MULTIPLIER;
    let velocityX =
      this.predatorVelocity[0] + this.predatorAcceleration[0] * delta;
    let velocityY =
      this.predatorVelocity[1] + this.predatorAcceleration[1] * delta;
    let velocityZ =
      this.predatorVelocity[2] + this.predatorAcceleration[2] * delta;
    [velocityX, velocityY, velocityZ] = limitVector(
      velocityX,
      velocityY,
      velocityZ,
      maximumSpeed,
    );

    let positionX = this.predatorPosition[0] + velocityX * delta;
    let positionY = this.predatorPosition[1] + velocityY * delta;
    let positionZ = this.predatorPosition[2] + velocityZ * delta;
    const boundaryRadius = this.config.boundaryRadius;
    const distanceSquared =
      positionX * positionX + positionY * positionY + positionZ * positionZ;
    if (distanceSquared > boundaryRadius * boundaryRadius) {
      const distance = Math.sqrt(distanceSquared);
      const normalX = positionX / distance;
      const normalY = positionY / distance;
      const normalZ = positionZ / distance;
      const containmentRadius = boundaryRadius * 0.999;
      positionX = normalX * containmentRadius;
      positionY = normalY * containmentRadius;
      positionZ = normalZ * containmentRadius;
      const outwardSpeed =
        velocityX * normalX + velocityY * normalY + velocityZ * normalZ;
      if (outwardSpeed > 0) {
        velocityX -= normalX * outwardSpeed * 1.45;
        velocityY -= normalY * outwardSpeed * 1.45;
        velocityZ -= normalZ * outwardSpeed * 1.45;
      }
    }

    this.predatorPosition[0] = Number.isFinite(positionX) ? positionX : 0;
    this.predatorPosition[1] = Number.isFinite(positionY) ? positionY : 0;
    this.predatorPosition[2] = Number.isFinite(positionZ) ? positionZ : 0;
    this.predatorVelocity[0] = Number.isFinite(velocityX) ? velocityX : 0;
    this.predatorVelocity[1] = Number.isFinite(velocityY) ? velocityY : 0;
    this.predatorVelocity[2] = Number.isFinite(velocityZ) ? velocityZ : 0;
  }

  private constrainPredatorState(): void {
    if (!this.config.predatorEnabled || this.config.count === 0) return;

    const radius = this.config.boundaryRadius * 0.999;
    const distanceSquared =
      this.predatorPosition[0] * this.predatorPosition[0] +
      this.predatorPosition[1] * this.predatorPosition[1] +
      this.predatorPosition[2] * this.predatorPosition[2];
    if (distanceSquared > radius * radius) {
      const scale = radius / Math.sqrt(distanceSquared);
      this.predatorPosition[0] *= scale;
      this.predatorPosition[1] *= scale;
      this.predatorPosition[2] *= scale;
    }
    const [velocityX, velocityY, velocityZ] = limitVector(
      finiteOr(this.predatorVelocity[0], 0),
      finiteOr(this.predatorVelocity[1], 0),
      finiteOr(this.predatorVelocity[2], 0),
      this.config.maxSpeed * PREDATOR_SPEED_MULTIPLIER,
    );
    this.predatorVelocity[0] = velocityX;
    this.predatorVelocity[1] = velocityY;
    this.predatorVelocity[2] = velocityZ;
  }

  private didPredatorCatch(
    targetIndex: number,
    relativeStartX: number,
    relativeStartY: number,
    relativeStartZ: number,
  ): boolean {
    if (targetIndex < 0 || targetIndex >= this.config.count) return false;

    const targetOffset = targetIndex * 3;
    const relativeEndX =
      this.predatorPosition[0] - this.positions[targetOffset];
    const relativeEndY =
      this.predatorPosition[1] - this.positions[targetOffset + 1];
    const relativeEndZ =
      this.predatorPosition[2] - this.positions[targetOffset + 2];
    const relativeDeltaX = relativeEndX - relativeStartX;
    const relativeDeltaY = relativeEndY - relativeStartY;
    const relativeDeltaZ = relativeEndZ - relativeStartZ;
    const relativeDeltaSquared =
      relativeDeltaX * relativeDeltaX +
      relativeDeltaY * relativeDeltaY +
      relativeDeltaZ * relativeDeltaZ;
    const closestTime =
      relativeDeltaSquared > EPSILON
        ? clamp(
            -(
              relativeStartX * relativeDeltaX +
              relativeStartY * relativeDeltaY +
              relativeStartZ * relativeDeltaZ
            ) / relativeDeltaSquared,
            0,
            1,
          )
        : 0;
    const closestX = relativeStartX + relativeDeltaX * closestTime;
    const closestY = relativeStartY + relativeDeltaY * closestTime;
    const closestZ = relativeStartZ + relativeDeltaZ * closestTime;
    const catchRadius = Math.min(
      this.config.boundaryRadius * 0.25,
      Math.max(
        PREDATOR_MIN_CATCH_RADIUS,
        this.config.perceptionRadius * PREDATOR_CATCH_RADIUS_MULTIPLIER,
      ),
    );
    return (
      closestX * closestX + closestY * closestY + closestZ * closestZ <=
      catchRadius * catchRadius
    );
  }

  private constrainCurrentState(): void {
    const radius = this.config.boundaryRadius * 0.999;

    for (let index = 0; index < this.config.count; index += 1) {
      const offset = index * 3;
      let px = Number.isFinite(this.positions[offset])
        ? this.positions[offset]
        : 0;
      let py = Number.isFinite(this.positions[offset + 1])
        ? this.positions[offset + 1]
        : 0;
      let pz = Number.isFinite(this.positions[offset + 2])
        ? this.positions[offset + 2]
        : 0;
      const distanceSquared = px * px + py * py + pz * pz;
      if (distanceSquared > radius * radius) {
        const scale = radius / Math.sqrt(distanceSquared);
        px *= scale;
        py *= scale;
        pz *= scale;
      }

      let vx = Number.isFinite(this.velocities[offset])
        ? this.velocities[offset]
        : 0;
      let vy = Number.isFinite(this.velocities[offset + 1])
        ? this.velocities[offset + 1]
        : 0;
      let vz = Number.isFinite(this.velocities[offset + 2])
        ? this.velocities[offset + 2]
        : 0;
      const maximumSpeed =
        this.config.predatorEnabled && this.boostingBoids[index] === 1
          ? this.config.maxSpeed * ESCAPE_SPEED_MULTIPLIER
          : this.config.maxSpeed;
      [vx, vy, vz] = limitVector(vx, vy, vz, maximumSpeed);

      this.positions[offset] = px;
      this.positions[offset + 1] = py;
      this.positions[offset + 2] = pz;
      this.velocities[offset] = vx;
      this.velocities[offset + 1] = vy;
      this.velocities[offset + 2] = vz;
    }
  }

  private updateMetrics(): void {
    let speedTotal = 0;
    let directionX = 0;
    let directionY = 0;
    let directionZ = 0;
    let movingCount = 0;
    let boostingBoidCount = 0;

    for (let index = 0; index < this.config.count; index += 1) {
      const offset = index * 3;
      const vx = this.velocities[offset];
      const vy = this.velocities[offset + 1];
      const vz = this.velocities[offset + 2];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      boostingBoidCount += this.boostingBoids[index];
      speedTotal += speed;
      if (speed > EPSILON) {
        directionX += vx / speed;
        directionY += vy / speed;
        directionZ += vz / speed;
        movingCount += 1;
      }
    }

    this.snapshot.count = this.config.count;
    this.snapshot.boostingBoidCount = boostingBoidCount;
    this.snapshot.averageSpeed =
      this.config.count > 0 ? speedTotal / this.config.count : 0;
    this.snapshot.coherence =
      movingCount > 0
        ? clamp(
            Math.sqrt(
              directionX * directionX +
                directionY * directionY +
                directionZ * directionZ,
            ) / movingCount,
            0,
            1,
          )
        : 0;
    this.snapshot.predator.active =
      this.config.predatorEnabled &&
      this.config.count > 0 &&
      this.predatorTargetIndex >= 0;
    this.snapshot.predator.targetIndex = this.snapshot.predator.active
      ? this.predatorTargetIndex
      : -1;
    this.snapshot.predator.targetSecondsRemaining = this.snapshot.predator
      .active
      ? Math.max(0, this.predatorTargetDeadlineSeconds - this.elapsedSeconds)
      : 0;
    this.snapshot.predator.catchCount = this.predatorCatchCount;
  }

  private syncSnapshotArrays(): void {
    this.snapshot.positions = this.positions;
    this.snapshot.velocities = this.velocities;
    this.snapshot.flockIds = this.flockIds;
    this.snapshot.boostingBoids = this.boostingBoids;
  }
}
