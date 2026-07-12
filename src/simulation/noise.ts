const UINT32_SCALE = 1 / 4_294_967_296;

export function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = normalizeSeed(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) * UINT32_SCALE;
  }

  signed(): number {
    return this.next() * 2 - 1;
  }
}

export function turbulenceNoise(
  index: number,
  time: number,
  axis: number,
): number {
  const phase = index * 0.754877666 + axis * 19.193;
  const primary = Math.sin(phase + time * (0.83 + axis * 0.19));
  const secondary = Math.sin(
    phase * 0.479 + time * (1.37 - axis * 0.11) + axis * 7.13,
  );
  return primary * 0.72 + secondary * 0.28;
}
