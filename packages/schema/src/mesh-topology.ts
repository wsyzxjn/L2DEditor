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
