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
    pub draw_order: i32,
    pub mask_ids: Vec<String>,
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
            _ => {}
        }
    }

    // 2. Evaluate ArtMeshes through ancestor deformer hierarchies
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

            // Apply ArtMesh keyforms (vertex offsets and opacity)
            if let Some(kf) = keyform_map.get(node.id.as_str()) {
                let (dim_keys, query_coords, kf_coords) = extract_keyform_coords(kf, params, project);
                let weights = compute_multidim_weights(&dim_keys, &query_coords, &kf_coords);
                let mut has_offsets = false;
                let mut offset_acc = vec![[0.0, 0.0]; vertices.len()];
                let mut opacity_acc = 0.0;
                let mut has_op_kf = false;

                for (state, &w) in kf.keyforms.iter().zip(weights.iter()) {
                    if let KeyformPayload::ArtMesh { vertex_offsets, opacity: op } = &state.payload {
                        has_offsets = true;
                        for (idx, off) in vertex_offsets.iter().enumerate().take(vertices.len()) {
                            offset_acc[idx][0] += off[0] * w;
                            offset_acc[idx][1] += off[1] * w;
                        }
                        if let Some(o) = op {
                            has_op_kf = true;
                            opacity_acc += o * w;
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

            // Trace ancestor deformers from child up to root
            let mut ancestors = Vec::new();
            let mut curr_parent = node.parent_id.as_deref();
            let mut visited = std::collections::HashSet::new();
            while let Some(pid) = curr_parent {
                if !visited.insert(pid) {
                    break; // Prevent infinite cycle
                }
                if let Some(parent_node) = node_map.get(pid) {
                    ancestors.push(pid);
                    curr_parent = parent_node.parent_id.as_deref();
                } else {
                    break;
                }
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
                draw_order: mesh_data.draw_order,
                mask_ids: mesh_data.mask_ids.clone(),
            });
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
        // Shift warp right by 20 at ParamAngleX = 30
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
                        draw_order: 0,
                        mask_ids: vec![],
                    }),
                },
            ],
            keyforms: vec![KeyformBinding {
                target_node_id: "warp1".into(),
                dimensions: vec![ParamDimension {
                    param_id: "ParamAngleX".into(),
                    keys: vec![0.0, 30.0],
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
        };

        // At ParamAngleX = 0, vertex should be at 50, 50
        let mut params = HashMap::new();
        params.insert("ParamAngleX".into(), 0.0);
        let frame0 = evaluate_project(&project, &params);
        assert_eq!(frame0.meshes.len(), 1);
        assert!((frame0.meshes[0].vertices[0][0] - 50.0).abs() < 1e-4);

        // At ParamAngleX = 15, vertex should shift by +10 -> 60
        params.insert("ParamAngleX".into(), 15.0);
        let frame15 = evaluate_project(&project, &params);
        assert!((frame15.meshes[0].vertices[0][0] - 60.0).abs() < 1e-4);

        // At ParamAngleX = 30, vertex should shift by +20 -> 70
        params.insert("ParamAngleX".into(), 30.0);
        let frame30 = evaluate_project(&project, &params);
        assert!((frame30.meshes[0].vertices[0][0] - 70.0).abs() < 1e-4);
    }
}
