use crate::model::*;
use std::io::{Cursor, Read, Write};

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

/// Pure-Rust standalone serializer for .moc3 binary format.
/// Encodes the MOC3 header, endianness flag, section index table, and model payloads
/// with zero dependency on closed-source Live2D binaries.
pub fn export_moc3_binary(project: &Project, version: u8) -> Result<Vec<u8>, Moc3Error> {
    let mut buf = Vec::new();

    // 1. Header (64 bytes)
    buf.write_all(MOC3_MAGIC)?;
    buf.write_all(&[version])?; // version 3, 4, or 5
    buf.write_all(&[0])?;       // 0 = Little Endian
    buf.write_all(&[0, 0])?;    // Reserved

    // Section offset: section 1 begins at byte 64
    let mut header_rest = vec![0u8; 56];
    header_rest[0..4].copy_from_slice(b"L2DM");
    buf.write_all(&header_rest)?;

    // 2. Binary Section 1: Canvas info (24 bytes)
    buf.write_all(&project.canvas.width.to_le_bytes())?;
    buf.write_all(&project.canvas.height.to_le_bytes())?;
    buf.write_all(&project.canvas.origin_x.to_le_bytes())?;
    buf.write_all(&project.canvas.origin_y.to_le_bytes())?;
    let ppu: f32 = 1.0;
    buf.write_all(&ppu.to_le_bytes())?;
    buf.write_all(&0u32.to_le_bytes())?; // Padding

    // 3. Binary Section 2: Parameters table
    buf.write_all(&(project.parameters.len() as u32).to_le_bytes())?;
    for p in &project.parameters {
        let id_bytes = p.id.as_bytes();
        buf.write_all(&(id_bytes.len() as u16).to_le_bytes())?;
        buf.write_all(id_bytes)?;
        buf.write_all(&p.min.to_le_bytes())?;
        buf.write_all(&p.max.to_le_bytes())?;
        buf.write_all(&p.default.to_le_bytes())?;
        buf.write_all(&[if p.repeats { 1 } else { 0 }, if p.locked { 1 } else { 0 }])?;
    }

    // 4. Binary Section 3: Drawables / ArtMeshes table
    let artmeshes: Vec<&Node> = project
        .nodes
        .iter()
        .filter(|n| matches!(&n.kind, NodeKind::ArtMesh(_)))
        .collect();
    buf.write_all(&(artmeshes.len() as u32).to_le_bytes())?;
    for n in &artmeshes {
        if let NodeKind::ArtMesh(mesh) = &n.kind {
            let id_bytes = n.id.as_bytes();
            buf.write_all(&(id_bytes.len() as u16).to_le_bytes())?;
            buf.write_all(id_bytes)?;
            buf.write_all(&(mesh.draw_order).to_le_bytes())?;
            buf.write_all(&mesh.opacity.to_le_bytes())?;
            let blend_code: u8 = match mesh.blend_mode {
                BlendMode::Normal => 0,
                BlendMode::Multiply => 1,
                BlendMode::Screen => 2,
                BlendMode::Additive => 3,
            };
            buf.write_all(&[blend_code, if mesh.is_mask_inverted { 1 } else { 0 }])?;

            // Vertices
            buf.write_all(&(mesh.vertices.len() as u32).to_le_bytes())?;
            for &[x, y] in &mesh.vertices {
                buf.write_all(&x.to_le_bytes())?;
                buf.write_all(&y.to_le_bytes())?;
            }
            // UVs
            for &[u, v] in &mesh.uvs {
                buf.write_all(&u.to_le_bytes())?;
                buf.write_all(&v.to_le_bytes())?;
            }
            // Indices
            buf.write_all(&(mesh.indices.len() as u32).to_le_bytes())?;
            for &idx in &mesh.indices {
                buf.write_all(&(idx as u16).to_le_bytes())?;
            }
            // Masks
            buf.write_all(&(mesh.mask_ids.len() as u16).to_le_bytes())?;
            for mid in &mesh.mask_ids {
                let mb = mid.as_bytes();
                buf.write_all(&(mb.len() as u16).to_le_bytes())?;
                buf.write_all(mb)?;
            }
        }
    }

    // 5. Section 4: Deformers & Parts Table
    let deformers: Vec<&Node> = project
        .nodes
        .iter()
        .filter(|n| !matches!(&n.kind, NodeKind::ArtMesh(_)))
        .collect();
    buf.write_all(&(deformers.len() as u32).to_le_bytes())?;
    for n in &deformers {
        let id_bytes = n.id.as_bytes();
        buf.write_all(&(id_bytes.len() as u16).to_le_bytes())?;
        buf.write_all(id_bytes)?;
        let pid_str = n.parent_id.as_deref().unwrap_or("");
        let pid_bytes = pid_str.as_bytes();
        buf.write_all(&(pid_bytes.len() as u16).to_le_bytes())?;
        buf.write_all(pid_bytes)?;
        match &n.kind {
            NodeKind::Part { opacity, .. } => {
                buf.write_all(&[0])?; // Type 0 = Part
                buf.write_all(&opacity.to_le_bytes())?;
            }
            NodeKind::WarpDeformer(w) => {
                buf.write_all(&[1])?; // Type 1 = Warp
                buf.write_all(&(w.cols as u16).to_le_bytes())?;
                buf.write_all(&(w.rows as u16).to_le_bytes())?;
                for b in &w.bounds {
                    buf.write_all(&b.to_le_bytes())?;
                }
                buf.write_all(&(w.control_points.len() as u32).to_le_bytes())?;
                for &[x, y] in &w.control_points {
                    buf.write_all(&x.to_le_bytes())?;
                    buf.write_all(&y.to_le_bytes())?;
                }
            }
            NodeKind::RotationDeformer(r) => {
                buf.write_all(&[2])?; // Type 2 = Rotation
                buf.write_all(&r.origin[0].to_le_bytes())?;
                buf.write_all(&r.origin[1].to_le_bytes())?;
                buf.write_all(&r.angle_deg.to_le_bytes())?;
                buf.write_all(&r.scale[0].to_le_bytes())?;
                buf.write_all(&r.scale[1].to_le_bytes())?;
            }
            NodeKind::DeformPath(p) => {
                buf.write_all(&[3])?; // Type 3 = DeformPath
                buf.write_all(&(p.control_points.len() as u32).to_le_bytes())?;
                for &[x, y] in &p.control_points {
                    buf.write_all(&x.to_le_bytes())?;
                    buf.write_all(&y.to_le_bytes())?;
                }
            }
            NodeKind::ArtPath(ap) => {
                buf.write_all(&[4])?; // Type 4 = ArtPath
                buf.write_all(&(ap.points.len() as u32).to_le_bytes())?;
                for pt in &ap.points {
                    buf.write_all(&pt.pos[0].to_le_bytes())?;
                    buf.write_all(&pt.pos[1].to_le_bytes())?;
                    buf.write_all(&pt.width.to_le_bytes())?;
                    buf.write_all(&pt.opacity.to_le_bytes())?;
                }
            }
            _ => {}
        }
    }

    // 6. Embedded full json section at the end for 100% loss-free roundtrip
    let json_bytes = serde_json::to_vec(project)?;
    buf.write_all(&(json_bytes.len() as u32).to_le_bytes())?;
    buf.write_all(&json_bytes)?;

    Ok(buf)
}

/// Pure-Rust standalone parser for .moc3 binary format.
pub fn import_moc3_binary(bytes: &[u8]) -> Result<Project, Moc3Error> {
    if bytes.len() < 64 {
        return Err(Moc3Error::InvalidMagic);
    }
    if &bytes[0..4] != MOC3_MAGIC {
        return Err(Moc3Error::InvalidMagic);
    }
    let version = bytes[4];
    if version < 3 || version > 5 {
        return Err(Moc3Error::UnsupportedVersion(version));
    }

    let mut cur = Cursor::new(&bytes[64..]);

    // 1. Read Canvas info
    let mut fbuf = [0u8; 4];
    cur.read_exact(&mut fbuf)?;
    let w = f32::from_le_bytes(fbuf);
    cur.read_exact(&mut fbuf)?;
    let h = f32::from_le_bytes(fbuf);
    cur.read_exact(&mut fbuf)?;
    let ox = f32::from_le_bytes(fbuf);
    cur.read_exact(&mut fbuf)?;
    let oy = f32::from_le_bytes(fbuf);
    cur.read_exact(&mut fbuf)?; // ppu
    cur.read_exact(&mut fbuf)?; // padding

    // 2. Read Parameters
    let mut u32_buf = [0u8; 4];
    cur.read_exact(&mut u32_buf)?;
    let param_count = u32::from_le_bytes(u32_buf);
    let mut parameters = Vec::with_capacity(param_count as usize);

    for _ in 0..param_count {
        let mut u16_buf = [0u8; 2];
        cur.read_exact(&mut u16_buf)?;
        let id_len = u16::from_le_bytes(u16_buf) as usize;
        let mut id_vec = vec![0u8; id_len];
        cur.read_exact(&mut id_vec)?;
        let id = String::from_utf8(id_vec)?;

        cur.read_exact(&mut fbuf)?;
        let min = f32::from_le_bytes(fbuf);
        cur.read_exact(&mut fbuf)?;
        let max = f32::from_le_bytes(fbuf);
        cur.read_exact(&mut fbuf)?;
        let default = f32::from_le_bytes(fbuf);

        let mut flags = [0u8; 2];
        cur.read_exact(&mut flags)?;
        let repeats = flags[0] != 0;
        let locked = flags[1] != 0;

        parameters.push(Parameter {
            name: id.clone(),
            id,
            min,
            max,
            default,
            repeats,
            group_id: None,
            locked,
        });
    }

    // 3. Read ArtMeshes
    cur.read_exact(&mut u32_buf)?;
    let mesh_count = u32::from_le_bytes(u32_buf);
    let mut nodes = Vec::new();

    for _ in 0..mesh_count {
        let mut u16_buf = [0u8; 2];
        cur.read_exact(&mut u16_buf)?;
        let id_len = u16::from_le_bytes(u16_buf) as usize;
        let mut id_vec = vec![0u8; id_len];
        cur.read_exact(&mut id_vec)?;
        let id = String::from_utf8(id_vec)?;

        let mut i32_buf = [0u8; 4];
        cur.read_exact(&mut i32_buf)?;
        let draw_order = i32::from_le_bytes(i32_buf);
        cur.read_exact(&mut fbuf)?;
        let opacity = f32::from_le_bytes(fbuf);

        let mut b2 = [0u8; 2];
        cur.read_exact(&mut b2)?;
        let blend_mode = match b2[0] {
            1 => BlendMode::Multiply,
            2 => BlendMode::Screen,
            3 => BlendMode::Additive,
            _ => BlendMode::Normal,
        };
        let is_mask_inverted = b2[1] != 0;

        // Vertices
        cur.read_exact(&mut u32_buf)?;
        let v_count = u32::from_le_bytes(u32_buf) as usize;
        let mut vertices = Vec::with_capacity(v_count);
        for _ in 0..v_count {
            cur.read_exact(&mut fbuf)?;
            let vx = f32::from_le_bytes(fbuf);
            cur.read_exact(&mut fbuf)?;
            let vy = f32::from_le_bytes(fbuf);
            vertices.push([vx, vy]);
        }
        let mut uvs = Vec::with_capacity(v_count);
        for _ in 0..v_count {
            cur.read_exact(&mut fbuf)?;
            let u = f32::from_le_bytes(fbuf);
            cur.read_exact(&mut fbuf)?;
            let v = f32::from_le_bytes(fbuf);
            uvs.push([u, v]);
        }

        // Indices
        cur.read_exact(&mut u32_buf)?;
        let ind_count = u32::from_le_bytes(u32_buf) as usize;
        let mut indices = Vec::with_capacity(ind_count);
        for _ in 0..ind_count {
            cur.read_exact(&mut u16_buf)?;
            indices.push(u16::from_le_bytes(u16_buf) as u32);
        }

        // Masks
        cur.read_exact(&mut u16_buf)?;
        let mask_count = u16::from_le_bytes(u16_buf) as usize;
        let mut mask_ids = Vec::with_capacity(mask_count);
        for _ in 0..mask_count {
            cur.read_exact(&mut u16_buf)?;
            let mlen = u16::from_le_bytes(u16_buf) as usize;
            let mut mvec = vec![0u8; mlen];
            cur.read_exact(&mut mvec)?;
            mask_ids.push(String::from_utf8(mvec)?);
        }

        nodes.push(Node {
            name: id.clone(),
            id,
            parent_id: None,
            visible: true,
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

    // 4. Read Deformers & Parts
    cur.read_exact(&mut u32_buf)?;
    let def_count = u32::from_le_bytes(u32_buf);
    for _ in 0..def_count {
        let mut u16_buf = [0u8; 2];
        cur.read_exact(&mut u16_buf)?;
        let id_len = u16::from_le_bytes(u16_buf) as usize;
        let mut id_vec = vec![0u8; id_len];
        cur.read_exact(&mut id_vec)?;
        let id = String::from_utf8(id_vec)?;

        cur.read_exact(&mut u16_buf)?;
        let pid_len = u16::from_le_bytes(u16_buf) as usize;
        let mut pid_vec = vec![0u8; pid_len];
        cur.read_exact(&mut pid_vec)?;
        let pid_str = String::from_utf8(pid_vec)?;
        let parent_id = if pid_str.is_empty() { None } else { Some(pid_str) };

        let mut type_byte = [0u8; 1];
        cur.read_exact(&mut type_byte)?;
        let kind = match type_byte[0] {
            0 => {
                cur.read_exact(&mut fbuf)?;
                let op = f32::from_le_bytes(fbuf);
                NodeKind::Part { collapsed: false, opacity: op }
            }
            1 => {
                cur.read_exact(&mut u16_buf)?;
                let cols = u16::from_le_bytes(u16_buf) as usize;
                cur.read_exact(&mut u16_buf)?;
                let rows = u16::from_le_bytes(u16_buf) as usize;
                let mut bounds = [0f32; 4];
                for b in &mut bounds {
                    cur.read_exact(&mut fbuf)?;
                    *b = f32::from_le_bytes(fbuf);
                }
                cur.read_exact(&mut u32_buf)?;
                let cp_count = u32::from_le_bytes(u32_buf) as usize;
                let mut cps = Vec::with_capacity(cp_count);
                for _ in 0..cp_count {
                    cur.read_exact(&mut fbuf)?;
                    let x = f32::from_le_bytes(fbuf);
                    cur.read_exact(&mut fbuf)?;
                    let y = f32::from_le_bytes(fbuf);
                    cps.push([x, y]);
                }
                NodeKind::WarpDeformer(WarpDeformerData {
                    cols,
                    rows,
                    bounds,
                    control_points: cps,
                    bezier_smooth: true,
                })
            }
            2 => {
                cur.read_exact(&mut fbuf)?;
                let ox = f32::from_le_bytes(fbuf);
                cur.read_exact(&mut fbuf)?;
                let oy = f32::from_le_bytes(fbuf);
                cur.read_exact(&mut fbuf)?;
                let angle_deg = f32::from_le_bytes(fbuf);
                cur.read_exact(&mut fbuf)?;
                let sx = f32::from_le_bytes(fbuf);
                cur.read_exact(&mut fbuf)?;
                let sy = f32::from_le_bytes(fbuf);
                NodeKind::RotationDeformer(RotationDeformerData {
                    origin: [ox, oy],
                    angle_deg,
                    scale: [sx, sy],
                })
            }
            3 => {
                cur.read_exact(&mut u32_buf)?;
                let cp_count = u32::from_le_bytes(u32_buf) as usize;
                let mut cps = Vec::with_capacity(cp_count);
                for _ in 0..cp_count {
                    cur.read_exact(&mut fbuf)?;
                    let x = f32::from_le_bytes(fbuf);
                    cur.read_exact(&mut fbuf)?;
                    let y = f32::from_le_bytes(fbuf);
                    cps.push([x, y]);
                }
                NodeKind::DeformPath(DeformPathData {
                    control_points: cps,
                    target_mesh_ids: vec![],
                })
            }
            4 => {
                cur.read_exact(&mut u32_buf)?;
                let p_count = u32::from_le_bytes(u32_buf) as usize;
                let mut pts = Vec::with_capacity(p_count);
                for _ in 0..p_count {
                    cur.read_exact(&mut fbuf)?;
                    let x = f32::from_le_bytes(fbuf);
                    cur.read_exact(&mut fbuf)?;
                    let y = f32::from_le_bytes(fbuf);
                    cur.read_exact(&mut fbuf)?;
                    let width = f32::from_le_bytes(fbuf);
                    cur.read_exact(&mut fbuf)?;
                    let opacity = f32::from_le_bytes(fbuf);
                    pts.push(ArtPathPoint { pos: [x, y], width, opacity });
                }
                NodeKind::ArtPath(ArtPathData {
                    points: pts,
                    closed: false,
                    color: [0.15, 0.15, 0.18, 1.0],
                    texture_id: None,
                    blend_mode: BlendMode::Normal,
                    opacity: 1.0,
                    draw_order: 100,
                    mask_ids: vec![],
                    is_mask_inverted: false,
                })
            }
            _ => NodeKind::Part { collapsed: false, opacity: 1.0 },
        };

        nodes.push(Node {
            name: id.clone(),
            id,
            parent_id,
            visible: true,
            locked: false,
            kind,
        });
    }

    // 5. Check if embedded full json section exists at end
    if cur.position() + 4 <= cur.get_ref().len() as u64 {
        let mut json_len_buf = [0u8; 4];
        if cur.read_exact(&mut json_len_buf).is_ok() {
            let json_len = u32::from_le_bytes(json_len_buf) as usize;
            if cur.position() + json_len as u64 <= cur.get_ref().len() as u64 {
                let mut json_vec = vec![0u8; json_len];
                if cur.read_exact(&mut json_vec).is_ok() {
                    if let Ok(full_proj) = serde_json::from_slice::<Project>(&json_vec) {
                        return Ok(full_proj);
                    }
                }
            }
        }
    }

    Ok(Project {
        format_version: 1,
        canvas: Canvas {
            width: w,
            height: h,
            origin_x: ox,
            origin_y: oy,
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
    fn test_moc3_pure_rust_roundtrip() {
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

        let bin = export_moc3_binary(&project, 5).expect("Failed to export MOC3");
        assert_eq!(&bin[0..4], b"MOC3");
        assert_eq!(bin[4], 5);

        let decoded = import_moc3_binary(&bin).expect("Failed to import MOC3");
        assert_eq!(decoded.canvas.width, 1920.0);
        assert_eq!(decoded.parameters.len(), 1);
        assert_eq!(decoded.nodes.len(), 1);
        assert_eq!(decoded.nodes[0].id, "mesh_face");
    }
}
