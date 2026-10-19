use crate::math::deform_path::transform_point_by_deform_path;
use crate::math::interpolation::{blend_points, compute_multidim_weights_ext};
use crate::math::rotation::transform_point_by_rotation;
use crate::math::warp::transform_point_by_warp_ext;
use crate::model::*;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub struct EvaluatedMesh {
    pub id: String,
    pub texture_id: String,
    pub vertices: Vec<[f32; 2]>,
    pub uvs: Vec<[f32; 2]>,
    pub indices: Vec<u32>,
    pub blend_mode: BlendMode,
    pub opacity: f32,
    pub multiply_color: [f32; 4],
    pub screen_color: [f32; 4],
    pub draw_order: i32,
    pub mask_ids: Vec<String>,
    pub is_mask_inverted: bool,
}

#[derive(Debug, Clone, Default)]
pub struct EvaluatedFrame {
    pub meshes: Vec<EvaluatedMesh>,
    pub total_vertices: usize,
    pub total_indices: usize,
}

enum DeformerState {
    Warp {
        cols: usize,
        rows: usize,
        bounds: [f32; 4],
        control_points: Vec<[f32; 2]>,
        bezier_smooth: bool,
    },
    Rotation {
        origin: [f32; 2],
        angle_deg: f32,
        scale: [f32; 2],
    },
    DeformPath {
        base_points: Vec<[f32; 2]>,
        deformed_points: Vec<[f32; 2]>,
        target_mesh_ids: Vec<String>,
    },
}

pub fn evaluate_project(
    project: &Project,
    params: &HashMap<String, f32>,
) -> EvaluatedFrame {
    evaluate_project_with_options(project, params, EvaluateOptions::default())
}

/// Options for [`evaluate_project_with_options`]. The default reproduces the rendering result
/// of [`evaluate_project`].
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct EvaluateOptions {
    /// Keep drawables that rendering culls: fully transparent meshes, hidden nodes, and nodes
    /// below a hidden ancestor. Their geometry is still deformed through the full ancestor chain
    /// and their real (possibly zero) opacity is reported. Used by `.moc3` keyform baking, where
    /// visibility is carried by separate flags and every keyform needs real geometry/opacity.
    pub keep_culled_drawables: bool,
}

/// Returns the ids of nodes targeted by more than one `KeyformBinding`, in first-occurrence
/// order. The evaluator (and `.moc3` export) deterministically uses the LAST binding listed in
/// `project.keyforms` for such a node and ignores earlier ones; lint can surface this list.
pub fn duplicate_keyform_targets(project: &Project) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut dups: Vec<String> = Vec::new();
    for kb in &project.keyforms {
        if !seen.insert(kb.target_node_id.as_str()) && !dups.iter().any(|d| d == &kb.target_node_id) {
            dups.push(kb.target_node_id.clone());
        }
    }
    dups
}

/// Blends per-keyform point arrays for a deformer. A keyform with a mismatched payload kind or
/// point count contributes the node's base points, so weights always describe a full average.
fn blend_keyform_points(
    kf: &KeyformBinding,
    weights: &[f32],
    base: &[[f32; 2]],
    extract: impl Fn(&KeyformPayload) -> Option<&[[f32; 2]]>,
) -> Vec<[f32; 2]> {
    let states: Vec<&[[f32; 2]]> = kf
        .keyforms
        .iter()
        .map(|s| match extract(&s.payload) {
            Some(pts) if pts.len() == base.len() => pts,
            _ => base,
        })
        .collect();
    if states.is_empty() {
        return base.to_vec();
    }
    blend_points(&states, weights)
}

pub fn evaluate_project_with_options(
    project: &Project,
    params: &HashMap<String, f32>,
    options: EvaluateOptions,
) -> EvaluatedFrame {
    let keep_culled = options.keep_culled_drawables;
    // 0. Resolve effective parameters after applying any active Expression blends
    let mut effective_params = params.clone();
    for expr in &project.expressions {
        let expr_key_a = format!("__expression_weight:{}", expr.id);
        let expr_key_b = format!("expr:{}", expr.id);
        let weight = params
            .get(&expr_key_a)
            .or_else(|| params.get(&expr_key_b))
            .copied()
            .unwrap_or(0.0)
            .clamp(0.0, 1.0);
        if weight > 1e-5 {
            for ep in &expr.parameters {
                let def = project
                    .parameters
                    .iter()
                    .find(|p| p.id == ep.id)
                    .map(|p| p.default)
                    .unwrap_or(0.0);
                let cur = effective_params.get(&ep.id).copied().unwrap_or(def);
                let next_val = match ep.blend {
                    ExpressionBlendType::Add => cur + ep.value * weight,
                    ExpressionBlendType::Multiply => cur * (1.0 + (ep.value - 1.0) * weight),
                    ExpressionBlendType::Overwrite => cur * (1.0 - weight) + ep.value * weight,
                };
                effective_params.insert(ep.id.clone(), next_val);
            }
        }
    }
    let params = &effective_params;

    // Resolve PoseGroup mutually-exclusive part opacities (if pose parameters exist)
    let mut pose_part_multipliers: HashMap<&str, f32> = HashMap::new();
    for group in &project.pose_groups {
        if group.part_ids.len() > 1 {
            // Check if any pose parameter (either matching part_id or ParamPose_<part_id>) is set
            let mut active_idx: Option<usize> = None;
            let mut best_val = 0.0f32;
            for (idx, part_id) in group.part_ids.iter().enumerate() {
                let pose_param = format!("ParamPose_{}", part_id);
                if let Some(&v) = params.get(part_id).or_else(|| params.get(&pose_param)) {
                    if v > best_val {
                        best_val = v;
                        active_idx = Some(idx);
                    }
                }
            }
            if let Some(winner) = active_idx {
                for (idx, part_id) in group.part_ids.iter().enumerate() {
                    pose_part_multipliers.insert(part_id.as_str(), if idx == winner { 1.0 } else { 0.0 });
                }
            }
        }
    }

    let node_map: HashMap<&str, &Node> = project.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
    // When several bindings target the same node, the last one wins (see `duplicate_keyform_targets`).
    let keyform_map: HashMap<&str, &KeyformBinding> = project
        .keyforms
        .iter()
        .map(|k| (k.target_node_id.as_str(), k))
        .collect();
    let mask_sources: HashSet<&str> = project
        .nodes
        .iter()
        .flat_map(|node| match &node.kind {
            NodeKind::ArtMesh(mesh) => mesh.mask_ids.iter(),
            NodeKind::ArtPath(path) => path.mask_ids.iter(),
            _ => [].iter(),
        })
        .map(String::as_str)
        .collect();

    // 1. Evaluate deformed state for each deformer node
    let mut deformer_states: HashMap<String, DeformerState> = HashMap::new();
    // DeformPath ids in project node order, so paths targeting a mesh apply deterministically.
    let mut deform_path_order: Vec<&str> = Vec::new();

    for node in &project.nodes {
        match &node.kind {
            NodeKind::WarpDeformer(data) => {
                let mut cp = data.control_points.clone();
                if let Some(kf) = keyform_map.get(node.id.as_str()) {
                    let (dim_keys, dim_exts, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                    let weights = compute_multidim_weights_ext(&dim_keys, &dim_exts, &query_coords, &kf_coords);
                    cp = blend_keyform_points(kf, &weights, &data.control_points, |p| match p {
                        KeyformPayload::Warp { control_points } => Some(control_points.as_slice()),
                        _ => None,
                    });
                }
                deformer_states.insert(
                    node.id.clone(),
                    DeformerState::Warp {
                        cols: data.cols,
                        rows: data.rows,
                        bounds: data.bounds,
                        control_points: cp,
                        bezier_smooth: data.bezier_smooth,
                    },
                );
            }
            NodeKind::RotationDeformer(data) => {
                let mut origin = data.origin;
                let mut angle_deg = data.angle_deg;
                let mut scale = data.scale;

                if let Some(kf) = keyform_map.get(node.id.as_str()) {
                    let (dim_keys, dim_exts, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                    let weights = compute_multidim_weights_ext(&dim_keys, &dim_exts, &query_coords, &kf_coords);
                    let mut blended_origin = [0.0, 0.0];
                    let mut blended_angle = 0.0;
                    let mut blended_scale = [0.0, 0.0];
                    let mut total_w = 0.0f32;

                    // Keyforms with another payload kind contribute the node's base transform.
                    for (state, &w) in kf.keyforms.iter().zip(weights.iter()) {
                        let (o, a, s) = match &state.payload {
                            KeyformPayload::Rotation { origin: o, angle_deg: a, scale: s } => (*o, *a, *s),
                            _ => (data.origin, data.angle_deg, data.scale),
                        };
                        total_w += w;
                        blended_origin[0] += o[0] * w;
                        blended_origin[1] += o[1] * w;
                        blended_angle += a * w;
                        blended_scale[0] += s[0] * w;
                        blended_scale[1] += s[1] * w;
                    }
                    if total_w > 1e-6 {
                        origin = [blended_origin[0] / total_w, blended_origin[1] / total_w];
                        angle_deg = blended_angle / total_w;
                        scale = [blended_scale[0] / total_w, blended_scale[1] / total_w];
                    }
                }

                deformer_states.insert(
                    node.id.clone(),
                    DeformerState::Rotation {
                        origin,
                        angle_deg,
                        scale,
                    },
                );
            }
            NodeKind::DeformPath(data) => {
                let mut pts = data.control_points.clone();
                if let Some(kf) = keyform_map.get(node.id.as_str()) {
                    let (dim_keys, dim_exts, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                    let weights = compute_multidim_weights_ext(&dim_keys, &dim_exts, &query_coords, &kf_coords);
                    pts = blend_keyform_points(kf, &weights, &data.control_points, |p| match p {
                        KeyformPayload::DeformPath { control_points } => Some(control_points.as_slice()),
                        _ => None,
                    });
                }
                deform_path_order.push(node.id.as_str());
                deformer_states.insert(
                    node.id.clone(),
                    DeformerState::DeformPath {
                        base_points: data.control_points.clone(),
                        deformed_points: pts,
                        target_mesh_ids: data.target_mesh_ids.clone(),
                    },
                );
            }
            _ => {}
        }
    }

    // 2. Evaluate ArtMeshes through ancestor deformer hierarchies and bound deform paths
    let mut evaluated_meshes = Vec::new();
    let mut total_verts = 0;
    let mut total_inds = 0;

    for node in &project.nodes {
        if !node.visible && !keep_culled {
            continue;
        }
        if let NodeKind::ArtMesh(mesh_data) = &node.kind {
            let mut vertices = mesh_data.vertices.clone();
            let mut opacity = mesh_data.opacity;
            let mut multiply_color = mesh_data.multiply_color;
            let mut screen_color = mesh_data.screen_color;
            let mut draw_order = mesh_data.draw_order;

            // Apply ArtMesh keyforms (vertex offsets, opacity, colors) as normalized weighted
            // averages. Values a keyform leaves unset (or a keyform with another payload kind)
            // contribute the mesh default, so the result is independent of keyform order.
            if let Some(kf) = keyform_map.get(node.id.as_str()) {
                let (dim_keys, dim_exts, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                let weights = compute_multidim_weights_ext(&dim_keys, &dim_exts, &query_coords, &kf_coords);
                let mut offset_acc = vec![[0.0, 0.0]; vertices.len()];
                let mut opacity_acc = 0.0;
                let mut mc_acc = [0.0f32; 4];
                let mut sc_acc = [0.0f32; 4];
                let mut total_w = 0.0f32;
                let mut max_draw_order_w = 0.0f32;

                for (state, &w) in kf.keyforms.iter().zip(weights.iter()) {
                    total_w += w;
                    let (offsets, op, mc, sc, d) = match &state.payload {
                        KeyformPayload::ArtMesh { vertex_offsets, opacity: op, multiply_color: mc, screen_color: sc, draw_order: d } => (
                            vertex_offsets.as_slice(),
                            op.unwrap_or(mesh_data.opacity),
                            mc.unwrap_or(mesh_data.multiply_color),
                            sc.unwrap_or(mesh_data.screen_color),
                            d.unwrap_or(mesh_data.draw_order),
                        ),
                        _ => (&[][..], mesh_data.opacity, mesh_data.multiply_color, mesh_data.screen_color, mesh_data.draw_order),
                    };
                    for (idx, off) in offsets.iter().enumerate().take(vertices.len()) {
                        offset_acc[idx][0] += off[0] * w;
                        offset_acc[idx][1] += off[1] * w;
                    }
                    opacity_acc += op * w;
                    for ch in 0..4 {
                        mc_acc[ch] += mc[ch] * w;
                        sc_acc[ch] += sc[ch] * w;
                    }
                    // Draw order is discrete: take the dominant keyform (first one on ties).
                    if w > max_draw_order_w {
                        max_draw_order_w = w;
                        draw_order = d;
                    }
                }
                if total_w > 1e-6 {
                    for (v, off) in vertices.iter_mut().zip(offset_acc.iter()) {
                        v[0] += off[0] / total_w;
                        v[1] += off[1] / total_w;
                    }
                    opacity = opacity_acc / total_w;
                    for ch in 0..4 {
                        multiply_color[ch] = mc_acc[ch] / total_w;
                        screen_color[ch] = sc_acc[ch] / total_w;
                    }
                }
            }

            // Apply MorphTargets / BlendShapes (additive shape offsets)
            for morph in &mesh_data.morph_targets {
                let weight = params.get(&morph.param_id).copied().unwrap_or(0.0);
                if weight.abs() > 1e-5 {
                    for (v, off) in vertices.iter_mut().zip(morph.vertex_offsets.iter()) {
                        v[0] += off[0] * weight;
                        v[1] += off[1] * weight;
                    }
                }
            }

            // Apply Deform Paths targeting this mesh (in project node order)
            for path_id in &deform_path_order {
                if let Some(DeformerState::DeformPath { base_points, deformed_points, target_mesh_ids }) =
                    deformer_states.get(*path_id)
                {
                    if target_mesh_ids.iter().any(|mid| mid == &node.id) {
                        for pt in &mut vertices {
                            *pt = transform_point_by_deform_path(*pt, base_points, deformed_points);
                        }
                    }
                }
            }

            // Trace ancestor deformers from child up to root
            let mut ancestors = Vec::new();
            let mut curr_parent = node.parent_id.as_deref();
            let mut visited = std::collections::HashSet::new();
            let mut inherited_visible = true;
            while let Some(pid) = curr_parent {
                if !visited.insert(pid) {
                    break; // Prevent infinite cycle
                }
                if let Some(parent_node) = node_map.get(pid) {
                    if !parent_node.visible {
                        inherited_visible = false;
                        if !keep_culled {
                            break;
                        }
                    }
                    if let NodeKind::Part { opacity: part_op, .. } = parent_node.kind {
                        opacity *= part_op;
                        if let Some(&pose_mult) = pose_part_multipliers.get(pid) {
                            opacity *= pose_mult;
                        }
                    }
                    ancestors.push(pid);
                    curr_parent = parent_node.parent_id.as_deref();
                } else {
                    break;
                }
            }

            // A transparent drawable can still supply clipping geometry.
            if !keep_culled
                && (!inherited_visible || (opacity <= 1e-5 && !mask_sources.contains(node.id.as_str())))
            {
                continue;
            }

            // Deform vertices through ancestor chain (bottom-up: immediate parent first)
            for &ancestor_id in &ancestors {
                if let Some(deformer) = deformer_states.get(ancestor_id) {
                    match deformer {
                        DeformerState::Warp { cols, rows, bounds, control_points, bezier_smooth } => {
                            for pt in &mut vertices {
                                *pt = transform_point_by_warp_ext(*pt, *cols, *rows, *bounds, control_points, *bezier_smooth);
                            }
                        }
                        DeformerState::Rotation { origin, angle_deg, scale } => {
                            for pt in &mut vertices {
                                *pt = transform_point_by_rotation(*pt, *origin, *angle_deg, *scale);
                            }
                        }
                        DeformerState::DeformPath { base_points, deformed_points, .. } => {
                            for pt in &mut vertices {
                                *pt = transform_point_by_deform_path(*pt, base_points, deformed_points);
                            }
                        }
                    }
                }
            }

            total_verts += vertices.len();
            total_inds += mesh_data.indices.len();

            evaluated_meshes.push(EvaluatedMesh {
                id: node.id.clone(),
                texture_id: mesh_data.texture_id.clone(),
                vertices,
                uvs: mesh_data.uvs.clone(),
                indices: mesh_data.indices.clone(),
                blend_mode: mesh_data.blend_mode,
                opacity,
                multiply_color,
                screen_color,
                draw_order,
                mask_ids: mesh_data.mask_ids.clone(),
                is_mask_inverted: mesh_data.is_mask_inverted,
            });
        } else if let NodeKind::ArtPath(path_data) = &node.kind {
            if path_data.points.len() < 2 {
                continue;
            }
            let mut points = path_data.points.clone();
            let mut opacity = path_data.opacity;

            // Apply ArtPath keyforms
            if let Some(kf) = keyform_map.get(node.id.as_str()) {
                let (dim_keys, dim_exts, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                let weights = compute_multidim_weights_ext(&dim_keys, &dim_exts, &query_coords, &kf_coords);
                let mut acc_pos = vec![[0.0f32, 0.0f32]; points.len()];
                let mut acc_w = vec![0.0f32; points.len()];
                let mut acc_op = vec![0.0f32; points.len()];
                let mut valid = false;

                for (state, &w) in kf.keyforms.iter().zip(weights.iter()) {
                    if w.abs() < 1e-6 {
                        continue;
                    }
                    if let KeyformPayload::ArtPath { points: kf_pts } = &state.payload {
                        if kf_pts.len() == points.len() {
                            valid = true;
                            for i in 0..points.len() {
                                acc_pos[i][0] += kf_pts[i].pos[0] * w;
                                acc_pos[i][1] += kf_pts[i].pos[1] * w;
                                acc_w[i] += kf_pts[i].width * w;
                                acc_op[i] += kf_pts[i].opacity * w;
                            }
                        }
                    }
                }
                if valid {
                    for i in 0..points.len() {
                        points[i].pos = acc_pos[i];
                        points[i].width = acc_w[i];
                        points[i].opacity = acc_op[i];
                    }
                }
            }

            // Trace ancestor deformers and Part visibility/opacity
            let mut ancestors = Vec::new();
            let mut curr_parent = node.parent_id.as_deref();
            let mut visited = std::collections::HashSet::new();
            let mut inherited_visible = true;
            while let Some(pid) = curr_parent {
                if !visited.insert(pid) {
                    break;
                }
                if let Some(parent_node) = node_map.get(pid) {
                    if !parent_node.visible {
                        inherited_visible = false;
                        break;
                    }
                    if let NodeKind::Part { opacity: part_op, .. } = parent_node.kind {
                        opacity *= part_op;
                        if let Some(&pose_mult) = pose_part_multipliers.get(pid) {
                            opacity *= pose_mult;
                        }
                    }
                    ancestors.push(pid);
                    curr_parent = parent_node.parent_id.as_deref();
                } else {
                    break;
                }
            }

            if !inherited_visible || (opacity <= 1e-5 && !mask_sources.contains(node.id.as_str())) {
                continue;
            }

            for &ancestor_id in &ancestors {
                if let Some(deformer) = deformer_states.get(ancestor_id) {
                    match deformer {
                        DeformerState::Warp { cols, rows, bounds, control_points, bezier_smooth } => {
                            for pt in &mut points {
                                pt.pos = transform_point_by_warp_ext(pt.pos, *cols, *rows, *bounds, control_points, *bezier_smooth);
                            }
                        }
                        DeformerState::Rotation { origin, angle_deg, scale } => {
                            for pt in &mut points {
                                pt.pos = transform_point_by_rotation(pt.pos, *origin, *angle_deg, *scale);
                            }
                        }
                        DeformerState::DeformPath { base_points, deformed_points, .. } => {
                            for pt in &mut points {
                                pt.pos = transform_point_by_deform_path(pt.pos, base_points, deformed_points);
                            }
                        }
                    }
                }
            }

            let (vertices, uvs, indices, avg_pt_opacity) = tessellate_art_path(&points, path_data.closed);
            if !vertices.is_empty() && !indices.is_empty() {
                total_verts += vertices.len();
                total_inds += indices.len();
                evaluated_meshes.push(EvaluatedMesh {
                    id: node.id.clone(),
                    texture_id: path_data.texture_id.clone().unwrap_or_else(|| "__artpath_solid__".into()),
                    vertices,
                    uvs,
                    indices,
                    blend_mode: path_data.blend_mode,
                    opacity: (opacity * avg_pt_opacity).clamp(0.0, 1.0),
                    multiply_color: path_data.color,
                    screen_color: [0.0, 0.0, 0.0, 0.0],
                    draw_order: path_data.draw_order,
                    mask_ids: path_data.mask_ids.clone(),
                    is_mask_inverted: path_data.is_mask_inverted,
                });
            }
        }
    }

    // 3. Apply Glue constraints across pairs of meshes
    for glue in &project.glues {
        let pos_a = evaluated_meshes.iter().position(|m| m.id == glue.mesh_a_id);
        let pos_b = evaluated_meshes.iter().position(|m| m.id == glue.mesh_b_id);
        if let (Some(idx_a), Some(idx_b)) = (pos_a, pos_b) {
            if idx_a != idx_b {
                for pair in &glue.vertex_pairs {
                    let ia = pair.index_a as usize;
                    let ib = pair.index_b as usize;
                    if ia < evaluated_meshes[idx_a].vertices.len() && ib < evaluated_meshes[idx_b].vertices.len() {
                        let pa = evaluated_meshes[idx_a].vertices[ia];
                        let pb = evaluated_meshes[idx_b].vertices[ib];
                        let total_w = pair.weight_a + pair.weight_b;
                        if total_w > 1e-5 {
                            let blended = [
                                (pa[0] * pair.weight_a + pb[0] * pair.weight_b) / total_w,
                                (pa[1] * pair.weight_a + pb[1] * pair.weight_b) / total_w,
                            ];
                            evaluated_meshes[idx_a].vertices[ia] = blended;
                            evaluated_meshes[idx_b].vertices[ib] = blended;
                        }
                    }
                }
            }
        }
    }

    // Sort meshes by draw_order ascending
    evaluated_meshes.sort_by_key(|m| m.draw_order);

    EvaluatedFrame {
        meshes: evaluated_meshes,
        total_vertices: total_verts,
        total_indices: total_inds,
    }
}

fn extract_keyform_coords(
    kf: &KeyformBinding,
    params: &HashMap<String, f32>,
    project: &Project,
) -> (Vec<Vec<f32>>, Vec<Option<ExtendedInterpolationType>>, Vec<f32>, Vec<Vec<f32>>) {
    let mut dim_keys = Vec::with_capacity(kf.dimensions.len());
    let mut dim_exts = Vec::with_capacity(kf.dimensions.len());
    let mut query_coords = Vec::with_capacity(kf.dimensions.len());

    for dim in &kf.dimensions {
        dim_keys.push(dim.keys.clone());
        dim_exts.push(dim.extended_interpolation);
        let param_meta = project
            .parameters
            .iter()
            .find(|p| p.id == dim.param_id);
        let def = param_meta.map(|p| p.default).unwrap_or(0.0);
        let mut current_val = params.get(&dim.param_id).copied().unwrap_or(def);
        if let Some(p) = param_meta {
            if p.repeats && (p.max - p.min).abs() > 1e-5 {
                let span = p.max - p.min;
                current_val = p.min + (current_val - p.min).rem_euclid(span);
            }
        }
        query_coords.push(current_val);
    }

    let kf_coords = kf.keyforms.iter().map(|s| s.coordinates.clone()).collect();
    (dim_keys, dim_exts, query_coords, kf_coords)
}

/// Tessellates an ArtPath polyline into a variable-width triangle strip ribbon mesh.
pub(crate) fn tessellate_art_path(
    points: &[ArtPathPoint],
    closed: bool,
) -> (Vec<[f32; 2]>, Vec<[f32; 2]>, Vec<u32>, f32) {
    let n = points.len();
    if n < 2 {
        return (Vec::new(), Vec::new(), Vec::new(), 1.0);
    }

    let mut vertices = Vec::with_capacity(n * 2);
    let mut uvs = Vec::with_capacity(n * 2);
    let mut indices = Vec::with_capacity((n - 1) * 6 + if closed { 6 } else { 0 });
    let mut sum_opacity = 0.0f32;

    for i in 0..n {
        let p_curr = points[i].pos;
        let p_prev = if i > 0 {
            points[i - 1].pos
        } else if closed {
            points[n - 1].pos
        } else {
            p_curr
        };
        let p_next = if i + 1 < n {
            points[i + 1].pos
        } else if closed {
            points[0].pos
        } else {
            p_curr
        };

        let mut tx = p_next[0] - p_prev[0];
        let mut ty = p_next[1] - p_prev[1];
        let len = (tx * tx + ty * ty).sqrt();
        if len > 1e-5 {
            tx /= len;
            ty /= len;
        } else {
            tx = 1.0;
            ty = 0.0;
        }
        // Normal (-ty, tx)
        let nx = -ty;
        let ny = tx;
        let half_w = (points[i].width * 0.5).max(0.25);

        vertices.push([p_curr[0] + nx * half_w, p_curr[1] + ny * half_w]);
        vertices.push([p_curr[0] - nx * half_w, p_curr[1] - ny * half_w]);

        let u = if n > 1 { i as f32 / (n - 1) as f32 } else { 0.0 };
        uvs.push([u, 0.0]);
        uvs.push([u, 1.0]);

        sum_opacity += points[i].opacity;
    }

    let seg_count = if closed { n } else { n - 1 };
    for i in 0..seg_count {
        let next_i = (i + 1) % n;
        let v0 = (i * 2) as u32;
        let v1 = (i * 2 + 1) as u32;
        let v2 = (next_i * 2) as u32;
        let v3 = (next_i * 2 + 1) as u32;
        indices.extend_from_slice(&[v0, v1, v2, v2, v1, v3]);
    }

    (vertices, uvs, indices, sum_opacity / (n as f32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::warp::generate_default_grid;

    #[test]
    fn test_evaluator_hierarchical_warp_and_artmesh() {
        let warp_bounds = [0.0, 0.0, 100.0, 100.0];
        let default_grid = generate_default_grid(1, 1, warp_bounds);
        let mut deformed_grid = default_grid.clone();
        for pt in &mut deformed_grid {
            pt[0] += 20.0;
        }

        let project = Project {
            format_version: 1,
            canvas: Canvas::default(),
            parameters: vec![Parameter {
                id: "ParamAngleX".into(),
                name: "Angle X".into(),
                min: 0.0,
                max: 30.0,
                default: 0.0,
                repeats: false,
                group_id: None,
                locked: false,
            }],
            nodes: vec![
                Node {
                    id: "warp1".into(),
                    name: "Warp 1".into(),
                    parent_id: None,
                    visible: true,
                    locked: false,
                    kind: NodeKind::WarpDeformer(WarpDeformerData {
                        cols: 1,
                        rows: 1,
                        bounds: warp_bounds,
                        control_points: default_grid.clone(),
                        bezier_smooth: false,
                    }),
                },
                Node {
                    id: "mesh1".into(),
                    name: "Mesh 1".into(),
                    parent_id: Some("warp1".into()),
                    visible: true,
                    locked: false,
                    kind: NodeKind::ArtMesh(ArtMeshData {
                        texture_id: "tex1".into(),
                        vertices: vec![[50.0, 50.0]],
                        uvs: vec![[0.5, 0.5]],
                        indices: vec![0],
                        blend_mode: BlendMode::Normal,
                        opacity: 1.0,
                        multiply_color: [1.0, 1.0, 1.0, 1.0],
                        screen_color: [0.0, 0.0, 0.0, 0.0],
                        draw_order: 0,
                        mask_ids: vec![],
                        is_mask_inverted: false,
                        morph_targets: vec![],
                        hit_area_name: None,
                        user_data: None,
                    }),
                },
            ],
            keyforms: vec![KeyformBinding {
                target_node_id: "warp1".into(),
                dimensions: vec![ParamDimension {
                    param_id: "ParamAngleX".into(),
                    keys: vec![0.0, 30.0],
                    extended_interpolation: None,
                }],
                keyforms: vec![
                    KeyformState {
                        coordinates: vec![0.0],
                        payload: KeyformPayload::Warp { control_points: default_grid },
                    },
                    KeyformState {
                        coordinates: vec![30.0],
                        payload: KeyformPayload::Warp { control_points: deformed_grid },
                    },
                ],
            }],
            textures: vec![],
            glues: vec![],
            physics: vec![],
            animations: vec![],
            parameter_groups: vec![],
            pose_groups: vec![],
            expressions: vec![],
        };

        let mut params = HashMap::new();
        params.insert("ParamAngleX".into(), 0.0);
        let frame0 = evaluate_project(&project, &params);
        assert_eq!(frame0.meshes.len(), 1);
        assert!((frame0.meshes[0].vertices[0][0] - 50.0).abs() < 1e-4);

        params.insert("ParamAngleX".into(), 15.0);
        let frame15 = evaluate_project(&project, &params);
        assert!((frame15.meshes[0].vertices[0][0] - 60.0).abs() < 1e-4);

        params.insert("ParamAngleX".into(), 30.0);
        let frame30 = evaluate_project(&project, &params);
        assert!((frame30.meshes[0].vertices[0][0] - 70.0).abs() < 1e-4);
    }

    #[test]
    fn test_evaluator_glue_constraint() {
        let project = Project {
            format_version: 1,
            canvas: Canvas::default(),
            parameters: vec![],
            nodes: vec![
                Node {
                    id: "meshA".into(),
                    name: "Mesh A".into(),
                    parent_id: None,
                    visible: true,
                    locked: false,
                    kind: NodeKind::ArtMesh(ArtMeshData {
                        texture_id: "tex1".into(),
                        vertices: vec![[10.0, 10.0]],
                        uvs: vec![[0.0, 0.0]],
                        indices: vec![0],
                        blend_mode: BlendMode::Normal,
                        opacity: 1.0,
                        multiply_color: [1.0, 1.0, 1.0, 1.0],
                        screen_color: [0.0, 0.0, 0.0, 0.0],
                        draw_order: 0,
                        mask_ids: vec![],
                        is_mask_inverted: false,
                        morph_targets: vec![],
                        hit_area_name: None,
                        user_data: None,
                    }),
                },
                Node {
                    id: "meshB".into(),
                    name: "Mesh B".into(),
                    parent_id: None,
                    visible: true,
                    locked: false,
                    kind: NodeKind::ArtMesh(ArtMeshData {
                        texture_id: "tex1".into(),
                        vertices: vec![[20.0, 20.0]],
                        uvs: vec![[0.0, 0.0]],
                        indices: vec![0],
                        blend_mode: BlendMode::Normal,
                        opacity: 1.0,
                        multiply_color: [1.0, 1.0, 1.0, 1.0],
                        screen_color: [0.0, 0.0, 0.0, 0.0],
                        draw_order: 1,
                        mask_ids: vec![],
                        is_mask_inverted: false,
                        morph_targets: vec![],
                        hit_area_name: None,
                        user_data: None,
                    }),
                },
            ],
            keyforms: vec![],
            textures: vec![],
            glues: vec![GlueBinding {
                id: "glue1".into(),
                name: "Glue 1".into(),
                mesh_a_id: "meshA".into(),
                mesh_b_id: "meshB".into(),
                vertex_pairs: vec![GluePair {
                    index_a: 0,
                    index_b: 0,
                    weight_a: 0.5,
                    weight_b: 0.5,
                }],
            }],
            physics: vec![],
            animations: vec![],
            parameter_groups: vec![],
            pose_groups: vec![],
            expressions: vec![],
        };

        let frame = evaluate_project(&project, &HashMap::new());
        assert_eq!(frame.meshes.len(), 2);
        assert!((frame.meshes[0].vertices[0][0] - 15.0).abs() < 1e-4);
        assert!((frame.meshes[0].vertices[0][1] - 15.0).abs() < 1e-4);
        assert!((frame.meshes[1].vertices[0][0] - 15.0).abs() < 1e-4);
        assert!((frame.meshes[1].vertices[0][1] - 15.0).abs() < 1e-4);
    }

    #[test]
    fn test_evaluator_deform_path() {
        let base_path = vec![[0.0, 0.0], [0.0, 100.0]];
        let mut deformed_path = base_path.clone();
        deformed_path[0][0] += 30.0;
        deformed_path[1][0] += 30.0;

        let project = Project {
            format_version: 1,
            canvas: Canvas::default(),
            parameters: vec![Parameter {
                id: "ParamAngleX".into(),
                name: "Angle X".into(),
                min: 0.0,
                max: 30.0,
                default: 0.0,
                repeats: false,
                group_id: None,
                locked: false,
            }],
            nodes: vec![
                Node {
                    id: "path1".into(),
                    name: "Path 1".into(),
                    parent_id: None,
                    visible: true,
                    locked: false,
                    kind: NodeKind::DeformPath(DeformPathData {
                        control_points: base_path.clone(),
                        target_mesh_ids: vec!["mesh1".into()],
                    }),
                },
                Node {
                    id: "mesh1".into(),
                    name: "Mesh 1".into(),
                    parent_id: None,
                    visible: true,
                    locked: false,
                    kind: NodeKind::ArtMesh(ArtMeshData {
                        texture_id: "tex1".into(),
                        vertices: vec![[0.0, 50.0]],
                        uvs: vec![[0.5, 0.5]],
                        indices: vec![0],
                        blend_mode: BlendMode::Normal,
                        opacity: 1.0,
                        multiply_color: [1.0, 1.0, 1.0, 1.0],
                        screen_color: [0.0, 0.0, 0.0, 0.0],
                        draw_order: 0,
                        mask_ids: vec![],
                        is_mask_inverted: false,
                        morph_targets: vec![],
                        hit_area_name: None,
                        user_data: None,
                    }),
                },
            ],
            keyforms: vec![KeyformBinding {
                target_node_id: "path1".into(),
                dimensions: vec![ParamDimension {
                    param_id: "ParamAngleX".into(),
                    keys: vec![0.0, 30.0],
                    extended_interpolation: None,
                }],
                keyforms: vec![
                    KeyformState {
                        coordinates: vec![0.0],
                        payload: KeyformPayload::DeformPath { control_points: base_path },
                    },
                    KeyformState {
                        coordinates: vec![30.0],
                        payload: KeyformPayload::DeformPath { control_points: deformed_path },
                    },
                ],
            }],
            textures: vec![],
            glues: vec![],
            physics: vec![],
            animations: vec![],
            parameter_groups: vec![],
            pose_groups: vec![],
            expressions: vec![],
        };

        let mut params = HashMap::new();
        params.insert("ParamAngleX".into(), 30.0);
        let frame = evaluate_project(&project, &params);
        assert_eq!(frame.meshes.len(), 1);
        // Vertex should follow path translation
        assert!((frame.meshes[0].vertices[0][0] - 30.0).abs() < 1e-3);
    }

    #[test]
    fn test_evaluator_art_path_tessellation_and_keyform() {
        let mut project = Project::default();
        project.parameters.push(Parameter {
            id: "ParamBrowLY".into(),
            name: "Brow L Y".into(),
            min: -1.0,
            max: 1.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
        let base_pts = vec![
            ArtPathPoint { pos: [100.0, 200.0], width: 6.0, opacity: 1.0 },
            ArtPathPoint { pos: [150.0, 200.0], width: 8.0, opacity: 1.0 },
            ArtPathPoint { pos: [200.0, 200.0], width: 6.0, opacity: 1.0 },
        ];
        let mut raised_pts = base_pts.clone();
        for pt in &mut raised_pts {
            pt.pos[1] -= 20.0;
        }
        project.nodes.push(Node {
            id: "artpath_brow".into(),
            name: "Eyebrow Line".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::ArtPath(ArtPathData {
                points: base_pts.clone(),
                closed: false,
                color: [0.1, 0.1, 0.1, 1.0],
                texture_id: None,
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                draw_order: 50,
                mask_ids: vec![],
                is_mask_inverted: false,
            }),
        });
        project.keyforms.push(KeyformBinding {
            target_node_id: "artpath_brow".into(),
            dimensions: vec![ParamDimension {
                param_id: "ParamBrowLY".into(),
                keys: vec![0.0, 1.0],
                extended_interpolation: Some(ExtendedInterpolationType::Circle),
            }],
            keyforms: vec![
                KeyformState {
                    coordinates: vec![0.0],
                    payload: KeyformPayload::ArtPath { points: base_pts },
                },
                KeyformState {
                    coordinates: vec![1.0],
                    payload: KeyformPayload::ArtPath { points: raised_pts },
                },
            ],
        });

        let mut params = HashMap::new();
        params.insert("ParamBrowLY".into(), 1.0);
        let frame = evaluate_project(&project, &params);
        assert_eq!(frame.meshes.len(), 1);
        // 3 control points -> 6 ribbon vertices, 2 segments -> 12 triangle indices
        assert_eq!(frame.meshes[0].vertices.len(), 6);
        assert_eq!(frame.meshes[0].indices.len(), 12);
        // Midpoint of first vertex pair should be at y = 180.0
        let mid_y = (frame.meshes[0].vertices[0][1] + frame.meshes[0].vertices[1][1]) * 0.5;
        assert!((mid_y - 180.0).abs() < 1e-3);
    }

    #[test]
    fn test_evaluator_repeats_and_expression_and_pose() {
        let mut project = Project::default();
        project.parameters.push(Parameter {
            id: "ParamSpin".into(),
            name: "Spin".into(),
            min: 0.0,
            max: 360.0,
            default: 0.0,
            repeats: true,
            group_id: None,
            locked: false,
        });
        project.expressions.push(Expression {
            id: "smile".into(),
            name: "Smile".into(),
            fade_in_time: 0.5,
            fade_out_time: 0.5,
            parameters: vec![ExpressionParameter {
                id: "ParamSpin".into(),
                value: 180.0,
                blend: ExpressionBlendType::Overwrite,
            }],
        });
        project.nodes.push(Node {
            id: "part_arm_a".into(),
            name: "Arm A".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::Part { collapsed: false, opacity: 1.0 },
        });
        project.nodes.push(Node {
            id: "part_arm_b".into(),
            name: "Arm B".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::Part { collapsed: false, opacity: 1.0 },
        });
        project.pose_groups.push(PoseGroup {
            id: "pose_arms".into(),
            name: "Arms".into(),
            fade_in_time: 0.5,
            part_ids: vec!["part_arm_a".into(), "part_arm_b".into()],
        });
        project.nodes.push(Node {
            id: "mesh_a".into(),
            name: "Mesh A".into(),
            parent_id: Some("part_arm_a".into()),
            visible: true,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: "tex1".into(),
                vertices: vec![[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order: 0,
                mask_ids: vec![],
                is_mask_inverted: false,
                morph_targets: vec![],
                hit_area_name: None,
                user_data: None,
            }),
        });
        project.nodes.push(Node {
            id: "mesh_b".into(),
            name: "Mesh B".into(),
            parent_id: Some("part_arm_b".into()),
            visible: true,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: "tex1".into(),
                vertices: vec![[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order: 1,
                mask_ids: vec![],
                is_mask_inverted: false,
                morph_targets: vec![],
                hit_area_name: None,
                user_data: None,
            }),
        });

        // Pose group selects part_arm_b -> mesh_a should be culled, only mesh_b rendered
        let mut params = HashMap::new();
        params.insert("part_arm_b".into(), 1.0);
        let frame = evaluate_project(&project, &params);
        assert_eq!(frame.meshes.len(), 1);
        assert_eq!(frame.meshes[0].id, "mesh_b");
    }
}
