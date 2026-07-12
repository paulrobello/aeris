interface CellBucket {
  x: number;
  y: number;
  z: number;
  indices: number[];
  next: CellBucket | null;
}

function hashCell(x: number, y: number, z: number): number {
  return (
    Math.imul(x, 73_856_093) ^
    Math.imul(y, 19_349_663) ^
    Math.imul(z, 83_492_791)
  );
}

export class SpatialHash {
  private readonly buckets = new Map<number, CellBucket>();
  private readonly bucketPool: CellBucket[] = [];
  private bucketCount = 0;
  private cellSize: number;
  private inverseCellSize: number;

  constructor(cellSize: number) {
    this.cellSize = Math.max(0.001, cellSize);
    this.inverseCellSize = 1 / this.cellSize;
  }

  setCellSize(cellSize: number): void {
    this.cellSize = Math.max(0.001, cellSize);
    this.inverseCellSize = 1 / this.cellSize;
  }

  rebuild(positions: Float32Array, count: number): void {
    this.buckets.clear();
    this.bucketCount = 0;

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const x = Math.floor(positions[offset] * this.inverseCellSize);
      const y = Math.floor(positions[offset + 1] * this.inverseCellSize);
      const z = Math.floor(positions[offset + 2] * this.inverseCellSize);
      const key = hashCell(x, y, z);
      let bucket = this.buckets.get(key);
      while (
        bucket !== undefined &&
        (bucket.x !== x || bucket.y !== y || bucket.z !== z)
      ) {
        bucket = bucket.next ?? undefined;
      }

      if (bucket === undefined) {
        bucket = this.bucketPool[this.bucketCount];
        if (bucket === undefined) {
          bucket = { x, y, z, indices: [], next: null };
          this.bucketPool.push(bucket);
        } else {
          bucket.x = x;
          bucket.y = y;
          bucket.z = z;
          bucket.indices.length = 0;
        }
        this.bucketCount += 1;
        bucket.next = this.buckets.get(key) ?? null;
        this.buckets.set(key, bucket);
      }

      bucket.indices.push(index);
    }
  }

  query(
    x: number,
    y: number,
    z: number,
    radius: number,
    target: number[],
  ): number[] {
    target.length = 0;
    const minX = Math.floor((x - radius) * this.inverseCellSize);
    const maxX = Math.floor((x + radius) * this.inverseCellSize);
    const minY = Math.floor((y - radius) * this.inverseCellSize);
    const maxY = Math.floor((y + radius) * this.inverseCellSize);
    const minZ = Math.floor((z - radius) * this.inverseCellSize);
    const maxZ = Math.floor((z + radius) * this.inverseCellSize);

    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellY = minY; cellY <= maxY; cellY += 1) {
        for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
          let bucket = this.buckets.get(hashCell(cellX, cellY, cellZ));
          while (
            bucket !== undefined &&
            (bucket.x !== cellX || bucket.y !== cellY || bucket.z !== cellZ)
          ) {
            bucket = bucket.next ?? undefined;
          }
          if (bucket === undefined) continue;

          for (
            let bucketIndex = 0;
            bucketIndex < bucket.indices.length;
            bucketIndex += 1
          ) {
            target.push(bucket.indices[bucketIndex]);
          }
        }
      }
    }

    return target;
  }
}
