pub mod animation;
pub mod evaluator;
pub mod lint;
pub mod math;
pub mod model;
pub mod physics;

pub use animation::{
    Animation, AnimationTrack, CurveType, FormAnimationKeyframe, FormAnimationTrack,
    TimelineKeyframe, TimelineMarker,
};
pub use evaluator::{evaluate_project, EvaluatedFrame, EvaluatedMesh};
pub use lint::{lint_project, Diagnostic, DiagnosticSeverity};
pub use model::{
    ArtPathData, ArtPathPoint, BlendMode, Canvas, DeformPathData, Expression, ExpressionBlendType,
    ExpressionParameter, ExtendedInterpolationType, GlueBinding, GluePair, KeyformBinding,
    KeyformPayload, KeyformState, ModelStats, MorphTarget, Node, NodeKind, ParamDimension,
    Parameter, ParameterGroup, PhysicsGroup, PhysicsInput, PhysicsOutput, PhysicsPendulum, Project,
    RotationDeformerData, TextureMeta, WarpDeformerData, CURRENT_FORMAT_VERSION,
};
pub use physics::{bake_physics_to_animation, PendulumState, PhysicsSimulator};

/// Exports JSON Schema for Project and Diagnostics.
pub fn export_project_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Project)
}

pub fn export_diagnostic_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Diagnostic)
}
