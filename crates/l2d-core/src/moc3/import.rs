use super::common::{
    checked_add, checked_range, find_source_project, read_f32, read_f32_array, read_i32,
    read_i32_array, read_u16_array, read_u32_array, unpack_id_64, Moc3Error, BODY_OFFSET,
    MOC3_MAGIC,
};
use crate::model::*;
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
struct BinaryPart {
    id: String,
    visible: bool,
    parent_index: i32,
}

#[derive(Clone)]
struct BinaryDeformer {
    id: String,
    visible: bool,
    parent_part_index: i32,
    parent_deformer_index: i32,
    deformer_type: i32,
    specific_index: usize,
    keyform_band_index: i32,
}

struct BindingTables {
    band_begin: Vec<i32>,
    band_count: Vec<i32>,
    binding_indices: Vec<i32>,
    keys_begin: Vec<i32>,
    keys_count: Vec<i32>,
    keys: Vec<f32>,
    binding_to_parameter: Vec<Option<usize>>,
}

impl BindingTables {
    fn dimensions(
        &self,
        band_index: i32,
        parameters: &[Parameter],
    ) -> Result<Vec<ParamDimension>, Moc3Error> {
        if band_index < 0 {
            return Ok(Vec::new());
        }
        let band_index = band_index as usize;
        let Some(&begin) = self.band_begin.get(band_index) else {
            return Err(Moc3Error::InvalidData(format!(
                "keyform band index {band_index} is out of range"
            )));
        };
        let Some(&count) = self.band_count.get(band_index) else {
            return Err(Moc3Error::InvalidData(format!(
                "keyform band count index {band_index} is out of range"
            )));
        };
        if begin < 0 || count < 0 {
            return Err(Moc3Error::InvalidData(format!(
                "keyform band {band_index} has a negative begin/count"
            )));
        }
        let begin = begin as usize;
        let count = count as usize;
        let end = checked_add(begin, count, "keyform band binding range")?;
        if end > self.binding_indices.len() {
            return Err(Moc3Error::InvalidData(format!(
                "keyform band {band_index} points outside the binding index array"
            )));
        }
        let mut dimensions = Vec::with_capacity(count);
        for &binding_index in &self.binding_indices[begin..end] {
            if binding_index < 0 {
                return Err(Moc3Error::InvalidData(format!(
                    "keyform band {band_index} references a negative binding"
                )));
            }
            let binding_index = binding_index as usize;
            let Some(&parameter_index) = self.binding_to_parameter.get(binding_index) else {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} is out of range"
                )));
            };
            let Some(parameter_index) = parameter_index else {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} is not owned by any parameter"
                )));
            };
            let Some(parameter) = parameters.get(parameter_index) else {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} references missing parameter {parameter_index}"
                )));
            };
            let Some(&key_begin) = self.keys_begin.get(binding_index) else {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} has no key begin"
                )));
            };
            let Some(&key_count) = self.keys_count.get(binding_index) else {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} has no key count"
                )));
            };
            if key_begin < 0 || key_count <= 0 {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} has an invalid key range"
                )));
            }
            let key_begin = key_begin as usize;
            let key_count = key_count as usize;
            let key_end = checked_add(key_begin, key_count, "parameter binding keys")?;
            if key_end > self.keys.len() {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} points outside the keys array"
                )));
            }
            let mut keys = self.keys[key_begin..key_end].to_vec();
            if keys.iter().any(|key| !key.is_finite()) {
                return Err(Moc3Error::InvalidData(
                    "MOC3 contains a non-finite parameter key".into(),
                ));
            }
            if keys.windows(2).any(|pair| pair[0] > pair[1]) {
                keys.sort_by(f32::total_cmp);
            }
            dimensions.push(ParamDimension {
                param_id: parameter.id.clone(),
                keys,
                extended_interpolation: None,
            });
        }
        Ok(dimensions)
    }
}

fn section_count_for_version(version: u8) -> usize {
    match version {
        1 => 101,
        2 | 3 => 102,
        4 => 137,
        _ => 154,
    }
}

fn section_range(
    bytes: &[u8],
    offset: usize,
    count: usize,
    element_size: usize,
    label: &str,
) -> Result<std::ops::Range<usize>, Moc3Error> {
    checked_range(offset, count, element_size, bytes.len(), label)
}

fn read_ids(
    bytes: &[u8],
    offset: usize,
    count: usize,
    label: &str,
) -> Result<Vec<String>, Moc3Error> {
    let range = section_range(bytes, offset, count, 64, label)?;
    let mut ids = Vec::new();
    ids.try_reserve_exact(count)
        .map_err(|error| Moc3Error::InvalidData(format!("{label} is too large: {error}")))?;
    let mut seen = HashSet::new();
    for index in 0..count {
        let start = range.start + index * 64;
        let id = unpack_id_64(&bytes[start..start + 64], label)?;
        if !seen.insert(id.clone()) {
            return Err(Moc3Error::InvalidData(format!(
                "{label} contains duplicate id `{id}`"
            )));
        }
        ids.push(id);
    }
    Ok(ids)
}

fn read_i32_section(
    bytes: &[u8],
    sec_offsets: &[usize],
    section: usize,
    count: usize,
    label: &str,
) -> Result<Vec<i32>, Moc3Error> {
    let &offset = sec_offsets
        .get(section)
        .ok_or_else(|| Moc3Error::InvalidData(format!("{label} section is absent")))?;
    read_i32_array(bytes, offset, count, label)
}

fn read_f32_section(
    bytes: &[u8],
    sec_offsets: &[usize],
    section: usize,
    count: usize,
    label: &str,
) -> Result<Vec<f32>, Moc3Error> {
    let &offset = sec_offsets
        .get(section)
        .ok_or_else(|| Moc3Error::InvalidData(format!("{label} section is absent")))?;
    read_f32_array(bytes, offset, count, label)
}

fn read_u8_section(
    bytes: &[u8],
    sec_offsets: &[usize],
    section: usize,
    count: usize,
    label: &str,
) -> Result<Vec<u8>, Moc3Error> {
    let &offset = sec_offsets
        .get(section)
        .ok_or_else(|| Moc3Error::InvalidData(format!("{label} section is absent")))?;
    let range = section_range(bytes, offset, count, 1, label)?;
    Ok(bytes[range].to_vec())
}

fn enumerate_coordinates(
    dimensions: &[ParamDimension],
    count: usize,
) -> Result<Vec<Vec<f32>>, Moc3Error> {
    if dimensions.is_empty() {
        if count == 1 {
            return Ok(vec![Vec::new()]);
        }
        return Err(Moc3Error::InvalidData(format!(
            "unbound keyform has {count} states instead of 1"
        )));
    }
    let mut expected = 1usize;
    for dimension in dimensions {
        if dimension.keys.is_empty() {
            return Err(Moc3Error::InvalidData(
                "MOC3 parameter binding has no keys".into(),
            ));
        }
        expected = expected
            .checked_mul(dimension.keys.len())
            .ok_or_else(|| Moc3Error::InvalidData("keyform count overflow".into()))?;
    }
    if expected != count {
        return Err(Moc3Error::InvalidData(format!(
            "keyform count {count} does not match parameter-grid product {expected}"
        )));
    }
    let mut coordinates = Vec::new();
    coordinates
        .try_reserve_exact(count)
        .map_err(|error| Moc3Error::InvalidData(format!("too many keyforms: {error}")))?;
    for flat in 0..count {
        let mut remainder = flat;
        let mut state = vec![0.0f32; dimensions.len()];
        for index in (0..dimensions.len()).rev() {
            let keys = &dimensions[index].keys;
            state[index] = keys[remainder % keys.len()];
            remainder /= keys.len();
        }
        coordinates.push(state);
    }
    Ok(coordinates)
}

fn default_state_index(
    coordinates: &[Vec<f32>],
    dimensions: &[ParamDimension],
    parameters: &[Parameter],
) -> usize {
    let defaults: HashMap<&str, f32> = parameters
        .iter()
        .map(|parameter| (parameter.id.as_str(), parameter.default))
        .collect();
    coordinates
        .iter()
        .position(|state| {
            dimensions
                .iter()
                .zip(state.iter())
                .all(|(dimension, coordinate)| {
                    defaults
                        .get(dimension.param_id.as_str())
                        .is_some_and(|default| (*default - *coordinate).abs() <= 1e-5)
                })
        })
        .unwrap_or(0)
}

fn checked_index(index: i32, total: usize, label: &str) -> Result<usize, Moc3Error> {
    if index < 0 || index as usize >= total {
        return Err(Moc3Error::InvalidData(format!(
            "{label} index {index} is outside 0..{total}"
        )));
    }
    Ok(index as usize)
}

fn checked_begin_count(
    begin: i32,
    count: i32,
    total: usize,
    label: &str,
) -> Result<std::ops::Range<usize>, Moc3Error> {
    if begin < 0 || count < 0 {
        return Err(Moc3Error::InvalidData(format!(
            "{label} has a negative begin/count"
        )));
    }
    let begin = begin as usize;
    let count = count as usize;
    let end = checked_add(begin, count, label)?;
    if begin > total || end > total {
        return Err(Moc3Error::InvalidData(format!(
            "{label} range {begin}..{end} exceeds {total}"
        )));
    }
    Ok(begin..end)
}

fn color_components(
    bytes: &[u8],
    sec_offsets: &[usize],
    begin: i32,
    total_colors: usize,
) -> Result<[f32; 4], Moc3Error> {
    if begin < 0 {
        return Ok([1.0, 1.0, 1.0, 1.0]);
    }
    let begin = begin as usize;
    if begin >= total_colors {
        return Ok([1.0, 1.0, 1.0, 1.0]);
    }
    let mut color = [1.0, 1.0, 1.0, 1.0];
    for (channel, section) in [108usize, 109, 110].into_iter().enumerate() {
        let &offset = sec_offsets
            .get(section)
            .ok_or_else(|| Moc3Error::InvalidData("missing color section".into()))?;
        color[channel] = read_f32(bytes, offset + begin * 4, "multiply color")?;
    }
    Ok(color)
}

fn screen_components(
    bytes: &[u8],
    sec_offsets: &[usize],
    begin: i32,
    total_colors: usize,
) -> Result<[f32; 4], Moc3Error> {
    if begin < 0 {
        return Ok([0.0, 0.0, 0.0, 0.0]);
    }
    let begin = begin as usize;
    if begin >= total_colors {
        return Ok([0.0, 0.0, 0.0, 0.0]);
    }
    let mut color = [0.0, 0.0, 0.0, 0.0];
    for (channel, section) in [111usize, 112, 113].into_iter().enumerate() {
        let &offset = sec_offsets
            .get(section)
            .ok_or_else(|| Moc3Error::InvalidData("missing color section".into()))?;
        color[channel] = read_f32(bytes, offset + begin * 4, "screen color")?;
    }
    Ok(color)
}

/// Parse a standard MOC3 body. An optional aligned `L2D0` source-project trailer is accepted for
/// backwards compatibility, but never required.
pub fn import_moc3_binary(bytes: &[u8]) -> Result<Project, Moc3Error> {
    if bytes.len() < BODY_OFFSET || &bytes[0..4] != MOC3_MAGIC {
        return Err(Moc3Error::InvalidMagic);
    }
    if bytes[5] != 0 {
        return Err(Moc3Error::InvalidData(
            "big-endian MOC3 files are not supported".into(),
        ));
    }
    let version = bytes[4];
    if !(1..=5).contains(&version) {
        return Err(Moc3Error::UnsupportedVersion(version));
    }
    if let Some(project) = find_source_project(bytes) {
        return Ok(project);
    }

    let section_count = section_count_for_version(version);
    let raw_offsets = read_u32_array(bytes, 64, section_count, "section offset table")?;
    let mut section_offsets = Vec::with_capacity(section_count);
    for (index, raw) in raw_offsets.into_iter().enumerate() {
        let offset = raw as usize;
        if offset < BODY_OFFSET || offset >= bytes.len() {
            return Err(Moc3Error::InvalidData(format!(
                "section {index} offset {offset} is outside the MOC3 body"
            )));
        }
        section_offsets.push(offset);
    }

    let counts_offset = section_offsets[0];
    let count_entries = if version >= 5 {
        35
    } else if version >= 4 {
        32
    } else {
        23
    };
    let mut counts = read_u32_array(bytes, counts_offset, count_entries, "count info")?;
    counts.resize(35, 0);
    if counts.iter().any(|&count| count > i32::MAX as u32) {
        return Err(Moc3Error::InvalidData(
            "a MOC3 count exceeds the signed index range".into(),
        ));
    }
    let num_parts = counts[0] as usize;
    let num_deformers = counts[1] as usize;
    let num_warp = counts[2] as usize;
    let num_rotation = counts[3] as usize;
    let num_artmeshes = counts[4] as usize;
    let num_parameters = counts[5] as usize;
    let num_part_keyforms = counts[6] as usize;
    let num_warp_keyforms = counts[7] as usize;
    let num_rotation_keyforms = counts[8] as usize;
    let num_artmesh_keyforms = counts[9] as usize;
    let num_keyform_position_floats = counts[10] as usize;
    let num_parameter_binding_indices = counts[11] as usize;
    let num_keyform_bands = counts[12] as usize;
    let num_parameter_bindings = counts[13] as usize;
    let num_keys = counts[14] as usize;
    let num_uv_floats = counts[15] as usize;
    let num_position_indices = counts[16] as usize;
    let num_drawable_masks = counts[17] as usize;
    let num_colors = if version >= 4 { counts[23] as usize } else { 0 };
    if num_deformers != num_warp + num_rotation {
        return Err(Moc3Error::InvalidData(
            "deformer count does not equal warp + rotation counts".into(),
        ));
    }

    let canvas_offset = section_offsets[1];
    let width = read_f32(bytes, canvas_offset + 12, "canvas width")?;
    let height = read_f32(bytes, canvas_offset + 16, "canvas height")?;
    let origin_x = read_f32(bytes, canvas_offset + 4, "canvas origin x")?;
    let origin_y = read_f32(bytes, canvas_offset + 8, "canvas origin y")?;
    if ![width, height, origin_x, origin_y]
        .into_iter()
        .all(f32::is_finite)
    {
        return Err(Moc3Error::InvalidData(
            "canvas contains non-finite values".into(),
        ));
    }

    let parameter_ids = read_ids(bytes, section_offsets[50], num_parameters, "parameter IDs")?;
    let parameter_max = read_f32_section(
        bytes,
        &section_offsets,
        51,
        num_parameters,
        "parameter max values",
    )?;
    let parameter_min = read_f32_section(
        bytes,
        &section_offsets,
        52,
        num_parameters,
        "parameter min values",
    )?;
    let parameter_default = read_f32_section(
        bytes,
        &section_offsets,
        53,
        num_parameters,
        "parameter default values",
    )?;
    let parameter_repeat = read_i32_section(
        bytes,
        &section_offsets,
        54,
        num_parameters,
        "parameter repeats",
    )?;
    let mut parameters = Vec::with_capacity(num_parameters);
    for index in 0..num_parameters {
        if parameter_min[index] > parameter_max[index]
            || ![
                parameter_min[index],
                parameter_max[index],
                parameter_default[index],
            ]
            .into_iter()
            .all(f32::is_finite)
        {
            return Err(Moc3Error::InvalidData(format!(
                "parameter `{}` has an invalid range",
                parameter_ids[index]
            )));
        }
        parameters.push(Parameter {
            id: parameter_ids[index].clone(),
            name: parameter_ids[index].clone(),
            min: parameter_min[index],
            max: parameter_max[index],
            default: parameter_default[index],
            repeats: parameter_repeat[index] != 0,
            group_id: None,
            locked: false,
        });
    }

    let parameter_binding_begin = read_i32_section(
        bytes,
        &section_offsets,
        56,
        num_parameters,
        "parameter binding begins",
    )?;
    let parameter_binding_count = read_i32_section(
        bytes,
        &section_offsets,
        57,
        num_parameters,
        "parameter binding counts",
    )?;
    let band_begin = read_i32_section(
        bytes,
        &section_offsets,
        73,
        num_keyform_bands,
        "keyform band begins",
    )?;
    let band_count = read_i32_section(
        bytes,
        &section_offsets,
        74,
        num_keyform_bands,
        "keyform band counts",
    )?;
    let binding_indices = read_i32_section(
        bytes,
        &section_offsets,
        72,
        num_parameter_binding_indices,
        "parameter binding indices",
    )?;
    let binding_keys_begin = read_i32_section(
        bytes,
        &section_offsets,
        75,
        num_parameter_bindings,
        "parameter binding key begins",
    )?;
    let binding_keys_count = read_i32_section(
        bytes,
        &section_offsets,
        76,
        num_parameter_bindings,
        "parameter binding key counts",
    )?;
    let keys = read_f32_section(bytes, &section_offsets, 77, num_keys, "parameter keys")?;
    let mut binding_to_parameter = vec![None; num_parameter_bindings];
    for parameter_index in 0..num_parameters {
        let range = checked_begin_count(
            parameter_binding_begin[parameter_index],
            parameter_binding_count[parameter_index],
            num_parameter_bindings,
            "parameter binding ownership",
        )?;
        for binding_index in range {
            if binding_to_parameter[binding_index]
                .replace(parameter_index)
                .is_some()
            {
                return Err(Moc3Error::InvalidData(format!(
                    "parameter binding {binding_index} has multiple owners"
                )));
            }
        }
    }
    let bindings = BindingTables {
        band_begin,
        band_count,
        binding_indices,
        keys_begin: binding_keys_begin,
        keys_count: binding_keys_count,
        keys,
        binding_to_parameter,
    };

    let part_ids = read_ids(bytes, section_offsets[3], num_parts, "Part IDs")?;
    let part_visible = read_i32_section(bytes, &section_offsets, 7, num_parts, "Part visibles")?;
    let part_parent = read_i32_section(bytes, &section_offsets, 9, num_parts, "Part parents")?;
    let part_keyform_begin =
        read_i32_section(bytes, &section_offsets, 5, num_parts, "Part keyform begins")?;
    let part_keyform_count =
        read_i32_section(bytes, &section_offsets, 6, num_parts, "Part keyform counts")?;
    for index in 0..num_parts {
        checked_begin_count(
            part_keyform_begin[index],
            part_keyform_count[index],
            num_part_keyforms,
            "Part keyform range",
        )?;
        if part_parent[index] < -1 || part_parent[index] >= num_parts as i32 {
            return Err(Moc3Error::InvalidData(format!(
                "Part {index} has an invalid parent index"
            )));
        }
    }
    let binary_parts: Vec<BinaryPart> = (0..num_parts)
        .map(|index| BinaryPart {
            id: part_ids[index].clone(),
            visible: part_visible[index] != 0,
            parent_index: part_parent[index],
        })
        .collect();

    let deformer_ids = read_ids(bytes, section_offsets[11], num_deformers, "deformer IDs")?;
    let deformer_visible = read_i32_section(
        bytes,
        &section_offsets,
        13,
        num_deformers,
        "deformer visibles",
    )?;
    let deformer_parent_part = read_i32_section(
        bytes,
        &section_offsets,
        15,
        num_deformers,
        "deformer parent Parts",
    )?;
    let deformer_parent_deformer = read_i32_section(
        bytes,
        &section_offsets,
        16,
        num_deformers,
        "deformer parent deformers",
    )?;
    let deformer_type =
        read_i32_section(bytes, &section_offsets, 17, num_deformers, "deformer types")?;
    let deformer_specific = read_i32_section(
        bytes,
        &section_offsets,
        18,
        num_deformers,
        "deformer specific indices",
    )?;
    let deformer_band = read_i32_section(
        bytes,
        &section_offsets,
        12,
        num_deformers,
        "deformer keyform bands",
    )?;
    let mut binary_deformers = Vec::with_capacity(num_deformers);
    for index in 0..num_deformers {
        let deformer_type_value = deformer_type[index];
        let specific = deformer_specific[index];
        match deformer_type_value {
            0 => {
                checked_index(specific, num_warp, "warp specific")?;
            }
            1 => {
                checked_index(specific, num_rotation, "rotation specific")?;
            }
            _ => {
                return Err(Moc3Error::InvalidData(format!(
                    "deformer {index} has unknown type {deformer_type_value}"
                )));
            }
        }
        if deformer_parent_part[index] < -1
            || deformer_parent_part[index] >= num_parts as i32
            || deformer_parent_deformer[index] < -1
            || deformer_parent_deformer[index] >= num_deformers as i32
        {
            return Err(Moc3Error::InvalidData(format!(
                "deformer {index} has an invalid parent"
            )));
        }
        binary_deformers.push(BinaryDeformer {
            id: deformer_ids[index].clone(),
            visible: deformer_visible[index] != 0,
            parent_part_index: deformer_parent_part[index],
            parent_deformer_index: deformer_parent_deformer[index],
            deformer_type: deformer_type_value,
            specific_index: specific as usize,
            keyform_band_index: deformer_band[index],
        });
    }

    let warp_keyform_band =
        read_i32_section(bytes, &section_offsets, 19, num_warp, "warp keyform bands")?;
    let warp_keyform_begin =
        read_i32_section(bytes, &section_offsets, 20, num_warp, "warp keyform begins")?;
    let warp_keyform_count =
        read_i32_section(bytes, &section_offsets, 21, num_warp, "warp keyform counts")?;
    let warp_vertex_count =
        read_i32_section(bytes, &section_offsets, 22, num_warp, "warp vertex counts")?;
    let warp_rows = read_i32_section(bytes, &section_offsets, 23, num_warp, "warp rows")?;
    let warp_cols = read_i32_section(bytes, &section_offsets, 24, num_warp, "warp cols")?;
    for index in 0..num_warp {
        if warp_rows[index] <= 0 || warp_cols[index] <= 0 {
            return Err(Moc3Error::InvalidData(format!(
                "warp deformer {index} has non-positive grid dimensions"
            )));
        }
        let expected = (warp_rows[index] as usize + 1)
            .checked_mul(warp_cols[index] as usize + 1)
            .ok_or_else(|| Moc3Error::InvalidData("warp vertex count overflow".into()))?;
        if warp_vertex_count[index] < 0 || warp_vertex_count[index] as usize != expected {
            return Err(Moc3Error::InvalidData(format!(
                "warp deformer {index} vertex count does not match its grid"
            )));
        }
        checked_begin_count(
            warp_keyform_begin[index],
            warp_keyform_count[index],
            num_warp_keyforms,
            "warp keyform range",
        )?;
        bindings.dimensions(warp_keyform_band[index], &parameters)?;
    }

    let rotation_keyform_band = read_i32_section(
        bytes,
        &section_offsets,
        25,
        num_rotation,
        "rotation keyform bands",
    )?;
    let rotation_keyform_begin = read_i32_section(
        bytes,
        &section_offsets,
        26,
        num_rotation,
        "rotation keyform begins",
    )?;
    let rotation_keyform_count = read_i32_section(
        bytes,
        &section_offsets,
        27,
        num_rotation,
        "rotation keyform counts",
    )?;
    let rotation_base_angle = read_f32_section(
        bytes,
        &section_offsets,
        28,
        num_rotation,
        "rotation base angles",
    )?;
    for index in 0..num_rotation {
        checked_begin_count(
            rotation_keyform_begin[index],
            rotation_keyform_count[index],
            num_rotation_keyforms,
            "rotation keyform range",
        )?;
        bindings.dimensions(rotation_keyform_band[index], &parameters)?;
    }

    let warp_keyform_opacity = read_f32_section(
        bytes,
        &section_offsets,
        59,
        num_warp_keyforms,
        "warp keyform opacities",
    )?;
    let warp_keyform_position_begin = read_i32_section(
        bytes,
        &section_offsets,
        60,
        num_warp_keyforms,
        "warp keyform positions",
    )?;
    let keyform_positions = read_f32_section(
        bytes,
        &section_offsets,
        71,
        num_keyform_position_floats,
        "keyform positions",
    )?;
    let rotation_keyform_opacity = read_f32_section(
        bytes,
        &section_offsets,
        61,
        num_rotation_keyforms,
        "rotation keyform opacities",
    )?;
    let rotation_keyform_angle = read_f32_section(
        bytes,
        &section_offsets,
        62,
        num_rotation_keyforms,
        "rotation keyform angles",
    )?;
    let rotation_keyform_origin_x = read_f32_section(
        bytes,
        &section_offsets,
        63,
        num_rotation_keyforms,
        "rotation keyform origin X",
    )?;
    let rotation_keyform_origin_y = read_f32_section(
        bytes,
        &section_offsets,
        64,
        num_rotation_keyforms,
        "rotation keyform origin Y",
    )?;
    let rotation_keyform_scale = read_f32_section(
        bytes,
        &section_offsets,
        65,
        num_rotation_keyforms,
        "rotation keyform scales",
    )?;
    let rotation_keyform_reflect_x = read_i32_section(
        bytes,
        &section_offsets,
        66,
        num_rotation_keyforms,
        "rotation keyform reflect X",
    )?;
    let rotation_keyform_reflect_y = read_i32_section(
        bytes,
        &section_offsets,
        67,
        num_rotation_keyforms,
        "rotation keyform reflect Y",
    )?;

    let artmesh_ids = read_ids(bytes, section_offsets[33], num_artmeshes, "ArtMesh IDs")?;
    let artmesh_band = read_i32_section(
        bytes,
        &section_offsets,
        34,
        num_artmeshes,
        "ArtMesh keyform bands",
    )?;
    let artmesh_keyform_begin = read_i32_section(
        bytes,
        &section_offsets,
        35,
        num_artmeshes,
        "ArtMesh keyform begins",
    )?;
    let artmesh_keyform_count = read_i32_section(
        bytes,
        &section_offsets,
        36,
        num_artmeshes,
        "ArtMesh keyform counts",
    )?;
    let artmesh_visible = read_i32_section(
        bytes,
        &section_offsets,
        37,
        num_artmeshes,
        "ArtMesh visibles",
    )?;
    let artmesh_parent_part = read_i32_section(
        bytes,
        &section_offsets,
        39,
        num_artmeshes,
        "ArtMesh parent Parts",
    )?;
    let artmesh_parent_deformer = read_i32_section(
        bytes,
        &section_offsets,
        40,
        num_artmeshes,
        "ArtMesh parent deformers",
    )?;
    let artmesh_texture = read_i32_section(
        bytes,
        &section_offsets,
        41,
        num_artmeshes,
        "ArtMesh texture indices",
    )?;
    let artmesh_flags = read_u8_section(
        bytes,
        &section_offsets,
        42,
        num_artmeshes,
        "ArtMesh drawable flags",
    )?;
    let artmesh_render_vertex_count = read_i32_section(
        bytes,
        &section_offsets,
        43,
        num_artmeshes,
        "ArtMesh render vertex counts",
    )?;
    let artmesh_uv_begin = read_i32_section(
        bytes,
        &section_offsets,
        44,
        num_artmeshes,
        "ArtMesh UV begins",
    )?;
    let artmesh_position_index_begin = read_i32_section(
        bytes,
        &section_offsets,
        45,
        num_artmeshes,
        "ArtMesh position index begins",
    )?;
    let artmesh_flat_index_count = read_i32_section(
        bytes,
        &section_offsets,
        46,
        num_artmeshes,
        "ArtMesh flat index counts",
    )?;
    let artmesh_mask_begin = read_i32_section(
        bytes,
        &section_offsets,
        47,
        num_artmeshes,
        "ArtMesh mask begins",
    )?;
    let artmesh_mask_count = read_i32_section(
        bytes,
        &section_offsets,
        48,
        num_artmeshes,
        "ArtMesh mask counts",
    )?;
    let artmesh_keyform_opacity = read_f32_section(
        bytes,
        &section_offsets,
        68,
        num_artmesh_keyforms,
        "ArtMesh keyform opacities",
    )?;
    let artmesh_keyform_draw_order = read_f32_section(
        bytes,
        &section_offsets,
        69,
        num_artmesh_keyforms,
        "ArtMesh keyform draw orders",
    )?;
    let artmesh_keyform_position_begin = read_i32_section(
        bytes,
        &section_offsets,
        70,
        num_artmesh_keyforms,
        "ArtMesh keyform positions",
    )?;
    let uvs = read_f32_section(bytes, &section_offsets, 78, num_uv_floats, "UVs")?;
    let position_indices = read_u16_array(
        bytes,
        section_offsets[79],
        num_position_indices,
        "position indices",
    )?;
    let drawable_masks = read_i32_section(
        bytes,
        &section_offsets,
        80,
        num_drawable_masks,
        "drawable masks",
    )?;

    let blend_modes = if version >= 5 {
        Some(read_i32_section(
            bytes,
            &section_offsets,
            153,
            num_artmeshes,
            "ArtMesh blend modes",
        )?)
    } else {
        None
    };

    let mut nodes = Vec::new();
    let mut part_node_ids: Vec<Option<String>> = Vec::with_capacity(num_parts);
    let skip_single_root_part = num_parts == 1 && binary_parts[0].id == "PartRoot";
    for (part_index, part) in binary_parts.iter().enumerate() {
        if skip_single_root_part && part_index == 0 {
            part_node_ids.push(None);
            continue;
        }
        let parent_id = if part.parent_index >= 0 {
            part_node_ids
                .get(part.parent_index as usize)
                .and_then(Clone::clone)
        } else {
            None
        };
        nodes.push(Node {
            id: part.id.clone(),
            name: part.id.clone(),
            parent_id,
            visible: part.visible,
            locked: false,
            kind: NodeKind::Part {
                collapsed: false,
                opacity: 1.0,
            },
        });
        part_node_ids.push(Some(part.id.clone()));
    }

    let mut deformer_node_ids: Vec<Option<String>> = Vec::with_capacity(num_deformers);
    let mut deformer_bindings = Vec::<Option<KeyformBinding>>::with_capacity(num_deformers);
    let mut warp_base_data: Vec<Option<WarpDeformerData>> = vec![None; num_warp];
    let mut rotation_base_data: Vec<Option<RotationDeformerData>> = vec![None; num_rotation];
    for deformer in &binary_deformers {
        let dimensions = bindings.dimensions(deformer.keyform_band_index, &parameters)?;
        let (specific_begin, specific_count) = match deformer.deformer_type {
            0 => (
                warp_keyform_begin[deformer.specific_index],
                warp_keyform_count[deformer.specific_index],
            ),
            1 => (
                rotation_keyform_begin[deformer.specific_index],
                rotation_keyform_count[deformer.specific_index],
            ),
            _ => unreachable!(),
        };
        let keyform_range = checked_begin_count(
            specific_begin,
            specific_count,
            match deformer.deformer_type {
                0 => num_warp_keyforms,
                _ => num_rotation_keyforms,
            },
            "deformer keyforms",
        )?;
        let count = keyform_range.end - keyform_range.start;
        let coordinates = enumerate_coordinates(&dimensions, count)?;
        let base_index = default_state_index(&coordinates, &dimensions, &parameters);
        let mut states = Vec::with_capacity(count);
        match deformer.deformer_type {
            0 => {
                let rows = warp_rows[deformer.specific_index] as usize;
                let cols = warp_cols[deformer.specific_index] as usize;
                let point_count = warp_vertex_count[deformer.specific_index] as usize;
                let mut base_control_points = Vec::new();
                for keyform_index in keyform_range {
                    let begin = checked_index(
                        warp_keyform_position_begin[keyform_index],
                        num_keyform_position_floats,
                        "warp keyform position",
                    )?;
                    let end = checked_add(begin, point_count * 2, "warp keyform vertices")?;
                    if end > keyform_positions.len() {
                        return Err(Moc3Error::InvalidData(
                            "warp keyform positions exceed the keyform position array".into(),
                        ));
                    }
                    let mut control_points = Vec::with_capacity(point_count);
                    for point in 0..point_count {
                        control_points.push([
                            keyform_positions[begin + point * 2],
                            keyform_positions[begin + point * 2 + 1],
                        ]);
                    }
                    if states.len() == base_index {
                        base_control_points = control_points.clone();
                    }
                    if !warp_keyform_opacity[keyform_index].is_finite() {
                        return Err(Moc3Error::InvalidData(
                            "warp keyform opacity is not finite".into(),
                        ));
                    }
                    states.push(KeyformState {
                        coordinates: coordinates[states.len()].clone(),
                        payload: KeyformPayload::Warp { control_points },
                    });
                }
                if base_control_points.is_empty() {
                    return Err(Moc3Error::InvalidData(format!(
                        "warp deformer {} has no keyforms",
                        deformer.id
                    )));
                }
                warp_base_data[deformer.specific_index] = Some(WarpDeformerData {
                    cols,
                    rows,
                    // MOC3 warp inputs are normalized to the deformer's [0, 1] domain. Editor-only
                    // canvas bounds are not stored in the binary; using control-point extents here
                    // turns neutral translations into an identity transform on read-back.
                    bounds: [0.0, 0.0, 1.0, 1.0],
                    control_points: base_control_points,
                    bezier_smooth: false,
                });
            }
            1 => {
                let mut base_rotation = None;
                for keyform_index in keyform_range {
                    let scale = rotation_keyform_scale[keyform_index]
                        * if rotation_keyform_reflect_x[keyform_index] != 0 {
                            -1.0
                        } else {
                            1.0
                        };
                    let scale_y = rotation_keyform_scale[keyform_index]
                        * if rotation_keyform_reflect_y[keyform_index] != 0 {
                            -1.0
                        } else {
                            1.0
                        };
                    if !rotation_keyform_angle[keyform_index].is_finite()
                        || !rotation_keyform_origin_x[keyform_index].is_finite()
                        || !rotation_keyform_origin_y[keyform_index].is_finite()
                        || !scale.is_finite()
                        || !scale_y.is_finite()
                        || !rotation_keyform_opacity[keyform_index].is_finite()
                    {
                        return Err(Moc3Error::InvalidData(
                            "rotation keyform contains non-finite values".into(),
                        ));
                    }
                    if states.len() == base_index {
                        base_rotation = Some(RotationDeformerData {
                            origin: [
                                rotation_keyform_origin_x[keyform_index],
                                rotation_keyform_origin_y[keyform_index],
                            ],
                            angle_deg: rotation_keyform_angle[keyform_index]
                                + rotation_base_angle[deformer.specific_index],
                            scale: [scale, scale_y],
                        });
                    }
                    states.push(KeyformState {
                        coordinates: coordinates[states.len()].clone(),
                        payload: KeyformPayload::Rotation {
                            origin: [
                                rotation_keyform_origin_x[keyform_index],
                                rotation_keyform_origin_y[keyform_index],
                            ],
                            angle_deg: rotation_keyform_angle[keyform_index]
                                + rotation_base_angle[deformer.specific_index],
                            scale: [scale, scale_y],
                        },
                    });
                }
                rotation_base_data[deformer.specific_index] = base_rotation;
            }
            _ => unreachable!(),
        }
        if deformer.id == "__root_deformer__" {
            deformer_bindings.push(None);
            deformer_node_ids.push(None);
            continue;
        }
        deformer_bindings.push(Some(KeyformBinding {
            target_node_id: deformer.id.clone(),
            dimensions,
            keyforms: states,
        }));
        let base_kind = match deformer.deformer_type {
            0 => NodeKind::WarpDeformer(
                warp_base_data[deformer.specific_index]
                    .clone()
                    .ok_or_else(|| Moc3Error::InvalidData("missing warp base data".into()))?,
            ),
            1 => NodeKind::RotationDeformer(
                rotation_base_data[deformer.specific_index]
                    .clone()
                    .ok_or_else(|| Moc3Error::InvalidData("missing rotation base data".into()))?,
            ),
            _ => unreachable!(),
        };
        let deformer_parent = if deformer.parent_deformer_index >= 0 {
            deformer_node_ids
                .get(deformer.parent_deformer_index as usize)
                .and_then(Clone::clone)
        } else {
            None
        };
        let parent_id = if deformer_parent.is_some() {
            deformer_parent
        } else if deformer.parent_part_index >= 0 {
            part_node_ids
                .get(deformer.parent_part_index as usize)
                .and_then(Clone::clone)
        } else {
            None
        };
        nodes.push(Node {
            id: deformer.id.clone(),
            name: deformer.id.clone(),
            parent_id,
            visible: deformer.visible,
            locked: false,
            kind: base_kind,
        });
        deformer_node_ids.push(Some(deformer.id.clone()));
    }

    let mut keyforms: Vec<KeyformBinding> = Vec::new();
    for binding in deformer_bindings.into_iter().flatten() {
        keyforms.push(binding);
    }

    let skip_single_default_mesh = num_artmeshes == 1 && artmesh_ids[0] == "__default_mesh__";
    for index in 0..num_artmeshes {
        if skip_single_default_mesh && index == 0 {
            continue;
        }
        let id = artmesh_ids[index].clone();
        let vertex_count = artmesh_render_vertex_count[index]
            .try_into()
            .map_err(|_| Moc3Error::InvalidData(format!("ArtMesh `{id}` has negative vertices")))?;
        let uv_begin = checked_index(artmesh_uv_begin[index], num_uv_floats, "ArtMesh UV begin")?;
        let uv_end = checked_add(uv_begin, vertex_count * 2, "ArtMesh UV range")?;
        if uv_end > uvs.len() {
            return Err(Moc3Error::InvalidData(format!(
                "ArtMesh `{id}` UV range exceeds the UV array"
            )));
        }
        let mut mesh_uvs = Vec::with_capacity(vertex_count);
        for vertex in 0..vertex_count {
            mesh_uvs.push([
                uvs[uv_begin + vertex * 2],
                1.0 - uvs[uv_begin + vertex * 2 + 1],
            ]);
        }
        let index_begin = checked_index(
            artmesh_position_index_begin[index],
            num_position_indices,
            "ArtMesh index begin",
        )?;
        let flat_count: usize = artmesh_flat_index_count[index].try_into().map_err(|_| {
            Moc3Error::InvalidData(format!("ArtMesh `{id}` has a negative index count"))
        })?;
        let index_end = checked_add(index_begin, flat_count, "ArtMesh index range")?;
        if index_end > position_indices.len() {
            return Err(Moc3Error::InvalidData(format!(
                "ArtMesh `{id}` index range exceeds PositionIndices"
            )));
        }
        let mut indices = Vec::with_capacity(flat_count);
        for &raw_index in &position_indices[index_begin..index_end] {
            let vertex_index = raw_index as usize;
            if vertex_index >= vertex_count {
                return Err(Moc3Error::InvalidData(format!(
                    "ArtMesh `{id}` contains out-of-range vertex index {raw_index}"
                )));
            }
            indices.push(raw_index as u32);
        }
        let keyform_range = checked_begin_count(
            artmesh_keyform_begin[index],
            artmesh_keyform_count[index],
            num_artmesh_keyforms,
            "ArtMesh keyform range",
        )?;
        let dimensions = bindings.dimensions(artmesh_band[index], &parameters)?;
        let count = keyform_range.end - keyform_range.start;
        let coordinates = enumerate_coordinates(&dimensions, count)?;
        let base_state = default_state_index(&coordinates, &dimensions, &parameters);
        let mut state_positions = Vec::with_capacity(count);
        for keyform_index in keyform_range.clone() {
            let begin = checked_index(
                artmesh_keyform_position_begin[keyform_index],
                num_keyform_position_floats,
                "ArtMesh keyform position",
            )?;
            let end = checked_add(begin, vertex_count * 2, "ArtMesh keyform positions")?;
            if end > keyform_positions.len() {
                return Err(Moc3Error::InvalidData(format!(
                    "ArtMesh `{id}` keyform positions exceed the position array"
                )));
            }
            let mut vertices = Vec::with_capacity(vertex_count);
            for vertex in 0..vertex_count {
                vertices.push([
                    keyform_positions[begin + vertex * 2],
                    keyform_positions[begin + vertex * 2 + 1],
                ]);
            }
            state_positions.push(vertices);
        }
        let Some(base_vertices) = state_positions.get(base_state).cloned() else {
            return Err(Moc3Error::InvalidData(format!(
                "ArtMesh `{id}` has no keyforms"
            )));
        };
        let mask_range = checked_begin_count(
            artmesh_mask_begin[index],
            artmesh_mask_count[index],
            num_drawable_masks,
            "ArtMesh mask range",
        )?;
        let mut mask_ids = Vec::new();
        for &mask_index in &drawable_masks[mask_range] {
            if mask_index >= 0 && (mask_index as usize) < num_artmeshes {
                mask_ids.push(artmesh_ids[mask_index as usize].clone());
            }
        }
        let base_keyform_index = keyform_range.start + base_state;
        let base_opacity = artmesh_keyform_opacity[base_keyform_index];
        let base_draw_order = artmesh_keyform_draw_order[base_keyform_index] as i32;
        let base_color = if version >= 5 {
            let begin = read_i32(
                bytes,
                section_offsets[141] + base_keyform_index * 4,
                "ArtMesh multiply color begin",
            )?;
            color_components(bytes, &section_offsets, begin, num_colors)?
        } else if version >= 4 {
            let begin = read_i32(
                bytes,
                section_offsets[107] + index * 4,
                "ArtMesh multiply color begin",
            )?;
            color_components(bytes, &section_offsets, begin, num_colors)?
        } else {
            [1.0, 1.0, 1.0, 1.0]
        };
        let screen_color = if version >= 5 {
            let begin = read_i32(
                bytes,
                section_offsets[142] + base_keyform_index * 4,
                "ArtMesh screen color begin",
            )?;
            screen_components(bytes, &section_offsets, begin, num_colors)?
        } else {
            [0.0, 0.0, 0.0, 0.0]
        };
        let flag = artmesh_flags[index];
        let blend_mode = if let Some(ref modes) = blend_modes {
            match modes[index] {
                0 => BlendMode::Normal,
                1 => BlendMode::Additive,
                2 => BlendMode::Multiply,
                3 => BlendMode::Screen,
                value => {
                    return Err(Moc3Error::InvalidData(format!(
                        "ArtMesh `{id}` has unknown blend mode {value}"
                    )));
                }
            }
        } else {
            match flag & 0x03 {
                1 => BlendMode::Additive,
                2 => BlendMode::Multiply,
                3 => BlendMode::Screen,
                _ => BlendMode::Normal,
            }
        };
        let deformer_parent = if artmesh_parent_deformer[index] >= 0 {
            deformer_node_ids
                .get(artmesh_parent_deformer[index] as usize)
                .and_then(Clone::clone)
        } else {
            None
        };
        let parent_id = if deformer_parent.is_some() {
            deformer_parent
        } else if artmesh_parent_part[index] >= 0 {
            part_node_ids
                .get(artmesh_parent_part[index] as usize)
                .and_then(Clone::clone)
        } else {
            None
        };
        nodes.push(Node {
            id: id.clone(),
            name: id.clone(),
            parent_id,
            visible: artmesh_visible[index] != 0,
            locked: false,
            kind: NodeKind::ArtMesh(ArtMeshData {
                texture_id: format!("texture_{:02}", artmesh_texture[index].max(0)),
                vertices: base_vertices.clone(),
                uvs: mesh_uvs,
                indices,
                blend_mode,
                opacity: base_opacity,
                multiply_color: base_color,
                screen_color,
                draw_order: base_draw_order,
                mask_ids,
                is_mask_inverted: flag & (1 << 3) != 0,
                morph_targets: Vec::new(),
                hit_area_name: None,
                user_data: None,
            }),
        });

        let mut states = Vec::with_capacity(count);
        for (state_index, vertices) in state_positions.into_iter().enumerate() {
            let keyform_index = keyform_range.start + state_index;
            let vertex_offsets = base_vertices
                .iter()
                .zip(vertices.iter())
                .map(|(base, value)| [value[0] - base[0], value[1] - base[1]])
                .collect();
            let opacity = artmesh_keyform_opacity[keyform_index];
            let draw_order = artmesh_keyform_draw_order[keyform_index] as i32;
            let multiply_color = if version >= 5 {
                let begin = read_i32(
                    bytes,
                    section_offsets[141] + keyform_index * 4,
                    "ArtMesh multiply color begin",
                )?;
                Some(color_components(
                    bytes,
                    &section_offsets,
                    begin,
                    num_colors,
                )?)
            } else {
                None
            };
            let screen_color = if version >= 5 {
                let begin = read_i32(
                    bytes,
                    section_offsets[142] + keyform_index * 4,
                    "ArtMesh screen color begin",
                )?;
                Some(screen_components(
                    bytes,
                    &section_offsets,
                    begin,
                    num_colors,
                )?)
            } else {
                None
            };
            states.push(KeyformState {
                coordinates: coordinates[state_index].clone(),
                payload: KeyformPayload::ArtMesh {
                    vertex_offsets,
                    opacity: Some(opacity),
                    multiply_color,
                    screen_color,
                    draw_order: Some(draw_order),
                },
            });
        }
        keyforms.push(KeyformBinding {
            target_node_id: id,
            dimensions,
            keyforms: states,
        });
    }

    let unique_ids: HashSet<&str> = nodes.iter().map(|node| node.id.as_str()).collect();
    if unique_ids.len() != nodes.len() {
        return Err(Moc3Error::InvalidData(
            "MOC3 sections contain duplicate node IDs".into(),
        ));
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
        keyforms,
        textures: Vec::new(),
        glues: Vec::new(),
        physics: Vec::new(),
        animations: Vec::new(),
        parameter_groups: Vec::new(),
        pose_groups: Vec::new(),
        expressions: Vec::new(),
    })
}
