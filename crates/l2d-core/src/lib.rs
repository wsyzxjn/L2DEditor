pub mod animation;
pub mod evaluator;
pub mod lint;
pub mod math;
pub mod model;
pub mod physics;

pub use animation::{Animation, AnimationTrack, CurveType, TimelineKeyframe};
pub use evaluator::{evaluate_project, EvaluatedFrame, EvaluatedMesh};
pub use lint::{lint_project, Diagnostic, DiagnosticSeverity};
pub use model::*;
pub use physics::{PhysicsSimulator, PendulumState};

/// Exports JSON Schema for Project and Diagnostics.
pub fn export_project_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Project)
}

pub fn export_diagnostic_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Diagnostic)
}
