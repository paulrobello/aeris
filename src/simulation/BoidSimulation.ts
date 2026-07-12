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
const EPSILON = 1e-8;

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
  private readonly spatialHash: SpatialHash;
  private readonly neighborCandidates: number[] = [];
  private readonly steeringScratch = new Float64Array(3);
  private readonly snapshot: BoidSnapshot;

  constructor(config: SimulationConfig, seed = DEFAULT_SEED) {
    this.config = sanitizeConfig(config);
    this.seed = normalizeSeed(seed);
    this.spatialHash = new SpatialHash(this.config.perceptionRadius);
    this.snapshot = {
      positions: this.positions,
      velocities: this.velocities,
      count: 0,
      averageSpeed: 0,
      coherence: 0,
    };
    this.reset();
  }

  configure(config: SimulationConfig): void {
    const nextConfig = sanitizeConfig(config);
    const previousCount = this.config.count;
    this.config = nextConfig;
    this.spatialHash.setCellSize(nextConfig.perceptionRadius);

    if (nextConfig.count !== previousCount) {
      this.resize(nextConfig.count);
    }

    this.constrainCurrentState();
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
      this.syncSnapshotArrays();
    }

    this.elapsedSeconds = 0;
    this.spatialHash.setCellSize(this.config.perceptionRadius);
    this.initializeRange(0, this.config.count, new SeededRandom(this.seed));
    this.accelerations.fill(0);
    this.updateMetrics();
  }

  step(deltaSeconds: number, interaction?: Interaction | null): BoidSnapshot {
    const delta = clamp(finiteOr(deltaSeconds, 0), 0, MAX_DELTA_SECONDS);
    const count = this.config.count;
    if (delta <= 0 || count === 0) return this.snapshot;

    this.elapsedSeconds += delta;
    this.spatialHash.rebuild(this.positions, count);
    this.computeAccelerations(interaction);
    this.integrate(delta);
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
    this.positions.set(oldPositions.subarray(0, oldCount * 3));
    this.velocities.set(oldVelocities.subarray(0, oldCount * 3));

    if (count > oldCount) {
      const growthSeed = normalizeSeed(
        this.seed ^ Math.imul(oldCount + 1, 0x9e3779b1),
      );
      this.initializeRange(oldCount, count, new SeededRandom(growthSeed));
    }

    this.syncSnapshotArrays();
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

    for (let index = 0; index < this.config.count; index += 1) {
      const offset = index * 3;
      const px = this.positions[offset];
      const py = this.positions[offset + 1];
      const pz = this.positions[offset + 2];
      const vx = this.velocities[offset];
      const vy = this.velocities[offset + 1];
      const vz = this.velocities[offset + 2];
      let neighborCount = 0;
      let separationX = 0;
      let separationY = 0;
      let separationZ = 0;
      let alignmentX = 0;
      let alignmentY = 0;
      let alignmentZ = 0;
      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;

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
        separationX += dx * inverseDistanceSquared;
        separationY += dy * inverseDistanceSquared;
        separationZ += dz * inverseDistanceSquared;
        alignmentX += this.velocities[neighborOffset];
        alignmentY += this.velocities[neighborOffset + 1];
        alignmentZ += this.velocities[neighborOffset + 2];
        centerX += this.positions[neighborOffset];
        centerY += this.positions[neighborOffset + 1];
        centerZ += this.positions[neighborOffset + 2];
        neighborCount += 1;
      }

      let accelerationX = 0;
      let accelerationY = 0;
      let accelerationZ = 0;

      if (neighborCount > 0 && maxForce > 0) {
        this.steer(
          separationX / neighborCount,
          separationY / neighborCount,
          separationZ / neighborCount,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.separation;
        accelerationY += this.steeringScratch[1] * this.config.separation;
        accelerationZ += this.steeringScratch[2] * this.config.separation;

        this.steer(
          alignmentX / neighborCount,
          alignmentY / neighborCount,
          alignmentZ / neighborCount,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.alignment;
        accelerationY += this.steeringScratch[1] * this.config.alignment;
        accelerationZ += this.steeringScratch[2] * this.config.alignment;

        this.steer(
          centerX / neighborCount - px,
          centerY / neighborCount - py,
          centerZ / neighborCount - pz,
          vx,
          vy,
          vz,
        );
        accelerationX += this.steeringScratch[0] * this.config.cohesion;
        accelerationY += this.steeringScratch[1] * this.config.cohesion;
        accelerationZ += this.steeringScratch[2] * this.config.cohesion;
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
  ): void {
    const magnitudeSquared =
      desiredX * desiredX + desiredY * desiredY + desiredZ * desiredZ;
    if (magnitudeSquared <= EPSILON || this.config.maxSpeed <= 0) {
      this.steeringScratch.fill(0);
      return;
    }

    const scale = this.config.maxSpeed / Math.sqrt(magnitudeSquared);
    let steerX = desiredX * scale - velocityX;
    let steerY = desiredY * scale - velocityY;
    let steerZ = desiredZ * scale - velocityZ;
    const steerMagnitudeSquared =
      steerX * steerX + steerY * steerY + steerZ * steerZ;
    const maximumSquared = this.config.maxForce * this.config.maxForce;
    if (steerMagnitudeSquared > maximumSquared) {
      const steerScale =
        this.config.maxForce / Math.sqrt(steerMagnitudeSquared);
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
      const maximumSpeedSquared = this.config.maxSpeed * this.config.maxSpeed;
      if (speedSquared > maximumSpeedSquared) {
        const velocityScale = this.config.maxSpeed / Math.sqrt(speedSquared);
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
      [vx, vy, vz] = limitVector(vx, vy, vz, this.config.maxSpeed);

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

    for (let index = 0; index < this.config.count; index += 1) {
      const offset = index * 3;
      const vx = this.velocities[offset];
      const vy = this.velocities[offset + 1];
      const vz = this.velocities[offset + 2];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      speedTotal += speed;
      if (speed > EPSILON) {
        directionX += vx / speed;
        directionY += vy / speed;
        directionZ += vz / speed;
        movingCount += 1;
      }
    }

    this.snapshot.count = this.config.count;
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
  }

  private syncSnapshotArrays(): void {
    this.snapshot.positions = this.positions;
    this.snapshot.velocities = this.velocities;
  }
}
