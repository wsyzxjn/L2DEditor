use crate::model::ExtendedInterpolationType;
use std::collections::HashMap;

/// Calculates piecewise linear weights for a 1D parameter given sorted key values.
/// Returns pairs of (key_index, weight) for non-zero weights.
pub fn compute_1d_weights(keys: &[f32], value: f32) -> Vec<(usize, f32)> {
    if keys.is_empty() {
        return Vec::new();
    }
    if keys.len() == 1 {
        return vec![(0, 1.0)];
    }
    // Value before first key
    if value <= keys[0] {
        return vec![(0, 1.0)];
    }
    // Value after last key
    let last_idx = keys.len() - 1;
    if value >= keys[last_idx] {
        return vec![(last_idx, 1.0)];
    }

    // Find interval [keys[i], keys[i+1]]
    for i in 0..keys.len() - 1 {
        let k0 = keys[i];
        let k1 = keys[i + 1];
        if value >= k0 && value <= k1 {
            let span = k1 - k0;
            if span.abs() < 1e-6 {
                return vec![(i, 1.0)];
            }
            let t = (value - k0) / span;
            let mut res = Vec::with_capacity(2);
            if 1.0 - t > 1e-6 {
                res.push((i, 1.0 - t));
            }
            if t > 1e-6 {
                res.push((i + 1, t));
            }
            return res;
        }
    }

    vec![(last_idx, 1.0)]
}

/// Computes weights for multi-dimensional coordinates across keyform states.
/// For each keyform state, its weight is the product of 1D weights across each dimension.
pub fn compute_multidim_weights(
    dimension_keys: &[Vec<f32>],
    query_coords: &[f32],
    keyform_coords: &[Vec<f32>],
) -> Vec<f32> {
    let num_dims = dimension_keys.len();
    if num_dims == 0 || keyform_coords.is_empty() {
        return vec![0.0; keyform_coords.len()];
    }

    // Compute 1D weights per dimension: dim -> (key_idx -> weight)
    let dim_weights: Vec<HashMap<usize, f32>> = (0..num_dims)
        .map(|d| {
            let val = query_coords.get(d).copied().unwrap_or(0.0);
            let w1d = compute_1d_weights(&dimension_keys[d], val);
            w1d.into_iter().collect()
        })
        .collect();

    // For each keyform state, calculate weight
    let mut weights = Vec::with_capacity(keyform_coords.len());
    let mut total_w = 0.0;

    for k_coord in keyform_coords {
        let mut state_w = 1.0;
        for (d, dim_val) in k_coord.iter().enumerate().take(num_dims) {
            // Find which key index this coordinate matches in dimension_keys[d]
            let key_idx = dimension_keys[d]
                .iter()
                .position(|&k| (k - *dim_val).abs() < 1e-5);
            if let Some(idx) = key_idx {
                let w = dim_weights[d].get(&idx).copied().unwrap_or(0.0);
                state_w *= w;
            } else {
                state_w = 0.0;
            }
        }
        weights.push(state_w);
        total_w += state_w;
    }

    // Normalize if non-zero
    if total_w > 1e-6 {
        for w in &mut weights {
            *w /= total_w;
        }
    }

    weights
}

/// Blends point arrays using the provided weights.
pub fn blend_points(states: &[&[[f32; 2]]], weights: &[f32]) -> Vec<[f32; 2]> {
    if states.is_empty() || states[0].is_empty() {
        return Vec::new();
    }
    let len = states[0].len();
    let mut out = vec![[0.0, 0.0]; len];

    for (state, &w) in states.iter().zip(weights.iter()) {
        if w.abs() < 1e-6 {
            continue;
        }
        for i in 0..len {
            out[i][0] += state[i][0] * w;
            out[i][1] += state[i][1] * w;
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_1d_interpolation() {
        let keys = vec![-30.0, 0.0, 30.0];
        let w_exact = compute_1d_weights(&keys, 0.0);
        assert_eq!(w_exact, vec![(1, 1.0)]);

        let w_mid = compute_1d_weights(&keys, 15.0);
        assert_eq!(w_mid.len(), 2);
        assert!((w_mid[0].1 - 0.5).abs() < 1e-5);
        assert!((w_mid[1].1 - 0.5).abs() < 1e-5);
    }

    #[test]
    fn test_multidim_2d_grid() {
        let dim_x = vec![-1.0, 1.0];
        let dim_y = vec![-1.0, 1.0];
        let dim_keys = vec![dim_x, dim_y];

        let keyform_coords = vec![
            vec![-1.0, -1.0],
            vec![1.0, -1.0],
            vec![-1.0, 1.0],
            vec![1.0, 1.0],
        ];

        let w = compute_multidim_weights(&dim_keys, &[0.0, 0.0], &keyform_coords);
        assert_eq!(w.len(), 4);
        for weight in w {
            assert!((weight - 0.25).abs() < 1e-5);
        }
    }
}

pub fn compute_1d_weights_ext(
    keys: &[f32],
    value: f32,
    ext: Option<ExtendedInterpolationType>,
) -> Vec<(usize, f32)> {
    let base_weights = compute_1d_weights(keys, value);
    if ext.is_none() || base_weights.len() != 2 {
        return base_weights;
    }

    match ext {
        Some(ExtendedInterpolationType::Circle) => {
            // Smooth C1 Hermite / Circular ease
            let (idx0, _w0) = base_weights[0];
            let (idx1, w1) = base_weights[1];
            let t = w1; // since w0 = 1 - t
            // Circular arc weight blend: t_smooth = (1 - (1 - t^2)^0.5) or smoothstep
            let t_smooth = t * t * (3.0 - 2.0 * t);
            vec![(idx0, 1.0 - t_smooth), (idx1, t_smooth)]
        }
        Some(ExtendedInterpolationType::Bezier) => {
            let (idx0, _w0) = base_weights[0];
            let (idx1, w1) = base_weights[1];
            let t = w1;
            let t_bezier = t * t * t; // cubic ease
            vec![(idx0, 1.0 - t_bezier), (idx1, t_bezier)]
        }
        _ => base_weights,
    }
}
