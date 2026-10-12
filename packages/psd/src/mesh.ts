import earcut from 'earcut';
export { earcut };

export interface GeneratedMesh {
  vertices: [number, number][];
  uvs: [number, number][];
  indices: number[];
}

/**
 * Generates a triangular mesh from bounding box and optional internal subdivision grid.
 * @param x min X in canvas space
 * @param y min Y in canvas space
 * @param w width
 * @param h height
 * @param density subdivision count (e.g. 2 means 2x2 grid = 4 cells)
 */
export function generateGridMesh(
  x: number,
  y: number,
  w: number,
  h: number,
  density: number = 2
): GeneratedMesh {
  const cols = Math.max(1, Math.round(density));
  const rows = Math.max(1, Math.round(density));

  const vertices: [number, number][] = [];
  const uvs: [number, number][] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const py = y + h * v;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const px = x + w * u;
      vertices.push([px, py]);
      uvs.push([u, v]);
    }
  }

  const indices: number[] = [];
  const stride = cols + 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p00 = r * stride + c;
      const p10 = p00 + 1;
      const p01 = (r + 1) * stride + c;
      const p11 = p01 + 1;

      // Triangle 1: p00, p10, p01
      indices.push(p00, p10, p01);
      // Triangle 2: p10, p11, p01
      indices.push(p10, p11, p01);
    }
  }

  return { vertices, uvs, indices };
}

/**
 * Triangulates an arbitrary 2D polygon with optional interior Steiner points using earcut.
 */
export function triangulatePolygon(
  polygonPoints: [number, number][],
  bounds: [number, number, number, number]
): GeneratedMesh {
  const [bx, by, bw, bh] = bounds;
  const flatCoords: number[] = [];
  const uvs: [number, number][] = [];

  for (const [px, py] of polygonPoints) {
    flatCoords.push(px, py);
    const u = bw > 0 ? (px - bx) / bw : 0;
    const v = bh > 0 ? (py - by) / bh : 0;
    uvs.push([u, v]);
  }

  const indices = earcut(flatCoords);

  return {
    vertices: polygonPoints,
    uvs,
    indices,
  };
}
