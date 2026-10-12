/// Generates default grid control points evenly distributed across the bounding box.
/// Total points = (cols + 1) * (rows + 1).
pub fn generate_default_grid(cols: usize, rows: usize, bounds: [f32; 4]) -> Vec<[f32; 2]> {
    let [min_x, min_y, w, h] = bounds;
    let mut points = Vec::with_capacity((cols + 1) * (rows + 1));

    for r in 0..=rows {
        let t = if rows == 0 { 0.0 } else { r as f32 / rows as f32 };
        let y = min_y + h * t;
        for c in 0..=cols {
            let s = if cols == 0 { 0.0 } else { c as f32 / cols as f32 };
            let x = min_x + w * s;
            points.push([x, y]);
        }
    }

    points
}

/// Transforms a 2D point using a warp deformer grid via piecewise bilinear interpolation.
pub fn transform_point_by_warp(
    point: [f32; 2],
    cols: usize,
    rows: usize,
    bounds: [f32; 4],
    control_points: &[[f32; 2]],
) -> [f32; 2] {
    transform_point_by_warp_ext(point, cols, rows, bounds, control_points, false)
}

/// Transforms a 2D point using a warp deformer grid with optional C1-continuous Hermite curvature smoothing.
pub fn transform_point_by_warp_ext(
    point: [f32; 2],
    cols: usize,
    rows: usize,
    bounds: [f32; 4],
    control_points: &[[f32; 2]],
    smooth: bool,
) -> [f32; 2] {
    let [min_x, min_y, w, h] = bounds;
    if w.abs() < 1e-6 || h.abs() < 1e-6 || cols == 0 || rows == 0 {
        return point;
    }
    let expected_len = (cols + 1) * (rows + 1);
    if control_points.len() < expected_len {
        return point;
    }

    let [px, py] = point;
    let u = (px - min_x) / w;
    let v = (py - min_y) / h;

    let gx = u * cols as f32;
    let gy = v * rows as f32;

    let cell_x = (gx.floor() as isize).clamp(0, (cols - 1) as isize) as usize;
    let cell_y = (gy.floor() as isize).clamp(0, (rows - 1) as isize) as usize;

    let raw_s = gx - cell_x as f32;
    let raw_t = gy - cell_y as f32;

    let s = if smooth {
        raw_s * raw_s * (3.0 - 2.0 * raw_s)
    } else {
        raw_s
    };

    let t = if smooth {
        raw_t * raw_t * (3.0 - 2.0 * raw_t)
    } else {
        raw_t
    };

    let stride = cols + 1;
    let p00 = control_points[cell_y * stride + cell_x];
    let p10 = control_points[cell_y * stride + (cell_x + 1)];
    let p01 = control_points[(cell_y + 1) * stride + cell_x];
    let p11 = control_points[(cell_y + 1) * stride + (cell_x + 1)];

    let w00 = (1.0 - s) * (1.0 - t);
    let w10 = s * (1.0 - t);
    let w01 = (1.0 - s) * t;
    let w11 = s * t;

    [
        w00 * p00[0] + w10 * p10[0] + w01 * p01[0] + w11 * p11[0],
        w00 * p00[1] + w10 * p10[1] + w01 * p01[1] + w11 * p11[1],
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_warp() {
        let bounds = [100.0, 100.0, 200.0, 200.0];
        let grid = generate_default_grid(2, 2, bounds);
        assert_eq!(grid.len(), 9);

        let p_in = [150.0, 180.0];
        let p_out = transform_point_by_warp(p_in, 2, 2, bounds, &grid);
        assert!((p_out[0] - p_in[0]).abs() < 1e-4);
        assert!((p_out[1] - p_in[1]).abs() < 1e-4);
    }

    #[test]
    fn test_translated_warp() {
        let bounds = [0.0, 0.0, 100.0, 100.0];
        let mut grid = generate_default_grid(1, 1, bounds);
        // Translate entire grid by +50 in X
        for pt in &mut grid {
            pt[0] += 50.0;
        }
        let p_in = [25.0, 25.0];
        let p_out = transform_point_by_warp(p_in, 1, 1, bounds, &grid);
        assert!((p_out[0] - 75.0).abs() < 1e-4);
        assert!((p_out[1] - 25.0).abs() < 1e-4);
    }
}
