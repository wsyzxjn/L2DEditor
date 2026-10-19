use super::common::{
    align_up, checked_mul, finite, ids_to_bytes, usize_to_i32, usize_to_u32, Moc3Error,
    Moc3ExportOptions, ALIGNMENT, BODY_OFFSET, HEADER_SIZE, MOC3_MAGIC, SOT_COUNT,
};
use crate::model::*;
use std::collections::{HashMap, HashSet};
use std::io::Write;

#[derive(Clone)]
struct Band {
    dimensions: Vec<ParamDimension>,
}

#[derive(Clone)]
enum DeformerData {
    Warp(WarpDeformerData),
    Rotation(RotationDeformerData),
}

#[derive(Clone)]
struct DeformerNode {
    id: String,
    parent_id: Option<String>,
    visible: bool,
    data: DeformerData,
}

#[derive(Clone, Copy, Debug)]
struct RuntimeAffine {
    m00: f32,
    m01: f32,
    m10: f32,
    m11: f32,
    tx: f32,
    ty: f32,
}

impl RuntimeAffine {
    const IDENTITY: Self = Self {
        m00: 1.0,
        m01: 0.0,
        m10: 0.0,
        m11: 1.0,
        tx: 0.0,
        ty: 0.0,
    };

    fn normalize(bounds: [f32; 4], label: &str) -> Result<Self, Moc3Error> {
        let [min_x, min_y, width, height] = bounds;
        for value in bounds {
            finite(value, label)?;
        }
        if width.abs() <= 1e-8 || height.abs() <= 1e-8 {
            return Err(Moc3Error::Export(format!(
                "{label} has a zero-sized warp domain"
            )));
        }
        Ok(Self {
            m00: 1.0 / width,
            m01: 0.0,
            m10: 0.0,
            m11: 1.0 / height,
            tx: -min_x / width,
            ty: -min_y / height,
        })
    }

    fn apply(self, point: [f32; 2]) -> [f32; 2] {
        [
            self.m00 * point[0] + self.m01 * point[1] + self.tx,
            self.m10 * point[0] + self.m11 * point[1] + self.ty,
        ]
    }

    fn apply_offset(self, point: [f32; 2]) -> [f32; 2] {
        [
            self.m00 * point[0] + self.m01 * point[1],
            self.m10 * point[0] + self.m11 * point[1],
        ]
    }

    fn inverse(self) -> Result<Self, Moc3Error> {
        let determinant = self.m00 * self.m11 - self.m01 * self.m10;
        if determinant.abs() <= 1e-12 {
            return Err(Moc3Error::Export(
                "deformer coordinate transform is singular".into(),
            ));
        }
        let m00 = self.m11 / determinant;
        let m01 = -self.m01 / determinant;
        let m10 = -self.m10 / determinant;
        let m11 = self.m00 / determinant;
        Ok(Self {
            m00,
            m01,
            m10,
            m11,
            tx: -(m00 * self.tx + m01 * self.ty),
            ty: -(m10 * self.tx + m11 * self.ty),
        })
    }

    /// MOC3 rotations only carry one uniform scale. When the parent's coordinate conversion is
    /// axis-aligned and uniform, a rotation survives unchanged apart from its origin. Other
    /// conversions are represented as a 1x1 warp instead, which can carry the full affine.
    fn is_uniform(self) -> bool {
        self.m01.abs() <= 1e-6
            && self.m10.abs() <= 1e-6
            && (self.m00 - self.m11).abs() <= 1e-6
            && self.m00.abs() > 1e-8
    }
}

fn node_output_transform(
    node_id: &str,
    nodes: &HashMap<&str, &Node>,
    deformer_ids: &HashSet<&str>,
    memo: &mut HashMap<String, RuntimeAffine>,
    visiting: &mut HashSet<String>,
) -> Result<RuntimeAffine, Moc3Error> {
    if let Some(transform) = memo.get(node_id) {
        return Ok(*transform);
    }
    if !visiting.insert(node_id.to_string()) {
        return Err(Moc3Error::Export(format!(
            "deformer hierarchy contains a cycle at `{node_id}`"
        )));
    }

    let node = nodes
        .get(node_id)
        .ok_or_else(|| Moc3Error::Export(format!("missing node `{node_id}`")))?;
    let mut current = node.parent_id.as_deref();
    let mut seen = HashSet::new();
    let mut parent_deformer = None;
    while let Some(parent_id) = current {
        if !seen.insert(parent_id.to_string()) {
            return Err(Moc3Error::Export(format!(
                "node hierarchy contains a cycle at `{parent_id}`"
            )));
        }
        let Some(parent) = nodes.get(parent_id) else {
            break;
        };
        if deformer_ids.contains(parent_id) {
            parent_deformer = Some(parent_id.to_string());
            break;
        }
        current = parent.parent_id.as_deref();
    }

    let transform = if let Some(parent_id) = parent_deformer {
        deformer_input_transform(&parent_id, nodes, deformer_ids, memo, visiting)?
    } else {
        RuntimeAffine::IDENTITY
    };
    visiting.remove(node_id);
    memo.insert(node_id.to_string(), transform);
    Ok(transform)
}

fn deformer_input_transform(
    node_id: &str,
    nodes: &HashMap<&str, &Node>,
    deformer_ids: &HashSet<&str>,
    memo: &mut HashMap<String, RuntimeAffine>,
    visiting: &mut HashSet<String>,
) -> Result<RuntimeAffine, Moc3Error> {
    let memo_key = format!("input:{node_id}");
    if let Some(transform) = memo.get(&memo_key) {
        return Ok(*transform);
    }
    let output = node_output_transform(node_id, nodes, deformer_ids, memo, visiting)?;
    let node = nodes
        .get(node_id)
        .ok_or_else(|| Moc3Error::Export(format!("missing deformer `{node_id}`")))?;
    let transform = match &node.kind {
        NodeKind::WarpDeformer(data) => {
            RuntimeAffine::normalize(data.bounds, &format!("warp deformer `{node_id}`"))?
        }
        NodeKind::RotationDeformer(_) => output,
        _ => output,
    };
    memo.insert(memo_key, transform);
    Ok(transform)
}

fn runtime_rotation_corners(
    origin: [f32; 2],
    angle_deg: f32,
    scale: [f32; 2],
    coordinate_transform: RuntimeAffine,
) -> Result<Vec<[f32; 2]>, Moc3Error> {
    let inverse = coordinate_transform.inverse()?;
    let radians = finite(angle_deg, "rotation angle during MOC3 export")?.to_radians();
    let (sin, cos) = radians.sin_cos();
    let mut corners = Vec::with_capacity(4);
    for corner in [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]] {
        let point = inverse.apply(corner);
        let dx = (point[0] - origin[0]) * scale[0];
        let dy = (point[1] - origin[1]) * scale[1];
        corners.push(coordinate_transform.apply([
            origin[0] + dx * cos - dy * sin,
            origin[1] + dx * sin + dy * cos,
        ]));
    }
    Ok(corners)
}

fn runtime_warp_transform(points: &mut [[f32; 2]], transform: RuntimeAffine) {
    for point in points {
        *point = transform.apply(*point);
    }
}

fn runtime_offsets_transform(points: &mut [[f32; 2]], transform: RuntimeAffine) {
    for point in points {
        *point = transform.apply_offset(*point);
    }
}

/// MOC3 drawable coordinates are local to their immediate deformer. Warp inputs are normalized
/// `[0, 1]`; rotation inputs inherit their parent's coordinate domain. The editor stores geometry
/// in a canvas-like coordinate space with explicit warp bounds, so bake that conversion before
/// serialization. Rotations under a non-uniform warp are represented as 1x1 warps because MOC3
/// rotations only carry a uniform scale.
fn runtime_project_coordinates(project: &Project) -> Result<Project, Moc3Error> {
    let mut runtime = project.clone();
    let nodes: HashMap<&str, &Node> = project
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    if nodes.len() != project.nodes.len() {
        return Err(Moc3Error::Export(
            "project contains duplicate node IDs".into(),
        ));
    }
    let deformer_ids: HashSet<&str> = project
        .nodes
        .iter()
        .filter(|node| {
            matches!(
                node.kind,
                NodeKind::WarpDeformer(_) | NodeKind::RotationDeformer(_)
            )
        })
        .map(|node| node.id.as_str())
        .collect();

    let mut memo = HashMap::new();
    let mut visiting = HashSet::new();
    let mut output_transforms = HashMap::with_capacity(project.nodes.len());
    for node in &project.nodes {
        output_transforms.insert(
            node.id.clone(),
            node_output_transform(&node.id, &nodes, &deformer_ids, &mut memo, &mut visiting)?,
        );
    }

    for node in &mut runtime.nodes {
        let transform = output_transforms
            .get(&node.id)
            .copied()
            .unwrap_or(RuntimeAffine::IDENTITY);
        match &mut node.kind {
            NodeKind::WarpDeformer(data) => {
                runtime_warp_transform(&mut data.control_points, transform);
                data.bounds = [0.0, 0.0, 1.0, 1.0];
            }
            NodeKind::RotationDeformer(data) => {
                if transform.is_uniform() {
                    data.origin = transform.apply(data.origin);
                } else {
                    let control_points = runtime_rotation_corners(
                        data.origin,
                        data.angle_deg,
                        data.scale,
                        transform,
                    )?;
                    node.kind = NodeKind::WarpDeformer(WarpDeformerData {
                        cols: 1,
                        rows: 1,
                        bounds: [0.0, 0.0, 1.0, 1.0],
                        control_points,
                        bezier_smooth: false,
                    });
                }
            }
            NodeKind::DeformPath(data) => {
                runtime_warp_transform(&mut data.control_points, transform)
            }
            NodeKind::ArtPath(data) => {
                for point in &mut data.points {
                    point.pos = transform.apply(point.pos);
                }
            }
            NodeKind::ArtMesh(data) => {
                runtime_warp_transform(&mut data.vertices, transform);
                for target in &mut data.morph_targets {
                    runtime_offsets_transform(&mut target.vertex_offsets, transform);
                }
            }
            NodeKind::Part { .. } => {}
        }
    }

    for binding in &mut runtime.keyforms {
        let transform = output_transforms
            .get(&binding.target_node_id)
            .copied()
            .unwrap_or(RuntimeAffine::IDENTITY);
        // Some older editing commands left duplicate state coordinates next to a dimension key
        // (for example two states both labelled 0.2499). MOC3 rows are positional Cartesian
        // products, so when the state count is complete, normalize coordinates from their row
        // index instead of trusting the stale labels.
        if let Ok(expected) = dimension_product(&binding.dimensions, "keyform state count") {
            if binding.keyforms.len() == expected {
                if let Ok(coordinates) = enumerate_coordinates(&binding.dimensions, expected) {
                    let stale = binding.keyforms.iter().zip(coordinates.iter()).any(
                        |(state, coordinates)| {
                            state.coordinates.len() != coordinates.len()
                                || state
                                    .coordinates
                                    .iter()
                                    .zip(coordinates.iter())
                                    .any(|(actual, expected)| (actual - expected).abs() > 1e-5)
                        },
                    );
                    if stale {
                        for (state, coordinates) in
                            binding.keyforms.iter_mut().zip(coordinates.into_iter())
                        {
                            state.coordinates = coordinates;
                        }
                    }
                }
            }
        }
        for state in &mut binding.keyforms {
            match &mut state.payload {
                KeyformPayload::Warp { control_points } => {
                    runtime_warp_transform(control_points, transform);
                }
                KeyformPayload::Rotation {
                    origin,
                    angle_deg,
                    scale,
                } => {
                    if transform.is_uniform() {
                        *origin = transform.apply(*origin);
                    } else {
                        let control_points =
                            runtime_rotation_corners(*origin, *angle_deg, *scale, transform)?;
                        state.payload = KeyformPayload::Warp { control_points };
                    }
                }
                KeyformPayload::DeformPath { control_points } => {
                    runtime_warp_transform(control_points, transform);
                }
                KeyformPayload::ArtPath { points } => {
                    for point in points {
                        point.pos = transform.apply(point.pos);
                    }
                }
                KeyformPayload::ArtMesh { vertex_offsets, .. } => {
                    runtime_offsets_transform(vertex_offsets, transform);
                }
            }
        }
    }

    Ok(runtime)
}

fn push_i32(out: &mut Vec<u8>, value: i32) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn push_i32_slice(out: &mut Vec<u8>, values: &[i32]) {
    for &value in values {
        push_i32(out, value);
    }
}

fn push_u32_slice(out: &mut Vec<u8>, values: &[u32]) {
    for &value in values {
        out.extend_from_slice(&value.to_le_bytes());
    }
}

fn push_u16_slice(out: &mut Vec<u8>, values: &[u16]) {
    for &value in values {
        out.extend_from_slice(&value.to_le_bytes());
    }
}

fn push_f32_slice(out: &mut Vec<u8>, values: &[f32]) {
    for &value in values {
        out.extend_from_slice(&value.to_le_bytes());
    }
}

fn i32_bytes(values: &[i32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 4);
    push_i32_slice(&mut out, values);
    out
}

fn u16_bytes(values: &[u16]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 2);
    push_u16_slice(&mut out, values);
    out
}

fn f32_bytes(values: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 4);
    push_f32_slice(&mut out, values);
    out
}

fn dimension_product(dimensions: &[ParamDimension], label: &str) -> Result<usize, Moc3Error> {
    let mut product = 1usize;
    for dimension in dimensions {
        product = checked_mul(product, dimension.keys.len(), label)?;
    }
    Ok(product)
}

fn validate_dimensions(
    dimensions: &[ParamDimension],
    param_indices: &HashMap<String, usize>,
    label: &str,
) -> Result<(), Moc3Error> {
    for dimension in dimensions {
        if !param_indices.contains_key(&dimension.param_id) {
            return Err(Moc3Error::Export(format!(
                "{label} references missing parameter `{}`",
                dimension.param_id
            )));
        }
        if dimension.keys.is_empty() {
            return Err(Moc3Error::Export(format!(
                "{label} dimension `{}` has no keys",
                dimension.param_id
            )));
        }
        for &key in &dimension.keys {
            finite(key, label)?;
        }
        if dimension.keys.windows(2).any(|pair| pair[0] >= pair[1]) {
            return Err(Moc3Error::Export(format!(
                "{label} dimension `{}` keys must be strictly increasing",
                dimension.param_id
            )));
        }
    }
    Ok(())
}

fn validate_keyform_binding(
    binding: &KeyformBinding,
    param_indices: &HashMap<String, usize>,
) -> Result<(), Moc3Error> {
    let label = format!("keyform binding for `{}`", binding.target_node_id);
    validate_dimensions(&binding.dimensions, param_indices, &label)?;
    if binding.keyforms.is_empty() {
        return Err(Moc3Error::Export(format!("{label} has no states")));
    }
    for state in &binding.keyforms {
        if state.coordinates.len() != binding.dimensions.len() {
            return Err(Moc3Error::Export(format!(
                "{label} state has {} coordinates, expected {}",
                state.coordinates.len(),
                binding.dimensions.len()
            )));
        }
        for &coordinate in &state.coordinates {
            finite(coordinate, &label)?;
        }
    }
    Ok(())
}

fn add_band(bands: &mut Vec<Band>, dimensions: Vec<ParamDimension>) -> usize {
    let index = bands.len();
    bands.push(Band { dimensions });
    index
}

fn add_null_band(bands: &mut Vec<Band>) -> usize {
    add_band(bands, Vec::new())
}

fn add_static_band(bands: &mut Vec<Band>, params: &[Parameter]) -> Result<usize, Moc3Error> {
    let parameter = params
        .first()
        .ok_or_else(|| Moc3Error::Export("at least one parameter is required".into()))?;
    Ok(add_band(
        bands,
        vec![ParamDimension {
            param_id: parameter.id.clone(),
            keys: vec![parameter.default],
            extended_interpolation: None,
        }],
    ))
}

fn enumerate_coordinates(
    dimensions: &[ParamDimension],
    count: usize,
) -> Result<Vec<Vec<f32>>, Moc3Error> {
    let expected = dimension_product(dimensions, "keyform dimension count")?;
    if expected != count {
        return Err(Moc3Error::Export(format!(
            "cannot enumerate {count} states from dimensions that describe {expected}"
        )));
    }
    let mut coordinates = Vec::new();
    coordinates
        .try_reserve_exact(count)
        .map_err(|error| Moc3Error::Export(format!("too many keyform states: {error}")))?;
    for flat in 0..count {
        let mut remainder = flat;
        let mut state = vec![0.0; dimensions.len()];
        // MOC3's Cartesian-product layout is last-dimension-fastest.
        for index in (0..dimensions.len()).rev() {
            let keys = &dimensions[index].keys;
            state[index] = keys[remainder % keys.len()];
            remainder /= keys.len();
        }
        coordinates.push(state);
    }
    Ok(coordinates)
}

fn select_states(binding: &KeyformBinding, query: &[f32]) -> Vec<(usize, f32)> {
    let mut distances = Vec::with_capacity(binding.keyforms.len());
    for (index, state) in binding.keyforms.iter().enumerate() {
        let mut distance = 0.0f32;
        for (dimension, (&query_value, &state_value)) in binding
            .dimensions
            .iter()
            .zip(query.iter().zip(state.coordinates.iter()))
        {
            let first = dimension.keys.first().copied().unwrap_or(0.0);
            let last = dimension.keys.last().copied().unwrap_or(first);
            let span = (last - first).abs().max(1.0);
            distance = distance.max(((state_value - query_value) / span).abs());
        }
        distances.push((index, distance));
    }
    let minimum = distances
        .iter()
        .map(|(_, distance)| *distance)
        .fold(f32::INFINITY, f32::min);
    if !minimum.is_finite() {
        return Vec::new();
    }
    if minimum <= 1e-5 {
        if let Some(exact) = distances
            .iter()
            .copied()
            .find(|(_, distance)| *distance <= 1e-5)
        {
            return vec![exact];
        }
    }
    distances
        .into_iter()
        .min_by(|left, right| left.1.total_cmp(&right.1))
        .into_iter()
        .collect()
}

fn blend_warp_points(
    binding: &KeyformBinding,
    query: &[f32],
    base: &[[f32; 2]],
) -> Result<Vec<[f32; 2]>, Moc3Error> {
    let selected = select_states(binding, query);
    if selected.is_empty() {
        return Err(Moc3Error::Export(format!(
            "no warp keyform matches query {query:?}"
        )));
    }
    let mut points = vec![[0.0f32, 0.0f32]; base.len()];
    for (index, _) in &selected {
        let control_points = match &binding.keyforms[*index].payload {
            KeyformPayload::Warp { control_points } if control_points.len() == base.len() => {
                control_points
            }
            _ => {
                return Err(Moc3Error::Export(format!(
                    "warp binding `{}` contains a malformed state",
                    binding.target_node_id
                )));
            }
        };
        for (target, source) in points.iter_mut().zip(control_points.iter()) {
            target[0] += source[0];
            target[1] += source[1];
        }
    }
    let scale = 1.0 / selected.len() as f32;
    for point in &mut points {
        point[0] *= scale;
        point[1] *= scale;
    }
    Ok(points)
}

fn blend_deform_path_points(
    binding: &KeyformBinding,
    query: &[f32],
    base: &[[f32; 2]],
) -> Result<Vec<[f32; 2]>, Moc3Error> {
    let selected = select_states(binding, query);
    if selected.is_empty() {
        return Err(Moc3Error::Export(format!(
            "no DeformPath keyform matches query {query:?}"
        )));
    }
    let mut points = vec![[0.0f32, 0.0f32]; base.len()];
    let mut weight_sum = 0.0f32;
    let selected_count = selected.len() as f32;
    for (index, _weight) in selected {
        let control_points = match &binding.keyforms[index].payload {
            KeyformPayload::DeformPath { control_points } if control_points.len() == base.len() => {
                control_points
            }
            _ => {
                return Err(Moc3Error::Export(format!(
                    "DeformPath binding `{}` contains a malformed state",
                    binding.target_node_id
                )));
            }
        };
        let normalized = 1.0 / selected_count.max(1.0);
        weight_sum += normalized;
        for (target, source) in points.iter_mut().zip(control_points.iter()) {
            target[0] += source[0] * normalized;
            target[1] += source[1] * normalized;
        }
    }
    if (weight_sum - 1.0).abs() > 1e-4 {
        return Err(Moc3Error::Export(
            "DeformPath keyform interpolation produced an invalid weight".into(),
        ));
    }
    Ok(points)
}

fn blend_rotation(
    binding: &KeyformBinding,
    query: &[f32],
    base: &RotationDeformerData,
) -> Result<RotationDeformerData, Moc3Error> {
    let selected = select_states(binding, query);
    if selected.is_empty() {
        return Err(Moc3Error::Export(format!(
            "no rotation keyform matches query {query:?}"
        )));
    }
    let mut result = RotationDeformerData {
        origin: [0.0, 0.0],
        angle_deg: 0.0,
        scale: [0.0, 0.0],
    };
    for (index, _) in &selected {
        match &binding.keyforms[*index].payload {
            KeyformPayload::Rotation {
                origin,
                angle_deg,
                scale,
            } => {
                result.origin[0] += origin[0];
                result.origin[1] += origin[1];
                result.angle_deg += angle_deg;
                result.scale[0] += scale[0];
                result.scale[1] += scale[1];
            }
            _ => {
                return Err(Moc3Error::Export(format!(
                    "rotation binding `{}` contains a malformed state",
                    binding.target_node_id
                )));
            }
        }
    }
    let count = selected.len() as f32;
    result.origin[0] /= count;
    result.origin[1] /= count;
    result.angle_deg /= count;
    result.scale[0] /= count;
    result.scale[1] /= count;
    let _ = base;
    Ok(result)
}

fn blend_artmesh_state(
    binding: &KeyformBinding,
    query: &[f32],
    mesh: &ArtMeshData,
) -> Result<(Vec<[f32; 2]>, f32, [f32; 4], [f32; 4], i32), Moc3Error> {
    let selected = select_states(binding, query);
    if selected.is_empty() {
        return Err(Moc3Error::Export(format!(
            "no ArtMesh keyform matches query {query:?} for `{}`",
            binding.target_node_id
        )));
    }
    let mut offsets = vec![[0.0f32, 0.0f32]; mesh.vertices.len()];
    let mut opacity = 0.0f32;
    let mut multiply = [0.0f32; 4];
    let mut screen = [0.0f32; 4];
    let mut draw_order = mesh.draw_order;
    let count = selected.len() as f32;
    for (position, (index, _)) in selected.iter().enumerate() {
        match &binding.keyforms[*index].payload {
            KeyformPayload::ArtMesh {
                vertex_offsets,
                opacity: state_opacity,
                multiply_color,
                screen_color,
                draw_order: state_draw_order,
            } => {
                if !vertex_offsets.is_empty() && vertex_offsets.len() != mesh.vertices.len() {
                    return Err(Moc3Error::Export(format!(
                        "ArtMesh `{}` has mismatched keyform offsets",
                        binding.target_node_id
                    )));
                }
                for (target, source) in offsets.iter_mut().zip(vertex_offsets.iter()) {
                    target[0] += source[0];
                    target[1] += source[1];
                }
                opacity += state_opacity.unwrap_or(mesh.opacity);
                for channel in 0..4 {
                    multiply[channel] += multiply_color.unwrap_or(mesh.multiply_color)[channel];
                    screen[channel] += screen_color.unwrap_or(mesh.screen_color)[channel];
                }
                if position == 0 {
                    draw_order = state_draw_order.unwrap_or(mesh.draw_order);
                }
            }
            _ => {
                return Err(Moc3Error::Export(format!(
                    "ArtMesh `{}` contains a non-ArtMesh keyform",
                    binding.target_node_id
                )));
            }
        }
    }
    for offset in &mut offsets {
        offset[0] /= count;
        offset[1] /= count;
    }
    opacity /= count;
    for channel in 0..4 {
        multiply[channel] /= count;
        screen[channel] /= count;
    }
    Ok((offsets, opacity, multiply, screen, draw_order))
}

fn nearest_ancestor_part(
    start: Option<&str>,
    nodes: &HashMap<&str, &Node>,
    part_indices: &HashMap<String, usize>,
) -> Option<usize> {
    let mut current = start;
    let mut visited = HashSet::new();
    while let Some(id) = current {
        if !visited.insert(id) {
            return None;
        }
        if let Some(&index) = part_indices.get(id) {
            return Some(index);
        }
        current = nodes.get(id).and_then(|node| node.parent_id.as_deref());
    }
    None
}

fn nearest_ancestor_deformer(
    start: Option<&str>,
    nodes: &HashMap<&str, &Node>,
    deformer_indices: &HashMap<String, usize>,
) -> Option<usize> {
    let mut current = start;
    let mut visited = HashSet::new();
    while let Some(id) = current {
        if !visited.insert(id) {
            return None;
        }
        if let Some(&index) = deformer_indices.get(id) {
            return Some(index);
        }
        current = nodes.get(id).and_then(|node| node.parent_id.as_deref());
    }
    None
}

fn inherited_part_opacity(
    start: Option<&str>,
    nodes: &HashMap<&str, &Node>,
) -> Result<f32, Moc3Error> {
    let mut current = start;
    let mut visited = HashSet::new();
    let mut opacity = 1.0f32;
    while let Some(id) = current {
        if !visited.insert(id) {
            break;
        }
        let Some(node) = nodes.get(id) else {
            break;
        };
        if let NodeKind::Part {
            opacity: part_opacity,
            ..
        } = node.kind
        {
            opacity *= finite(part_opacity, "part opacity")?;
        }
        current = node.parent_id.as_deref();
    }
    Ok(opacity)
}

fn inherited_visibility(start: Option<&str>, nodes: &HashMap<&str, &Node>) -> bool {
    let mut current = start;
    let mut visited = HashSet::new();
    while let Some(id) = current {
        if !visited.insert(id) {
            break;
        }
        let Some(node) = nodes.get(id) else {
            break;
        };
        if !node.visible {
            return false;
        }
        current = node.parent_id.as_deref();
    }
    true
}

fn morph_dimensions(
    mesh: &ArtMeshData,
    params: &[Parameter],
    param_indices: &HashMap<String, usize>,
    existing: &[ParamDimension],
) -> Result<Vec<ParamDimension>, Moc3Error> {
    let mut result = Vec::new();
    for target in &mesh.morph_targets {
        if target.vertex_offsets.len() != mesh.vertices.len() {
            return Err(Moc3Error::Export(format!(
                "morph target `{}` has {} offsets for {} vertices",
                target.id,
                target.vertex_offsets.len(),
                mesh.vertices.len()
            )));
        }
        if existing
            .iter()
            .any(|dimension| dimension.param_id == target.param_id)
            || result
                .iter()
                .any(|dimension: &ParamDimension| dimension.param_id == target.param_id)
        {
            continue;
        }
        let Some(&parameter_index) = param_indices.get(&target.param_id) else {
            return Err(Moc3Error::Export(format!(
                "morph target `{}` references missing parameter `{}`",
                target.id, target.param_id
            )));
        };
        let parameter = &params[parameter_index];
        let mut keys = vec![parameter.min, parameter.default, parameter.max];
        keys.sort_by(f32::total_cmp);
        keys.dedup_by(|left, right| (*left - *right).abs() <= 1e-6);
        result.push(ParamDimension {
            param_id: target.param_id.clone(),
            keys,
            extended_interpolation: None,
        });
    }
    Ok(result)
}

fn split_uniform_scale(scale: [f32; 2]) -> Result<(f32, i32, i32), Moc3Error> {
    let x = finite(scale[0], "rotation scale x")?;
    let y = finite(scale[1], "rotation scale y")?;
    if (x.abs() - y.abs()).abs() > 1e-4 {
        return Err(Moc3Error::Export(format!(
            "MOC3 rotation deformers only support uniform scale, got [{x}, {y}]"
        )));
    }
    if x.abs() <= 1e-8 {
        return Err(Moc3Error::Export(
            "rotation deformer scale must be non-zero".into(),
        ));
    }
    Ok((x.abs(), i32::from(x < 0.0), i32::from(y < 0.0)))
}

fn tessellated_art_path(_node: &Node, path: &ArtPathData) -> Option<ArtMeshData> {
    let (vertices, uvs, indices, average_opacity) =
        crate::evaluator::tessellate_art_path(&path.points, path.closed);
    if vertices.is_empty() {
        return None;
    }
    Some(ArtMeshData {
        texture_id: path
            .texture_id
            .clone()
            .unwrap_or_else(|| "texture_00".into()),
        vertices,
        uvs,
        indices,
        blend_mode: path.blend_mode,
        opacity: (path.opacity * average_opacity).clamp(0.0, 1.0),
        multiply_color: path.color,
        screen_color: [0.0, 0.0, 0.0, 0.0],
        draw_order: path.draw_order,
        mask_ids: path.mask_ids.clone(),
        is_mask_inverted: path.is_mask_inverted,
        morph_targets: Vec::new(),
        hit_area_name: None,
        user_data: None,
    })
}

fn ensure_mesh(mesh: &mut ArtMeshData, id: &str) -> Result<(), Moc3Error> {
    if mesh.vertices.len() > u16::MAX as usize {
        return Err(Moc3Error::Export(format!(
            "ArtMesh `{id}` has {} vertices; MOC3 indices are u16 and support at most {}",
            mesh.vertices.len(),
            u16::MAX
        )));
    }
    if mesh.vertices.len() < 3 {
        return Err(Moc3Error::Export(format!(
            "ArtMesh `{id}` must have at least 3 vertices"
        )));
    }
    mesh.uvs.resize(mesh.vertices.len(), [0.0, 0.0]);
    for point in mesh.vertices.iter().chain(mesh.uvs.iter()) {
        finite(point[0], id)?;
        finite(point[1], id)?;
    }
    if mesh.indices.is_empty() {
        for index in 1..mesh.vertices.len() - 1 {
            mesh.indices
                .extend_from_slice(&[0, index as u32, (index + 1) as u32]);
        }
    }
    if mesh.indices.len() % 3 != 0 {
        return Err(Moc3Error::Export(format!(
            "ArtMesh `{id}` has an index list that is not a triangle list"
        )));
    }
    for &index in &mesh.indices {
        if index as usize >= mesh.vertices.len() {
            return Err(Moc3Error::Export(format!(
                "ArtMesh `{id}` contains out-of-range vertex index {index}"
            )));
        }
    }
    Ok(())
}

/// Serialize a project using the standard MOC3 body only. The editable source project is not
/// embedded unless [`Moc3ExportOptions::embed_source_project`] is enabled.
pub fn export_moc3_binary(project: &Project, version: u8) -> Result<Vec<u8>, Moc3Error> {
    export_moc3_binary_with_options(project, version, Moc3ExportOptions::default())
}

pub fn export_moc3_binary_with_options(
    project: &Project,
    version: u8,
    options: Moc3ExportOptions,
) -> Result<Vec<u8>, Moc3Error> {
    if !(1..=5).contains(&version) {
        return Err(Moc3Error::UnsupportedVersion(version));
    }

    let source_project = project;
    let runtime_project = runtime_project_coordinates(source_project)?;
    let project = &runtime_project;

    let mut params = project.parameters.clone();
    for parameter in &mut params {
        finite(parameter.min, "parameter minimum")?;
        finite(parameter.max, "parameter maximum")?;
        finite(parameter.default, "parameter default")?;
        if parameter.min > parameter.max {
            return Err(Moc3Error::Export(format!(
                "parameter `{}` has min > max",
                parameter.id
            )));
        }
        parameter.default = parameter.default.clamp(parameter.min, parameter.max);
    }
    let known_parameter_ids: HashSet<String> = params
        .iter()
        .map(|parameter| parameter.id.clone())
        .collect();
    let mut inferred_parameter_ids = HashSet::new();
    for binding in &project.keyforms {
        for dimension in &binding.dimensions {
            if known_parameter_ids.contains(&dimension.param_id)
                || !inferred_parameter_ids.insert(dimension.param_id.clone())
                || dimension.keys.is_empty()
            {
                continue;
            }
            let minimum = dimension.keys.iter().copied().fold(f32::INFINITY, f32::min);
            let maximum = dimension
                .keys
                .iter()
                .copied()
                .fold(f32::NEG_INFINITY, f32::max);
            if minimum.is_finite() && maximum.is_finite() {
                params.push(Parameter {
                    id: dimension.param_id.clone(),
                    name: dimension.param_id.clone(),
                    min: minimum,
                    max: maximum,
                    default: 0.0f32.clamp(minimum, maximum),
                    repeats: false,
                    group_id: None,
                    locked: false,
                });
            }
        }
    }
    if params.is_empty() {
        params.push(Parameter {
            id: "ParamAngleX".into(),
            name: "Angle X".into(),
            min: -30.0,
            max: 30.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
    }
    let param_indices: HashMap<String, usize> = params
        .iter()
        .enumerate()
        .map(|(index, parameter)| (parameter.id.clone(), index))
        .collect();
    if param_indices.len() != params.len() {
        return Err(Moc3Error::Export(
            "project contains duplicate parameter IDs".into(),
        ));
    }

    let mut part_nodes: Vec<Node> = project
        .nodes
        .iter()
        .filter(|node| matches!(node.kind, NodeKind::Part { .. }))
        .cloned()
        .collect();
    if part_nodes.is_empty() {
        part_nodes.push(Node {
            id: "PartRoot".into(),
            name: "PartRoot".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::Part {
                collapsed: false,
                opacity: 1.0,
            },
        });
    }
    let part_indices: HashMap<String, usize> = part_nodes
        .iter()
        .enumerate()
        .map(|(index, node)| (node.id.clone(), index))
        .collect();
    if part_indices.len() != part_nodes.len() {
        return Err(Moc3Error::Export(
            "project contains duplicate Part IDs".into(),
        ));
    }

    let mut deformer_nodes = Vec::<DeformerNode>::new();
    let mut deform_path_nodes = Vec::<(String, DeformPathData)>::new();
    for node in &project.nodes {
        let data = match &node.kind {
            NodeKind::WarpDeformer(data) => DeformerData::Warp(data.clone()),
            NodeKind::RotationDeformer(data) => DeformerData::Rotation(data.clone()),
            NodeKind::DeformPath(data) => {
                deform_path_nodes.push((node.id.clone(), data.clone()));
                continue;
            }
            _ => continue,
        };
        deformer_nodes.push(DeformerNode {
            id: node.id.clone(),
            parent_id: node.parent_id.clone(),
            visible: node.visible,
            data,
        });
    }
    let mut deformer_indices: HashMap<String, usize> = HashMap::new();
    deformer_indices.insert("__root_deformer__".into(), 0);
    for (index, node) in deformer_nodes.iter().enumerate() {
        if deformer_indices
            .insert(node.id.clone(), index + 1)
            .is_some()
        {
            return Err(Moc3Error::Export(format!(
                "duplicate deformer id `{}`",
                node.id
            )));
        }
    }

    let mut mesh_nodes: Vec<(Node, ArtMeshData)> = project
        .nodes
        .iter()
        .filter_map(|node| match &node.kind {
            NodeKind::ArtMesh(mesh) => Some((node.clone(), mesh.clone())),
            NodeKind::ArtPath(path) if path.points.len() >= 2 => {
                tessellated_art_path(node, path).map(|mesh| (node.clone(), mesh))
            }
            _ => None,
        })
        .collect();
    if mesh_nodes.is_empty() {
        mesh_nodes.push((
            Node {
                id: "__default_mesh__".into(),
                name: "__default_mesh__".into(),
                parent_id: Some(part_nodes[0].id.clone()),
                visible: true,
                locked: false,
                kind: NodeKind::Part {
                    collapsed: false,
                    opacity: 1.0,
                },
            },
            ArtMeshData {
                texture_id: "texture_00".into(),
                vertices: vec![[0.0, 0.0], [64.0, 0.0], [0.0, 64.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order: 500,
                mask_ids: Vec::new(),
                is_mask_inverted: false,
                morph_targets: Vec::new(),
                hit_area_name: None,
                user_data: None,
            },
        ));
    }
    for (node, mesh) in &mut mesh_nodes {
        ensure_mesh(mesh, &node.id)?;
    }
    let mesh_indices: HashMap<String, usize> = mesh_nodes
        .iter()
        .enumerate()
        .map(|(index, (node, _))| (node.id.clone(), index))
        .collect();
    if mesh_indices.len() != mesh_nodes.len() {
        return Err(Moc3Error::Export(
            "project contains duplicate ArtMesh IDs".into(),
        ));
    }

    let mut all_node_ids = HashSet::new();
    for node in &project.nodes {
        if node.id == "__root_deformer__" {
            return Err(Moc3Error::Export("`__root_deformer__` is reserved".into()));
        }
        if !all_node_ids.insert(node.id.as_str()) {
            return Err(Moc3Error::Export(format!(
                "duplicate node id `{}`",
                node.id
            )));
        }
    }
    if project
        .keyforms
        .iter()
        .any(|binding| binding.target_node_id.starts_with("__default"))
    {
        return Err(Moc3Error::Export(
            "synthetic node IDs must not have authored keyforms".into(),
        ));
    }
    let mut keyform_map: HashMap<&str, &KeyformBinding> = HashMap::new();
    for binding in &project.keyforms {
        validate_keyform_binding(binding, &param_indices)?;
        if keyform_map
            .insert(binding.target_node_id.as_str(), binding)
            .is_some()
        {
            return Err(Moc3Error::Export(format!(
                "duplicate keyform binding for `{}`",
                binding.target_node_id
            )));
        }
    }
    if !project.glues.is_empty() {
        return Err(Moc3Error::Export(
            "MOC3 glue export is not implemented yet".into(),
        ));
    }

    let node_map: HashMap<&str, &Node> = project
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let texture_indices: HashMap<&str, i32> = project
        .textures
        .iter()
        .enumerate()
        .map(|(index, texture)| (texture.id.as_str(), index as i32))
        .collect();

    let mut bands = vec![Band {
        dimensions: Vec::new(),
    }];
    let part_bands: Vec<usize> = part_nodes
        .iter()
        .map(|_| add_null_band(&mut bands))
        .collect();
    let root_band = add_static_band(&mut bands, &params)?;

    let mut deformer_bands = Vec::with_capacity(deformer_nodes.len());
    for node in &deformer_nodes {
        let band = if let Some(binding) = keyform_map.get(node.id.as_str()) {
            add_band(&mut bands, binding.dimensions.clone())
        } else {
            add_static_band(&mut bands, &params)?
        };
        deformer_bands.push(band);
    }

    let mut mesh_bands = Vec::with_capacity(mesh_nodes.len());
    let mut mesh_combined_dimensions = Vec::with_capacity(mesh_nodes.len());
    for (node, mesh) in &mesh_nodes {
        let base_dimensions = keyform_map
            .get(node.id.as_str())
            .map(|binding| binding.dimensions.clone())
            .unwrap_or_default();
        let morphs = morph_dimensions(mesh, &params, &param_indices, &base_dimensions)?;
        let mut combined = base_dimensions;
        combined.extend(morphs);
        for (path_id, path) in &deform_path_nodes {
            if !path.target_mesh_ids.iter().any(|target| target == &node.id) {
                continue;
            }
            if let Some(binding) = keyform_map.get(path_id.as_str()) {
                for dimension in &binding.dimensions {
                    if !combined
                        .iter()
                        .any(|existing| existing.param_id == dimension.param_id)
                    {
                        combined.push(dimension.clone());
                    }
                }
            }
        }
        let band = if combined.is_empty() {
            add_static_band(&mut bands, &params)?
        } else {
            add_band(&mut bands, combined.clone())
        };
        mesh_bands.push(band);
        mesh_combined_dimensions.push(combined);
    }

    // Group parameter bindings by owner parameter so every parameter's range is contiguous.
    let mut unique_dimensions: Vec<ParamDimension> = Vec::new();
    let mut seen_dimensions = HashSet::new();
    for band in &bands {
        for dimension in &band.dimensions {
            let key = (
                dimension.param_id.clone(),
                dimension
                    .keys
                    .iter()
                    .map(|value| value.to_bits())
                    .collect::<Vec<_>>(),
            );
            if seen_dimensions.insert(key) {
                unique_dimensions.push(dimension.clone());
            }
        }
    }
    let mut per_parameter_dimensions: Vec<Vec<ParamDimension>> = vec![Vec::new(); params.len()];
    for dimension in unique_dimensions {
        let index = param_indices[&dimension.param_id];
        per_parameter_dimensions[index].push(dimension);
    }
    let mut parameter_binding_begin = Vec::with_capacity(params.len());
    let mut parameter_binding_count = Vec::with_capacity(params.len());
    let mut parameter_bindings_keys_begin = Vec::new();
    let mut parameter_bindings_keys_count = Vec::new();
    let mut keys = Vec::new();
    let mut dimension_to_binding: HashMap<(String, Vec<u32>), i32> = HashMap::new();
    for (parameter_index, parameter) in params.iter().enumerate() {
        if per_parameter_dimensions[parameter_index].is_empty() {
            per_parameter_dimensions[parameter_index].push(ParamDimension {
                param_id: parameter.id.clone(),
                keys: vec![parameter.min, parameter.default, parameter.max],
                extended_interpolation: None,
            });
        }
        let begin = parameter_bindings_keys_begin.len();
        parameter_binding_begin.push(usize_to_i32(begin, "parameter binding begin")?);
        parameter_binding_count.push(usize_to_i32(
            per_parameter_dimensions[parameter_index].len(),
            "parameter binding count",
        )?);
        for dimension in &per_parameter_dimensions[parameter_index] {
            let binding_index = parameter_bindings_keys_begin.len();
            let key_begin = keys.len();
            keys.extend_from_slice(&dimension.keys);
            parameter_bindings_keys_begin.push(usize_to_i32(key_begin, "parameter keys begin")?);
            parameter_bindings_keys_count
                .push(usize_to_i32(dimension.keys.len(), "parameter keys count")?);
            let map_key = (
                dimension.param_id.clone(),
                dimension.keys.iter().map(|value| value.to_bits()).collect(),
            );
            dimension_to_binding.insert(map_key, usize_to_i32(binding_index, "parameter binding")?);
        }
    }

    let mut keyform_band_begin = Vec::with_capacity(bands.len());
    let mut keyform_band_count = Vec::with_capacity(bands.len());
    let mut parameter_binding_indices = Vec::new();
    for band in &bands {
        if band.dimensions.is_empty() {
            keyform_band_begin.push(0i32);
            keyform_band_count.push(0i32);
            continue;
        }
        keyform_band_begin.push(usize_to_i32(
            parameter_binding_indices.len(),
            "keyform band begin",
        )?);
        keyform_band_count.push(usize_to_i32(band.dimensions.len(), "keyform band count")?);
        for dimension in &band.dimensions {
            let map_key = (
                dimension.param_id.clone(),
                dimension
                    .keys
                    .iter()
                    .map(|value| value.to_bits())
                    .collect::<Vec<_>>(),
            );
            parameter_binding_indices.push(
                *dimension_to_binding
                    .get(&map_key)
                    .ok_or_else(|| Moc3Error::Export("missing parameter binding".into()))?,
            );
        }
    }

    // Deformer table. Index 0 is a synthetic identity rotation deformer.
    let mut deformer_ids = vec!["__root_deformer__".to_string()];
    let mut deformer_band_indices = vec![usize_to_i32(root_band, "root deformer band")?];
    let mut deformer_visible = vec![1i32];
    let mut deformer_enabled = vec![1i32];
    let mut deformer_parent_part = vec![-1i32];
    let mut deformer_parent_deformer = vec![-1i32];
    let mut deformer_types = vec![1i32];
    let mut deformer_specific_indices = vec![0i32];

    let mut warp_band_indices = Vec::new();
    let mut warp_keyform_begin = Vec::new();
    let mut warp_keyform_count = Vec::new();
    let mut warp_vertex_count = Vec::new();
    let mut warp_rows = Vec::new();
    let mut warp_cols = Vec::new();
    let mut warp_keyform_opacity = Vec::new();
    let mut warp_keyform_position_begin = Vec::new();
    let mut warp_keyform_color_begin = Vec::new();

    let mut rotation_band_indices = vec![usize_to_i32(root_band, "root deformer band")?];
    let mut rotation_keyform_begin = vec![0i32];
    let mut rotation_keyform_count = vec![1i32];
    let mut rotation_base_angle = vec![0.0f32];
    let mut rotation_keyform_opacity = vec![1.0f32];
    let mut rotation_keyform_angle = vec![0.0f32];
    let mut rotation_keyform_origin_x = vec![0.0f32];
    let mut rotation_keyform_origin_y = vec![0.0f32];
    let mut rotation_keyform_scale = vec![1.0f32];
    let mut rotation_keyform_reflect_x = vec![0i32];
    let mut rotation_keyform_reflect_y = vec![0i32];
    let mut rotation_keyform_color_begin = vec![0i32];

    let mut keyform_positions = Vec::<f32>::new();
    let mut multiply_r = vec![1.0f32];
    let mut multiply_g = vec![1.0f32];
    let mut multiply_b = vec![1.0f32];
    let mut screen_r = vec![0.0f32];
    let mut screen_g = vec![0.0f32];
    let mut screen_b = vec![0.0f32];

    let mut warp_specific_index = 0usize;
    let mut rotation_specific_index = 1usize;
    for (deformer_index, node) in deformer_nodes.iter().enumerate() {
        let mocc_deformer_index = deformer_index + 1;
        let parent_deformer =
            nearest_ancestor_deformer(node.parent_id.as_deref(), &node_map, &deformer_indices)
                .unwrap_or(0);
        let parent_part = if parent_deformer == 0 {
            nearest_ancestor_part(node.parent_id.as_deref(), &node_map, &part_indices)
                .map(|index| usize_to_i32(index, "parent part"))
                .transpose()?
                .unwrap_or(-1)
        } else {
            -1
        };
        deformer_ids.push(node.id.clone());
        deformer_band_indices.push(usize_to_i32(
            deformer_bands[deformer_index],
            "deformer keyform band",
        )?);
        deformer_visible.push(i32::from(node.visible));
        deformer_enabled.push(1);
        deformer_parent_part.push(parent_part);
        deformer_parent_deformer.push(usize_to_i32(parent_deformer, "parent deformer")?);

        let binding = keyform_map.get(node.id.as_str());
        let state_coordinates = if let Some(binding) = binding {
            let count = dimension_product(&binding.dimensions, "deformer keyform count")?;
            enumerate_coordinates(&binding.dimensions, count)?
        } else {
            vec![Vec::new()]
        };
        let state_count = state_coordinates.len();
        let color_start = multiply_r.len();
        for _ in 0..state_count {
            multiply_r.push(1.0);
            multiply_g.push(1.0);
            multiply_b.push(1.0);
            screen_r.push(0.0);
            screen_g.push(0.0);
            screen_b.push(0.0);
        }

        match &node.data {
            DeformerData::Warp(data) => {
                let expected = checked_mul(data.cols + 1, data.rows + 1, "warp grid size")?;
                if data.cols == 0 || data.rows == 0 {
                    return Err(Moc3Error::Export(format!(
                        "warp deformer `{}` must have positive rows and cols",
                        node.id
                    )));
                }
                if data.control_points.len() != expected {
                    return Err(Moc3Error::Export(format!(
                        "warp deformer `{}` has {} control points, expected {expected}",
                        node.id,
                        data.control_points.len()
                    )));
                }
                deformer_types.push(0);
                deformer_specific_indices
                    .push(usize_to_i32(warp_specific_index, "warp specific index")?);
                warp_specific_index += 1;
                warp_band_indices.push(usize_to_i32(
                    deformer_bands[deformer_index],
                    "warp deformer band",
                )?);
                warp_keyform_begin.push(usize_to_i32(
                    warp_keyform_opacity.len(),
                    "warp keyform begin",
                )?);
                warp_keyform_count.push(usize_to_i32(state_count, "warp keyform count")?);
                warp_vertex_count.push(usize_to_i32(expected, "warp vertex count")?);
                warp_rows.push(usize_to_i32(data.rows, "warp rows")?);
                warp_cols.push(usize_to_i32(data.cols, "warp cols")?);
                for coordinates in &state_coordinates {
                    let control_points = if let Some(binding) = binding {
                        blend_warp_points(binding, coordinates, &data.control_points)?
                    } else {
                        data.control_points.clone()
                    };
                    if control_points.len() != expected {
                        return Err(Moc3Error::Export(format!(
                            "warp deformer `{}` keyform has {} points, expected {expected}",
                            node.id,
                            control_points.len()
                        )));
                    }
                    warp_keyform_opacity.push(1.0);
                    warp_keyform_position_begin.push(usize_to_i32(
                        keyform_positions.len(),
                        "warp keyform position begin",
                    )?);
                    warp_keyform_color_begin
                        .push(usize_to_i32(color_start, "warp keyform color begin")?);
                    for point in &control_points {
                        keyform_positions.push(finite(point[0], "warp control point")?);
                        keyform_positions.push(finite(point[1], "warp control point")?);
                    }
                }
                let _ = mocc_deformer_index;
            }
            DeformerData::Rotation(data) => {
                deformer_types.push(1);
                deformer_specific_indices.push(usize_to_i32(
                    rotation_specific_index,
                    "rotation specific index",
                )?);
                rotation_specific_index += 1;
                let (base_scale, base_reflect_x, base_reflect_y) = split_uniform_scale(data.scale)?;
                rotation_band_indices.push(usize_to_i32(
                    deformer_bands[deformer_index],
                    "rotation deformer band",
                )?);
                rotation_keyform_begin.push(usize_to_i32(
                    rotation_keyform_opacity.len(),
                    "rotation keyform begin",
                )?);
                rotation_keyform_count.push(usize_to_i32(state_count, "rotation keyform count")?);
                rotation_base_angle.push(0.0);
                for coordinates in &state_coordinates {
                    let (origin, angle, scale, color) = if let Some(binding) = binding {
                        let blended = blend_rotation(binding, coordinates, data)?;
                        (
                            blended.origin,
                            blended.angle_deg,
                            blended.scale,
                            color_start,
                        )
                    } else {
                        (
                            data.origin,
                            data.angle_deg,
                            [base_scale, base_scale],
                            color_start,
                        )
                    };
                    let (scale, reflect_x, reflect_y) = if binding.is_some() {
                        split_uniform_scale(scale)?
                    } else {
                        (base_scale, base_reflect_x, base_reflect_y)
                    };
                    rotation_keyform_opacity.push(1.0);
                    rotation_keyform_angle.push(finite(angle, "rotation angle")?);
                    rotation_keyform_origin_x.push(finite(origin[0], "rotation origin")?);
                    rotation_keyform_origin_y.push(finite(origin[1], "rotation origin")?);
                    rotation_keyform_scale.push(scale);
                    rotation_keyform_reflect_x.push(reflect_x);
                    rotation_keyform_reflect_y.push(reflect_y);
                    rotation_keyform_color_begin
                        .push(usize_to_i32(color, "rotation keyform color begin")?);
                }
            }
        }
    }

    let mut artmesh_ids = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_band_indices = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_keyform_begin = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_keyform_count = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_visible = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_enabled = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_parent_part = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_parent_deformer = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_texture_index = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_drawable_flags = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_render_vertex_count = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_uv_begin = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_position_index_begin = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_flat_index_count = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_mask_begin = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_mask_count = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_blend_mode = Vec::with_capacity(mesh_nodes.len());
    let mut artmesh_color_begin_v4 = Vec::with_capacity(mesh_nodes.len());

    let mut artmesh_keyform_opacity = Vec::new();
    let mut artmesh_keyform_draw_order = Vec::new();
    let mut artmesh_keyform_position_begin = Vec::new();
    let mut artmesh_keyform_color_begin = Vec::new();

    let mut uvs = Vec::<f32>::new();
    let mut position_indices = Vec::<u16>::new();
    // The validator requires every begin index to point into a real array, even for count=0.
    let mut drawable_masks = vec![-1i32];

    for (mesh_index, (node, mesh)) in mesh_nodes.iter().enumerate() {
        artmesh_ids.push(node.id.clone());
        artmesh_band_indices.push(usize_to_i32(
            mesh_bands[mesh_index],
            "ArtMesh keyform band",
        )?);
        let part_opacity = inherited_part_opacity(node.parent_id.as_deref(), &node_map)?;
        artmesh_visible.push(i32::from(
            node.visible && inherited_visibility(node.parent_id.as_deref(), &node_map),
        ));
        artmesh_enabled.push(1);
        let parent_deformer =
            nearest_ancestor_deformer(node.parent_id.as_deref(), &node_map, &deformer_indices)
                .unwrap_or(0);
        artmesh_parent_deformer.push(usize_to_i32(parent_deformer, "ArtMesh parent deformer")?);
        artmesh_parent_part.push(if parent_deformer == 0 {
            nearest_ancestor_part(node.parent_id.as_deref(), &node_map, &part_indices)
                .map(|index| usize_to_i32(index, "ArtMesh parent part"))
                .transpose()?
                .unwrap_or(-1)
        } else {
            -1
        });
        artmesh_texture_index.push(
            texture_indices
                .get(mesh.texture_id.as_str())
                .copied()
                .unwrap_or(0),
        );
        let blend_code = match mesh.blend_mode {
            BlendMode::Normal => 0u8,
            BlendMode::Additive => 1,
            BlendMode::Multiply => 2,
            BlendMode::Screen => 3,
        };
        artmesh_blend_mode.push(i32::from(blend_code));
        artmesh_drawable_flags
            .push(0x04 | (blend_code & 0x03) | (u8::from(mesh.is_mask_inverted) << 3));
        artmesh_render_vertex_count.push(usize_to_i32(
            mesh.vertices.len(),
            "ArtMesh render vertex count",
        )?);
        // MOC3 stores this as a float offset into the UV pool, not a vertex offset.
        artmesh_uv_begin.push(usize_to_i32(uvs.len(), "ArtMesh UV begin")?);
        for &[u, v] in mesh.uvs.iter().take(mesh.vertices.len()) {
            uvs.push(u);
            uvs.push(1.0 - v);
        }
        artmesh_position_index_begin.push(usize_to_i32(
            position_indices.len(),
            "ArtMesh position index begin",
        )?);
        artmesh_flat_index_count.push(usize_to_i32(
            mesh.indices.len(),
            "ArtMesh flat index count",
        )?);
        for &index in &mesh.indices {
            position_indices.push(index as u16);
        }
        artmesh_mask_begin.push(usize_to_i32(drawable_masks.len(), "ArtMesh mask begin")?);
        let mut valid_masks = 0i32;
        for mask_id in &mesh.mask_ids {
            if let Some(&mask_index) = mesh_indices.get(mask_id) {
                drawable_masks.push(usize_to_i32(mask_index, "drawable mask index")?);
                valid_masks += 1;
            }
        }
        artmesh_mask_count.push(valid_masks);

        let binding = keyform_map.get(node.id.as_str());
        let base_dimensions = binding
            .map(|binding| binding.dimensions.clone())
            .unwrap_or_default();
        let combined = &mesh_combined_dimensions[mesh_index];
        let output_count = if combined.is_empty() {
            1
        } else {
            dimension_product(combined, "ArtMesh output keyform count")?
        };
        let output_coordinates = enumerate_coordinates(combined, output_count)?;
        artmesh_keyform_begin.push(usize_to_i32(
            artmesh_keyform_opacity.len(),
            "ArtMesh keyform begin",
        )?);
        artmesh_keyform_count.push(usize_to_i32(output_count, "ArtMesh keyform count")?);
        artmesh_color_begin_v4.push(usize_to_i32(multiply_r.len(), "ArtMesh color begin")?);

        let morph_positions: Vec<(usize, &MorphTarget)> = mesh
            .morph_targets
            .iter()
            .filter_map(|target| {
                combined
                    .iter()
                    .position(|dimension| dimension.param_id == target.param_id)
                    .map(|position| (position, target))
            })
            .collect();

        for coordinates in &output_coordinates {
            let (vertex_offsets, opacity, multiply_color, screen_color, draw_order) =
                if let Some(binding) = binding {
                    let query = &coordinates[..base_dimensions.len()];
                    blend_artmesh_state(binding, query, mesh)?
                } else {
                    (
                        vec![[0.0, 0.0]; mesh.vertices.len()],
                        mesh.opacity,
                        mesh.multiply_color,
                        mesh.screen_color,
                        mesh.draw_order,
                    )
                };
            let mut state_vertices = mesh.vertices.clone();
            for (vertex, offset) in state_vertices.iter_mut().zip(vertex_offsets.iter()) {
                vertex[0] += offset[0];
                vertex[1] += offset[1];
            }
            for &(dimension_position, target) in &morph_positions {
                let weight = coordinates[dimension_position];
                for (vertex, offset) in state_vertices.iter_mut().zip(target.vertex_offsets.iter())
                {
                    vertex[0] += offset[0] * weight;
                    vertex[1] += offset[1] * weight;
                }
            }
            for (path_id, path) in &deform_path_nodes {
                if !path.target_mesh_ids.iter().any(|target| target == &node.id) {
                    continue;
                }
                let deformed_points = if let Some(binding) = keyform_map.get(path_id.as_str()) {
                    let query = binding
                        .dimensions
                        .iter()
                        .map(|dimension| {
                            combined
                                .iter()
                                .position(|item| item.param_id == dimension.param_id)
                                .map(|position| coordinates[position])
                                .ok_or_else(|| {
                                    Moc3Error::Export(format!(
                                        "DeformPath `{path_id}` parameter `{}` is not part of the ArtMesh keyform",
                                        dimension.param_id
                                    ))
                                })
                        })
                        .collect::<Result<Vec<_>, _>>()?;
                    blend_deform_path_points(binding, &query, &path.control_points)?
                } else {
                    path.control_points.clone()
                };
                if deformed_points.len() != path.control_points.len() {
                    return Err(Moc3Error::Export(format!(
                        "DeformPath `{path_id}` has mismatched control point counts"
                    )));
                }
                for vertex in &mut state_vertices {
                    *vertex = crate::math::deform_path::transform_point_by_deform_path(
                        *vertex,
                        &path.control_points,
                        &deformed_points,
                    );
                }
            }
            for vertex in &mut state_vertices {
                finite(vertex[0], "ArtMesh keyform vertex")?;
                finite(vertex[1], "ArtMesh keyform vertex")?;
            }
            artmesh_keyform_opacity.push(finite(opacity * part_opacity, "ArtMesh opacity")?);
            artmesh_keyform_draw_order.push(draw_order as f32);
            artmesh_keyform_position_begin.push(usize_to_i32(
                keyform_positions.len(),
                "ArtMesh keyform position begin",
            )?);
            artmesh_keyform_color_begin.push(usize_to_i32(
                multiply_r.len(),
                "ArtMesh keyform color begin",
            )?);
            multiply_r.push(finite(multiply_color[0], "multiply color")?);
            multiply_g.push(finite(multiply_color[1], "multiply color")?);
            multiply_b.push(finite(multiply_color[2], "multiply color")?);
            screen_r.push(finite(screen_color[0], "screen color")?);
            screen_g.push(finite(screen_color[1], "screen color")?);
            screen_b.push(finite(screen_color[2], "screen color")?);
            for point in state_vertices {
                keyform_positions.push(point[0]);
                keyform_positions.push(point[1]);
            }
        }
    }

    // Section 4 part keyform ranges and section 9 parents.
    let mut part_band_indices = Vec::with_capacity(part_nodes.len());
    let mut part_keyform_begin = Vec::with_capacity(part_nodes.len());
    let mut part_keyform_count = Vec::with_capacity(part_nodes.len());
    let mut part_visible = Vec::with_capacity(part_nodes.len());
    let mut part_enabled = Vec::with_capacity(part_nodes.len());
    let mut part_parent = Vec::with_capacity(part_nodes.len());
    let mut part_keyform_draw_order = Vec::with_capacity(part_nodes.len());
    for (index, node) in part_nodes.iter().enumerate() {
        part_band_indices.push(usize_to_i32(part_bands[index], "Part keyform band")?);
        part_keyform_begin.push(usize_to_i32(index, "Part keyform begin")?);
        part_keyform_count.push(1);
        part_visible.push(i32::from(node.visible));
        part_enabled.push(1);
        part_parent.push(
            nearest_ancestor_part(node.parent_id.as_deref(), &node_map, &part_indices)
                .filter(|&parent| parent != index)
                .map(|parent| usize_to_i32(parent, "Part parent"))
                .transpose()?
                .unwrap_or(-1),
        );
        part_keyform_draw_order.push(500.0);
    }

    let num_parts = part_nodes.len();
    let num_deformers = deformer_ids.len();
    let num_warp = warp_keyform_count.len();
    let num_rotation = rotation_keyform_count.len();
    let num_artmeshes = mesh_nodes.len();
    let num_parameters = params.len();
    let num_warp_keyforms = warp_keyform_opacity.len();
    let num_rotation_keyforms = rotation_keyform_opacity.len();
    let num_artmesh_keyforms = artmesh_keyform_opacity.len();
    if multiply_r.len() != multiply_g.len()
        || multiply_r.len() != multiply_b.len()
        || multiply_r.len() != screen_r.len()
        || multiply_r.len() != screen_g.len()
        || multiply_r.len() != screen_b.len()
    {
        return Err(Moc3Error::Export(
            "internal color array length mismatch".into(),
        ));
    }

    let mut counts: Vec<u32> = vec![
        usize_to_u32(num_parts, "Part count")?,
        usize_to_u32(num_deformers, "deformer count")?,
        usize_to_u32(num_warp, "warp deformer count")?,
        usize_to_u32(num_rotation, "rotation deformer count")?,
        usize_to_u32(num_artmeshes, "ArtMesh count")?,
        usize_to_u32(num_parameters, "parameter count")?,
        usize_to_u32(num_parts, "Part keyform count")?,
        usize_to_u32(num_warp_keyforms, "warp keyform count")?,
        usize_to_u32(num_rotation_keyforms, "rotation keyform count")?,
        usize_to_u32(num_artmesh_keyforms, "ArtMesh keyform count")?,
        usize_to_u32(keyform_positions.len(), "keyform position float count")?,
        usize_to_u32(
            parameter_binding_indices.len(),
            "parameter binding index count",
        )?,
        usize_to_u32(keyform_band_begin.len(), "keyform band count")?,
        usize_to_u32(
            parameter_bindings_keys_begin.len(),
            "parameter binding count",
        )?,
        usize_to_u32(keys.len(), "parameter key count")?,
        usize_to_u32(uvs.len(), "UV float count")?,
        usize_to_u32(position_indices.len(), "position index count")?,
        usize_to_u32(drawable_masks.len(), "drawable mask count")?,
        1,
        usize_to_u32(num_artmeshes, "draw order object count")?,
        0,
        0,
        0,
    ];
    if version >= 4 {
        counts.extend_from_slice(&[
            usize_to_u32(multiply_r.len(), "multiply color count")?,
            usize_to_u32(screen_r.len(), "screen color count")?,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
        ]);
    }
    if version >= 5 {
        counts.extend_from_slice(&[0, 0, 0]);
    }
    let count_info_size = if version >= 5 { 256 } else { 128 };
    let mut section_zero = Vec::with_capacity(count_info_size);
    push_u32_slice(&mut section_zero, &counts);
    section_zero.resize(count_info_size, 0);

    let mut section_one = Vec::with_capacity(64);
    push_f32_slice(
        &mut section_one,
        &[
            1.0,
            project.canvas.origin_x,
            project.canvas.origin_y,
            project.canvas.width,
            project.canvas.height,
        ],
    );
    section_one.push(1);
    section_one.resize(64, 0);

    let part_ids = ids_to_bytes(part_nodes.iter().map(|node| node.id.as_str()), "Part")?;
    let deformer_ids_bytes = ids_to_bytes(deformer_ids.iter().map(String::as_str), "deformer")?;
    let artmesh_ids_bytes = ids_to_bytes(artmesh_ids.iter().map(String::as_str), "ArtMesh")?;
    let parameter_ids_bytes = ids_to_bytes(
        params.iter().map(|parameter| parameter.id.as_str()),
        "parameter",
    )?;

    let mut parameter_max = Vec::with_capacity(num_parameters);
    let mut parameter_min = Vec::with_capacity(num_parameters);
    let mut parameter_default = Vec::with_capacity(num_parameters);
    let mut parameter_repeat = Vec::with_capacity(num_parameters);
    let mut parameter_decimal = Vec::with_capacity(num_parameters);
    for parameter in &params {
        parameter_max.push(parameter.max);
        parameter_min.push(parameter.min);
        parameter_default.push(parameter.default);
        parameter_repeat.push(i32::from(parameter.repeats));
        parameter_decimal.push(4i32);
    }

    let mut body = Vec::<u8>::new();
    let mut section_offsets = Vec::<u32>::new();
    let mut add_section = |data: &[u8], alignment: usize| -> Result<(), Moc3Error> {
        if alignment > 0 {
            let aligned = align_up(body.len(), alignment)?;
            body.resize(aligned, 0);
        }
        section_offsets.push(usize_to_u32(
            BODY_OFFSET
                .checked_add(body.len())
                .ok_or_else(|| Moc3Error::Export("section offset overflow".into()))?,
            "section offset",
        )?);
        body.extend_from_slice(data);
        Ok(())
    };

    add_section(&section_zero, 0)?;
    add_section(&section_one, 0)?;
    add_section(&vec![0u8; 8 * num_parts], ALIGNMENT)?;
    add_section(&part_ids, 0)?;
    add_section(&i32_bytes(&part_band_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&part_keyform_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&part_keyform_count), ALIGNMENT)?;
    add_section(&i32_bytes(&part_visible), ALIGNMENT)?;
    add_section(&i32_bytes(&part_enabled), ALIGNMENT)?;
    add_section(&i32_bytes(&part_parent), ALIGNMENT)?;

    add_section(&vec![0u8; 8 * num_deformers], ALIGNMENT)?;
    add_section(&deformer_ids_bytes, 0)?;
    add_section(&i32_bytes(&deformer_band_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&deformer_visible), ALIGNMENT)?;
    add_section(&i32_bytes(&deformer_enabled), ALIGNMENT)?;
    add_section(&i32_bytes(&deformer_parent_part), ALIGNMENT)?;
    add_section(&i32_bytes(&deformer_parent_deformer), ALIGNMENT)?;
    add_section(&i32_bytes(&deformer_types), ALIGNMENT)?;
    add_section(&i32_bytes(&deformer_specific_indices), ALIGNMENT)?;

    add_section(&i32_bytes(&warp_band_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&warp_keyform_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&warp_keyform_count), ALIGNMENT)?;
    add_section(&i32_bytes(&warp_vertex_count), ALIGNMENT)?;
    add_section(&i32_bytes(&warp_rows), ALIGNMENT)?;
    add_section(&i32_bytes(&warp_cols), ALIGNMENT)?;

    add_section(&i32_bytes(&rotation_band_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&rotation_keyform_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&rotation_keyform_count), ALIGNMENT)?;
    add_section(&f32_bytes(&rotation_base_angle), ALIGNMENT)?;

    for _ in 29..=32 {
        add_section(&vec![0u8; 8 * num_artmeshes], ALIGNMENT)?;
    }
    add_section(&artmesh_ids_bytes, 0)?;
    add_section(&i32_bytes(&artmesh_band_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_keyform_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_keyform_count), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_visible), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_enabled), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_parent_part), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_parent_deformer), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_texture_index), ALIGNMENT)?;
    add_section(&artmesh_drawable_flags, ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_render_vertex_count), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_uv_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_position_index_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_flat_index_count), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_mask_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_mask_count), ALIGNMENT)?;

    add_section(&vec![0u8; 8 * num_parameters], ALIGNMENT)?;
    add_section(&parameter_ids_bytes, 0)?;
    add_section(&f32_bytes(&parameter_max), ALIGNMENT)?;
    add_section(&f32_bytes(&parameter_min), ALIGNMENT)?;
    add_section(&f32_bytes(&parameter_default), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_repeat), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_decimal), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_binding_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_binding_count), ALIGNMENT)?;

    add_section(&f32_bytes(&part_keyform_draw_order), ALIGNMENT)?;
    add_section(&f32_bytes(&warp_keyform_opacity), ALIGNMENT)?;
    add_section(&i32_bytes(&warp_keyform_position_begin), ALIGNMENT)?;
    add_section(&f32_bytes(&rotation_keyform_opacity), ALIGNMENT)?;
    add_section(&f32_bytes(&rotation_keyform_angle), ALIGNMENT)?;
    add_section(&f32_bytes(&rotation_keyform_origin_x), ALIGNMENT)?;
    add_section(&f32_bytes(&rotation_keyform_origin_y), ALIGNMENT)?;
    add_section(&f32_bytes(&rotation_keyform_scale), ALIGNMENT)?;
    add_section(&i32_bytes(&rotation_keyform_reflect_x), ALIGNMENT)?;
    add_section(&i32_bytes(&rotation_keyform_reflect_y), ALIGNMENT)?;
    add_section(&f32_bytes(&artmesh_keyform_opacity), ALIGNMENT)?;
    add_section(&f32_bytes(&artmesh_keyform_draw_order), ALIGNMENT)?;
    add_section(&i32_bytes(&artmesh_keyform_position_begin), ALIGNMENT)?;

    add_section(&f32_bytes(&keyform_positions), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_binding_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&keyform_band_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&keyform_band_count), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_bindings_keys_begin), ALIGNMENT)?;
    add_section(&i32_bytes(&parameter_bindings_keys_count), ALIGNMENT)?;
    add_section(&f32_bytes(&keys), ALIGNMENT)?;
    add_section(&f32_bytes(&uvs), ALIGNMENT)?;
    add_section(&u16_bytes(&position_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&drawable_masks), ALIGNMENT)?;

    let minimum_draw_order = artmesh_keyform_draw_order
        .iter()
        .chain(part_keyform_draw_order.iter())
        .fold(0.0f32, |minimum, &value| minimum.min(value))
        .floor() as i32;
    let maximum_draw_order = artmesh_keyform_draw_order
        .iter()
        .chain(part_keyform_draw_order.iter())
        .fold(1000.0f32, |maximum, &value| maximum.max(value))
        .ceil() as i32;
    let draw_order_indices: Vec<i32> = (0..num_artmeshes)
        .map(|index| usize_to_i32(index, "draw order object index"))
        .collect::<Result<_, _>>()?;
    add_section(&i32_bytes(&[0]), ALIGNMENT)?;
    add_section(
        &i32_bytes(&[usize_to_i32(num_artmeshes, "draw order object count")?]),
        ALIGNMENT,
    )?;
    add_section(
        &i32_bytes(&[usize_to_i32(
            num_artmeshes,
            "draw order total object count",
        )?]),
        ALIGNMENT,
    )?;
    add_section(&i32_bytes(&[minimum_draw_order]), ALIGNMENT)?;
    add_section(&i32_bytes(&[maximum_draw_order]), ALIGNMENT)?;
    add_section(&i32_bytes(&vec![0; num_artmeshes]), ALIGNMENT)?;
    add_section(&i32_bytes(&draw_order_indices), ALIGNMENT)?;
    add_section(&i32_bytes(&vec![-1; num_artmeshes]), ALIGNMENT)?;

    add_section(&[], ALIGNMENT)?;
    add_section(&[], 0)?;
    for _ in 91..=100 {
        add_section(&[], ALIGNMENT)?;
    }
    if version >= 2 {
        add_section(&i32_bytes(&vec![0; num_warp_keyforms]), ALIGNMENT)?;
    }
    if version >= 4 {
        add_section(&vec![0u8; 8 * num_parameters], ALIGNMENT)?;
        add_section(&i32_bytes(&vec![0; num_parameters]), ALIGNMENT)?;
        add_section(&i32_bytes(&vec![0; num_parameters]), ALIGNMENT)?;
        add_section(&i32_bytes(&warp_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&rotation_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&artmesh_color_begin_v4), ALIGNMENT)?;
        add_section(&f32_bytes(&multiply_r), ALIGNMENT)?;
        add_section(&f32_bytes(&multiply_g), ALIGNMENT)?;
        add_section(&f32_bytes(&multiply_b), ALIGNMENT)?;
        add_section(&f32_bytes(&screen_r), ALIGNMENT)?;
        add_section(&f32_bytes(&screen_g), ALIGNMENT)?;
        add_section(&f32_bytes(&screen_b), ALIGNMENT)?;
        add_section(&i32_bytes(&vec![0; num_parameters]), ALIGNMENT)?;
        add_section(&i32_bytes(&vec![0; num_parameters]), ALIGNMENT)?;
        add_section(&i32_bytes(&vec![0; num_parameters]), ALIGNMENT)?;
        for _ in 117..=136 {
            add_section(&[], ALIGNMENT)?;
        }
    }
    if version >= 5 {
        add_section(&i32_bytes(&warp_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&warp_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&rotation_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&rotation_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&artmesh_keyform_color_begin), ALIGNMENT)?;
        add_section(&i32_bytes(&artmesh_keyform_color_begin), ALIGNMENT)?;
        for _ in 143..=151 {
            add_section(&[], ALIGNMENT)?;
        }
        add_section(&i32_bytes(&vec![0; num_parts]), ALIGNMENT)?;
        add_section(&i32_bytes(&artmesh_blend_mode), ALIGNMENT)?;
    }

    let body_aligned = align_up(body.len(), ALIGNMENT)?;
    body.resize(body_aligned, 0);
    if options.embed_source_project {
        let json = serde_json::to_vec(source_project)?;
        let json_length = usize_to_u32(json.len(), "source project trailer length")?;
        body.extend_from_slice(b"L2D0");
        body.extend_from_slice(&json_length.to_le_bytes());
        body.extend_from_slice(&json);
        let trailer_aligned = align_up(body.len(), ALIGNMENT)?;
        body.resize(trailer_aligned, 0);
    }

    let mut output = Vec::with_capacity(
        BODY_OFFSET
            .checked_add(body.len())
            .ok_or_else(|| Moc3Error::Export("output size overflow".into()))?,
    );
    output.write_all(MOC3_MAGIC)?;
    output.push(version);
    output.push(0);
    output.resize(HEADER_SIZE, 0);
    for index in 0..SOT_COUNT {
        let offset = section_offsets.get(index).copied().unwrap_or(0);
        output.extend_from_slice(&offset.to_le_bytes());
    }
    output.resize(BODY_OFFSET, 0);
    output.extend_from_slice(&body);
    Ok(output)
}
