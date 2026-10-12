use l2d_core::export_project_schema;
use std::fs;

fn main() {
    let schema = export_project_schema();
    let json = serde_json::to_string_pretty(&schema).expect("Failed to serialize schema");
    fs::create_dir_all("packages/schema").ok();
    fs::write("packages/schema/project.schema.json", json).expect("Failed to write schema");
    println!("Exported schema to packages/schema/project.schema.json");
}
