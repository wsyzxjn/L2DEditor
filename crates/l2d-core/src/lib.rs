pub mod evaluator;
pub mod lint;
pub mod math;
pub mod model;

pub use evaluator::{evaluate_project, EvaluatedFrame, EvaluatedMesh};
pub use lint::{lint_project, Diagnostic, DiagnosticSeverity};
pub use model::*;

/// Exports JSON Schema for Project and Diagnostics.
pub fn export_project_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Project)
}

pub fn export_diagnostic_schema() -> schemars::schema::RootSchema {
    schemars::schema_for!(Diagnostic)
}
