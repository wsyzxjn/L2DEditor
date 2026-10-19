use super::{
    export_moc3_binary, export_moc3_binary_with_options, import_moc3_binary, Moc3Error,
    Moc3ExportOptions,
};
use crate::model::*;
use std::collections::HashMap;

fn parameter(id: &str, min: f32, max: f32) -> Parameter {
    Parameter {
        id: id.into(),
        name: id.into(),
        min,
        max,
        default: 0.0,
        repeats: false,
        group_id: None,
        locked: false,
    }
}

fn mesh(parent: &str) -> Node {
    Node {
        id: "mesh_face".into(),
        name: "Face".into(),
        parent_id: Some(parent.into()),
        visible: true,
        locked: false,
        kind: NodeKind::ArtMesh(ArtMeshData {
            texture_id: "tex".into(),
            vertices: vec![[10.0, 10.0], [30.0, 10.0], [20.0, 30.0]],
            uvs: vec![[0.0, 0.0], [1.0, 0.0], [0.5, 1.0]],
            indices: vec![0, 1, 2],
            blend_mode: BlendMode::Normal,
            opacity: 1.0,
            multiply_color: [1.0, 1.0, 1.0, 1.0],
            screen_color: [0.0, 0.0, 0.0, 0.0],
            draw_order: 10,
            mask_ids: Vec::new(),
            is_mask_inverted: false,
            morph_targets: Vec::new(),
            hit_area_name: None,
            user_data: None,
        }),
    }
}

fn nested_project() -> Project {
    let mut project = Project::default();
    project.parameters = vec![
        parameter("ParamOuter", -1.0, 1.0),
        parameter("ParamInner", -1.0, 1.0),
    ];
    project.nodes = vec![
        Node {
            id: "PartRoot".into(),
            name: "Root".into(),
            parent_id: None,
            visible: true,
            locked: false,
            kind: NodeKind::Part {
                collapsed: false,
                opacity: 1.0,
            },
        },
        Node {
            id: "PartBody".into(),
            name: "Body".into(),
            parent_id: Some("PartRoot".into()),
            visible: true,
            locked: false,
            kind: NodeKind::Part {
                collapsed: false,
                opacity: 1.0,
            },
        },
        Node {
            id: "warp_outer".into(),
            name: "Outer warp".into(),
            parent_id: Some("PartBody".into()),
            visible: true,
            locked: false,
            kind: NodeKind::WarpDeformer(WarpDeformerData {
                cols: 1,
                rows: 1,
                bounds: [0.0, 0.0, 40.0, 40.0],
                control_points: vec![[0.0, 0.0], [40.0, 0.0], [0.0, 40.0], [40.0, 40.0]],
                bezier_smooth: false,
            }),
        },
        Node {
            id: "rotation_inner".into(),
            name: "Inner rotation".into(),
            parent_id: Some("warp_outer".into()),
            visible: true,
            locked: false,
            kind: NodeKind::RotationDeformer(RotationDeformerData {
                origin: [20.0, 20.0],
                angle_deg: 0.0,
                scale: [1.0, 1.0],
            }),
        },
        mesh("rotation_inner"),
    ];
    project.keyforms = vec![
        KeyformBinding {
            target_node_id: "warp_outer".into(),
            dimensions: vec![ParamDimension {
                param_id: "ParamOuter".into(),
                keys: vec![-1.0, 0.0, 1.0],
                extended_interpolation: None,
            }],
            keyforms: [-2.0f32, 0.0, 2.0]
                .into_iter()
                .map(|shift| KeyformState {
                    coordinates: vec![if shift < 0.0 {
                        -1.0
                    } else if shift > 0.0 {
                        1.0
                    } else {
                        0.0
                    }],
                    payload: KeyformPayload::Warp {
                        control_points: vec![
                            [shift, 0.0],
                            [40.0 + shift, 0.0],
                            [shift, 40.0],
                            [40.0 + shift, 40.0],
                        ],
                    },
                })
                .collect(),
        },
        KeyformBinding {
            target_node_id: "rotation_inner".into(),
            dimensions: vec![ParamDimension {
                param_id: "ParamInner".into(),
                keys: vec![-1.0, 0.0, 1.0],
                extended_interpolation: None,
            }],
            keyforms: [-20.0, 0.0, 20.0]
                .into_iter()
                .map(|angle| KeyformState {
                    coordinates: vec![if angle < 0.0 {
                        -1.0
                    } else if angle > 0.0 {
                        1.0
                    } else {
                        0.0
                    }],
                    payload: KeyformPayload::Rotation {
                        origin: [20.0, 20.0],
                        angle_deg: angle,
                        scale: [1.0, 1.0],
                    },
                })
                .collect(),
        },
        KeyformBinding {
            target_node_id: "mesh_face".into(),
            dimensions: vec![ParamDimension {
                param_id: "ParamInner".into(),
                keys: vec![-1.0, 0.0, 1.0],
                extended_interpolation: None,
            }],
            keyforms: [
                (vec![-1.0], 1.0, 1.0),
                (vec![0.0], 0.0, 0.0),
                (vec![1.0], 1.0, 2.0),
            ]
            .into_iter()
            .map(|(coordinates, opacity, shift)| KeyformState {
                coordinates,
                payload: KeyformPayload::ArtMesh {
                    vertex_offsets: vec![[shift, 0.0]; 3],
                    opacity: Some(opacity),
                    multiply_color: None,
                    screen_color: None,
                    draw_order: Some(10),
                },
            })
            .collect(),
        },
    ];
    project.textures = vec![TextureMeta {
        id: "tex".into(),
        path: "textures/tex.png".into(),
        width: 64,
        height: 64,
        content_hash: Some("abc".into()),
    }];
    project
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

fn section(bytes: &[u8], index: usize) -> usize {
    read_u32(bytes, 64 + index * 4) as usize
}

#[test]
fn exports_real_nested_deformers_and_transparent_keyforms_without_trailer() {
    let project = nested_project();
    let binary = export_moc3_binary(&project, 5).expect("export");
    assert!(!binary.windows(4).any(|window| window == b"L2D0"));
    let counts = section(&binary, 0);
    assert_eq!(read_u32(&binary, counts), 2); // parts
    assert_eq!(read_u32(&binary, counts + 4), 3); // root + warp + rotation
    assert_eq!(read_u32(&binary, counts + 8), 1); // warp
    assert_eq!(read_u32(&binary, counts + 12), 2); // rotations
    assert_eq!(read_u32(&binary, counts + 16), 1); // art meshes
    assert_eq!(read_u32(&binary, counts + 28), 3); // warp keyforms
    assert_eq!(read_u32(&binary, counts + 32), 4); // root + rotation keyforms
    assert_eq!(read_u32(&binary, counts + 36), 3); // artmesh keyforms

    let artmesh_opacity = section(&binary, 68);
    let opacities = (0..3)
        .map(|index| {
            f32::from_le_bytes(
                binary[artmesh_opacity + index * 4..artmesh_opacity + index * 4 + 4]
                    .try_into()
                    .unwrap(),
            )
        })
        .collect::<Vec<_>>();
    assert!(opacities.contains(&0.0));

    let artmesh_band = section(&binary, 34);
    let artmesh_count = section(&binary, 36);
    assert!(read_u32(&binary, artmesh_band) < read_u32(&binary, counts + 48));
    assert_eq!(read_u32(&binary, artmesh_count), 3);

    let decoded = import_moc3_binary(&binary).expect("body import");
    let ids = decoded
        .nodes
        .iter()
        .map(|node| node.id.as_str())
        .collect::<Vec<_>>();
    assert!(ids.contains(&"warp_outer"));
    assert!(ids.contains(&"rotation_inner"));
    assert!(ids.contains(&"mesh_face"));
    let warp = decoded
        .nodes
        .iter()
        .find(|node| node.id == "warp_outer")
        .unwrap();
    assert!(matches!(
        &warp.kind,
        NodeKind::WarpDeformer(data) if data.bounds == [0.0, 0.0, 1.0, 1.0]
    ));
    let rotation = decoded
        .nodes
        .iter()
        .find(|node| node.id == "rotation_inner")
        .unwrap();
    assert_eq!(rotation.parent_id.as_deref(), Some("warp_outer"));
    assert_eq!(warp.parent_id.as_deref(), Some("PartBody"));
    let mesh_binding = decoded
        .keyforms
        .iter()
        .find(|binding| binding.target_node_id == "mesh_face")
        .unwrap();
    assert!(mesh_binding.keyforms.iter().any(|state| {
        matches!(
            state.payload,
            KeyformPayload::ArtMesh {
                opacity: Some(opacity),
                ..
            } if opacity == 0.0
        )
    }));
}

#[test]
fn source_project_trailer_is_opt_in() {
    let project = nested_project();
    let without = export_moc3_binary(&project, 5).unwrap();
    assert!(!without.windows(4).any(|window| window == b"L2D0"));
    let decoded = import_moc3_binary(&without).unwrap();
    assert!(decoded.textures.is_empty());

    let with = export_moc3_binary_with_options(
        &project,
        5,
        Moc3ExportOptions {
            embed_source_project: true,
        },
    )
    .unwrap();
    assert!(with.windows(4).any(|window| window == b"L2D0"));
    let decoded = import_moc3_binary(&with).unwrap();
    assert_eq!(decoded.textures, project.textures);
}

#[test]
fn runtime_coordinates_round_trip_geometry_through_non_uniform_warp() {
    let mut project = nested_project();
    let NodeKind::WarpDeformer(outer) = &mut project.nodes[2].kind else {
        panic!("expected outer warp");
    };
    outer.bounds = [0.0, 0.0, 40.0, 20.0];

    let binary = export_moc3_binary(&project, 5).expect("export");
    let decoded = import_moc3_binary(&binary).expect("read back");

    for (outer, inner) in [(-1.0, -20.0), (0.0, 0.0), (1.0, 20.0)] {
        let parameters = HashMap::from([
            ("ParamOuter".to_string(), outer),
            ("ParamInner".to_string(), inner),
        ]);
        let options = crate::evaluator::EvaluateOptions {
            keep_culled_drawables: true,
        };
        let expected =
            crate::evaluator::evaluate_project_with_options(&project, &parameters, options);
        let actual =
            crate::evaluator::evaluate_project_with_options(&decoded, &parameters, options);
        let expected_mesh = expected
            .meshes
            .iter()
            .find(|mesh| mesh.id == "mesh_face")
            .unwrap_or_else(|| {
                panic!(
                    "source mesh missing at ({outer}, {inner}); got {:?}",
                    expected
                        .meshes
                        .iter()
                        .map(|mesh| (&mesh.id, mesh.opacity))
                        .collect::<Vec<_>>()
                )
            });
        let actual_mesh = actual
            .meshes
            .iter()
            .find(|mesh| mesh.id == "mesh_face")
            .expect("decoded mesh");
        assert_eq!(expected_mesh.vertices.len(), actual_mesh.vertices.len());
        for (expected, actual) in expected_mesh
            .vertices
            .iter()
            .zip(actual_mesh.vertices.iter())
        {
            assert!(
                (expected[0] - actual[0]).abs() <= 1e-3 && (expected[1] - actual[1]).abs() <= 1e-3,
                "runtime round-trip at ({outer}, {inner}) moved vertex from {expected:?} to \
                 {actual:?}"
            );
        }
    }
}

#[test]
fn artmesh_uv_offsets_point_into_the_float_pool() {
    let mut project = nested_project();
    let mut second = mesh("PartBody");
    second.id = "mesh_second".into();
    if let NodeKind::ArtMesh(data) = &mut second.kind {
        data.uvs = vec![[0.25, 0.2], [0.75, 0.2], [0.5, 0.8]];
    }
    project.nodes.push(second);

    let binary = export_moc3_binary(&project, 5).expect("export");
    let decoded = import_moc3_binary(&binary).expect("read back");
    for (mesh_id, expected) in [
        ("mesh_face", [[0.0, 0.0], [1.0, 0.0], [0.5, 1.0]]),
        ("mesh_second", [[0.25, 0.2], [0.75, 0.2], [0.5, 0.8]]),
    ] {
        let node = decoded
            .nodes
            .iter()
            .find(|node| node.id == mesh_id)
            .expect("decoded mesh");
        let NodeKind::ArtMesh(data) = &node.kind else {
            panic!("expected ArtMesh `{mesh_id}`");
        };
        assert_eq!(data.uvs.len(), expected.len());
        for (actual, expected) in data.uvs.iter().zip(expected) {
            assert!(
                (actual[0] - expected[0]).abs() <= 1e-6 && (actual[1] - expected[1]).abs() <= 1e-6,
                "UV round-trip changed {mesh_id}: {actual:?} != {expected:?}"
            );
        }
    }
}

#[test]
fn corrupted_sections_return_errors_without_panicking() {
    let project = nested_project();
    let binary = export_moc3_binary(&project, 5).unwrap();
    let counts = section(&binary, 0);

    let mut corrupt = binary.clone();
    corrupt[counts..counts + 4].copy_from_slice(&u32::MAX.to_le_bytes());
    assert!(import_moc3_binary(&corrupt).is_err());

    let mut corrupt = binary.clone();
    let param_ids = section(&binary, 50);
    corrupt[64 + 50 * 4..64 + 51 * 4].copy_from_slice(&(binary.len() as u32 - 1).to_le_bytes());
    assert!(import_moc3_binary(&corrupt).is_err());
    assert!(param_ids < binary.len());

    for length in (0..binary.len()).step_by(257) {
        let result = std::panic::catch_unwind(|| import_moc3_binary(&binary[..length]));
        assert!(result.is_ok(), "panic while importing {length} bytes");
        if length < 1984 {
            assert!(
                result.unwrap().is_err(),
                "short input unexpectedly imported"
            );
        }
    }
}

#[test]
fn rejects_ids_and_vertex_indices_that_do_not_fit_moc3() {
    let mut project = nested_project();
    project.nodes[4].id = "X".repeat(64);
    project.keyforms[2].target_node_id = project.nodes[4].id.clone();
    assert!(matches!(
        export_moc3_binary(&project, 5),
        Err(Moc3Error::Export(_))
    ));

    let mut project = nested_project();
    if let NodeKind::ArtMesh(mesh) = &mut project.nodes[4].kind {
        mesh.indices[0] = 99;
    }
    assert!(matches!(
        export_moc3_binary(&project, 5),
        Err(Moc3Error::Export(_))
    ));
}

#[test]
#[ignore = "set L2D_TEST_PROJECT to an external project.json to run this integration check"]
fn external_project_is_exported_without_a_project_trailer() {
    let path = std::env::var("L2D_TEST_PROJECT")
        .expect("set L2D_TEST_PROJECT to an external project.json");
    let path = std::path::Path::new(&path);
    let project: Project =
        serde_json::from_slice(&std::fs::read(path).expect("read external project"))
            .expect("parse external project");
    let binary = export_moc3_binary(&project, 5).expect("export external project");
    assert!(!binary.windows(4).any(|window| window == b"L2D0"));
    let counts = section(&binary, 0);
    assert!(read_u32(&binary, counts + 4) >= 17);
    assert!(read_u32(&binary, counts + 8) >= 16);
    assert!(read_u32(&binary, counts + 12) >= 1);
    let decoded = import_moc3_binary(&binary).expect("decode exported project");
    let deformer_count = decoded
        .nodes
        .iter()
        .filter(|node| {
            matches!(
                node.kind,
                NodeKind::WarpDeformer(_) | NodeKind::RotationDeformer(_)
            )
        })
        .count();
    assert!(deformer_count >= 16);
    let mesh_binding = decoded
        .keyforms
        .iter()
        .find(|binding| binding.target_node_id == "eye_l_hidden_white");
    assert!(mesh_binding.is_some_and(|binding| binding.keyforms.len() >= 2500));
    let opacity_zero = decoded
        .keyforms
        .iter()
        .flat_map(|binding| binding.keyforms.iter())
        .any(|state| {
            matches!(
                state.payload,
                KeyformPayload::ArtMesh {
                    opacity: Some(opacity),
                    ..
                } if opacity <= f32::EPSILON
            )
        });
    assert!(opacity_zero);
    let lash = decoded
        .keyforms
        .iter()
        .find(|binding| binding.target_node_id == "eye_l_lash")
        .expect("eye lash binding");
    let near_closed_state = lash
        .keyforms
        .iter()
        .find(|state| {
            state
                .coordinates
                .last()
                .is_some_and(|coordinate| (coordinate - 0.7499).abs() <= 1e-4)
        })
        .expect("near-closed lash keyform");
    assert!(matches!(
        near_closed_state.payload,
        KeyformPayload::ArtMesh {
            opacity: Some(0.0),
            ..
        }
    ));
    let eye_white = decoded
        .keyforms
        .iter()
        .find(|binding| binding.target_node_id == "eye_l_white")
        .expect("eye white binding");
    let opacity_at = |target: f32| {
        eye_white
            .keyforms
            .iter()
            .find(|state| {
                state
                    .coordinates
                    .last()
                    .is_some_and(|coordinate| (coordinate - target).abs() <= 1e-5)
            })
            .and_then(|state| match state.payload {
                KeyformPayload::ArtMesh { opacity, .. } => opacity,
                _ => None,
            })
    };
    assert_eq!(opacity_at(0.2499), Some(0.0));
    assert_eq!(opacity_at(0.25), Some(1.0));

    let params = project
        .parameters
        .iter()
        .map(|parameter| (parameter.id.clone(), parameter.default))
        .collect::<HashMap<_, _>>();
    let frame = crate::evaluator::evaluate_project(&project, &params);
    assert!(!frame.meshes.is_empty());
}
