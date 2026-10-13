pub mod animation;
pub mod evaluator;
pub mod exporter;
pub mod lint;
pub mod math;
pub mod moc3;
pub mod model;
pub mod neural;
pub mod physics;

pub use animation::{
    auto_smooth_track_tangents, Animation, AnimationTrack, CurveType, FormAnimationKeyframe,
    FormAnimationTrack, TimelineKeyframe, TimelineMarker,
};
pub use evaluator::{evaluate_project, EvaluatedFrame, EvaluatedMesh};
pub use exporter::{
    compute_atlas_layout_and_remap_uvs, export_runtime_bundle, AtlasPlacement, ExportedTextFile,
    RuntimeBundleOutput,
};
pub use lint::{lint_project, Diagnostic, DiagnosticSeverity};
pub use moc3::{export_moc3_binary, import_moc3_binary, Moc3Error, DEFAULT_MOC3_VERSION, MOC3_MAGIC};
pub use model::{
    ArtPathData, ArtPathPoint, BlendMode, Canvas, DeformPathData, Expression, ExpressionBlendType,
    ExpressionParameter, ExtendedInterpolationType, GlueBinding, GluePair, KeyformBinding,
    KeyformPayload, KeyformState, ModelStats, MorphTarget, Node, NodeKind, ParamDimension,
    Parameter, ParameterGroup, PhysicsGroup, PhysicsInput, PhysicsOutput, PhysicsPendulum, Project,
    RotationDeformerData, TextureMeta, WarpDeformerData, CURRENT_FORMAT_VERSION,
};
pub use neural::{classify_artmesh_pure_rust, evaluate_mlp_forward, parse_onnx_mlp_tensors, PRED_CLASSES};
pub use physics::{bake_physics_to_animation, PendulumState, PhysicsSimulator};

/// Exports JSON Schema for Project and Diagnostics.
pub fn export_project_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Project)
}

pub fn export_diagnostic_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Diagnostic)
}
