use crate::animation::{bezier_segment_controls, sanitized_keyframes, CurveType};
use crate::moc3::{export_moc3_binary_with_options, Moc3ExportOptions, DEFAULT_MOC3_VERSION};
use crate::model::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportedTextFile {
    pub relative_path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AtlasPlacement {
    pub mesh_id: String,
    pub texture_id: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeBundleOutput {
    pub model_name: String,
    pub updated_project: Project,
    pub atlas_size: u32,
    pub atlas_placements: Vec<AtlasPlacement>,
    pub moc3_bytes: Vec<u8>,
    pub model3_json: String,
    pub physics3_json: String,
    pub cdi3_json: String,
    pub userdata3_json: Option<String>,
    pub pose3_json: Option<String>,
    pub motionsync3_json: Option<String>,
    pub motion_files: Vec<ExportedTextFile>,
    pub expression_files: Vec<ExportedTextFile>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct RuntimeBundleOptions {
    pub embed_source_project: bool,
}

pub(crate) fn sanitize_file_stem(value: &str, fallback: &str) -> String {
    let mut stem = String::new();
    for character in value.chars() {
        let safe = character.is_alphanumeric() || matches!(character, '-' | '_' | ' ');
        stem.push(if safe { character } else { '_' });
    }
    let stem = stem.trim().trim_matches('.').trim().replace(' ', "_");
    let mut stem = if stem.is_empty() {
        fallback.to_string()
    } else {
        stem
    };
    if stem.len() > 120 {
        stem = stem.chars().take(120).collect();
        while stem.ends_with('_') {
            stem.pop();
        }
    }
    let upper = stem.to_ascii_uppercase();
    let windows_reserved = matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (upper.len() == 4
            && (upper.starts_with("COM") || upper.starts_with("LPT"))
            && upper.as_bytes()[3].is_ascii_digit());
    if windows_reserved {
        stem.insert(0, '_');
    }
    if stem.is_empty() {
        fallback.to_string()
    } else {
        stem
    }
}

fn unique_file_stem(base: String, used: &mut HashSet<String>) -> String {
    let mut candidate = base.clone();
    let mut suffix = 2usize;
    while !used.insert(candidate.to_lowercase()) {
        candidate = format!("{base}_{suffix}");
        suffix += 1;
    }
    candidate
}

fn validate_atlas_size(atlas_size: u32) -> Result<u32, String> {
    if !(64..=16384).contains(&atlas_size) || !atlas_size.is_power_of_two() {
        return Err(format!(
            "atlas size must be a power of two between 64 and 16384, got {atlas_size}"
        ));
    }
    Ok(atlas_size)
}

/// Computes 2D Shelf bin-packing layout for ArtMesh textures and remaps mesh UVs in pure Rust.
pub fn compute_atlas_layout_and_remap_uvs(
    project: &Project,
    atlas_size: u32,
    padding: u32,
) -> Result<(Project, Vec<AtlasPlacement>, u32), String> {
    let atlas_size = validate_atlas_size(atlas_size)?;
    if padding >= atlas_size / 2 {
        return Err(format!(
            "atlas padding {padding} is too large for a {atlas_size}x{atlas_size} atlas"
        ));
    }
    let mut items: Vec<(String, String, u32, u32)> = Vec::new();

    for node in &project.nodes {
        if let NodeKind::ArtMesh(mesh) = &node.kind {
            if let Some(tex) = project.textures.iter().find(|t| t.id == mesh.texture_id) {
                items.push((
                    node.id.clone(),
                    tex.id.clone(),
                    tex.width.max(1),
                    tex.height.max(1),
                ));
            }
        }
    }

    // Shelf-pack taller textures first. The tie-breakers are required: this layout is computed
    // independently when writing the atlas PNG and the MOC3 body, so equal-height textures must
    // land in exactly the same cells in both passes.
    items.sort_by(|a, b| {
        b.3.cmp(&a.3)
            .then_with(|| a.1.cmp(&b.1))
            .then_with(|| a.0.cmp(&b.0))
    });

    let mut placements = Vec::new();
    let mut cur_x = padding;
    let mut cur_y = padding;
    let mut shelf_h = 0u32;
    let mut packed_textures: HashMap<String, AtlasPlacement> = HashMap::new();

    for (mesh_id, texture_id, w, h) in items {
        if let Some(existing) = packed_textures.get(&texture_id) {
            placements.push(AtlasPlacement {
                mesh_id,
                ..existing.clone()
            });
            continue;
        }
        let padded_width = w
            .checked_add(padding.checked_mul(2).ok_or("atlas padding overflow")?)
            .ok_or("atlas texture width overflow")?;
        let padded_height = h
            .checked_add(padding.checked_mul(2).ok_or("atlas padding overflow")?)
            .ok_or("atlas texture height overflow")?;
        if padded_width > atlas_size || padded_height > atlas_size {
            return Err(format!(
                "texture `{texture_id}` ({w}x{h}) do not fit in a {atlas_size}x{atlas_size} atlas"
            ));
        }
        if cur_x + w + padding > atlas_size {
            cur_x = padding;
            cur_y += shelf_h + padding * 2;
            shelf_h = 0;
        }
        if cur_y + h + padding > atlas_size {
            return Err(format!(
                "textures do not fit in a {atlas_size}x{atlas_size} atlas"
            ));
        }
        let placement = AtlasPlacement {
            mesh_id,
            texture_id,
            x: cur_x,
            y: cur_y,
            width: w,
            height: h,
        };
        packed_textures.insert(placement.texture_id.clone(), placement.clone());
        placements.push(placement);
        // Reserve a full gutter on both sides so edge-bleed pixels never overlap the next cell.
        cur_x += w + padding * 2;
        shelf_h = shelf_h.max(h);
    }

    let mut updated = project.clone();
    let atlas_id = "tex_atlas_00".to_string();
    updated.textures = vec![TextureMeta {
        id: atlas_id.clone(),
        path: "textures/texture_00.png".to_string(),
        width: atlas_size,
        height: atlas_size,
        content_hash: None,
    }];

    let af = atlas_size as f32;
    for node in &mut updated.nodes {
        if let NodeKind::ArtMesh(mesh) = &mut node.kind {
            if let Some(p) = placements.iter().find(|pl| pl.mesh_id == node.id) {
                mesh.texture_id = atlas_id.clone();
                let ox = p.x as f32;
                let oy = p.y as f32;
                let ow = p.width as f32;
                let oh = p.height as f32;
                for uv in &mut mesh.uvs {
                    uv[0] = (ox + uv[0] * ow) / af;
                    uv[1] = (oy + uv[1] * oh) / af;
                }
            }
        }
    }

    Ok((updated, placements, atlas_size))
}

/// Generates the complete Live2D Cubism 3/4/5 runtime distribution bundle in pure Rust:
/// - `.moc3` binary
/// - `.model3.json` manifest
/// - `.physics3.json`
/// - `.cdi3.json`
/// - `motions/*.motion3.json`
/// - `.userdata3.json`
/// - `.pose3.json`
/// - `expressions/*.exp3.json`
/// - `.motionsync3.json`
/// - 2D Shelf Atlas placements & UV-remapped `Project`
pub fn export_runtime_bundle(
    project: &Project,
    model_name: &str,
    atlas_size: u32,
    padding: u32,
    texture_files: &[String],
) -> Result<RuntimeBundleOutput, String> {
    export_runtime_bundle_with_options(
        project,
        model_name,
        atlas_size,
        padding,
        texture_files,
        RuntimeBundleOptions::default(),
    )
}

pub fn export_runtime_bundle_with_options(
    project: &Project,
    model_name: &str,
    atlas_size: u32,
    padding: u32,
    texture_files: &[String],
    options: RuntimeBundleOptions,
) -> Result<RuntimeBundleOutput, String> {
    let model_name = sanitize_file_stem(model_name.trim(), "model");

    // 1. Compute Atlas layout & UV remapping
    let (updated_project, atlas_placements, atlas_size) =
        compute_atlas_layout_and_remap_uvs(project, atlas_size, padding)?;

    let textured_mesh_count = project.nodes.iter().filter(|node| {
        matches!(&node.kind, NodeKind::ArtMesh(mesh) if project.textures.iter().any(|t| t.id == mesh.texture_id))
    }).count();
    if atlas_placements.len() != textured_mesh_count {
        return Err(format!(
            "Textures do not fit in the {}x{} atlas; increase the atlas size",
            atlas_size, atlas_size
        ));
    }

    // 2. Serialize .moc3 binary
    let moc3_bytes = export_moc3_binary_with_options(
        &updated_project,
        DEFAULT_MOC3_VERSION,
        Moc3ExportOptions {
            embed_source_project: options.embed_source_project,
        },
    )
    .map_err(|e| format!("MOC3 export error: {}", e))?;

    // 3. Generate .physics3.json
    let mut physics_settings: Vec<Value> = Vec::new();
    let mut physics_dictionary: Vec<Value> = Vec::new();
    let mut total_inputs = 0usize;
    let mut total_outputs = 0usize;
    let mut total_vertices = 0usize;

    for group in &project.physics {
        total_inputs += group.inputs.len();
        total_outputs += group.outputs.len();
        total_vertices += group.pendulums.len();
        physics_dictionary.push(json!({
            "Id": group.id,
            "Name": if group.name.is_empty() { &group.id } else { &group.name },
        }));

        let inputs: Vec<Value> = group
            .inputs
            .iter()
            .map(|inp| {
                json!({
                    "Source": { "Target": "Parameter", "Id": inp.param_id },
                    "Weight": inp.weight,
                    "Type": "X",
                    "Reflect": inp.reflect,
                })
            })
            .collect();

        let outputs: Vec<Value> = group
            .outputs
            .iter()
            .map(|out| {
                json!({
                    "Destination": { "Target": "Parameter", "Id": out.param_id },
                    "VertexIndex": out.pendulum_index,
                    "Scale": out.angle_scale,
                    "Weight": out.weight,
                    "Type": "Angle",
                    "Reflect": false,
                })
            })
            .collect();

        let vertices: Vec<Value> = group
            .pendulums
            .iter()
            .enumerate()
            .map(|(idx, p)| {
                json!({
                    "Position": { "X": 0.0, "Y": (idx as f32) * p.length },
                    "Mobility": 1.0,
                    "Delay": p.damping,
                    "Acceleration": p.mass,
                    "Radius": p.length,
                })
            })
            .collect();

        physics_settings.push(json!({
            "Id": group.id,
            "Normalization": {
                "Position": { "Minimum": -10.0, "Default": 0.0, "Maximum": 10.0 },
                "Angle": { "Minimum": -10.0, "Default": 0.0, "Maximum": 10.0 }
            },
            "Input": inputs,
            "Output": outputs,
            "Vertices": vertices,
        }));
    }

    let physics_filename = format!("{}.physics3.json", model_name);
    let physics3_val = json!({
        "Version": 3,
        "Meta": {
            "PhysicsSettingCount": physics_settings.len(),
            "TotalInputCount": total_inputs,
            "TotalOutputCount": total_outputs,
            "VertexCount": total_vertices,
            "Fps": 60,
            "EffectiveForces": {
                "Gravity": { "X": 0.0, "Y": -1.0 },
                "Wind": { "X": 0.0, "Y": 0.0 }
            },
            "PhysicsDictionary": physics_dictionary,
        },
        "PhysicsSettings": physics_settings,
    });
    let physics3_json = serde_json::to_string_pretty(&physics3_val).unwrap_or_default();

    // 4. Generate .cdi3.json
    let cdi_filename = format!("{}.cdi3.json", model_name);
    let cdi_params: Vec<Value> = project
        .parameters
        .iter()
        .map(|p| {
            json!({
                "Id": p.id,
                "GroupId": p.group_id.clone().unwrap_or_default(),
                "Name": if p.name.is_empty() { &p.id } else { &p.name },
            })
        })
        .collect();
    let cdi_groups: Vec<Value> = project
        .parameter_groups
        .iter()
        .map(|g| {
            json!({
                "Id": g.id,
                "GroupId": "",
                "Name": if g.name.is_empty() { &g.id } else { &g.name },
            })
        })
        .collect();
    let cdi_parts: Vec<Value> = project
        .nodes
        .iter()
        .filter(|n| matches!(&n.kind, NodeKind::Part { .. }))
        .map(|n| {
            json!({
                "Id": n.id,
                "Name": if n.name.is_empty() { &n.id } else { &n.name },
            })
        })
        .collect();
    let mut combined_params: Vec<Vec<String>> = Vec::new();
    for kb in &project.keyforms {
        if kb.dimensions.len() == 2 {
            let pair = vec![
                kb.dimensions[0].param_id.clone(),
                kb.dimensions[1].param_id.clone(),
            ];
            if !combined_params.contains(&pair) {
                combined_params.push(pair);
            }
        }
    }
    let cdi3_val = json!({
        "Version": 3,
        "Parameters": cdi_params,
        "ParameterGroups": cdi_groups,
        "Parts": cdi_parts,
        "CombinedParameters": combined_params,
    });
    let cdi3_json = serde_json::to_string_pretty(&cdi3_val).unwrap_or_default();

    // 5. Generate motions/*.motion3.json
    let mut motion_files: Vec<ExportedTextFile> = Vec::new();
    let mut idle_motion_refs: Vec<Value> = Vec::new();
    let mut used_motion_stems = HashSet::new();

    for anim in &project.animations {
        let fps = if anim.fps.is_finite() && anim.fps > 0.0 {
            anim.fps
        } else {
            30.0
        };
        let stem = unique_file_stem(
            sanitize_file_stem(&anim.id, "motion"),
            &mut used_motion_stems,
        );
        let motion_rel = format!("motions/{stem}.motion3.json");
        let mut total_segments = 0usize;
        let mut total_points = 0usize;
        let mut curves: Vec<Value> = Vec::new();
        let mut has_bezier = false;
        let mut beziers_restricted = true;

        for track in &anim.tracks {
            let keyframes = sanitized_keyframes(&track.keyframes);
            if keyframes.is_empty() {
                continue;
            }
            total_points += 1;
            total_segments += keyframes.len().saturating_sub(1);
            let mut segments: Vec<f32> = Vec::new();
            if let Some(first) = keyframes.first() {
                segments.push(first.frame / fps);
                segments.push(first.value);
                for i in 1..keyframes.len() {
                    let prev = &keyframes[i - 1];
                    let kf = &keyframes[i];
                    let t0 = prev.frame / fps;
                    let t1 = kf.frame / fps;
                    match prev.curve {
                        CurveType::Stepped => {
                            segments.extend_from_slice(&[2.0, t1, kf.value]);
                            total_points += 1;
                        }
                        CurveType::Bezier => {
                            has_bezier = true;
                            let (p1, p2) = bezier_segment_controls(prev, kf);
                            let c1t = p1[0] / fps;
                            let c2t = p2[0] / fps;
                            beziers_restricted &=
                                (t0..=t1).contains(&c1t) && (t0..=t1).contains(&c2t);
                            segments
                                .extend_from_slice(&[1.0, c1t, p1[1], c2t, p2[1], t1, kf.value]);
                            total_points += 3;
                        }
                        CurveType::Linear => {
                            segments.extend_from_slice(&[0.0, t1, kf.value]);
                            total_points += 1;
                        }
                    }
                }
            } else {
                continue;
            }

            let mut curve_obj = serde_json::Map::new();
            curve_obj.insert("Target".into(), json!("Parameter"));
            curve_obj.insert("Id".into(), json!(track.target_param_id));
            if let Some(fi) = track
                .fade_in_ms
                .filter(|value| value.is_finite() && *value >= 0.0)
            {
                curve_obj.insert("FadeInTime".into(), json!(fi / 1000.0));
            }
            if let Some(fo) = track
                .fade_out_ms
                .filter(|value| value.is_finite() && *value >= 0.0)
            {
                curve_obj.insert("FadeOutTime".into(), json!(fo / 1000.0));
            }
            curve_obj.insert("Segments".into(), json!(segments));
            curves.push(Value::Object(curve_obj));
        }

        let mut motion_userdata: Vec<Value> = Vec::new();
        let mut motion_userdata_size = 0usize;
        for marker in &anim.markers {
            motion_userdata_size += marker.label.len();
            motion_userdata.push(json!({
                "Time": marker.frame / fps,
                "Value": marker.label,
            }));
        }

        let motion_val = json!({
            "Version": 3,
            "Meta": {
                "Duration": if anim.duration_frames.is_finite() {
                    (anim.duration_frames.max(0.0)) / fps
                } else {
                    0.0
                },
                "Fps": fps,
                "Loop": anim.loop_playback,
                "AreBeziersRestricted": has_bezier && beziers_restricted,
                "FadeInTime": 0.5,
                "FadeOutTime": 0.5,
                "CurveCount": curves.len(),
                "TotalSegmentCount": total_segments,
                "TotalPointCount": total_points,
                "UserDataCount": motion_userdata.len(),
                "TotalUserDataSize": motion_userdata_size,
            },
            "Curves": curves,
            "UserData": motion_userdata,
        });
        motion_files.push(ExportedTextFile {
            relative_path: motion_rel.clone(),
            content: serde_json::to_string_pretty(&motion_val).unwrap_or_default(),
        });
        idle_motion_refs.push(json!({ "File": motion_rel }));
    }

    // 6. Generate .userdata3.json
    let mut user_data_entries: Vec<Value> = Vec::new();
    let mut total_ud_size = 0usize;
    for node in &project.nodes {
        if let NodeKind::ArtMesh(mesh) = &node.kind {
            if let Some(ud) = &mesh.user_data {
                if !ud.is_empty() {
                    total_ud_size += ud.len();
                    user_data_entries.push(json!({
                        "Target": "ArtMesh",
                        "Id": node.id,
                        "Value": ud,
                    }));
                }
            }
        }
    }
    let (userdata_filename, userdata3_json) = if !user_data_entries.is_empty() {
        let fname = format!("{}.userdata3.json", model_name);
        let val = json!({
            "Version": 3,
            "Meta": {
                "UserDataCount": user_data_entries.len(),
                "TotalUserDataSize": total_ud_size,
            },
            "UserData": user_data_entries,
        });
        (
            Some(fname),
            Some(serde_json::to_string_pretty(&val).unwrap_or_default()),
        )
    } else {
        (None, None)
    };

    // 7. Generate .pose3.json
    let (pose_filename, pose3_json) = if !project.pose_groups.is_empty() {
        let fname = format!("{}.pose3.json", model_name);
        let fade_in = project.pose_groups[0].fade_in_time;
        let groups: Vec<Value> = project
            .pose_groups
            .iter()
            .map(|g| {
                let items: Vec<Value> = g
                    .part_ids
                    .iter()
                    .map(|pid| {
                        json!({
                            "Id": pid,
                            "Link": [],
                        })
                    })
                    .collect();
                Value::Array(items)
            })
            .collect();
        let val = json!({
            "Type": "Live2D Pose",
            "FadeInTime": fade_in,
            "Groups": groups,
        });
        (
            Some(fname),
            Some(serde_json::to_string_pretty(&val).unwrap_or_default()),
        )
    } else {
        (None, None)
    };

    // 8. Generate expressions/*.exp3.json
    let mut expression_files: Vec<ExportedTextFile> = Vec::new();
    let mut expression_refs: Vec<Value> = Vec::new();
    let mut used_expression_stems = HashSet::new();
    for expr in &project.expressions {
        let stem = unique_file_stem(
            sanitize_file_stem(&expr.id, "expression"),
            &mut used_expression_stems,
        );
        let rel = format!("expressions/{stem}.exp3.json");
        let params: Vec<Value> = expr
            .parameters
            .iter()
            .map(|p| {
                let blend_str = match p.blend {
                    ExpressionBlendType::Add => "Add",
                    ExpressionBlendType::Multiply => "Multiply",
                    ExpressionBlendType::Overwrite => "Overwrite",
                };
                json!({
                    "Id": p.id,
                    "Value": p.value,
                    "Blend": blend_str,
                })
            })
            .collect();
        let val = json!({
            "Type": "Live2D Expression",
            "FadeInTime": expr.fade_in_time,
            "FadeOutTime": expr.fade_out_time,
            "Parameters": params,
        });
        expression_files.push(ExportedTextFile {
            relative_path: rel.clone(),
            content: serde_json::to_string_pretty(&val).unwrap_or_default(),
        });
        expression_refs.push(json!({
            "Name": if expr.name.is_empty() { &expr.id } else { &expr.name },
            "File": rel,
        }));
    }

    // 9. Generate .motionsync3.json
    let (motionsync_filename, motionsync3_json) = if project
        .parameters
        .iter()
        .any(|p| p.id == "ParamMouthOpen" || p.id == "ParamMouthOpenY")
    {
        let fname = format!("{}.motionsync3.json", model_name);
        let val = json!({
            "Version": 1,
            "Setting": {
                "AudioSampleRate": 44100,
                "MouthOpenParameter": "ParamMouthOpen",
                "MouthFormParameter": "ParamMouthForm",
            }
        });
        (
            Some(fname),
            Some(serde_json::to_string_pretty(&val).unwrap_or_default()),
        )
    } else {
        (None, None)
    };

    // 10. Generate .model3.json root manifest
    let mut hit_areas: Vec<Value> = Vec::new();
    for node in &project.nodes {
        if let NodeKind::ArtMesh(mesh) = &node.kind {
            if let Some(ha) = &mesh.hit_area_name {
                if !ha.is_empty() {
                    hit_areas.push(json!({
                        "Id": node.id,
                        "Name": ha,
                    }));
                }
            }
        }
    }

    let eye_blink_ids: Vec<String> = ["ParamEyeLOpen", "ParamEyeROpen"]
        .iter()
        .filter(|&&id| project.parameters.iter().any(|p| p.id == id))
        .map(|&s| s.to_string())
        .collect();
    let lip_sync_ids: Vec<String> = ["ParamMouthOpen", "ParamMouthOpenY"]
        .iter()
        .filter(|&&id| project.parameters.iter().any(|p| p.id == id))
        .map(|&s| s.to_string())
        .collect();

    let mut file_refs = serde_json::Map::new();
    file_refs.insert("Moc".into(), json!(format!("{}.moc3", model_name)));
    let tex_list: Vec<String> = if texture_files.is_empty() {
        vec!["textures/texture_00.png".to_string()]
    } else {
        texture_files.to_vec()
    };
    file_refs.insert("Textures".into(), json!(tex_list));
    file_refs.insert("Physics".into(), json!(physics_filename));
    file_refs.insert("DisplayInfo".into(), json!(cdi_filename));
    let mut motions_map = serde_json::Map::new();
    if !idle_motion_refs.is_empty() {
        motions_map.insert("Idle".into(), Value::Array(idle_motion_refs));
    }
    file_refs.insert("Motions".into(), Value::Object(motions_map));
    if let Some(udf) = userdata_filename {
        file_refs.insert("UserData".into(), json!(udf));
    }
    if let Some(pf) = pose_filename {
        file_refs.insert("Pose".into(), json!(pf));
    }
    if !expression_refs.is_empty() {
        file_refs.insert("Expressions".into(), Value::Array(expression_refs));
    }
    if let Some(msf) = motionsync_filename {
        file_refs.insert("MotionSync".into(), json!(msf));
    }

    let model3_val = json!({
        "Version": 3,
        "FileReferences": Value::Object(file_refs),
        "Groups": [
            {
                "Target": "Parameter",
                "Name": "EyeBlink",
                "Ids": eye_blink_ids,
            },
            {
                "Target": "Parameter",
                "Name": "LipSync",
                "Ids": lip_sync_ids,
            }
        ],
        "HitAreas": hit_areas,
    });
    let model3_json = serde_json::to_string_pretty(&model3_val).unwrap_or_default();

    Ok(RuntimeBundleOutput {
        model_name: model_name.clone(),
        updated_project,
        atlas_size,
        atlas_placements,
        moc3_bytes,
        model3_json,
        physics3_json,
        cdi3_json,
        userdata3_json,
        pose3_json,
        motionsync3_json,
        motion_files,
        expression_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::animation::{Animation, AnimationTrack, TimelineKeyframe};

    #[test]
    fn test_pure_rust_runtime_bundle_exporter() {
        let mut project = Project::default();
        project.parameters.push(Parameter {
            id: "ParamAngleX".into(),
            name: "Angle X".into(),
            min: -30.0,
            max: 30.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
        project.parameters.push(Parameter {
            id: "ParamMouthOpen".into(),
            name: "Mouth Open".into(),
            min: 0.0,
            max: 1.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
        project.textures.push(TextureMeta {
            id: "tex_face".into(),
            path: "textures/face.png".into(),
            width: 256,
            height: 256,
            content_hash: None,
        });
        project.nodes.push(Node {
            id: "mesh_face".into(),
            name: "Face".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: "tex_face".into(),
                vertices: vec![[0.0, 0.0], [100.0, 0.0], [100.0, 100.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order: 10,
                mask_ids: vec![],
                is_mask_inverted: false,
                morph_targets: vec![],
                hit_area_name: Some("Head".into()),
                user_data: Some("event_head".into()),
            }),
        });
        project.animations.push(Animation {
            id: "idle_01".into(),
            name: "Idle".into(),
            duration_frames: 30.0,
            fps: 30.0,
            loop_playback: true,
            tracks: vec![AnimationTrack {
                target_param_id: "ParamAngleX".into(),
                keyframes: vec![
                    TimelineKeyframe {
                        frame: 0.0,
                        value: 0.0,
                        curve: CurveType::Linear,
                        bezier_handles: None,
                    },
                    TimelineKeyframe {
                        frame: 30.0,
                        value: 15.0,
                        curve: CurveType::Linear,
                        bezier_handles: None,
                    },
                ],
                fade_in_ms: Some(200.0),
                fade_out_ms: None,
                frozen: false,
            }],
            markers: vec![],
            form_tracks: vec![],
        });

        let bundle = export_runtime_bundle(
            &project,
            "haru",
            1024,
            4,
            &["textures/texture_00.png".into()],
        )
        .expect("Failed to export runtime bundle in Rust");

        assert_eq!(&bundle.moc3_bytes[0..4], b"MOC3");
        assert!(bundle.model3_json.contains("\"haru.moc3\""));
        assert!(bundle.userdata3_json.is_some());
        assert!(bundle.motionsync3_json.is_some());
        assert_eq!(bundle.motion_files.len(), 1);
        assert_eq!(bundle.atlas_placements.len(), 1);

        // A character's separated meshes can all sample the same artwork.
        // Twenty copies must occupy a single texture slot, not twenty slots.
        let template = project.nodes[0].clone();
        for index in 1..20 {
            let mut node = template.clone();
            node.id = format!("mesh_{}", index);
            project.nodes.push(node);
        }
        let shared = export_runtime_bundle(&project, "shared", 512, 4, &[]).unwrap();
        assert_eq!(shared.atlas_placements.len(), 20);
        for placement in &shared.atlas_placements {
            assert_eq!((placement.x, placement.y), (4, 4));
        }
        for node in &shared.updated_project.nodes {
            if let NodeKind::ArtMesh(mesh) = &node.kind {
                assert_eq!(mesh.texture_id, "tex_atlas_00");
                assert_eq!(mesh.uvs[0], [4.0 / 512.0, 4.0 / 512.0]);
            }
        }
        // Reject oversized textures and an atlas that cannot fit distinct
        // textures rather than returning a bundle with missing parts.
        assert!(export_runtime_bundle(&project, "too_small", 256, 4, &[]).is_err());
        project.textures.push(TextureMeta {
            id: "second_texture".into(),
            path: "second.png".into(),
            width: 256,
            height: 256,
            content_hash: None,
        });
        if let NodeKind::ArtMesh(mesh) = &mut project.nodes[1].kind {
            mesh.texture_id = "second_texture".into();
        }
        assert!(export_runtime_bundle(&project, "overflow", 512, 4, &[]).is_err());
    }

    #[test]
    fn motion3_bezier_times_counts_and_file_names_are_pack_safe() {
        let mut project = Project::default();
        project.parameters.push(Parameter {
            id: "ParamAngleX".into(),
            name: "Angle X".into(),
            min: -30.0,
            max: 30.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
        project.textures.push(TextureMeta {
            id: "tex".into(),
            path: "textures/tex.png".into(),
            width: 128,
            height: 128,
            content_hash: None,
        });
        project.nodes.push(Node {
            id: "mesh".into(),
            name: "Mesh".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: "tex".into(),
                vertices: vec![[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0; 4],
                screen_color: [0.0; 4],
                draw_order: 0,
                mask_ids: Vec::new(),
                is_mask_inverted: false,
                morph_targets: Vec::new(),
                hit_area_name: None,
                user_data: None,
            }),
        });
        project.animations = vec![Animation {
            id: "../same".into(),
            name: "Bad path".into(),
            duration_frames: 30.0,
            fps: 30.0,
            loop_playback: false,
            tracks: vec![AnimationTrack {
                target_param_id: "ParamAngleX".into(),
                keyframes: vec![
                    TimelineKeyframe {
                        frame: 0.0,
                        value: 0.0,
                        curve: CurveType::Bezier,
                        bezier_handles: Some([-4.0, -2.0, 10.0, 5.0]),
                    },
                    TimelineKeyframe {
                        frame: 30.0,
                        value: 30.0,
                        curve: CurveType::Linear,
                        bezier_handles: Some([20.0, 15.0, 34.0, 40.0]),
                    },
                ],
                fade_in_ms: Some(200.0),
                fade_out_ms: None,
                frozen: false,
            }],
            markers: Vec::new(),
            form_tracks: Vec::new(),
        }];
        project.expressions.push(Expression {
            id: "../../smile".into(),
            name: "Smile".into(),
            fade_in_time: 0.1,
            fade_out_time: 0.1,
            parameters: Vec::new(),
        });

        let bundle = export_runtime_bundle(&project, "haru", 512, 4, &[]).unwrap();
        let motion = &bundle.motion_files[0];
        assert!(!motion.relative_path.contains(".."));
        let value: serde_json::Value = serde_json::from_str(&motion.content).unwrap();
        assert_eq!(value["Meta"]["TotalSegmentCount"], 1);
        assert_eq!(value["Meta"]["TotalPointCount"], 4);
        assert_eq!(value["Meta"]["AreBeziersRestricted"], true);
        let segments = value["Curves"][0]["Segments"].as_array().unwrap();
        assert_eq!(segments.len(), 9);
        assert!((segments[0].as_f64().unwrap() - 0.0).abs() < 1e-6);
        assert_eq!(segments[2].as_f64().unwrap(), 1.0);
        assert!((segments[3].as_f64().unwrap() - 10.0 / 30.0).abs() < 1e-6);
        assert!((segments[5].as_f64().unwrap() - 20.0 / 30.0).abs() < 1e-6);
        assert!((segments[7].as_f64().unwrap() - 1.0).abs() < 1e-6);
        assert!(!bundle.expression_files[0].relative_path.contains(".."));

        assert!(export_runtime_bundle(&project, "haru", 100, 4, &[]).is_err());
        assert!(export_runtime_bundle(&project, "haru", 32, 4, &[]).is_err());
    }
}
