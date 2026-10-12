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
    let texture_ids: HashSet<&str> = project.textures.iter().map(|t| t.id.as_str()).collect();

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
        }

        // Kind specific checks
        match &node.kind {
            NodeKind::WarpDeformer(warp) => {
                let expected = (warp.cols + 1) * (warp.rows + 1);
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
                for &index in &mesh.indices {
                    if index as usize >= num_v {
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
            }
            _ => {}
        }
    }

    // 5. Keyforms checks
    for (idx, kf) in project.keyforms.iter().enumerate() {
        if !node_map.contains_key(kf.target_node_id.as_str()) {
            diags.push(Diagnostic {
                code: "KEYFORM_TARGET_NOT_FOUND".into(),
                severity: DiagnosticSeverity::Error,
                message: format!("Keyform references non-existent target node '{}'", kf.target_node_id),
                target_id: Some(kf.target_node_id.clone()),
                json_path: format!("/keyforms/{}/target_node_id", idx),
            });
        }
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
                kind: NodeKind::Part { collapsed: false },
            },
            Node {
                id: "B".into(),
                name: "B".into(),
                parent_id: Some("A".into()),
                visible: true,
                locked: false,
                kind: NodeKind::Part { collapsed: false },
            },
        ];
        let diags = lint_project(&proj);
        assert!(diags.iter().any(|d| d.code == "HIERARCHY_CYCLE_DETECTED"));
    }
}
