/// Mathematical deformation of a 2D point based on the displacement of a polyline control path.
/// Given base path control points Q and deformed path control points P, computes deformed point position.
pub fn transform_point_by_deform_path(
    point: [f32; 2],
    base_points: &[[f32; 2]],
    deformed_points: &[[f32; 2]],
) -> [f32; 2] {
    if base_points.len() < 2 || deformed_points.len() != base_points.len() {
        return point;
    }

    let mut total_weight = 0.0;
    let mut accumulated_pos = [0.0, 0.0];

    for i in 0..base_points.len() - 1 {
        let q0 = base_points[i];
        let q1 = base_points[i + 1];
        let p0 = deformed_points[i];
        let p1 = deformed_points[i + 1];

        let seg_q = [q1[0] - q0[0], q1[1] - q0[1]];
        let len_q_sq = seg_q[0] * seg_q[0] + seg_q[1] * seg_q[1];
        if len_q_sq < 1e-6 {
            continue;
        }

        // Project point onto segment Q0 -> Q1
        let v_q = [point[0] - q0[0], point[1] - q0[1]];
        let t = ((v_q[0] * seg_q[0] + v_q[1] * seg_q[1]) / len_q_sq).clamp(0.0, 1.0);

        // Perpendicular distance & vector in base frame
        let proj_q = [q0[0] + t * seg_q[0], q0[1] + t * seg_q[1]];
        let perp_q = [point[0] - proj_q[0], point[1] - proj_q[1]];
        let dist_sq = perp_q[0] * perp_q[0] + perp_q[1] * perp_q[1];

        // Segment length & angle in base frame vs deformed frame
        let len_q = len_q_sq.sqrt();
        let angle_q = seg_q[1].atan2(seg_q[0]);

        let seg_p = [p1[0] - p0[0], p1[1] - p0[1]];
        let len_p = (seg_p[0] * seg_p[0] + seg_p[1] * seg_p[1]).sqrt().max(1e-6);
        let angle_p = seg_p[1].atan2(seg_p[0]);

        let delta_angle = angle_p - angle_q;
        let scale = len_p / len_q;

        // Rotate & scale perpendicular offset into deformed frame
        let cos_a = delta_angle.cos();
        let sin_a = delta_angle.sin();
        let rotated_perp = [
            (perp_q[0] * cos_a - perp_q[1] * sin_a) * scale,
            (perp_q[0] * sin_a + perp_q[1] * cos_a) * scale,
        ];

        let target_p = [
            p0[0] + t * seg_p[0] + rotated_perp[0],
            p0[1] + t * seg_p[1] + rotated_perp[1],
        ];

        // Weight inversely proportional to distance (smooth blending)
        let weight = 1.0 / (dist_sq.sqrt() + 20.0).powi(2);
        accumulated_pos[0] += target_p[0] * weight;
        accumulated_pos[1] += target_p[1] * weight;
        total_weight += weight;
    }

    if total_weight > 1e-6 {
        [
            accumulated_pos[0] / total_weight,
            accumulated_pos[1] / total_weight,
        ]
    } else {
        point
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_deform_path() {
        let path = vec![[0.0, 0.0], [0.0, 100.0]];
        let pt = [10.0, 50.0];
        let deformed = transform_point_by_deform_path(pt, &path, &path);
        assert!((deformed[0] - pt[0]).abs() < 1e-4);
        assert!((deformed[1] - pt[1]).abs() < 1e-4);
    }

    #[test]
    fn test_translated_deform_path() {
        let base = vec![[0.0, 0.0], [0.0, 100.0]];
        let moved = vec![[50.0, 0.0], [50.0, 100.0]];
        let pt = [10.0, 50.0];
        let deformed = transform_point_by_deform_path(pt, &base, &moved);
        assert!((deformed[0] - 60.0).abs() < 1e-4);
        assert!((deformed[1] - 50.0).abs() < 1e-4);
    }
}
