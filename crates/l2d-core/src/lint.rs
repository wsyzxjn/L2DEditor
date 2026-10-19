use crate::model::*;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Diagnostic {
    pub code: String,
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub target_id: Option<String>,
    pub json_path: String,
}

pub fn lint_project(project: &Project) -> Vec<Diagnostic> {
    let mut diags = Vec::new();

    // 1. Check format version
    if project.format_version == 0 || project.format_version > CURRENT_FORMAT_VERSION {
        diags.push(Diagnostic {
            code: "FORMAT_VERSION_UNSUPPORTED".into(),
            severity: DiagnosticSeverity::Error,
            message: format!(
                "Unsupported format_version {}, current supported version is {}",
                project.format_version, CURRENT_FORMAT_VERSION
            ),
            target_id: None,
            json_path: "/format_version".into(),
        });
    }

    // 2. Parameters checks
    let mut param_ids = HashSet::new();
    for (idx, param) in project.parameters.iter().enumerate() {
        if !param_ids.insert(&param.id) {
            diags.push(Diagnostic {
                code: "DUPLICATE_PARAM_ID".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Duplicate parameter ID: '{}'", param.id),
                target_id: Some(param.id.clone()),
                json_path: format!("/parameters/{}", idx),
            });
        }
        if param.min >= param.max {
            diags.push(Diagnostic {
                code: "INVALID_PARAM_RANGE".into(),
                severity: DiagnosticSeverity::Error,
                message: format!(
                    "Parameter '{}' min ({}) must be strictly less than max ({})",
                    param.id, param.min, param.max
                ),
                target_id: Some(param.id.clone()),
                json_path: format!("/parameters/{}/min", idx),
            });
        }
        if !param.min.is_finite() || !param.max.is_finite() || !param.default.is_finite() {
            diags.push(Diagnostic {
                code: "NON_FINITE_PARAMETER".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Parameter '{}' contains a non-finite value", param.id),
                target_id: Some(param.id.clone()),
                json_path: format!("/parameters/{}", idx),
            });
        }
        if param.id.is_empty() || param.id.len() >= 64 {
            diags.push(Diagnostic {
                code: "MOC3_ID_INVALID_LENGTH".into(),
                severity: DiagnosticSeverity::Error,
                message: format!(
                    "Parameter ID '{}' must contain 1..63 UTF-8 bytes for MOC3",
                    param.id
                ),
                target_id: Some(param.id.clone()),
                json_path: format!("/parameters/{}/id", idx),
            });
        }
        if param.default < param.min || param.default > param.max {
            diags.push(Diagnostic {
                code: "INVALID_PARAM_DEFAULT".into(),
                severity: DiagnosticSeverity::Warning,
                message: format!(
                    "Parameter '{}' default ({}) is outside range [{}, {}]",
                    param.id, param.default, param.min, param.max
                ),
                target_id: Some(param.id.clone()),
                json_path: format!("/parameters/{}/default", idx),
            });
        }
    }

    // 3. Texture IDs map
    let mut texture_ids = HashSet::new();
    for (idx, texture) in project.textures.iter().enumerate() {
        if !texture_ids.insert(texture.id.as_str()) {
            diags.push(Diagnostic {
                code: "DUPLICATE_TEXTURE_ID".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Duplicate texture ID: '{}'", texture.id),
                target_id: Some(texture.id.clone()),
                json_path: format!("/textures/{}", idx),
            });
        }
        if texture.width == 0 || texture.height == 0 {
            diags.push(Diagnostic {
                code: "INVALID_TEXTURE_SIZE".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Texture '{}' has a zero dimension", texture.id),
                target_id: Some(texture.id.clone()),
                json_path: format!("/textures/{}/width", idx),
            });
        }
    }

    // 4. Node map & checks
    let mut node_ids = HashSet::new();
    let mut node_map = HashMap::new();
    for (idx, node) in project.nodes.iter().enumerate() {
        if !node_ids.insert(&node.id) {
            diags.push(Diagnostic {
                code: "DUPLICATE_NODE_ID".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Duplicate node ID: '{}'", node.id),
                target_id: Some(node.id.clone()),
                json_path: format!("/nodes/{}", idx),
            });
        }
        node_map.insert(node.id.as_str(), (idx, node));
        if node.id.is_empty() || node.id.len() >= 64 {
            diags.push(Diagnostic {
                code: "MOC3_ID_INVALID_LENGTH".into(),
                severity: DiagnosticSeverity::Error,
                message: format!(
                    "Node ID '{}' must contain 1..63 UTF-8 bytes for MOC3",
                    node.id
                ),
                target_id: Some(node.id.clone()),
                json_path: format!("/nodes/{}/id", idx),
            });
        }
    }

    // Check parent references and cycles
    for (idx, node) in project.nodes.iter().enumerate() {
        if let Some(parent_id) = &node.parent_id {
            if !node_map.contains_key(parent_id.as_str()) {
                diags.push(Diagnostic {
                    code: "DANGLING_PARENT_ID".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Node '{}' references missing parent_id '{}'", node.id, parent_id),
                    target_id: Some(node.id.clone()),
                    json_path: format!("/nodes/{}/parent_id", idx),
                });
            } else {
                // Cycle check
                let mut visited = HashSet::new();
                visited.insert(node.id.as_str());
                let mut curr = parent_id.as_str();
                while let Some((_, p_node)) = node_map.get(curr) {
                    if !visited.insert(curr) {
                        diags.push(Diagnostic {
                            code: "HIERARCHY_CYCLE_DETECTED".into(),
                            severity: DiagnosticSeverity::Error,
                            message: format!("Hierarchy cycle detected starting from node '{}'", node.id),
                            target_id: Some(node.id.clone()),
                            json_path: format!("/nodes/{}/parent_id", idx),
                        });
                        break;
                    }
                    if let Some(next_pid) = &p_node.parent_id {
                        curr = next_pid.as_str();
                    } else {
                        break;
                    }
                }
            }

            // Check if child vertices protrude outside parent WarpDeformer bounds (`CMD_VALIDATE_DEFORMER_DIALOG`)
            if let Some((_, parent_node)) = node_map.get(parent_id.as_str()) {
                if let NodeKind::WarpDeformer(parent_warp) = &parent_node.kind {
                    let [bx, by, bw, bh] = parent_warp.bounds;
                    let eps = 1e-2;
                    let child_pts: Option<&[[f32; 2]]> = match &node.kind {
                        NodeKind::ArtMesh(m) => Some(&m.vertices),
                        NodeKind::WarpDeformer(w) => Some(&w.control_points),
                        _ => None,
                    };
                    if let Some(pts) = child_pts {
                        let outside_count = pts
                            .iter()
                            .filter(|&&[px, py]| {
                                px < bx - eps || px > bx + bw + eps || py < by - eps || py > by + bh + eps
                            })
                            .count();
                        if outside_count > 0 {
                            diags.push(Diagnostic {
                                code: "CHILD_OUTSIDE_WARP_BOUNDS".into(),
                                severity: DiagnosticSeverity::Warning,
                                message: format!(
                                    "Node '{}' has {} point(s) protruding outside parent WarpDeformer '{}' bounds",
                                    node.id, outside_count, parent_node.id
                                ),
                                target_id: Some(node.id.clone()),
                                json_path: format!("/nodes/{}", idx),
                            });
                        }
                    }
                }
            }
        }

        // Check clipping mask references (`CUB3-1999`)
        if let NodeKind::ArtMesh(mesh) = &node.kind {
            for mask_id in &mesh.mask_ids {
                if let Some((_, mask_node)) = node_map.get(mask_id.as_str()) {
                    if !mask_node.visible {
                        diags.push(Diagnostic {
                            code: "MASK_TARGET_HIDDEN".into(),
                            severity: DiagnosticSeverity::Warning,
                            message: format!(
                                "ArtMesh '{}' references hidden mask node '{}' (CUB3-1999)",
                                node.id, mask_id
                            ),
                            target_id: Some(node.id.clone()),
                            json_path: format!("/nodes/{}/mask_ids", idx),
                        });
                    }
                    if !matches!(mask_node.kind, NodeKind::ArtMesh(_)) {
                        diags.push(Diagnostic {
                            code: "MASK_TARGET_NOT_ARTMESH".into(),
                            severity: DiagnosticSeverity::Error,
                            message: format!(
                                "ArtMesh '{}' references mask '{}' which is not an ArtMesh",
                                node.id, mask_id
                            ),
                            target_id: Some(node.id.clone()),
                            json_path: format!("/nodes/{}/mask_ids", idx),
                        });
                    }
                } else {
                    diags.push(Diagnostic {
                        code: "DANGLING_MASK_ID".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "ArtMesh '{}' references missing mask node '{}'",
                            node.id, mask_id
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/mask_ids", idx),
                    });
                }
            }
        }

        // Kind specific checks
        match &node.kind {
            NodeKind::WarpDeformer(warp) => {
                if warp.cols == 0 || warp.rows == 0 {
                    diags.push(Diagnostic {
                        code: "INVALID_WARP_GRID".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "Warp deformer '{}' must have positive rows and cols",
                            node.id
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/cols", idx),
                    });
                }
                let expected = (warp.cols + 1)
                    .checked_mul(warp.rows + 1)
                    .unwrap_or(usize::MAX);
                if warp.control_points.len() != expected {
                    diags.push(Diagnostic {
                        code: "WARP_CONTROL_POINTS_MISMATCH".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "Warp deformer '{}' expected {} control points ({}x{}), got {}",
                            node.id, expected, warp.cols, warp.rows, warp.control_points.len()
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/control_points", idx),
                    });
                }
                if !warp.bounds.iter().all(|value| value.is_finite())
                    || warp
                        .control_points
                        .iter()
                        .flatten()
                        .any(|value| !value.is_finite())
                {
                    diags.push(Diagnostic {
                        code: "NON_FINITE_WARP".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!("Warp deformer '{}' contains non-finite values", node.id),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}", idx),
                    });
                }
            }
            NodeKind::ArtMesh(mesh) => {
                if !project.textures.is_empty() && !texture_ids.contains(mesh.texture_id.as_str()) {
                    diags.push(Diagnostic {
                        code: "MISSING_TEXTURE_REFERENCE".into(),
                        severity: DiagnosticSeverity::Warning,
                        message: format!(
                            "ArtMesh '{}' references undefined texture '{}'",
                            node.id, mesh.texture_id
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/texture_id", idx),
                    });
                }
                if mesh.indices.len() % 3 != 0 {
                    diags.push(Diagnostic {
                        code: "INVALID_TRIANGLE_INDICES".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "ArtMesh '{}' indices length ({}) is not a multiple of 3",
                            node.id, mesh.indices.len()
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/indices", idx),
                    });
                }
                let num_v = mesh.vertices.len();
                if num_v > u16::MAX as usize {
                    diags.push(Diagnostic {
                        code: "MESH_VERTEX_COUNT_EXCEEDS_MOC3".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "ArtMesh '{}' has {} vertices; MOC3 supports at most {}",
                            node.id,
                            num_v,
                            u16::MAX
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/vertices", idx),
                    });
                }
                if mesh.uvs.len() < num_v {
                    diags.push(Diagnostic {
                        code: "MESH_UV_COUNT_MISMATCH".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "ArtMesh '{}' has {} UVs for {} vertices",
                            node.id,
                            mesh.uvs.len(),
                            num_v
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/uvs", idx),
                    });
                }
                if mesh
                    .vertices
                    .iter()
                    .chain(mesh.uvs.iter())
                    .flatten()
                    .any(|value| !value.is_finite())
                    || !mesh.opacity.is_finite()
                    || mesh
                        .multiply_color
                        .iter()
                        .chain(mesh.screen_color.iter())
                        .any(|value| !value.is_finite())
                {
                    diags.push(Diagnostic {
                        code: "NON_FINITE_MESH_DATA".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!("ArtMesh '{}' contains non-finite values", node.id),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}", idx),
                    });
                }
                let mut has_oob = false;
                for &index in &mesh.indices {
                    if index as usize >= num_v {
                        has_oob = true;
                        diags.push(Diagnostic {
                            code: "INDEX_OUT_OF_BOUNDS".into(),
                            severity: DiagnosticSeverity::Error,
                            message: format!(
                                "ArtMesh '{}' index {} is out of bounds (vertex count {})",
                                node.id, index, num_v
                            ),
                            target_id: Some(node.id.clone()),
                            json_path: format!("/nodes/{}/indices", idx),
                        });
                        break;
                    }
                }

                if !has_oob && mesh.indices.len() % 3 == 0 {
                    // Check base triangle areas & degeneracy
                    for tri_idx in 0..(mesh.indices.len() / 3) {
                        let i0 = mesh.indices[tri_idx * 3] as usize;
                        let i1 = mesh.indices[tri_idx * 3 + 1] as usize;
                        let i2 = mesh.indices[tri_idx * 3 + 2] as usize;
                        let p0 = mesh.vertices[i0];
                        let p1 = mesh.vertices[i1];
                        let p2 = mesh.vertices[i2];
                        let area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
                        if area.abs() < 1e-6 {
                            diags.push(Diagnostic {
                                code: "DEGENERATE_TRIANGLE".into(),
                                severity: DiagnosticSeverity::Warning,
                                message: format!(
                                    "ArtMesh '{}' triangle #{} has near-zero area ({:.6})",
                                    node.id, tri_idx, area
                                ),
                                target_id: Some(node.id.clone()),
                                json_path: format!("/nodes/{}/indices/{}", idx, tri_idx * 3),
                            });
                        }
                    }
                }
            }
            NodeKind::ArtPath(path) => {
                if path.points.len() < 2 {
                    diags.push(Diagnostic {
                        code: "ART_PATH_TOO_FEW_POINTS".into(),
                        severity: DiagnosticSeverity::Warning,
                        message: format!(
                            "ArtPath '{}' must have at least 2 control points, got {}",
                            node.id,
                            path.points.len()
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/points", idx),
                    });
                }
            }
            _ => {}
        }
    }

    // 5. Keyforms checks
    let mut keyform_targets = HashSet::new();
    for (idx, kf) in project.keyforms.iter().enumerate() {
        if !keyform_targets.insert(kf.target_node_id.as_str()) {
            diags.push(Diagnostic {
                code: "DUPLICATE_KEYFORM_BINDING".into(),
                severity: DiagnosticSeverity::Error,
                message: format!(
                    "Node '{}' has more than one keyform binding",
                    kf.target_node_id
                ),
                target_id: Some(kf.target_node_id.clone()),
                json_path: format!("/keyforms/{}", idx),
            });
        }
        let target_node = node_map.get(kf.target_node_id.as_str()).map(|(_, node)| *node);
        if target_node.is_none() {
            diags.push(Diagnostic {
                code: "KEYFORM_TARGET_NOT_FOUND".into(),
                severity: DiagnosticSeverity::Error,
                message: format!(
                    "Keyform references non-existent target node '{}'",
                    kf.target_node_id
                ),
                target_id: Some(kf.target_node_id.clone()),
                json_path: format!("/keyforms/{}/target_node_id", idx),
            });
        }
        let mut expected_states = 1usize;
        for (dim_idx, dim) in kf.dimensions.iter().enumerate() {
            if !param_ids.contains(&dim.param_id) {
                diags.push(Diagnostic {
                    code: "KEYFORM_PARAM_NOT_FOUND".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Keyform references undefined parameter '{}'", dim.param_id),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/dimensions/{}", idx, dim_idx),
                });
            }
            if dim.keys.is_empty() {
                diags.push(Diagnostic {
                    code: "EMPTY_KEYFORM_DIMENSION".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Keyform for '{}' has an empty dimension '{}'",
                        kf.target_node_id, dim.param_id
                    ),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/dimensions/{}", idx, dim_idx),
                });
            }
            if dim.keys.iter().any(|key| !key.is_finite()) {
                diags.push(Diagnostic {
                    code: "NON_FINITE_KEYFORM_KEY".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Keyform for '{}' has a non-finite key in '{}'",
                        kf.target_node_id, dim.param_id
                    ),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/dimensions/{}", idx, dim_idx),
                });
            }
            if dim.keys.windows(2).any(|pair| pair[0] >= pair[1]) {
                diags.push(Diagnostic {
                    code: "UNSORTED_KEYFORM_KEYS".into(),
                    severity: DiagnosticSeverity::Warning,
                    message: format!(
                        "Keyform for '{}' has unsorted or duplicate keys in '{}'",
                        kf.target_node_id, dim.param_id
                    ),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/dimensions/{}", idx, dim_idx),
                });
            }
            expected_states = expected_states.saturating_mul(dim.keys.len().max(1));
        }
        if kf.keyforms.len() != expected_states {
            diags.push(Diagnostic {
                code: "KEYFORM_STATE_COUNT_MISMATCH".into(),
                severity: DiagnosticSeverity::Warning,
                message: format!(
                    "Keyform for '{}' has {} states for a {} point parameter grid",
                    kf.target_node_id,
                    kf.keyforms.len(),
                    expected_states
                ),
                target_id: Some(kf.target_node_id.clone()),
                json_path: format!("/keyforms/{}/keyforms", idx),
            });
        }
        for (state_idx, state) in kf.keyforms.iter().enumerate() {
            if state.coordinates.len() != kf.dimensions.len() {
                diags.push(Diagnostic {
                    code: "KEYFORM_COORDINATE_COUNT_MISMATCH".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Keyform for '{}' state #{} has {} coordinates for {} dimensions",
                        kf.target_node_id,
                        state_idx,
                        state.coordinates.len(),
                        kf.dimensions.len()
                    ),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/keyforms/{}", idx, state_idx),
                });
            }
            if state.coordinates.iter().any(|value| !value.is_finite()) {
                diags.push(Diagnostic {
                    code: "NON_FINITE_KEYFORM_COORDINATE".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Keyform for '{}' state #{} contains a non-finite coordinate",
                        kf.target_node_id, state_idx
                    ),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/keyforms/{}", idx, state_idx),
                });
            }
            let Some(target_node) = target_node else {
                continue;
            };
            let payload_valid = match (&state.payload, &target_node.kind) {
                (KeyformPayload::Warp { control_points }, NodeKind::WarpDeformer(warp)) => {
                    let expected = (warp.cols + 1)
                        .checked_mul(warp.rows + 1)
                        .unwrap_or(usize::MAX);
                    control_points.len() == expected
                        && control_points.iter().flatten().all(|value| value.is_finite())
                }
                (KeyformPayload::Rotation { origin, angle_deg, scale }, NodeKind::RotationDeformer(_)) => {
                    origin.iter().chain(std::iter::once(angle_deg)).chain(scale.iter()).all(|value| value.is_finite())
                        && scale[0].abs() > 1e-8
                        && scale[1].abs() > 1e-8
                }
                (KeyformPayload::DeformPath { control_points }, NodeKind::DeformPath(path)) => {
                    control_points.len() == path.control_points.len()
                        && control_points.iter().flatten().all(|value| value.is_finite())
                }
                (KeyformPayload::ArtPath { points }, NodeKind::ArtPath(path)) => {
                    points.len() == path.points.len()
                }
                (KeyformPayload::ArtMesh { vertex_offsets, opacity, multiply_color, screen_color, .. }, NodeKind::ArtMesh(mesh)) => {
                    (vertex_offsets.is_empty() || vertex_offsets.len() == mesh.vertices.len())
                        && vertex_offsets.iter().flatten().all(|value| value.is_finite())
                        && opacity.is_none_or(|value| value.is_finite())
                        && multiply_color.is_none_or(|color| color.iter().all(|value| value.is_finite()))
                        && screen_color.is_none_or(|color| color.iter().all(|value| value.is_finite()))
                }
                _ => false,
            };
            if !payload_valid {
                diags.push(Diagnostic {
                    code: "KEYFORM_PAYLOAD_MISMATCH".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Keyform for '{}' state #{} has a payload that does not match the target or contains invalid data",
                        kf.target_node_id, state_idx
                    ),
                    target_id: Some(kf.target_node_id.clone()),
                    json_path: format!("/keyforms/{}/keyforms/{}/payload", idx, state_idx),
                });
            }
        }
    }

    // 6. Cross-reference integrity
    let mut glue_ids = HashSet::new();
    for (idx, glue) in project.glues.iter().enumerate() {
        if !glue_ids.insert(glue.id.as_str()) {
            diags.push(Diagnostic {
                code: "DUPLICATE_GLUE_ID".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Duplicate glue ID: '{}'", glue.id),
                target_id: Some(glue.id.clone()),
                json_path: format!("/glues/{}", idx),
            });
        }
        for (slot, mesh_id) in [("mesh_a_id", &glue.mesh_a_id), ("mesh_b_id", &glue.mesh_b_id)] {
            match node_map.get(mesh_id.as_str()) {
                Some((_, node)) if matches!(node.kind, NodeKind::ArtMesh(_)) => {}
                Some(_) => diags.push(Diagnostic {
                    code: "GLUE_TARGET_NOT_ARTMESH".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Glue '{}' {slot} '{}' is not an ArtMesh", glue.id, mesh_id),
                    target_id: Some(glue.id.clone()),
                    json_path: format!("/glues/{}/{}", idx, slot),
                }),
                None => diags.push(Diagnostic {
                    code: "DANGLING_GLUE_MESH".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Glue '{}' references missing mesh '{}'", glue.id, mesh_id),
                    target_id: Some(glue.id.clone()),
                    json_path: format!("/glues/{}/{}", idx, slot),
                }),
            }
        }
        let mesh_a_vertices = node_map
            .get(glue.mesh_a_id.as_str())
            .and_then(|(_, node)| match &node.kind {
                NodeKind::ArtMesh(mesh) => Some(mesh.vertices.len()),
                _ => None,
            });
        let mesh_b_vertices = node_map
            .get(glue.mesh_b_id.as_str())
            .and_then(|(_, node)| match &node.kind {
                NodeKind::ArtMesh(mesh) => Some(mesh.vertices.len()),
                _ => None,
            });
        for (pair_idx, pair) in glue.vertex_pairs.iter().enumerate() {
            if mesh_a_vertices.is_some_and(|count| pair.index_a as usize >= count)
                || mesh_b_vertices.is_some_and(|count| pair.index_b as usize >= count)
                || !pair.weight_a.is_finite()
                || !pair.weight_b.is_finite()
            {
                diags.push(Diagnostic {
                    code: "INVALID_GLUE_VERTEX_PAIR".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Glue '{}' vertex pair #{} is invalid", glue.id, pair_idx),
                    target_id: Some(glue.id.clone()),
                    json_path: format!("/glues/{}/vertex_pairs/{}", idx, pair_idx),
                });
            }
        }
    }

    for (idx, node) in project.nodes.iter().enumerate() {
        if let NodeKind::DeformPath(path) = &node.kind {
            for (target_idx, target_id) in path.target_mesh_ids.iter().enumerate() {
                if !node_map
                    .get(target_id.as_str())
                    .is_some_and(|(_, target)| matches!(target.kind, NodeKind::ArtMesh(_)))
                {
                    diags.push(Diagnostic {
                        code: "DANGLING_DEFORM_PATH_TARGET".into(),
                        severity: DiagnosticSeverity::Error,
                        message: format!(
                            "DeformPath '{}' references missing ArtMesh '{}'",
                            node.id, target_id
                        ),
                        target_id: Some(node.id.clone()),
                        json_path: format!("/nodes/{}/target_mesh_ids/{}", idx, target_idx),
                    });
                }
            }
        }
    }

    for (idx, parameter) in project.parameters.iter().enumerate() {
        if let Some(group_id) = &parameter.group_id {
            if !project.parameter_groups.iter().any(|group| &group.id == group_id) {
                diags.push(Diagnostic {
                    code: "DANGLING_PARAMETER_GROUP".into(),
                    severity: DiagnosticSeverity::Warning,
                    message: format!(
                        "Parameter '{}' references missing group '{}'",
                        parameter.id, group_id
                    ),
                    target_id: Some(parameter.id.clone()),
                    json_path: format!("/parameters/{}/group_id", idx),
                });
            }
        }
    }

    for (idx, pose) in project.pose_groups.iter().enumerate() {
        for (part_idx, part_id) in pose.part_ids.iter().enumerate() {
            if !node_map
                .get(part_id.as_str())
                .is_some_and(|(_, node)| matches!(node.kind, NodeKind::Part { .. }))
            {
                diags.push(Diagnostic {
                    code: "DANGLING_POSE_PART".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Pose group references missing Part '{}'", part_id),
                    target_id: Some(part_id.clone()),
                    json_path: format!("/pose_groups/{}/part_ids/{}", idx, part_idx),
                });
            }
        }
        if !pose.fade_in_time.is_finite() || pose.fade_in_time < 0.0 {
            diags.push(Diagnostic {
                code: "INVALID_POSE_FADE".into(),
                severity: DiagnosticSeverity::Warning,
                message: "Pose fade_in_time must be finite and non-negative".into(),
                target_id: None,
                json_path: format!("/pose_groups/{}/fade_in_time", idx),
            });
        }
    }

    for (group_idx, group) in project.physics.iter().enumerate() {
        for (input_idx, input) in group.inputs.iter().enumerate() {
            if !param_ids.contains(&input.param_id) || !input.weight.is_finite() {
                diags.push(Diagnostic {
                    code: "INVALID_PHYSICS_INPUT".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Physics group '{}' input #{} is invalid",
                        group.id, input_idx
                    ),
                    target_id: Some(group.id.clone()),
                    json_path: format!(
                        "/physics/{}/inputs/{}",
                        group_idx, input_idx
                    ),
                });
            }
        }
        for (output_idx, output) in group.outputs.iter().enumerate() {
            if !param_ids.contains(&output.param_id)
                || output.pendulum_index >= group.pendulums.len()
                || !output.angle_scale.is_finite()
                || !output.weight.is_finite()
            {
                diags.push(Diagnostic {
                    code: "INVALID_PHYSICS_OUTPUT".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Physics group '{}' output #{} is invalid",
                        group.id, output_idx
                    ),
                    target_id: Some(group.id.clone()),
                    json_path: format!(
                        "/physics/{}/outputs/{}",
                        group_idx, output_idx
                    ),
                });
            }
        }
        for (pendulum_idx, pendulum) in group.pendulums.iter().enumerate() {
            if !pendulum.length.is_finite()
                || pendulum.length <= 0.0
                || !pendulum.mass.is_finite()
                || pendulum.mass <= 0.0
                || !pendulum.damping.is_finite()
            {
                diags.push(Diagnostic {
                    code: "INVALID_PHYSICS_PENDULUM".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Physics group '{}' pendulum #{} is invalid",
                        group.id, pendulum_idx
                    ),
                    target_id: Some(group.id.clone()),
                    json_path: format!(
                        "/physics/{}/pendulums/{}",
                        group_idx, pendulum_idx
                    ),
                });
            }
        }
    }

    let mut animation_ids = HashSet::new();
    for (anim_idx, animation) in project.animations.iter().enumerate() {
        if !animation_ids.insert(animation.id.as_str()) {
            diags.push(Diagnostic {
                code: "DUPLICATE_ANIMATION_ID".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Duplicate animation ID: '{}'", animation.id),
                target_id: Some(animation.id.clone()),
                json_path: format!("/animations/{}", anim_idx),
            });
        }
        if animation.duration_frames.is_finite() && animation.duration_frames < 0.0 {
            diags.push(Diagnostic {
                code: "NEGATIVE_ANIMATION_DURATION".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Animation '{}' has a negative duration", animation.id),
                target_id: Some(animation.id.clone()),
                json_path: format!("/animations/{}/duration_frames", anim_idx),
            });
        }
        if !animation.duration_frames.is_finite()
            || !animation.fps.is_finite()
            || animation.fps <= 0.0
        {
            diags.push(Diagnostic {
                code: "NON_FINITE_ANIMATION_TIMING".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Animation '{}' has invalid duration/fps", animation.id),
                target_id: Some(animation.id.clone()),
                json_path: format!("/animations/{}", anim_idx),
            });
        }
        if crate::exporter::sanitize_file_stem(&animation.id, "motion") != animation.id {
            diags.push(Diagnostic {
                code: "UNSAFE_MOTION_FILE_NAME".into(),
                severity: DiagnosticSeverity::Warning,
                message: format!(
                    "Animation ID '{}' will be sanitized when exported",
                    animation.id
                ),
                target_id: Some(animation.id.clone()),
                json_path: format!("/animations/{}/id", anim_idx),
            });
        }
        for (track_idx, track) in animation.tracks.iter().enumerate() {
            if !param_ids.contains(&track.target_param_id) {
                diags.push(Diagnostic {
                    code: "ANIMATION_TRACK_PARAM_NOT_FOUND".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Animation '{}' track references missing parameter '{}'",
                        animation.id, track.target_param_id
                    ),
                    target_id: Some(animation.id.clone()),
                    json_path: format!(
                        "/animations/{}/tracks/{}/target_param_id",
                        anim_idx, track_idx
                    ),
                });
            }
            if track
                .keyframes
                .iter()
                .any(|keyframe| !keyframe.frame.is_finite() || !keyframe.value.is_finite())
            {
                diags.push(Diagnostic {
                    code: "NON_FINITE_ANIMATION_KEYFRAME".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Animation '{}' track #{} contains a non-finite keyframe",
                        animation.id, track_idx
                    ),
                    target_id: Some(animation.id.clone()),
                    json_path: format!("/animations/{}/tracks/{}", anim_idx, track_idx),
                });
            }
        }
        for (track_idx, track) in animation.form_tracks.iter().enumerate() {
            if !node_map.contains_key(track.target_node_id.as_str()) {
                diags.push(Diagnostic {
                    code: "FORM_TRACK_NODE_NOT_FOUND".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Animation '{}' form track references missing node '{}'",
                        animation.id, track.target_node_id
                    ),
                    target_id: Some(animation.id.clone()),
                    json_path: format!(
                        "/animations/{}/form_tracks/{}/target_node_id",
                        anim_idx, track_idx
                    ),
                });
            }
        }
    }

    let mut expression_ids = HashSet::new();
    for (expr_idx, expression) in project.expressions.iter().enumerate() {
        if !expression_ids.insert(expression.id.as_str()) {
            diags.push(Diagnostic {
                code: "DUPLICATE_EXPRESSION_ID".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Duplicate expression ID: '{}'", expression.id),
                target_id: Some(expression.id.clone()),
                json_path: format!("/expressions/{}", expr_idx),
            });
        }
        if crate::exporter::sanitize_file_stem(&expression.id, "expression") != expression.id {
            diags.push(Diagnostic {
                code: "UNSAFE_EXPRESSION_FILE_NAME".into(),
                severity: DiagnosticSeverity::Warning,
                message: format!(
                    "Expression ID '{}' will be sanitized when exported",
                    expression.id
                ),
                target_id: Some(expression.id.clone()),
                json_path: format!("/expressions/{}/id", expr_idx),
            });
        }
        for (param_idx, parameter) in expression.parameters.iter().enumerate() {
            if !param_ids.contains(&parameter.id) || !parameter.value.is_finite() {
                diags.push(Diagnostic {
                    code: "INVALID_EXPRESSION_PARAMETER".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!(
                        "Expression '{}' parameter #{} is invalid",
                        expression.id, param_idx
                    ),
                    target_id: Some(expression.id.clone()),
                    json_path: format!(
                        "/expressions/{}/parameters/{}",
                        expr_idx, param_idx
                    ),
                });
            }
        }
    }

    diags
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lint_clean_project() {
        let proj = Project::default();
        let diags = lint_project(&proj);
        assert!(diags.is_empty());
    }

    #[test]
    fn test_lint_hierarchy_cycle() {
        let mut proj = Project::default();
        proj.nodes = vec![
            Node {
                id: "A".into(),
                name: "A".into(),
                parent_id: Some("B".into()),
                visible: true,
                locked: false,
                kind: NodeKind::Part { collapsed: false, opacity: 1.0 },
            },
            Node {
                id: "B".into(),
                name: "B".into(),
                parent_id: Some("A".into()),
                visible: true,
                locked: false,
                kind: NodeKind::Part { collapsed: false, opacity: 1.0 },
            },
        ];
        let diags = lint_project(&proj);
        assert!(diags.iter().any(|d| d.code == "HIERARCHY_CYCLE_DETECTED"));
    }
}
