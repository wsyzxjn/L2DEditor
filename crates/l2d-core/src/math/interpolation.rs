use crate::model::ExtendedInterpolationType;
use std::collections::HashMap;

/// Calculates piecewise linear weights for a 1D parameter.
/// Returns pairs of (key_index, weight) for non-zero weights, where `key_index` refers to the
/// position in the caller's `keys` slice. Keys do not need to be sorted: they are ordered by
/// value internally (stable, so duplicate keys resolve to the first occurrence) and the
/// resulting indices are mapped back to the original positions.
pub fn compute_1d_weights(keys: &[f32], value: f32) -> Vec<(usize, f32)> {
    if keys.is_empty() {
        return Vec::new();
    }
    if keys.len() == 1 {
        return vec![(0, 1.0)];
    }
    let mut order: Vec<usize> = (0..keys.len()).collect();
    order.sort_by(|&a, &b| keys[a].total_cmp(&keys[b]));
    let sorted: Vec<f32> = order.iter().map(|&i| keys[i]).collect();
    compute_1d_weights_sorted(&sorted, value)
        .into_iter()
        .map(|(i, w)| (order[i], w))
        .collect()
}

fn compute_1d_weights_sorted(keys: &[f32], value: f32) -> Vec<(usize, f32)> {
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

    // Only reachable for NaN values.
    vec![(0, 1.0)]
}

/// Computes weights for multi-dimensional coordinates across keyform states.
/// For each keyform state, its weight is the product of 1D weights across each dimension.
pub fn compute_multidim_weights(
    dimension_keys: &[Vec<f32>],
    query_coords: &[f32],
    keyform_coords: &[Vec<f32>],
) -> Vec<f32> {
    let exts = vec![None; dimension_keys.len()];
    compute_multidim_weights_ext(dimension_keys, &exts, query_coords, keyform_coords)
}

/// Computes weights for multi-dimensional coordinates across keyform states,
/// honoring per-dimension ExtendedInterpolationType (Linear, Circle, Bezier).
///
/// The result always sums to 1 when `keyform_coords` is non-empty:
/// - a binding without dimensions resolves fully to the first keyform;
/// - a sparse grid whose surrounding corners are missing (total weight 0) falls back to the
///   nearest existing keyform (distance normalized by each dimension's key span), instead of
///   collapsing geometry to the origin.
pub fn compute_multidim_weights_ext(
    dimension_keys: &[Vec<f32>],
    dimension_exts: &[Option<ExtendedInterpolationType>],
    query_coords: &[f32],
    keyform_coords: &[Vec<f32>],
) -> Vec<f32> {
    let num_dims = dimension_keys.len();
    if keyform_coords.is_empty() {
        return Vec::new();
    }
    if num_dims == 0 {
        let mut w = vec![0.0; keyform_coords.len()];
        w[0] = 1.0;
        return w;
    }

    // Compute 1D weights per dimension: dim -> (key_idx -> weight)
    let dim_weights: Vec<HashMap<usize, f32>> = (0..num_dims)
        .map(|d| {
            let val = query_coords.get(d).copied().unwrap_or(0.0);
            let ext = dimension_exts.get(d).copied().flatten();
            let w1d = compute_1d_weights_ext(&dimension_keys[d], val, ext);
            w1d.into_iter().collect()
        })
        .collect();

    // For each keyform state, calculate weight
    let mut weights = Vec::with_capacity(keyform_coords.len());
    let mut total_w = 0.0;

    for k_coord in keyform_coords {
        let mut state_w = 1.0;
        for d in 0..num_dims {
            // A keyform lacking a coordinate for some dimension cannot be placed on the grid.
            let Some(dim_val) = k_coord.get(d) else {
                state_w = 0.0;
                break;
            };
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

    if total_w > 1e-6 {
        for w in &mut weights {
            *w /= total_w;
        }
        return weights;
    }

    // Sparse grid fallback: pick the nearest keyform.
    let nearest = nearest_keyform(dimension_keys, query_coords, keyform_coords);
    let mut w = vec![0.0; keyform_coords.len()];
    w[nearest] = 1.0;
    w
}

fn nearest_keyform(dimension_keys: &[Vec<f32>], query_coords: &[f32], keyform_coords: &[Vec<f32>]) -> usize {
    let mut best = 0usize;
    let mut best_d = f32::INFINITY;
    for (i, k_coord) in keyform_coords.iter().enumerate() {
        let mut dist = 0.0f32;
        for (d, keys) in dimension_keys.iter().enumerate() {
            let Some(&c) = k_coord.get(d) else {
                dist = f32::INFINITY;
                break;
            };
            let (lo, hi) = keys
                .iter()
                .fold((f32::INFINITY, f32::NEG_INFINITY), |(lo, hi), &k| (lo.min(k), hi.max(k)));
            let span = if hi - lo > 1e-6 { hi - lo } else { 1.0 };
            let q = query_coords.get(d).copied().unwrap_or(0.0);
            let delta = (c - q) / span;
            dist += delta * delta;
        }
        if !dist.is_nan() && dist < best_d {
            best_d = dist;
            best = i;
        }
    }
    best
}

/// Blends point arrays using the provided weights.
///
/// Never panics on malformed input: the reference length is that of the state with the largest
/// weight; states with a different point count (or without a weight) are skipped and the
/// remaining weights renormalized. If no usable weight remains, the reference state is returned
/// unchanged.
pub fn blend_points(states: &[&[[f32; 2]]], weights: &[f32]) -> Vec<[f32; 2]> {
    if states.is_empty() {
        return Vec::new();
    }
    let ref_idx = (0..states.len())
        .max_by(|&a, &b| {
            let wa = weights.get(a).copied().unwrap_or(0.0).abs();
            let wb = weights.get(b).copied().unwrap_or(0.0).abs();
            // Prefer the earliest state on ties.
            wa.total_cmp(&wb).then(b.cmp(&a))
        })
        .unwrap_or(0);
    let len = states[ref_idx].len();
    let mut out = vec![[0.0, 0.0]; len];
    let mut total_w = 0.0f32;

    for (state, &w) in states.iter().zip(weights.iter()) {
        if w.abs() < 1e-6 || state.len() != len {
            continue;
        }
        total_w += w;
        for i in 0..len {
            out[i][0] += state[i][0] * w;
            out[i][1] += state[i][1] * w;
        }
    }

    if total_w.abs() < 1e-6 {
        return states[ref_idx].to_vec();
    }
    if (total_w - 1.0).abs() > 1e-6 {
        for p in &mut out {
            p[0] /= total_w;
            p[1] /= total_w;
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

#[cfg(test)]
mod robustness_tests {
    use super::*;

    #[test]
    fn unsorted_keys_select_the_correct_interval() {
        // Same keys as [-30, 0, 30], stored out of order.
        let keys = vec![30.0, -30.0, 0.0];
        let w = compute_1d_weights(&keys, 15.0);
        let mut map: HashMap<usize, f32> = w.into_iter().collect();
        assert!((map.remove(&2).unwrap() - 0.5).abs() < 1e-5);
        assert!((map.remove(&0).unwrap() - 0.5).abs() < 1e-5);
        assert!(map.is_empty());
        assert_eq!(compute_1d_weights(&keys, -100.0), vec![(1, 1.0)]);
        assert_eq!(compute_1d_weights(&keys, 100.0), vec![(0, 1.0)]);
    }

    #[test]
    fn blend_points_never_panics_on_mismatched_lengths() {
        let a: Vec<[f32; 2]> = vec![[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]];
        let b: Vec<[f32; 2]> = vec![[5.0, 5.0]];
        let out = blend_points(&[&a, &b], &[0.5, 0.5]);
        // `b` is skipped, `a` is renormalized to full weight.
        assert_eq!(out, a);
        // Short state first, long state dominating: still no panic.
        let out = blend_points(&[&b, &a], &[0.25, 0.75]);
        assert_eq!(out, a);
        // Fewer weights than states.
        let out = blend_points(&[&a, &b], &[]);
        assert_eq!(out, a);
    }

    #[test]
    fn sparse_grid_falls_back_to_nearest_keyform() {
        let dim_keys = vec![vec![-1.0, 0.0, 1.0], vec![-1.0, 1.0]];
        // Only two of six corners authored.
        let kf = vec![vec![-1.0, -1.0], vec![1.0, 1.0]];
        let w = compute_multidim_weights(&dim_keys, &[0.0, -1.0], &kf);
        assert_eq!(w.len(), 2);
        assert!((w.iter().sum::<f32>() - 1.0).abs() < 1e-6);
        assert_eq!(w, vec![1.0, 0.0]);
        let w = compute_multidim_weights(&dim_keys, &[0.9, 1.0], &kf);
        assert_eq!(w, vec![0.0, 1.0]);
    }

    #[test]
    fn binding_without_dimensions_uses_first_keyform() {
        let w = compute_multidim_weights(&[], &[], &[vec![], vec![]]);
        assert_eq!(w, vec![1.0, 0.0]);
        assert!(compute_multidim_weights(&[], &[], &[]).is_empty());
    }
}
