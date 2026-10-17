use crate::animation::CurveType;
use crate::moc3::{export_moc3_binary, DEFAULT_MOC3_VERSION};
use crate::model::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

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

/// Computes 2D Shelf bin-packing layout for ArtMesh textures and remaps mesh UVs in pure Rust.
pub fn compute_atlas_layout_and_remap_uvs(
    project: &Project,
    atlas_size: u32,
    padding: u32,
) -> (Project, Vec<AtlasPlacement>) {
    let atlas_size = atlas_size.max(64);
    let mut items: Vec<(String, String, u32, u32)> = Vec::new();

    for node in &project.nodes {
        if let NodeKind::ArtMesh(mesh) = &node.kind {
            if let Some(tex) = project.textures.iter().find(|t| t.id == mesh.texture_id) {
                items.push((node.id.clone(), tex.id.clone(), tex.width.max(1), tex.height.max(1)));
            }
        }
    }

    // Sort descending by height for Shelf bin-packing
    items.sort_by(|a, b| b.3.cmp(&a.3));

    let mut placements = Vec::new();
    let mut cur_x = padding;
    let mut cur_y = padding;
    let mut shelf_h = 0u32;
    let mut packed_textures: HashMap<String, AtlasPlacement> = HashMap::new();

    for (mesh_id, texture_id, w, h) in items {
        if let Some(existing) = packed_textures.get(&texture_id) {
            placements.push(AtlasPlacement { mesh_id, ..existing.clone() });
            continue;
        }
        if w.saturating_add(padding.saturating_mul(2)) > atlas_size
            || h.saturating_add(padding.saturating_mul(2)) > atlas_size
        {
            break;
        }
        if cur_x + w + padding > atlas_size {
            cur_x = padding;
            cur_y += shelf_h + padding;
            shelf_h = 0;
        }
        if cur_y + h + padding > atlas_size {
            break;
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
        cur_x += w + padding;
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

    (updated, placements)
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
    let model_name = if model_name.trim().is_empty() {
        "model"
    } else {
        model_name.trim()
    };

    // 1. Compute Atlas layout & UV remapping
    let (updated_project, atlas_placements) =
        compute_atlas_layout_and_remap_uvs(project, atlas_size, padding);

    let textured_mesh_count = project.nodes.iter().filter(|node| {
        matches!(&node.kind, NodeKind::ArtMesh(mesh) if project.textures.iter().any(|t| t.id == mesh.texture_id))
    }).count();
    if atlas_placements.len() != textured_mesh_count {
        return Err(format!("Textures do not fit in the {}x{} atlas; increase the atlas size", atlas_size, atlas_size));
    }

    // 2. Serialize .moc3 binary
    let moc3_bytes = export_moc3_binary(&updated_project, DEFAULT_MOC3_VERSION)
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

    for anim in &project.animations {
        let fps = anim.fps.max(1.0);
        let motion_rel = format!("motions/{}.motion3.json", anim.id);
        let mut total_segments = 0usize;
        let mut total_points = 0usize;
        let mut curves: Vec<Value> = Vec::new();

        for track in &anim.tracks {
            total_points += track.keyframes.len();
            total_segments += track.keyframes.len().saturating_sub(1).max(1);
            let mut segments: Vec<f32> = Vec::new();
            if let Some(first) = track.keyframes.first() {
                segments.push(first.frame / fps);
                segments.push(first.value);
                for i in 1..track.keyframes.len() {
                    let prev = &track.keyframes[i - 1];
                    let kf = &track.keyframes[i];
                    let t0 = prev.frame / fps;
                    let t1 = kf.frame / fps;
                    match prev.curve {
                        CurveType::Stepped => {
                            segments.extend_from_slice(&[2.0, t1, kf.value]);
                        }
                        CurveType::Bezier => {
                            let dt = (t1 - t0) / 3.0;
                            let (c1t, c1v, c2t, c2v) = if let Some(h) = prev.bezier_handles {
                                (h[0], h[1], h[2], h[3])
                            } else {
                                (t0 + dt, prev.value, t1 - dt, kf.value)
                            };
                            segments.extend_from_slice(&[
                                1.0,
                                c1t,
                                c1v,
                                c2t,
                                c2v,
                                t1,
                                kf.value,
                            ]);
                        }
                        CurveType::Linear => {
                            segments.extend_from_slice(&[0.0, t1, kf.value]);
                        }
                    }
                }
            } else {
                segments.extend_from_slice(&[0.0, 0.0]);
            }

            let mut curve_obj = serde_json::Map::new();
            curve_obj.insert("Target".into(), json!("Parameter"));
            curve_obj.insert("Id".into(), json!(track.target_param_id));
            if let Some(fi) = track.fade_in_ms {
                curve_obj.insert("FadeInTime".into(), json!(fi / 1000.0));
            }
            if let Some(fo) = track.fade_out_ms {
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
                "Duration": anim.duration_frames / fps,
                "Fps": fps,
                "Loop": anim.loop_playback,
                "AreBeziersRestricted": true,
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
        (Some(fname), Some(serde_json::to_string_pretty(&val).unwrap_or_default()))
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
        (Some(fname), Some(serde_json::to_string_pretty(&val).unwrap_or_default()))
    } else {
        (None, None)
    };

    // 8. Generate expressions/*.exp3.json
    let mut expression_files: Vec<ExportedTextFile> = Vec::new();
    let mut expression_refs: Vec<Value> = Vec::new();
    for expr in &project.expressions {
        let rel = format!("expressions/{}.exp3.json", expr.id);
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
        (Some(fname), Some(serde_json::to_string_pretty(&val).unwrap_or_default()))
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
        model_name: model_name.to_string(),
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

        let bundle = export_runtime_bundle(&project, "haru", 1024, 4, &["textures/texture_00.png".into()])
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
            id: "second_texture".into(), path: "second.png".into(), width: 256, height: 256, content_hash: None,
        });
        if let NodeKind::ArtMesh(mesh) = &mut project.nodes[1].kind {
            mesh.texture_id = "second_texture".into();
        }
        assert!(export_runtime_bundle(&project, "overflow", 512, 4, &[]).is_err());
    }
}
