/// Transforms a 2D point using a rotation deformer (origin, angle in degrees, scale).
pub fn transform_point_by_rotation(
    point: [f32; 2],
    origin: [f32; 2],
    angle_deg: f32,
    scale: [f32; 2],
) -> [f32; 2] {
    let rad = angle_deg.to_radians();
    let cos_a = rad.cos();
    let sin_a = rad.sin();

    let dx = (point[0] - origin[0]) * scale[0];
    let dy = (point[1] - origin[1]) * scale[1];

    [
        origin[0] + dx * cos_a - dy * sin_a,
        origin[1] + dx * sin_a + dy * cos_a,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rotation_90_deg() {
        let origin = [0.0, 0.0];
        let pt = [10.0, 0.0];
        let res = transform_point_by_rotation(pt, origin, 90.0, [1.0, 1.0]);
        assert!(res[0].abs() < 1e-4);
        assert!((res[1] - 10.0).abs() < 1e-4);
    }
}
