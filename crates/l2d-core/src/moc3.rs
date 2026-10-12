use crate::model::*;
use std::collections::HashMap;
use std::io::Write;

pub const MOC3_MAGIC: &[u8; 4] = b"MOC3";
pub const DEFAULT_MOC3_VERSION: u8 = 5;

#[derive(Debug, thiserror::Error)]
pub enum Moc3Error {
    #[error("Invalid MOC3 file: invalid magic header")]
    InvalidMagic,
    #[error("Unsupported MOC3 version: {0}")]
    UnsupportedVersion(u8),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("UTF-8 decode error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("JSON decode error: {0}")]
    Json(#[from] serde_json::Error),
}

fn push_i32_slice(out: &mut Vec<u8>, slice: &[i32]) {
    for &v in slice {
        out.extend_from_slice(&v.to_le_bytes());
    }
}

fn push_u32_slice(out: &mut Vec<u8>, slice: &[u32]) {
    for &v in slice {
        out.extend_from_slice(&v.to_le_bytes());
    }
}

fn push_u16_slice(out: &mut Vec<u8>, slice: &[u16]) {
    for &v in slice {
        out.extend_from_slice(&v.to_le_bytes());
    }
}

fn push_f32_slice(out: &mut Vec<u8>, slice: &[f32]) {
    for &v in slice {
        out.extend_from_slice(&v.to_le_bytes());
    }
}

fn i32_bytes(slice: &[i32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(slice.len() * 4);
    push_i32_slice(&mut out, slice);
    out
}

fn u16_bytes(slice: &[u16]) -> Vec<u8> {
    let mut out = Vec::with_capacity(slice.len() * 2);
    push_u16_slice(&mut out, slice);
    out
}

fn f32_bytes(slice: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(slice.len() * 4);
    push_f32_slice(&mut out, slice);
    out
}

fn pack_id_64(id: &str) -> [u8; 64] {
    let mut b = [0u8; 64];
    let bytes = id.as_bytes();
    let len = bytes.len().min(63);
    b[..len].copy_from_slice(&bytes[..len]);
    b
}

fn unpack_id_64(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).to_string()
}

fn read_u32_le(bytes: &[u8], offset: usize) -> u32 {
    if offset + 4 > bytes.len() {
        return 0;
    }
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn read_i32_le(bytes: &[u8], offset: usize) -> i32 {
    if offset + 4 > bytes.len() {
        return 0;
    }
    i32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn read_u16_le(bytes: &[u8], offset: usize) -> u16 {
    if offset + 2 > bytes.len() {
        return 0;
    }
    u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn read_f32_le(bytes: &[u8], offset: usize) -> f32 {
    if offset + 4 > bytes.len() {
        return 0.0;
    }
    f32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

/// Pure-Rust spec-compliant serializer for the official Live2D `.moc3` binary format (`ver = 1..=5`).
/// Produces a 64-byte-aligned binary with header (`0..64`), section offset directory (`64..704`),
/// `EmCountInfo` (`1984..`), and all runtime sections (`0..153` for Cubism 5.0) that passes
/// `csmHasMocConsistency == 1`, `csmReviveMocInPlace`, `csmInitializeModelInPlace`, and `csmUpdateModel`.
pub fn export_moc3_binary(project: &Project, version: u8) -> Result<Vec<u8>, Moc3Error> {
    if !(1..=5).contains(&version) {
        return Err(Moc3Error::UnsupportedVersion(version));
    }

    // 1. Collect Parts (guarantee >= 1 Part for csmHasMocConsistency)
    let mut part_nodes: Vec<Node> = project
        .nodes
        .iter()
        .filter(|n| matches!(&n.kind, NodeKind::Part { .. }))
        .cloned()
        .collect();
    if part_nodes.is_empty() {
        part_nodes.push(Node {
            id: "PartRoot".into(),
            name: "PartRoot".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::Part {
                collapsed: false,
                opacity: 1.0,
            },
        });
    }
    let num_parts = part_nodes.len();
    let part_id_to_idx: HashMap<String, i32> = part_nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.clone(), i as i32))
        .collect();

    // 2. Collect Parameters (guarantee >= 1 Parameter)
    let mut params: Vec<Parameter> = project.parameters.clone();
    if params.is_empty() {
        params.push(Parameter {
            id: "ParamAngleX".into(),
            name: "Angle X".into(),
            min: -30.0,
            max: 30.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
    }
    let num_params = params.len();
    let param_id_to_idx: HashMap<String, usize> = params
        .iter()
        .enumerate()
        .map(|(i, p)| (p.id.clone(), i))
        .collect();
    let default_param_map: HashMap<String, f32> =
        params.iter().map(|p| (p.id.clone(), p.default)).collect();
    let default_eval_frame = crate::evaluator::evaluate_project(project, &default_param_map);
    let tex_id_to_no: HashMap<&str, i32> = project
        .textures
        .iter()
        .enumerate()
        .map(|(i, t)| (t.id.as_str(), i as i32))
        .collect();

    // 3. Collect ArtMeshes & tessellated ArtPaths (guarantee >= 1 ArtMesh with >= 3 vertices)
    let mut mesh_nodes: Vec<(Node, ArtMeshData)> = project
        .nodes
        .iter()
        .filter_map(|n| match &n.kind {
            NodeKind::ArtMesh(m) => {
                let mut m_cloned = m.clone();
                if m_cloned.vertices.is_empty() {
                    m_cloned.vertices = vec![[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]];
                    m_cloned.uvs = vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]];
                    m_cloned.indices = vec![0, 1, 2];
                } else if m_cloned.uvs.len() < m_cloned.vertices.len() {
                    m_cloned.uvs.resize(m_cloned.vertices.len(), [0.0, 0.0]);
                }
                Some((n.clone(), m_cloned))
            }
            NodeKind::ArtPath(ap) if ap.points.len() >= 2 => {
                let (vertices, uvs, indices, avg_op) =
                    crate::evaluator::tessellate_art_path(&ap.points, ap.closed);
                if vertices.is_empty() {
                    None
                } else {
                    Some((
                        n.clone(),
                        ArtMeshData {
                            texture_id: ap
                                .texture_id
                                .clone()
                                .unwrap_or_else(|| "texture_00".into()),
                            vertices,
                            uvs,
                            indices,
                            blend_mode: ap.blend_mode,
                            opacity: (ap.opacity * avg_op).clamp(0.0, 1.0),
                            multiply_color: ap.color,
                            screen_color: [0.0, 0.0, 0.0, 0.0],
                            draw_order: ap.draw_order,
                            mask_ids: ap.mask_ids.clone(),
                            is_mask_inverted: ap.is_mask_inverted,
                            morph_targets: vec![],
                            hit_area_name: None,
                            user_data: None,
                        },
                    ))
                }
            }
            _ => None,
        })
        .collect();
    if mesh_nodes.is_empty() {
        mesh_nodes.push((
            Node {
                id: "__default_mesh__".into(),
                name: "__default_mesh__".into(),
                parent_id: Some(part_nodes[0].id.clone()),
                visible: true,
                locked: false,
                kind: NodeKind::Part {
                    collapsed: false,
                    opacity: 1.0,
                },
            },
            ArtMeshData {
                texture_id: "texture_00".into(),
                vertices: vec![[0.0, 0.0], [64.0, 0.0], [0.0, 64.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order: 500,
                mask_ids: vec![],
                is_mask_inverted: false,
                morph_targets: vec![],
                hit_area_name: None,
                user_data: None,
            },
        ));
    }
    let num_artmeshes = mesh_nodes.len();
    let mesh_id_to_idx: HashMap<String, i32> = mesh_nodes
        .iter()
        .enumerate()
        .map(|(i, (n, _))| (n.id.clone(), i as i32))
        .collect();
    let node_map: HashMap<&str, &Node> = project.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
    let kf_map: HashMap<&str, &KeyformBinding> = project
        .keyforms
        .iter()
        .map(|k| (k.target_node_id.as_str(), k))
        .collect();

    // Helper to find closest ancestor Part index for a node
    let resolve_parent_part_idx = |start_parent: Option<&str>| -> i32 {
        let mut cur = start_parent;
        let mut visited = std::collections::HashSet::new();
        while let Some(pid) = cur {
            if !visited.insert(pid) {
                break;
            }
            if let Some(&idx) = part_id_to_idx.get(pid) {
                return idx;
            }
            cur = node_map.get(pid).and_then(|n| n.parent_id.as_deref());
        }
        0
    };

    // Helper to find effective driving ParamDimensions for an ArtMesh (from self or ancestor deformer)
    let resolve_driving_dims = |mesh_node: &Node, mesh_data: &ArtMeshData| -> Vec<ParamDimension> {
        let mut cur_id = Some(mesh_node.id.as_str());
        let mut visited = std::collections::HashSet::new();
        while let Some(nid) = cur_id {
            if !visited.insert(nid) {
                break;
            }
            if let Some(kb) = kf_map.get(nid) {
                let valid_dims: Vec<ParamDimension> = kb
                    .dimensions
                    .iter()
                    .filter(|d| param_id_to_idx.contains_key(&d.param_id) && !d.keys.is_empty())
                    .take(2)
                    .cloned()
                    .collect();
                if !valid_dims.is_empty() {
                    return valid_dims;
                }
            }
            cur_id = node_map.get(nid).and_then(|n| n.parent_id.as_deref());
        }
        // Also check MorphTargets / BlendShapes on the ArtMesh
        let mut morph_dims = Vec::new();
        for mt in &mesh_data.morph_targets {
            if let Some(&p_idx) = param_id_to_idx.get(&mt.param_id) {
                if !morph_dims.iter().any(|d: &ParamDimension| d.param_id == mt.param_id) {
                    let p = &params[p_idx];
                    morph_dims.push(ParamDimension {
                        param_id: p.id.clone(),
                        keys: vec![p.min, p.default, p.max],
                        extended_interpolation: None,
                    });
                    if morph_dims.len() >= 2 {
                        break;
                    }
                }
            }
        }
        morph_dims
    };

    // 4. Build ParameterBindings (dK) grouped by Parameter so each parameter has a contiguous range
    let mut per_param_key_lists: Vec<Vec<Vec<f32>>> = vec![Vec::new(); num_params];
    let mut mesh_driving_dims: Vec<Vec<ParamDimension>> = Vec::with_capacity(num_artmeshes);
    for (mnode, mdata) in &mesh_nodes {
        let dims = resolve_driving_dims(mnode, mdata);
        for d in &dims {
            let p_idx = param_id_to_idx[&d.param_id];
            if !per_param_key_lists[p_idx].iter().any(|k| k == &d.keys) {
                per_param_key_lists[p_idx].push(d.keys.clone());
            }
        }
        mesh_driving_dims.push(dims);
    }
    // Ensure every parameter has at least one ParameterBinding in dK
    for (p_idx, p) in params.iter().enumerate() {
        if per_param_key_lists[p_idx].is_empty() {
            per_param_key_lists[p_idx].push(vec![p.min, p.default, p.max]);
        }
    }

    let mut param_binding_begin: Vec<i32> = Vec::with_capacity(num_params);
    let mut param_binding_count: Vec<i32> = Vec::with_capacity(num_params);
    let mut dk_keys_begin: Vec<i32> = Vec::new();
    let mut dk_keys_count: Vec<i32> = Vec::new();
    let mut db_keys: Vec<f32> = Vec::new();
    let mut param_keylist_to_dk: Vec<Vec<i32>> = vec![Vec::new(); num_params];

    for p_idx in 0..num_params {
        let begin = dk_keys_begin.len() as i32;
        let lists = &per_param_key_lists[p_idx];
        param_binding_begin.push(begin);
        param_binding_count.push(lists.len() as i32);
        for keys in lists {
            let dk_idx = dk_keys_begin.len() as i32;
            let k_begin = db_keys.len() as i32;
            db_keys.extend_from_slice(keys);
            dk_keys_begin.push(k_begin);
            dk_keys_count.push(keys.len() as i32);
            param_keylist_to_dk[p_idx].push(dk_idx);
        }
    }

    // 5. Build KeyformBindings (dx), ParameterBindingIndices (dJ), ArtMeshes, and ArtMeshKeyforms
    // Index 0 in KeyformBindings is always the unbound (begin=0, count=0) entry
    let mut dx_begin: Vec<i32> = vec![0];
    let mut dx_count: Vec<i32> = vec![0];
    let mut dj_indices: Vec<i32> = Vec::new();

    let mut am_ids_bytes: Vec<u8> = Vec::with_capacity(num_artmeshes * 64);
    let mut am_kf_binding_idx: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_kf_begin: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_kf_count: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_is_visible: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let am_is_enabled: Vec<i32> = vec![1; num_artmeshes];
    let mut am_parent_part_idx: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let am_parent_deformer_idx: Vec<i32> = vec![0; num_artmeshes];
    let mut am_texture_no: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_drawable_flag: Vec<u8> = Vec::with_capacity(num_artmeshes);
    let mut am_vertex_count: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_uv_begin: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_pos_idx_begin: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_pos_idx_count: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_mask_begin: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_mask_count: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_blend_mode_v5: Vec<i32> = Vec::with_capacity(num_artmeshes);
    let mut am_color_begin_v4: Vec<i32> = Vec::with_capacity(num_artmeshes);

    let mut am_kf_opacity: Vec<f32> = Vec::new();
    let mut am_kf_draw_order: Vec<f32> = Vec::new();
    let mut am_kf_pos_begin: Vec<i32> = Vec::new();
    let mut am_kf_color_begin_v5: Vec<i32> = Vec::new();

    // Color arrays (index 0 is consumed by the 1 RotationDeformer keyform)
    let mut mult_r: Vec<f32> = vec![1.0];
    let mut mult_g: Vec<f32> = vec![1.0];
    let mut mult_b: Vec<f32> = vec![1.0];
    let mut scr_r: Vec<f32> = vec![0.0];
    let mut scr_g: Vec<f32> = vec![0.0];
    let mut scr_b: Vec<f32> = vec![0.0];

    let mut da_positions: Vec<f32> = Vec::new();
    let mut dv_uvs: Vec<f32> = Vec::new();
    let mut dq_indices: Vec<u16> = Vec::new();
    let mut dr_masks: Vec<i32> = Vec::new();

    for (m_idx, (mnode, mesh)) in mesh_nodes.iter().enumerate() {
        am_ids_bytes.extend_from_slice(&pack_id_64(&mnode.id));
        am_is_visible.push(if mnode.visible { 1 } else { 0 });
        am_parent_part_idx.push(resolve_parent_part_idx(mnode.parent_id.as_deref()));
        am_texture_no.push(
            tex_id_to_no
                .get(mesh.texture_id.as_str())
                .copied()
                .unwrap_or(0),
        );

        let blend_code: u8 = match mesh.blend_mode {
            BlendMode::Normal => 0,
            BlendMode::Additive => 1,
            BlendMode::Multiply => 2,
            BlendMode::Screen => 3,
        };
        let inv_mask_bit: u8 = if mesh.is_mask_inverted { 1 << 3 } else { 0 };
        am_drawable_flag.push(0x04 | (blend_code & 0x03) | inv_mask_bit);
        am_blend_mode_v5.push(blend_code as i32);

        let v_count = mesh.vertices.len();
        am_vertex_count.push(v_count as i32);
        am_uv_begin.push((dv_uvs.len() / 2) as i32);
        for uv in &mesh.uvs[..v_count] {
            dv_uvs.push(uv[0]);
            dv_uvs.push(uv[1]);
        }

        am_pos_idx_begin.push(dq_indices.len() as i32);
        am_pos_idx_count.push(mesh.indices.len() as i32);
        for &idx in &mesh.indices {
            dq_indices.push((idx as u16).min(v_count.saturating_sub(1) as u16));
        }

        am_mask_begin.push(dr_masks.len() as i32);
        let mut valid_masks = 0i32;
        for mid in &mesh.mask_ids {
            if let Some(&mask_idx) = mesh_id_to_idx.get(mid) {
                dr_masks.push(mask_idx);
                valid_masks += 1;
            }
        }
        am_mask_count.push(valid_masks);

        let dims = &mesh_driving_dims[m_idx];
        let kf_begin = am_kf_opacity.len() as i32;
        am_kf_begin.push(kf_begin);
        am_color_begin_v4.push(mult_r.len() as i32);

        if dims.is_empty() {
            am_kf_binding_idx.push(0);
            am_kf_count.push(1);
            let eval_mesh = default_eval_frame.meshes.iter().find(|em| em.id == mnode.id);
            let op = eval_mesh.map(|em| em.opacity).unwrap_or(mesh.opacity);
            let d_order = eval_mesh.map(|em| em.draw_order).unwrap_or(mesh.draw_order);
            let mc = eval_mesh
                .map(|em| em.multiply_color)
                .unwrap_or(mesh.multiply_color);
            let sc = eval_mesh
                .map(|em| em.screen_color)
                .unwrap_or(mesh.screen_color);
            am_kf_opacity.push(op);
            am_kf_draw_order.push(d_order as f32);
            am_kf_pos_begin.push(da_positions.len() as i32);
            am_kf_color_begin_v5.push(mult_r.len() as i32);
            mult_r.push(mc[0]);
            mult_g.push(mc[1]);
            mult_b.push(mc[2]);
            scr_r.push(sc[0]);
            scr_g.push(sc[1]);
            scr_b.push(sc[2]);
            if let Some(em) = eval_mesh {
                if em.vertices.len() == v_count {
                    for &[x, y] in &em.vertices {
                        da_positions.push(x);
                        da_positions.push(y);
                    }
                } else {
                    for &[x, y] in &mesh.vertices {
                        da_positions.push(x);
                        da_positions.push(y);
                    }
                }
            } else {
                for &[x, y] in &mesh.vertices {
                    da_positions.push(x);
                    da_positions.push(y);
                }
            }
        } else {
            let dj_start = dj_indices.len() as i32;
            for d in dims {
                let p_idx = param_id_to_idx[&d.param_id];
                let k_list_idx = per_param_key_lists[p_idx]
                    .iter()
                    .position(|k| k == &d.keys)
                    .unwrap_or(0);
                dj_indices.push(param_keylist_to_dk[p_idx][k_list_idx]);
            }
            let binding_idx = dx_begin.len() as i32;
            dx_begin.push(dj_start);
            dx_count.push(dims.len() as i32);
            am_kf_binding_idx.push(binding_idx);

            let total_combos: usize = dims.iter().map(|d| d.keys.len()).product();
            am_kf_count.push(total_combos as i32);

            for combo_idx in 0..total_combos {
                let mut rem = combo_idx;
                let mut param_map: HashMap<String, f32> = HashMap::new();
                for d in dims {
                    let k_idx = rem % d.keys.len();
                    rem /= d.keys.len();
                    param_map.insert(d.param_id.clone(), d.keys[k_idx]);
                }
                let eval_frame = crate::evaluator::evaluate_project(project, &param_map);
                let eval_mesh = eval_frame.meshes.iter().find(|em| em.id == mnode.id);

                let op = eval_mesh.map(|em| em.opacity).unwrap_or(mesh.opacity);
                let d_order = eval_mesh.map(|em| em.draw_order).unwrap_or(mesh.draw_order);
                let mc = eval_mesh
                    .map(|em| em.multiply_color)
                    .unwrap_or(mesh.multiply_color);
                let sc = eval_mesh
                    .map(|em| em.screen_color)
                    .unwrap_or(mesh.screen_color);

                am_kf_opacity.push(op);
                am_kf_draw_order.push(d_order as f32);
                am_kf_pos_begin.push(da_positions.len() as i32);
                am_kf_color_begin_v5.push(mult_r.len() as i32);
                mult_r.push(mc[0]);
                mult_g.push(mc[1]);
                mult_b.push(mc[2]);
                scr_r.push(sc[0]);
                scr_g.push(sc[1]);
                scr_b.push(sc[2]);

                if let Some(em) = eval_mesh {
                    if em.vertices.len() == v_count {
                        for &[x, y] in &em.vertices {
                            da_positions.push(x);
                            da_positions.push(y);
                        }
                        continue;
                    }
                }
                for &[x, y] in &mesh.vertices {
                    da_positions.push(x);
                    da_positions.push(y);
                }
            }
        }
    }

    // Pad KeyformPositions (dA) to a multiple of 16 floats (64 bytes) for section 72 alignment
    while da_positions.len() % 16 != 0 {
        da_positions.push(0.0);
    }

    let num_artmesh_kfs = am_kf_opacity.len();
    let num_colors = mult_r.len(); // 1 (RotationDeformer) + num_artmesh_kfs

    // 6. Build CountInfo (Section 0)
    let mut counts: Vec<u32> = vec![
        num_parts as u32,               // 0: Parts
        1,                              // 1: Deformers (1 root RotationDeformer)
        0,                              // 2: WarpDeformers
        1,                              // 3: RotationDeformers
        num_artmeshes as u32,           // 4: ArtMeshes
        num_params as u32,              // 5: Parameters
        num_parts as u32,               // 6: PartKeyforms
        0,                              // 7: WarpDeformerKeyforms
        1,                              // 8: RotationDeformerKeyforms
        num_artmesh_kfs as u32,         // 9: ArtMeshKeyforms
        da_positions.len() as u32,      // 10: KeyformPositions (number of f32 floats!)
        dj_indices.len() as u32,        // 11: ParameterBindingIndices
        dx_begin.len() as u32,          // 12: KeyformBindings
        dk_keys_begin.len() as u32,     // 13: ParameterBindings
        db_keys.len() as u32,           // 14: Keys
        dv_uvs.len() as u32,            // 15: Uvs (number of f32 floats)
        dq_indices.len() as u32,        // 16: PositionIndices (number of u16s)
        dr_masks.len() as u32,          // 17: DrawableMasks
        1,                              // 18: DrawOrderGroups
        num_artmeshes as u32,           // 19: DrawOrderGroupObjects
        0,                              // 20: Glues
        0,                              // 21: GlueInfos
        0,                              // 22: GlueKeyforms
    ];
    if version >= 4 {
        counts.extend_from_slice(&[
            num_colors as u32, // 23: KeyformMultiplyColors
            num_colors as u32, // 24: KeyformScreenColors
            0,                 // 25: BlendShapeParameterBindings
            0,                 // 26: BlendShapeKeyformBindings
            0,                 // 27: BlendShapesWarpDeformers
            0,                 // 28: BlendShapesArtMeshes
            0,                 // 29: BlendShapeConstraintIndices
            0,                 // 30: BlendShapeConstraints
            0,                 // 31: BlendShapeConstraintValues
        ]);
    }
    if version >= 5 {
        counts.extend_from_slice(&[
            0, // 32: BlendShapesParts
            0, // 33: BlendShapesRotationDeformers
            0, // 34: BlendShapesGlue
        ]);
    }

    let count_info_pad_len = if version >= 5 { 256 } else { 128 };
    let mut sec0_bytes = Vec::with_capacity(count_info_pad_len);
    push_u32_slice(&mut sec0_bytes, &counts);
    sec0_bytes.resize(count_info_pad_len, 0);

    // 7. Build Section 1: EmCanvasInfo (64 bytes)
    let mut sec1_bytes = Vec::with_capacity(64);
    let ppu: f32 = 1.0;
    push_f32_slice(
        &mut sec1_bytes,
        &[
            ppu,
            project.canvas.origin_x,
            project.canvas.origin_y,
            project.canvas.width,
            project.canvas.height,
        ],
    );
    sec1_bytes.push(1u8); // Canvas flags
    sec1_bytes.resize(64, 0);

    // 8. Build Part sections (2..9) and PartKeyform (58)
    let mut part_ids_bytes = Vec::with_capacity(num_parts * 64);
    let mut part_kf_binding_idx = Vec::with_capacity(num_parts);
    let mut part_kf_begin = Vec::with_capacity(num_parts);
    let mut part_kf_count = Vec::with_capacity(num_parts);
    let mut part_is_visible = Vec::with_capacity(num_parts);
    let mut part_is_enabled = Vec::with_capacity(num_parts);
    let mut part_parent_idx = Vec::with_capacity(num_parts);
    let mut part_kf_draw_order = Vec::with_capacity(num_parts);

    for (i, pnode) in part_nodes.iter().enumerate() {
        part_ids_bytes.extend_from_slice(&pack_id_64(&pnode.id));
        part_kf_binding_idx.push(0i32);
        part_kf_begin.push(i as i32);
        part_kf_count.push(1i32);
        part_is_visible.push(if pnode.visible { 1 } else { 0 });
        part_is_enabled.push(1i32);
        let parent_i = pnode
            .parent_id
            .as_ref()
            .and_then(|pid| part_id_to_idx.get(pid).copied())
            .unwrap_or(-1);
        part_parent_idx.push(if parent_i == i as i32 { -1 } else { parent_i });
        part_kf_draw_order.push(500.0f32);
    }

    // 9. Build Parameter sections (49..57)
    let mut param_ids_bytes = Vec::with_capacity(num_params * 64);
    let mut param_max = Vec::with_capacity(num_params);
    let mut param_min = Vec::with_capacity(num_params);
    let mut param_default = Vec::with_capacity(num_params);
    let mut param_is_repeat = Vec::with_capacity(num_params);
    let mut param_decimal = Vec::with_capacity(num_params);
    for p in &params {
        param_ids_bytes.extend_from_slice(&pack_id_64(&p.id));
        param_max.push(p.max);
        param_min.push(p.min);
        param_default.push(p.default);
        param_is_repeat.push(if p.repeats { 1 } else { 0 });
        param_decimal.push(4i32);
    }

    // 10. Assemble body and section offset table
    let mut body: Vec<u8> = Vec::with_capacity(16384);
    let mut sec_offsets: Vec<u32> = Vec::with_capacity(160);

    let mut add_sec = |data: &[u8], align: usize| {
        if align > 0 {
            let rem = body.len() % align;
            if rem != 0 {
                body.resize(body.len() + (align - rem), 0);
            }
        }
        sec_offsets.push((1984 + body.len()) as u32);
        body.extend_from_slice(data);
    };

    // 0: EmCountInfo (align 0)
    add_sec(&sec0_bytes, 0);
    // 1: EmCanvasInfo (align 0)
    add_sec(&sec1_bytes, 0);

    // 2..9: Parts
    add_sec(&vec![0u8; 8 * num_parts], 64); // 2: runtime space
    add_sec(&part_ids_bytes, 0); // 3: IDs (align 0)
    add_sec(&i32_bytes(&part_kf_binding_idx), 64); // 4
    add_sec(&i32_bytes(&part_kf_begin), 64); // 5
    add_sec(&i32_bytes(&part_kf_count), 64); // 6
    add_sec(&i32_bytes(&part_is_visible), 64); // 7
    add_sec(&i32_bytes(&part_is_enabled), 64); // 8
    add_sec(&i32_bytes(&part_parent_idx), 64); // 9

    // 10..18: Deformers (1 root RotationDeformer)
    add_sec(&[0u8; 8], 64); // 10: runtime space
    add_sec(&pack_id_64("__root_deformer__"), 0); // 11: IDs (align 0)
    add_sec(&i32_bytes(&[0]), 64); // 12: kfBindingIdx
    add_sec(&i32_bytes(&[1]), 64); // 13: isVisible
    add_sec(&i32_bytes(&[1]), 64); // 14: isEnabled
    add_sec(&i32_bytes(&[0]), 64); // 15: parentPartIdx
    add_sec(&i32_bytes(&[-1]), 64); // 16: parentDeformerIdx
    add_sec(&i32_bytes(&[1]), 64); // 17: type (1 = Rotation)
    add_sec(&i32_bytes(&[0]), 64); // 18: specificIdx

    // 19..24: WarpDeformers (0)
    for _ in 19..=24 {
        add_sec(&[], 64);
    }

    // 25..28: RotationDeformers (1)
    add_sec(&i32_bytes(&[0]), 64); // 25: kfBindingIdx
    add_sec(&i32_bytes(&[0]), 64); // 26: kfBegin
    add_sec(&i32_bytes(&[1]), 64); // 27: kfCount
    add_sec(&f32_bytes(&[0.0]), 64); // 28: baseAngle

    // 29..48: ArtMeshes
    for _ in 29..=32 {
        add_sec(&vec![0u8; 8 * num_artmeshes], 64);
    }
    add_sec(&am_ids_bytes, 0); // 33: IDs (align 0)
    add_sec(&i32_bytes(&am_kf_binding_idx), 64); // 34
    add_sec(&i32_bytes(&am_kf_begin), 64); // 35
    add_sec(&i32_bytes(&am_kf_count), 64); // 36
    add_sec(&i32_bytes(&am_is_visible), 64); // 37
    add_sec(&i32_bytes(&am_is_enabled), 64); // 38
    add_sec(&i32_bytes(&am_parent_part_idx), 64); // 39
    add_sec(&i32_bytes(&am_parent_deformer_idx), 64); // 40
    add_sec(&i32_bytes(&am_texture_no), 64); // 41
    add_sec(&am_drawable_flag, 64); // 42
    add_sec(&i32_bytes(&am_vertex_count), 64); // 43
    add_sec(&i32_bytes(&am_uv_begin), 64); // 44
    add_sec(&i32_bytes(&am_pos_idx_begin), 64); // 45
    add_sec(&i32_bytes(&am_pos_idx_count), 64); // 46
    add_sec(&i32_bytes(&am_mask_begin), 64); // 47
    add_sec(&i32_bytes(&am_mask_count), 64); // 48

    // 49..57: Parameters
    add_sec(&vec![0u8; 8 * num_params], 64); // 49: runtime space
    add_sec(&param_ids_bytes, 0); // 50: IDs (align 0)
    add_sec(&f32_bytes(&param_max), 64); // 51
    add_sec(&f32_bytes(&param_min), 64); // 52
    add_sec(&f32_bytes(&param_default), 64); // 53
    add_sec(&i32_bytes(&param_is_repeat), 64); // 54
    add_sec(&i32_bytes(&param_decimal), 64); // 55
    add_sec(&i32_bytes(&param_binding_begin), 64); // 56
    add_sec(&i32_bytes(&param_binding_count), 64); // 57

    // 58: PartKeyforms
    add_sec(&f32_bytes(&part_kf_draw_order), 64); // 58

    // 59..60: WarpDeformerKeyforms (0)
    add_sec(&[], 64); // 59
    add_sec(&[], 64); // 60

    // 61..67: RotationDeformerKeyforms (1)
    add_sec(&f32_bytes(&[1.0]), 64); // 61: opacity
    add_sec(&f32_bytes(&[0.0]), 64); // 62: angle
    add_sec(&f32_bytes(&[0.0]), 64); // 63: originX
    add_sec(&f32_bytes(&[0.0]), 64); // 64: originY
    add_sec(&f32_bytes(&[1.0]), 64); // 65: scale
    add_sec(&i32_bytes(&[0]), 64); // 66: isReflectX
    add_sec(&i32_bytes(&[0]), 64); // 67: isReflectY

    // 68..70: ArtMeshKeyforms
    add_sec(&f32_bytes(&am_kf_opacity), 64); // 68: opacity
    add_sec(&f32_bytes(&am_kf_draw_order), 64); // 69: drawOrder
    add_sec(&i32_bytes(&am_kf_pos_begin), 64); // 70: keyformPositionBegin

    // 71..80: Positions, Bindings, Keys, UVs, Indices, Masks
    add_sec(&f32_bytes(&da_positions), 64); // 71: KeyformPositions
    add_sec(&i32_bytes(&dj_indices), 64); // 72: ParameterBindingIndices
    add_sec(&i32_bytes(&dx_begin), 64); // 73: KeyformBindings.begin
    add_sec(&i32_bytes(&dx_count), 64); // 74: KeyformBindings.count
    add_sec(&i32_bytes(&dk_keys_begin), 64); // 75: ParameterBindings.keysBegin
    add_sec(&i32_bytes(&dk_keys_count), 64); // 76: ParameterBindings.keysCount
    add_sec(&f32_bytes(&db_keys), 64); // 77: Keys
    add_sec(&f32_bytes(&dv_uvs), 64); // 78: Uvs
    add_sec(&u16_bytes(&dq_indices), 64); // 79: PositionIndices
    add_sec(&i32_bytes(&dr_masks), 64); // 80: DrawableMasks

    // 81..88: DrawOrderGroups & DrawOrderGroupObjects
    let min_do = am_kf_draw_order
        .iter()
        .chain(part_kf_draw_order.iter())
        .fold(0.0f32, |acc, &v| acc.min(v))
        .floor() as i32;
    let max_do = am_kf_draw_order
        .iter()
        .chain(part_kf_draw_order.iter())
        .fold(1000.0f32, |acc, &v| acc.max(v))
        .ceil() as i32;
    add_sec(&i32_bytes(&[0]), 64); // 81: objectBegin
    add_sec(&i32_bytes(&[num_artmeshes as i32]), 64); // 82: objectCount
    add_sec(&i32_bytes(&[num_artmeshes as i32]), 64); // 83: totalArtMeshCount
    add_sec(&i32_bytes(&[max_do]), 64); // 84: maximumDrawOrder
    add_sec(&i32_bytes(&[min_do]), 64); // 85: minimumDrawOrder

    let dog_types = vec![0i32; num_artmeshes];
    let dog_indices: Vec<i32> = (0..num_artmeshes as i32).collect();
    let dog_self_group = vec![-1i32; num_artmeshes];
    add_sec(&i32_bytes(&dog_types), 64); // 86: type (0 = ArtMesh)
    add_sec(&i32_bytes(&dog_indices), 64); // 87: index
    add_sec(&i32_bytes(&dog_self_group), 64); // 88: selfGroupIndex

    // 89..100: Glues (0)
    add_sec(&[], 64); // 89: runtime space
    add_sec(&[], 0); // 90: Glue IDs (align 0)
    for _ in 91..=100 {
        add_sec(&[], 64);
    }

    // Version >= 2: 101 (WarpDeformer.isQuadTransform)
    if version >= 2 {
        add_sec(&[], 64); // 101
    }

    // Version >= 4: 102..136 (ParameterExtensions, KeyformColors, BlendShapes)
    if version >= 4 {
        add_sec(&vec![0u8; 8 * num_params], 64); // 102: ParameterExtensions runtime space
        add_sec(&i32_bytes(&vec![0; num_params]), 64); // 103: keysBegin
        add_sec(&i32_bytes(&vec![0; num_params]), 64); // 104: keysCount
        add_sec(&[], 64); // 105: Warp color begin
        add_sec(&i32_bytes(&[0]), 64); // 106: Rotation color begin
        add_sec(&i32_bytes(&am_color_begin_v4), 64); // 107: ArtMesh color begin
        add_sec(&f32_bytes(&mult_r), 64); // 108: Multiply R
        add_sec(&f32_bytes(&mult_g), 64); // 109: Multiply G
        add_sec(&f32_bytes(&mult_b), 64); // 110: Multiply B
        add_sec(&f32_bytes(&scr_r), 64); // 111: Screen R
        add_sec(&f32_bytes(&scr_g), 64); // 112: Screen G
        add_sec(&f32_bytes(&scr_b), 64); // 113: Screen B
        add_sec(&i32_bytes(&vec![0; num_params]), 64); // 114: Parameter.type
        add_sec(&i32_bytes(&vec![0; num_params]), 64); // 115: Parameter.blendShapeBegin
        add_sec(&i32_bytes(&vec![0; num_params]), 64); // 116: Parameter.blendShapeCount
        for _ in 117..=136 {
            add_sec(&[], 64);
        }
    }

    // Version >= 5: 137..153 (Keyform color indices, BlendShapes v5, Offscreen, BlendMode)
    if version >= 5 {
        add_sec(&[], 64); // 137: WarpKeyform mult color begin
        add_sec(&[], 64); // 138: WarpKeyform scr color begin
        add_sec(&i32_bytes(&[0]), 64); // 139: RotationKeyform mult color begin
        add_sec(&i32_bytes(&[0]), 64); // 140: RotationKeyform scr color begin
        add_sec(&i32_bytes(&am_kf_color_begin_v5), 64); // 141: ArtMeshKeyform mult color begin
        add_sec(&i32_bytes(&am_kf_color_begin_v5), 64); // 142: ArtMeshKeyform scr color begin
        for _ in 143..=151 {
            add_sec(&[], 64);
        }
        add_sec(&i32_bytes(&vec![0; num_parts]), 64); // 152: Part offscreen index
        add_sec(&i32_bytes(&am_blend_mode_v5), 64); // 153: ArtMesh blendMode
    }

    // Align end of standard MOC3 body to 64 bytes
    if body.len() % 64 != 0 {
        body.resize(body.len() + (64 - (body.len() % 64)), 0);
    }

    // Append optional 64-byte-aligned L2D0 project trailer after the last MOC3 section
    // (csmHasMocConsistency only checks that all section end addresses <= total_size and total_size % 64 == 0)
    let json_bytes = serde_json::to_vec(project)?;
    body.extend_from_slice(b"L2D0");
    body.extend_from_slice(&(json_bytes.len() as u32).to_le_bytes());
    body.extend_from_slice(&json_bytes);
    if body.len() % 64 != 0 {
        body.resize(body.len() + (64 - (body.len() % 64)), 0);
    }

    // 11. Build 1984-byte File Header + Section Offset Table
    let mut out = Vec::with_capacity(1984 + body.len());
    out.write_all(MOC3_MAGIC)?;
    out.write_all(&[version, 0])?; // version, endianFlag = 0 (little-endian)
    out.resize(64, 0);

    for &off in &sec_offsets {
        out.extend_from_slice(&off.to_le_bytes());
    }
    out.resize(1984, 0);
    out.extend_from_slice(&body);

    Ok(out)
}

/// Pure-Rust standalone parser for the official Live2D `.moc3` binary format (`ver = 1..=5`).
/// Reads the section offset table (`64..704`), `EmCountInfo`, `EmCanvasInfo`, `Parts`,
/// `Parameters`, `ArtMeshes`, `Uvs`, `PositionIndices`, `KeyformPositions`, and `DrawableMasks`
/// directly from standard `.moc3` binaries, and restores full lossless editor metadata when
/// an `L2D0` trailer is present.
pub fn import_moc3_binary(bytes: &[u8]) -> Result<Project, Moc3Error> {
    if bytes.len() < 1984 || &bytes[0..4] != MOC3_MAGIC {
        return Err(Moc3Error::InvalidMagic);
    }
    let version = bytes[4];
    if !(1..=5).contains(&version) {
        return Err(Moc3Error::UnsupportedVersion(version));
    }

    // Read section offset table at 64..704
    let num_secs = match version {
        1 => 101,
        2 | 3 => 102,
        4 => 137,
        _ => 154,
    };
    let mut sec_offsets = Vec::with_capacity(num_secs);
    for i in 0..num_secs {
        sec_offsets.push(read_u32_le(bytes, 64 + i * 4) as usize);
    }

    let count_off = sec_offsets[0];
    if count_off + 92 > bytes.len() {
        return Err(Moc3Error::InvalidMagic);
    }
    let num_parts = read_u32_le(bytes, count_off) as usize;
    let num_artmeshes = read_u32_le(bytes, count_off + 4 * 4) as usize;
    let num_params = read_u32_le(bytes, count_off + 5 * 4) as usize;
    let num_artmesh_kfs = read_u32_le(bytes, count_off + 9 * 4) as usize;

    // Check if an L2D0 lossless trailer exists after the last MOC3 section
    let last_sec_off = sec_offsets[num_secs - 1];
    let last_sec_len = if version >= 5 { num_artmeshes * 4 } else { 0 };
    let mut trailer_off = last_sec_off + last_sec_len;
    if trailer_off % 64 != 0 {
        trailer_off += 64 - (trailer_off % 64);
    }
    if trailer_off + 8 <= bytes.len() && &bytes[trailer_off..trailer_off + 4] == b"L2D0" {
        let json_len = read_u32_le(bytes, trailer_off + 4) as usize;
        let json_start = trailer_off + 8;
        if json_start + json_len <= bytes.len() {
            if let Ok(proj) = serde_json::from_slice::<Project>(&bytes[json_start..json_start + json_len]) {
                return Ok(proj);
            }
        }
    }

    // Otherwise reconstruct Project directly from standard .moc3 binary sections
    let canvas_off = sec_offsets[1];
    let origin_x = read_f32_le(bytes, canvas_off + 4);
    let origin_y = read_f32_le(bytes, canvas_off + 8);
    let width = read_f32_le(bytes, canvas_off + 12);
    let height = read_f32_le(bytes, canvas_off + 16);

    // Reconstruct Parameters (sections 50..54)
    let mut parameters = Vec::with_capacity(num_params);
    let param_ids_off = sec_offsets[50];
    let param_max_off = sec_offsets[51];
    let param_min_off = sec_offsets[52];
    let param_def_off = sec_offsets[53];
    let param_rep_off = sec_offsets[54];
    for i in 0..num_params {
        let id = unpack_id_64(&bytes[param_ids_off + i * 64..param_ids_off + (i + 1) * 64]);
        parameters.push(Parameter {
            name: id.clone(),
            id,
            max: read_f32_le(bytes, param_max_off + i * 4),
            min: read_f32_le(bytes, param_min_off + i * 4),
            default: read_f32_le(bytes, param_def_off + i * 4),
            repeats: read_i32_le(bytes, param_rep_off + i * 4) != 0,
            group_id: None,
            locked: false,
        });
    }

    // Reconstruct Parts (sections 3, 7, 9)
    let mut nodes = Vec::with_capacity(num_parts + num_artmeshes);
    let part_ids_off = sec_offsets[3];
    let part_vis_off = sec_offsets[7];
    let part_par_off = sec_offsets[9];
    let mut part_ids = Vec::with_capacity(num_parts);
    for i in 0..num_parts {
        part_ids.push(unpack_id_64(
            &bytes[part_ids_off + i * 64..part_ids_off + (i + 1) * 64],
        ));
    }
    for i in 0..num_parts {
        let parent_idx = read_i32_le(bytes, part_par_off + i * 4);
        let parent_id = if parent_idx >= 0 && (parent_idx as usize) < num_parts {
            Some(part_ids[parent_idx as usize].clone())
        } else {
            None
        };
        let id = part_ids[i].clone();
        if id != "PartRoot" || num_parts > 1 {
            nodes.push(Node {
                name: id.clone(),
                id,
                parent_id,
                visible: read_i32_le(bytes, part_vis_off + i * 4) != 0,
                locked: false,
                kind: NodeKind::Part {
                    collapsed: false,
                    opacity: 1.0,
                },
            });
        }
    }

    // Reconstruct ArtMeshes (sections 33..48, 68..71, 78..80)
    let am_ids_off = sec_offsets[33];
    let am_kf_begin_off = sec_offsets[35];
    let am_vis_off = sec_offsets[37];
    let am_part_off = sec_offsets[39];
    let am_flag_off = sec_offsets[42];
    let am_vcount_off = sec_offsets[43];
    let am_uv_begin_off = sec_offsets[44];
    let am_idx_begin_off = sec_offsets[45];
    let am_idx_count_off = sec_offsets[46];
    let am_mask_begin_off = sec_offsets[47];
    let am_mask_count_off = sec_offsets[48];

    let am_kf_op_off = sec_offsets[68];
    let am_kf_do_off = sec_offsets[69];
    let am_kf_pos_off = sec_offsets[70];
    let pos_off = sec_offsets[71];
    let uv_off = sec_offsets[78];
    let idx_off = sec_offsets[79];
    let mask_off = sec_offsets[80];

    let mut am_ids = Vec::with_capacity(num_artmeshes);
    for i in 0..num_artmeshes {
        am_ids.push(unpack_id_64(
            &bytes[am_ids_off + i * 64..am_ids_off + (i + 1) * 64],
        ));
    }

    for i in 0..num_artmeshes {
        let id = am_ids[i].clone();
        if id == "__default_mesh__" && num_artmeshes == 1 {
            continue;
        }
        let kf_begin = (read_i32_le(bytes, am_kf_begin_off + i * 4).max(0) as usize)
            .min(num_artmesh_kfs.saturating_sub(1));
        let opacity = read_f32_le(bytes, am_kf_op_off + kf_begin * 4);
        let draw_order = read_f32_le(bytes, am_kf_do_off + kf_begin * 4) as i32;
        let pos_float_begin = read_i32_le(bytes, am_kf_pos_off + kf_begin * 4).max(0) as usize;

        let v_count = read_i32_le(bytes, am_vcount_off + i * 4).max(0) as usize;
        let uv_pair_begin = read_i32_le(bytes, am_uv_begin_off + i * 4).max(0) as usize;
        let mut vertices = Vec::with_capacity(v_count);
        let mut uvs = Vec::with_capacity(v_count);
        for v in 0..v_count {
            let vx = read_f32_le(bytes, pos_off + (pos_float_begin + v * 2) * 4);
            let vy = read_f32_le(bytes, pos_off + (pos_float_begin + v * 2 + 1) * 4);
            vertices.push([vx, vy]);
            let u = read_f32_le(bytes, uv_off + (uv_pair_begin + v) * 8);
            let tv = read_f32_le(bytes, uv_off + (uv_pair_begin + v) * 8 + 4);
            uvs.push([u, tv]);
        }

        let idx_begin = read_i32_le(bytes, am_idx_begin_off + i * 4).max(0) as usize;
        let idx_count = read_i32_le(bytes, am_idx_count_off + i * 4).max(0) as usize;
        let mut indices = Vec::with_capacity(idx_count);
        for k in 0..idx_count {
            indices.push(read_u16_le(bytes, idx_off + (idx_begin + k) * 2) as u32);
        }

        let mask_begin = read_i32_le(bytes, am_mask_begin_off + i * 4).max(0) as usize;
        let mask_count = read_i32_le(bytes, am_mask_count_off + i * 4).max(0) as usize;
        let mut mask_ids = Vec::with_capacity(mask_count);
        for k in 0..mask_count {
            let m_idx = read_i32_le(bytes, mask_off + (mask_begin + k) * 4);
            if m_idx >= 0 && (m_idx as usize) < num_artmeshes {
                mask_ids.push(am_ids[m_idx as usize].clone());
            }
        }

        let flag = bytes.get(am_flag_off + i).copied().unwrap_or(0);
        let blend_mode = match flag & 0x03 {
            1 => BlendMode::Additive,
            2 => BlendMode::Multiply,
            3 => BlendMode::Screen,
            _ => BlendMode::Normal,
        };
        let is_mask_inverted = (flag & (1 << 3)) != 0;
        let part_idx = read_i32_le(bytes, am_part_off + i * 4);
        let parent_id = if part_idx >= 0 && (part_idx as usize) < num_parts {
            let pid = &part_ids[part_idx as usize];
            if pid == "PartRoot" && num_parts == 1 {
                None
            } else {
                Some(pid.clone())
            }
        } else {
            None
        };

        nodes.push(Node {
            name: id.clone(),
            id,
            parent_id,
            visible: read_i32_le(bytes, am_vis_off + i * 4) != 0,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: "texture_00".into(),
                vertices,
                uvs,
                indices,
                blend_mode,
                opacity,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order,
                mask_ids,
                is_mask_inverted,
                morph_targets: vec![],
                hit_area_name: None,
                user_data: None,
            }),
        });
    }

    Ok(Project {
        format_version: 1,
        canvas: Canvas {
            width,
            height,
            origin_x,
            origin_y,
            background_color: "#18181b".into(),
        },
        parameters,
        nodes,
        keyforms: vec![],
        textures: vec![],
        glues: vec![],
        physics: vec![],
        animations: vec![],
        parameter_groups: vec![],
        pose_groups: vec![],
        expressions: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_moc3_pure_rust_roundtrip_and_section_layout() {
        let mut project = Project::default();
        project.canvas.width = 1920.0;
        project.canvas.height = 1080.0;
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
        project.nodes.push(Node {
            id: "mesh_face".into(),
            name: "Face Mesh".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: "t0".into(),
                vertices: vec![[100.0, 100.0], [200.0, 100.0], [150.0, 200.0]],
                uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.5, 1.0]],
                indices: vec![0, 1, 2],
                blend_mode: BlendMode::Normal,
                opacity: 1.0,
                multiply_color: [1.0, 1.0, 1.0, 1.0],
                screen_color: [0.0, 0.0, 0.0, 0.0],
                draw_order: 10,
                mask_ids: vec![],
                is_mask_inverted: false,
                morph_targets: vec![],
                hit_area_name: None,
                user_data: None,
            }),
        });
        project.keyforms.push(KeyformBinding {
            target_node_id: "mesh_face".into(),
            dimensions: vec![ParamDimension {
                param_id: "ParamAngleX".into(),
                keys: vec![-30.0, 0.0, 30.0],
                extended_interpolation: None,
            }],
            keyforms: vec![
                KeyformState {
                    coordinates: vec![-30.0],
                    payload: KeyformPayload::ArtMesh {
                        vertex_offsets: vec![[-15.0, 0.0], [-15.0, 0.0], [-15.0, 0.0]],
                        opacity: Some(1.0),
                        multiply_color: None,
                        screen_color: None,
                        draw_order: Some(10),
                    },
                },
                KeyformState {
                    coordinates: vec![0.0],
                    payload: KeyformPayload::ArtMesh {
                        vertex_offsets: vec![[0.0, 0.0], [0.0, 0.0], [0.0, 0.0]],
                        opacity: Some(1.0),
                        multiply_color: None,
                        screen_color: None,
                        draw_order: Some(10),
                    },
                },
                KeyformState {
                    coordinates: vec![30.0],
                    payload: KeyformPayload::ArtMesh {
                        vertex_offsets: vec![[20.0, 0.0], [20.0, 0.0], [20.0, 0.0]],
                        opacity: Some(1.0),
                        multiply_color: None,
                        screen_color: None,
                        draw_order: Some(10),
                    },
                },
            ],
        });

        for ver in 1..=5 {
            let bin = export_moc3_binary(&project, ver).expect("Failed to export MOC3");
            assert_eq!(&bin[0..4], b"MOC3");
            assert_eq!(bin[4], ver);
            assert_eq!(bin.len() % 64, 0);
            // Section 0 (EmCountInfo) always begins at byte 1984 (0x7C0)
            assert_eq!(read_u32_le(&bin, 64), 1984);

            let decoded = import_moc3_binary(&bin).expect("Failed to import MOC3");
            assert_eq!(decoded.canvas.width, 1920.0);
            assert_eq!(decoded.parameters.len(), 1);
            assert_eq!(decoded.nodes.len(), 1);
            assert_eq!(decoded.nodes[0].id, "mesh_face");

            // Also test stripping the L2D0 trailer to verify pure-binary section decoding
            let last_sec_idx = match ver {
                1 => 100,
                2 | 3 => 101,
                4 => 136,
                _ => 153,
            };
            let last_off = read_u32_le(&bin, 64 + last_sec_idx * 4) as usize;
            let mut pure_end = last_off + if ver >= 5 { 4 } else { 0 };
            if pure_end % 64 != 0 {
                pure_end += 64 - (pure_end % 64);
            }
            let pure_decoded =
                import_moc3_binary(&bin[..pure_end]).expect("Failed to decode pure MOC3 sections");
            assert_eq!(pure_decoded.canvas.width, 1920.0);
            assert_eq!(pure_decoded.parameters[0].id, "ParamAngleX");
            assert_eq!(pure_decoded.nodes.len(), 1);
            assert_eq!(pure_decoded.nodes[0].id, "mesh_face");
        }
    }
}
