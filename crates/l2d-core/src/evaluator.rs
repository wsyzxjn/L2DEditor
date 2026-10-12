use crate::math::deform_path::transform_point_by_deform_path;
use crate::math::interpolation::{compute_multidim_weights, blend_points};
use crate::math::rotation::transform_point_by_rotation;
use crate::math::warp::transform_point_by_warp;
use crate::model::*;
use std::collections::HashMap;

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
    let node_map: HashMap<&str, &Node> = project.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
    let keyform_map: HashMap<&str, &KeyformBinding> = project
        .keyforms
        .iter()
        .map(|k| (k.target_node_id.as_str(), k))
        .collect();

    // 1. Evaluate deformed state for each deformer node
    let mut deformer_states: HashMap<String, DeformerState> = HashMap::new();

    for node in &project.nodes {
        match &node.kind {
            NodeKind::WarpDeformer(data) => {
                let mut cp = data.control_points.clone();
                if let Some(kf) = keyform_map.get(node.id.as_str()) {
                    let (dim_keys, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                    let weights = compute_multidim_weights(&dim_keys, &query_coords, &kf_coords);
                    let point_states: Vec<&[[f32; 2]]> = kf
                        .keyforms
                        .iter()
                        .filter_map(|s| match &s.payload {
                            KeyformPayload::Warp { control_points } => Some(control_points.as_slice()),
                            _ => None,
                        })
                        .collect();

                    if point_states.len() == weights.len() && !point_states.is_empty() {
                        cp = blend_points(&point_states, &weights);
                    }
                }
                deformer_states.insert(
                    node.id.clone(),
                    DeformerState::Warp {
                        cols: data.cols,
                        rows: data.rows,
                        bounds: data.bounds,
                        control_points: cp,
                    },
                );
            }
            NodeKind::RotationDeformer(data) => {
                let mut origin = data.origin;
                let mut angle_deg = data.angle_deg;
                let mut scale = data.scale;

                if let Some(kf) = keyform_map.get(node.id.as_str()) {
                    let (dim_keys, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                    let weights = compute_multidim_weights(&dim_keys, &query_coords, &kf_coords);
                    let mut blended_origin = [0.0, 0.0];
                    let mut blended_angle = 0.0;
                    let mut blended_scale = [0.0, 0.0];
                    let mut valid = false;

                    for (state, &w) in kf.keyforms.iter().zip(weights.iter()) {
                        if let KeyformPayload::Rotation { origin: o, angle_deg: a, scale: s } = &state.payload {
                            valid = true;
                            blended_origin[0] += o[0] * w;
                            blended_origin[1] += o[1] * w;
                            blended_angle += a * w;
                            blended_scale[0] += s[0] * w;
                            blended_scale[1] += s[1] * w;
                        }
                    }
                    if valid {
                        origin = blended_origin;
                        angle_deg = blended_angle;
                        scale = blended_scale;
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
                    let (dim_keys, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                    let weights = compute_multidim_weights(&dim_keys, &query_coords, &kf_coords);
                    let point_states: Vec<&[[f32; 2]]> = kf
                        .keyforms
                        .iter()
                        .filter_map(|s| match &s.payload {
                            KeyformPayload::DeformPath { control_points } => Some(control_points.as_slice()),
                            _ => None,
                        })
                        .collect();

                    if point_states.len() == weights.len() && !point_states.is_empty() {
                        pts = blend_points(&point_states, &weights);
                    }
                }
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
        if !node.visible {
            continue;
        }
        if let NodeKind::ArtMesh(mesh_data) = &node.kind {
            let mut vertices = mesh_data.vertices.clone();
            let mut opacity = mesh_data.opacity;
            let mut multiply_color = mesh_data.multiply_color;
            let mut screen_color = mesh_data.screen_color;

            // Apply ArtMesh keyforms (vertex offsets, opacity, colors)
            if let Some(kf) = keyform_map.get(node.id.as_str()) {
                let (dim_keys, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                let weights = compute_multidim_weights(&dim_keys, &query_coords, &kf_coords);
                let mut has_offsets = false;
                let mut offset_acc = vec![[0.0, 0.0]; vertices.len()];
                let mut opacity_acc = 0.0;
                let mut has_op_kf = false;

                for (state, &w) in kf.keyforms.iter().zip(weights.iter()) {
                    if let KeyformPayload::ArtMesh { vertex_offsets, opacity: op, multiply_color: mc, screen_color: sc } = &state.payload {
                        has_offsets = true;
                        for (idx, off) in vertex_offsets.iter().enumerate().take(vertices.len()) {
                            offset_acc[idx][0] += off[0] * w;
                            offset_acc[idx][1] += off[1] * w;
                        }
                        if let Some(o) = op {
                            has_op_kf = true;
                            opacity_acc += o * w;
                        }
                        if let Some(c) = mc {
                            for ch in 0..4 {
                                multiply_color[ch] = multiply_color[ch] * (1.0 - w) + c[ch] * w;
                            }
                        }
                        if let Some(c) = sc {
                            for ch in 0..4 {
                                screen_color[ch] = screen_color[ch] * (1.0 - w) + c[ch] * w;
                            }
                        }
                    }
                }
                if has_offsets {
                    for (v, off) in vertices.iter_mut().zip(offset_acc.iter()) {
                        v[0] += off[0];
                        v[1] += off[1];
                    }
                }
                if has_op_kf {
                    opacity = opacity_acc;
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

            // Apply Deform Paths targeting this mesh
            for deformer in deformer_states.values() {
                if let DeformerState::DeformPath { base_points, deformed_points, target_mesh_ids } = deformer {
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
                        break;
                    }
                    if let NodeKind::Part { opacity: part_op, .. } = parent_node.kind {
                        opacity *= part_op;
                    }
                    ancestors.push(pid);
                    curr_parent = parent_node.parent_id.as_deref();
                } else {
                    break;
                }
            }

            if !inherited_visible {
                continue;
            }

            // Deform vertices through ancestor chain (bottom-up: immediate parent first)
            for &ancestor_id in &ancestors {
                if let Some(deformer) = deformer_states.get(ancestor_id) {
                    match deformer {
                        DeformerState::Warp { cols, rows, bounds, control_points } => {
                            for pt in &mut vertices {
                                *pt = transform_point_by_warp(*pt, *cols, *rows, *bounds, control_points);
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
                draw_order: mesh_data.draw_order,
                mask_ids: mesh_data.mask_ids.clone(),
                is_mask_inverted: mesh_data.is_mask_inverted,
            });
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
) -> (Vec<Vec<f32>>, Vec<f32>, Vec<Vec<f32>>) {
    let mut dim_keys = Vec::with_capacity(kf.dimensions.len());
    let mut query_coords = Vec::with_capacity(kf.dimensions.len());

    for dim in &kf.dimensions {
        dim_keys.push(dim.keys.clone());
        let def = project
            .parameters
            .iter()
            .find(|p| p.id == dim.param_id)
            .map(|p| p.default)
            .unwrap_or(0.0);
        let current_val = params.get(&dim.param_id).copied().unwrap_or(def);
        query_coords.push(current_val);
    }

    let kf_coords = kf.keyforms.iter().map(|s| s.coordinates.clone()).collect();
    (dim_keys, query_coords, kf_coords)
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
}
