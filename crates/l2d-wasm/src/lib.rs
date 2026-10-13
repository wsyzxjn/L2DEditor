use l2d_core::{
    auto_smooth_track_tangents,
    bake_physics_to_animation, classify_artmesh_pure_rust, evaluate_mlp_forward, evaluate_project,
    export_moc3_binary, export_project_schema, export_runtime_bundle, import_moc3_binary,
    lint_project, Animation, Diagnostic, DiagnosticSeverity, Node, Project,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[derive(Serialize, Deserialize)]
pub struct CompileReport {
    pub success: bool,
    pub diagnostics: Vec<Diagnostic>,
    pub num_nodes: usize,
    pub num_parameters: usize,
}

#[derive(Serialize, Deserialize)]
pub struct EvaluatedMeshJs {
    pub id: String,
    pub texture_id: String,
    pub vertices: Vec<f32>, // flattened x, y, x, y
    pub uvs: Vec<f32>,      // flattened u, v, u, v
    pub indices: Vec<u32>,
    pub blend_mode: String,
    pub opacity: f32,
    pub multiply_color: [f32; 4],
    pub screen_color: [f32; 4],
    pub draw_order: i32,
    pub mask_ids: Vec<String>,
    pub is_mask_inverted: bool,
}

#[derive(Serialize, Deserialize)]
pub struct EvaluatedFrameJs {
    pub meshes: Vec<EvaluatedMeshJs>,
    pub total_vertices: usize,
    pub total_indices: usize,
}

#[wasm_bindgen]
pub struct WasmModel {
    project: Project,
    parameters: HashMap<String, f32>,
}

#[wasm_bindgen]
impl WasmModel {
    #[wasm_bindgen(constructor)]
    pub fn new(project_json: &str) -> Result<WasmModel, JsValue> {
        let project: Project = serde_json::from_str(project_json)
            .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;

        let mut params = HashMap::new();
        for p in &project.parameters {
            params.insert(p.id.clone(), p.default);
        }

        Ok(WasmModel {
            project,
            parameters: params,
        })
    }

    #[wasm_bindgen(js_name = setParameter)]
    pub fn set_parameter(&mut self, param_id: &str, value: f32) {
        let val = if let Some(p) = self.project.parameters.iter().find(|param| param.id == param_id) {
            if p.repeats && (p.max - p.min).abs() > 1e-5 {
                let span = p.max - p.min;
                p.min + (value - p.min).rem_euclid(span)
            } else {
                value.clamp(p.min, p.max)
            }
        } else {
            value
        };
        self.parameters.insert(param_id.to_string(), val);
    }

    #[wasm_bindgen(js_name = getParameter)]
    pub fn get_parameter(&self, param_id: &str) -> f32 {
        self.parameters.get(param_id).copied().unwrap_or(0.0)
    }

    #[wasm_bindgen(js_name = evaluate)]
    pub fn evaluate(&self) -> Result<JsValue, JsValue> {
        let frame = evaluate_project(&self.project, &self.parameters);

        let meshes_js: Vec<EvaluatedMeshJs> = frame
            .meshes
            .into_iter()
            .map(|m| {
                let mut flat_v = Vec::with_capacity(m.vertices.len() * 2);
                for pt in m.vertices {
                    flat_v.push(pt[0]);
                    flat_v.push(pt[1]);
                }
                let mut flat_uv = Vec::with_capacity(m.uvs.len() * 2);
                for uv in m.uvs {
                    flat_uv.push(uv[0]);
                    flat_uv.push(uv[1]);
                }

                let blend_str = match m.blend_mode {
                    l2d_core::BlendMode::Normal => "normal",
                    l2d_core::BlendMode::Multiply => "multiply",
                    l2d_core::BlendMode::Screen => "screen",
                    l2d_core::BlendMode::Additive => "additive",
                };

                EvaluatedMeshJs {
                    id: m.id,
                    texture_id: m.texture_id,
                    vertices: flat_v,
                    uvs: flat_uv,
                    indices: m.indices,
                    blend_mode: blend_str.into(),
                    opacity: m.opacity,
                    multiply_color: m.multiply_color,
                    screen_color: m.screen_color,
                    draw_order: m.draw_order,
                    mask_ids: m.mask_ids,
                    is_mask_inverted: m.is_mask_inverted,
                }
            })
            .collect();

        let frame_js = EvaluatedFrameJs {
            meshes: meshes_js,
            total_vertices: frame.total_vertices,
            total_indices: frame.total_indices,
        };

        serde_wasm_bindgen::to_value(&frame_js)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen(js_name = lint)]
    pub fn lint(&self) -> Result<JsValue, JsValue> {
        let diags = lint_project(&self.project);
        serde_wasm_bindgen::to_value(&diags)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.project.compute_stats();
        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

#[wasm_bindgen(js_name = lintProjectJson)]
pub fn lint_project_json(project_json: &str) -> Result<JsValue, JsValue> {
    let project: Project = serde_json::from_str(project_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    let diags = lint_project(&project);
    serde_wasm_bindgen::to_value(&diags)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = getProjectSchema)]
pub fn get_project_schema() -> String {
    let schema = export_project_schema();
    serde_json::to_string_pretty(&schema).unwrap_or_else(|_| "{}".to_string())
}

#[wasm_bindgen(js_name = compileProject)]
pub fn compile_project(project_json: &str) -> Result<JsValue, JsValue> {
    let parse_res: Result<Project, _> = serde_json::from_str(project_json);
    match parse_res {
        Ok(project) => {
            let diags = lint_project(&project);
            let has_errors = diags.iter().any(|d| d.severity == DiagnosticSeverity::Error);
            let report = CompileReport {
                success: !has_errors,
                diagnostics: diags,
                num_nodes: project.nodes.len(),
                num_parameters: project.parameters.len(),
            };
            serde_wasm_bindgen::to_value(&report)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        }
        Err(e) => {
            let report = CompileReport {
                success: false,
                diagnostics: vec![Diagnostic {
                    code: "JSON_PARSE_ERROR".into(),
                    severity: DiagnosticSeverity::Error,
                    message: format!("Failed to parse project JSON: {}", e),
                    target_id: None,
                    json_path: "/".into(),
                }],
                num_nodes: 0,
                num_parameters: 0,
            };
            serde_wasm_bindgen::to_value(&report)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        }
    }
}

#[wasm_bindgen(js_name = getProjectStats)]
pub fn get_project_stats(project_json: &str) -> Result<JsValue, JsValue> {
    let project: Project = serde_json::from_str(project_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    let stats = project.compute_stats();
    serde_wasm_bindgen::to_value(&stats)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = autoSmoothAnimationTrackTangents)]
pub fn auto_smooth_animation_track_tangents_wasm(track_json: &str) -> Result<JsValue, JsValue> {
    let mut track: l2d_core::AnimationTrack = serde_json::from_str(track_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    auto_smooth_track_tangents(&mut track);
    serde_wasm_bindgen::to_value(&track)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = bakePhysicsToAnimation)]
pub fn bake_physics_to_animation_wasm(
    project_json: &str,
    animation_id: &str,
) -> Result<String, JsValue> {
    let mut project: Project = serde_json::from_str(project_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    bake_physics_to_animation(&mut project, animation_id)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string_pretty(&project)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = importMtnMotion)]
pub fn import_mtn_motion_wasm(
    id: &str,
    name: &str,
    content: &str,
    normalize_ids: bool,
) -> Result<JsValue, JsValue> {
    let anim = Animation::from_mtn_str_with_options(id, name, content, normalize_ids)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&anim)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = exportMoc3Binary)]
pub fn export_moc3_binary_wasm(project_json: &str, version: u8) -> Result<Vec<u8>, JsValue> {
    let project: Project = serde_json::from_str(project_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    export_moc3_binary(&project, version).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen(js_name = importMoc3Binary)]
pub fn import_moc3_binary_wasm(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let project = import_moc3_binary(bytes).map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&project)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = evaluateMlpForward)]
pub fn evaluate_mlp_forward_wasm(
    onnx_bytes: Option<Vec<u8>>,
    input: &[f32],
    expected_output_len: usize,
) -> Vec<f32> {
    evaluate_mlp_forward(onnx_bytes.as_deref(), input, expected_output_len)
}

#[wasm_bindgen(js_name = classifyArtMeshPureRust)]
pub fn classify_artmesh_pure_rust_wasm(
    node_json: &str,
    canvas_w: f32,
    canvas_h: f32,
) -> Result<JsValue, JsValue> {
    let node: Node = serde_json::from_str(node_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    let (logits, predicted_class) = classify_artmesh_pure_rust(&node, canvas_w, canvas_h);
    #[derive(Serialize)]
    struct ClsResult<'a> {
        logits: [f32; 13],
        predicted_class: &'a str,
    }
    serde_wasm_bindgen::to_value(&ClsResult {
        logits,
        predicted_class,
    })
    .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen(js_name = exportRuntimeBundle)]
pub fn export_runtime_bundle_wasm(
    project_json: &str,
    model_name: &str,
    atlas_size: u32,
    padding: u32,
) -> Result<JsValue, JsValue> {
    let project: Project = serde_json::from_str(project_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    let bundle = export_runtime_bundle(
        &project,
        model_name,
        atlas_size,
        padding,
        &["textures/texture_00.png".to_string()],
    )
    .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&bundle)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
