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
pub struct Parameter {
    pub id: String,
    pub name: String,
    pub min: f32,
    pub max: f32,
    pub default: f32,
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
    },
    WarpDeformer(WarpDeformerData),
    RotationDeformer(RotationDeformerData),
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
    #[serde(default)]
    pub draw_order: i32,
    #[serde(default)]
    pub mask_ids: Vec<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ParamDimension {
    pub param_id: String,
    /// Monotonically increasing key values, e.g. [-30.0, 0.0, 30.0]
    pub keys: Vec<f32>,
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
    ArtMesh {
        /// Vertex positions or offsets
        vertex_offsets: Vec<[f32; 2]>,
        opacity: Option<f32>,
    },
}
