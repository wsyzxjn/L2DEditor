use crate::animation::Animation;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Format version for L2DEditor project files.
pub const CURRENT_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Project {
    pub format_version: u32,
    pub canvas: Canvas,
    #[serde(default)]
    pub parameters: Vec<Parameter>,
    #[serde(default)]
    pub nodes: Vec<Node>,
    #[serde(default)]
    pub keyforms: Vec<KeyformBinding>,
    #[serde(default)]
    pub textures: Vec<TextureMeta>,
    #[serde(default)]
    pub glues: Vec<GlueBinding>,
    #[serde(default)]
    pub physics: Vec<PhysicsGroup>,
    #[serde(default)]
    pub animations: Vec<Animation>,
    #[serde(default)]
    pub parameter_groups: Vec<ParameterGroup>,
    #[serde(default)]
    pub pose_groups: Vec<PoseGroup>,
    #[serde(default)]
    pub expressions: Vec<Expression>,
}

impl Default for Project {
    fn default() -> Self {
        Self {
            format_version: CURRENT_FORMAT_VERSION,
            canvas: Canvas::default(),
            parameters: Vec::new(),
            nodes: Vec::new(),
            keyforms: Vec::new(),
            textures: Vec::new(),
            glues: Vec::new(),
            physics: Vec::new(),
            animations: Vec::new(),
            parameter_groups: Vec::new(),
            pose_groups: Vec::new(),
            expressions: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Canvas {
    pub width: f32,
    pub height: f32,
    #[serde(default)]
    pub origin_x: f32,
    #[serde(default)]
    pub origin_y: f32,
    #[serde(default = "default_background_color")]
    pub background_color: String,
}

fn default_background_color() -> String {
    "#18181b".to_string()
}

impl Default for Canvas {
    fn default() -> Self {
        Self {
            width: 1920.0,
            height: 1080.0,
            origin_x: 0.5,
            origin_y: 0.5,
            background_color: default_background_color(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ParameterGroup {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub collapsed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Parameter {
    pub id: String,
    pub name: String,
    pub min: f32,
    pub max: f32,
    pub default: f32,
    #[serde(default)]
    pub repeats: bool,
    #[serde(default)]
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct TextureMeta {
    pub id: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Node {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub locked: bool,
    pub kind: NodeKind,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(tag = "type")]
pub enum NodeKind {
    Part {
        #[serde(default)]
        collapsed: bool,
        #[serde(default = "default_opacity")]
        opacity: f32,
    },
    WarpDeformer(WarpDeformerData),
    RotationDeformer(RotationDeformerData),
    DeformPath(DeformPathData),
    ArtMesh(ArtMeshData),
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct WarpDeformerData {
    pub cols: usize,
    pub rows: usize,
    /// [min_x, min_y, width, height]
    pub bounds: [f32; 4],
    /// (cols + 1) * (rows + 1) control points in canvas space
    pub control_points: Vec<[f32; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct RotationDeformerData {
    pub origin: [f32; 2],
    #[serde(default)]
    pub angle_deg: f32,
    #[serde(default = "default_scale")]
    pub scale: [f32; 2],
}

fn default_scale() -> [f32; 2] {
    [1.0, 1.0]
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct DeformPathData {
    pub control_points: Vec<[f32; 2]>,
    #[serde(default)]
    pub target_mesh_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BlendMode {
    Normal,
    Multiply,
    Screen,
    Additive,
}

impl Default for BlendMode {
    fn default() -> Self {
        Self::Normal
    }
}

fn default_multiply_color() -> [f32; 4] {
    [1.0, 1.0, 1.0, 1.0]
}

fn default_screen_color() -> [f32; 4] {
    [0.0, 0.0, 0.0, 0.0]
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct MorphTarget {
    pub id: String,
    pub name: String,
    pub param_id: String,
    pub vertex_offsets: Vec<[f32; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ArtMeshData {
    pub texture_id: String,
    pub vertices: Vec<[f32; 2]>,
    pub uvs: Vec<[f32; 2]>,
    pub indices: Vec<u32>,
    #[serde(default)]
    pub blend_mode: BlendMode,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_multiply_color")]
    pub multiply_color: [f32; 4],
    #[serde(default = "default_screen_color")]
    pub screen_color: [f32; 4],
    #[serde(default)]
    pub draw_order: i32,
    #[serde(default)]
    pub mask_ids: Vec<String>,
    #[serde(default)]
    pub is_mask_inverted: bool,
    #[serde(default)]
    pub morph_targets: Vec<MorphTarget>,
    #[serde(default)]
    pub hit_area_name: Option<String>,
    #[serde(default)]
    pub user_data: Option<String>,
}

fn default_opacity() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct KeyformBinding {
    pub target_node_id: String,
    /// One or more parameters driving this node (e.g. ParamAngleX, ParamAngleY)
    pub dimensions: Vec<ParamDimension>,
    /// Keyform entries for each combination of key values across dimensions
    pub keyforms: Vec<KeyformState>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExtendedInterpolationType {
    Linear,
    Circle,
    Bezier,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ParamDimension {
    pub param_id: String,
    /// Monotonically increasing key values, e.g. [-30.0, 0.0, 30.0]
    pub keys: Vec<f32>,
    #[serde(default)]
    pub extended_interpolation: Option<ExtendedInterpolationType>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct KeyformState {
    /// Key values per dimension corresponding to this state, e.g. [-30.0, 0.0]
    pub coordinates: Vec<f32>,
    pub payload: KeyformPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(tag = "kind")]
pub enum KeyformPayload {
    Warp {
        control_points: Vec<[f32; 2]>,
    },
    Rotation {
        origin: [f32; 2],
        angle_deg: f32,
        scale: [f32; 2],
    },
    DeformPath {
        control_points: Vec<[f32; 2]>,
    },
    ArtMesh {
        /// Vertex positions or offsets
        vertex_offsets: Vec<[f32; 2]>,
        opacity: Option<f32>,
        multiply_color: Option<[f32; 4]>,
        screen_color: Option<[f32; 4]>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct GlueBinding {
    pub id: String,
    pub name: String,
    pub mesh_a_id: String,
    pub mesh_b_id: String,
    pub vertex_pairs: Vec<GluePair>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct GluePair {
    pub index_a: u32,
    pub index_b: u32,
    pub weight_a: f32,
    pub weight_b: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PhysicsGroup {
    pub id: String,
    pub name: String,
    pub inputs: Vec<PhysicsInput>,
    pub outputs: Vec<PhysicsOutput>,
    pub pendulums: Vec<PhysicsPendulum>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PhysicsInput {
    pub param_id: String,
    pub weight: f32,
    #[serde(default)]
    pub reflect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PhysicsOutput {
    pub param_id: String,
    pub pendulum_index: usize,
    pub angle_scale: f32,
    pub weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PhysicsPendulum {
    pub length: f32,
    pub damping: f32,
    pub mass: f32,
}

fn default_fade_time() -> f32 {
    0.5
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PoseGroup {
    pub id: String,
    pub name: String,
    #[serde(default = "default_fade_time")]
    pub fade_in_time: f32,
    pub part_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExpressionBlendType {
    Add,
    Multiply,
    Overwrite,
}

impl Default for ExpressionBlendType {
    fn default() -> Self {
        Self::Add
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ExpressionParameter {
    pub id: String,
    pub value: f32,
    #[serde(default)]
    pub blend: ExpressionBlendType,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Expression {
    pub id: String,
    pub name: String,
    #[serde(default = "default_fade_time")]
    pub fade_in_time: f32,
    #[serde(default = "default_fade_time")]
    pub fade_out_time: f32,
    pub parameters: Vec<ExpressionParameter>,
}
