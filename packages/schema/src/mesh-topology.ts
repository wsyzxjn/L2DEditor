/** Barycentric coordinates inside a non-degenerate triangle (either winding). */
export function triangleWeights(
  point: readonly number[], a: readonly number[], b: readonly number[], c: readonly number[],
): [number, number, number] | null {
  const bx = b[0] - a[0], by = b[1] - a[1];
  const cx = c[0] - a[0], cy = c[1] - a[1];
  const px = point[0] - a[0], py = point[1] - a[1];
  const det = bx * cy - by * cx;
  if (!Number.isFinite(det) || Math.abs(det) <= Number.EPSILON * Math.max(1, Math.hypot(bx, by) * Math.hypot(cx, cy))) return null;
  const v = (px * cy - py * cx) / det;
  const w = (bx * py - by * px) / det;
  const weights: [number, number, number] = [1 - v - w, v, w];
  if (weights.some(value => !Number.isFinite(value) || value < -1e-8 || value > 1 + 1e-8)) return null;
  // Snap shared edges to zero so adjacent faces agree on edge insertion.
  const snapped = weights.map(value => Math.abs(value) <= 1e-8 ? 0 : value);
  const sum = snapped.reduce((total, value) => total + value, 0);
  return snapped.map(value => value / sum) as [number, number, number];
}

/** Closed boundary loops of a triangle mesh, including holes and disconnected islands. */
export function getMeshBoundaryLoops(indices: readonly number[]): number[][] {
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let offset = 0; offset < indices.length; offset += 3) {
    for (const [a, b] of [[indices[offset], indices[offset + 1]], [indices[offset + 1], indices[offset + 2]], [indices[offset + 2], indices[offset]]]) {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const previous = edges.get(key);
      if (previous) previous.count++;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  const adjacency = new Map<number, number[]>();
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    const a = adjacency.get(edge.a) ?? [];
    const b = adjacency.get(edge.b) ?? [];
    a.push(edge.b);
    b.push(edge.a);
    adjacency.set(edge.a, a);
    adjacency.set(edge.b, b);
  }
  const visited = new Set<number>();
  const loops: number[][] = [];
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const loop: number[] = [];
    let current: number | undefined = start;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      loop.push(current);
      current = adjacency.get(current)?.find(neighbor => !visited.has(neighbor));
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
