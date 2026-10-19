use crate::model::Project;
use std::collections::HashSet;
use std::ops::Range;

pub const MOC3_MAGIC: &[u8; 4] = b"MOC3";
pub const DEFAULT_MOC3_VERSION: u8 = 5;

pub(crate) const HEADER_SIZE: usize = 64;
pub(crate) const SOT_COUNT: usize = 160;
pub(crate) const BODY_OFFSET: usize = 1984;
pub(crate) const ALIGNMENT: usize = 64;

#[derive(Debug, thiserror::Error)]
pub enum Moc3Error {
    #[error("Invalid MOC3 file: invalid magic header")]
    InvalidMagic,
    #[error("Unsupported MOC3 version: {0}")]
    UnsupportedVersion(u8),
    #[error("Invalid MOC3 data: {0}")]
    InvalidData(String),
    #[error("Cannot export MOC3: {0}")]
    Export(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("UTF-8 decode error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("JSON decode error: {0}")]
    Json(#[from] serde_json::Error),
}

/// Controls optional metadata written after the standard `.moc3` body.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Moc3ExportOptions {
    /// Append the editable project JSON as an `L2D0` trailer. Defaults to `false`: runtime
    /// exports must be valid from their standard sections alone and must not leak source files.
    pub embed_source_project: bool,
}

pub(crate) fn align_up(value: usize, alignment: usize) -> Result<usize, Moc3Error> {
    if alignment == 0 {
        return Ok(value);
    }
    let remainder = value % alignment;
    if remainder == 0 {
        Ok(value)
    } else {
        checked_add(value, alignment - remainder, "aligned offset")
    }
}

pub(crate) fn checked_add(a: usize, b: usize, label: &str) -> Result<usize, Moc3Error> {
    a.checked_add(b)
        .ok_or_else(|| Moc3Error::InvalidData(format!("{label} overflows usize")))
}

pub(crate) fn checked_mul(a: usize, b: usize, label: &str) -> Result<usize, Moc3Error> {
    a.checked_mul(b)
        .ok_or_else(|| Moc3Error::InvalidData(format!("{label} overflows usize")))
}

pub(crate) fn checked_range(
    offset: usize,
    count: usize,
    element_size: usize,
    total: usize,
    label: &str,
) -> Result<Range<usize>, Moc3Error> {
    let len = checked_mul(count, element_size, label)?;
    let end = checked_add(offset, len, label)?;
    if offset > total || end > total {
        return Err(Moc3Error::InvalidData(format!(
            "{label} range {offset}..{end} is outside {total} bytes"
        )));
    }
    Ok(offset..end)
}

pub(crate) fn usize_to_u32(value: usize, label: &str) -> Result<u32, Moc3Error> {
    u32::try_from(value)
        .map_err(|_| Moc3Error::Export(format!("{label} exceeds the MOC3 u32 limit: {value}")))
}

pub(crate) fn usize_to_i32(value: usize, label: &str) -> Result<i32, Moc3Error> {
    i32::try_from(value)
        .map_err(|_| Moc3Error::Export(format!("{label} exceeds the MOC3 i32 limit: {value}")))
}

pub(crate) fn finite(value: f32, label: &str) -> Result<f32, Moc3Error> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(Moc3Error::Export(format!("{label} must be finite")))
    }
}

pub(crate) fn id_to_bytes(id: &str, kind: &str) -> Result<[u8; 64], Moc3Error> {
    if id.is_empty() {
        return Err(Moc3Error::Export(format!("{kind} id must not be empty")));
    }
    let bytes = id.as_bytes();
    if bytes.len() >= 64 {
        return Err(Moc3Error::Export(format!(
            "{kind} id `{id}` is {} UTF-8 bytes; MOC3 IDs must be at most 63 bytes",
            bytes.len()
        )));
    }
    let mut packed = [0u8; 64];
    packed[..bytes.len()].copy_from_slice(bytes);
    Ok(packed)
}

pub(crate) fn ids_to_bytes<'a>(
    ids: impl IntoIterator<Item = &'a str>,
    kind: &str,
) -> Result<Vec<u8>, Moc3Error> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for id in ids {
        let packed = id_to_bytes(id, kind)?;
        if !seen.insert(packed) {
            return Err(Moc3Error::Export(format!(
                "duplicate {kind} id `{id}`"
            )));
        }
        out.extend_from_slice(&packed);
    }
    Ok(out)
}

pub(crate) fn unpack_id_64(bytes: &[u8], label: &str) -> Result<String, Moc3Error> {
    if bytes.len() != 64 {
        return Err(Moc3Error::InvalidData(format!(
            "{label} must occupy exactly 64 bytes"
        )));
    }
    let Some(end) = bytes.iter().position(|&byte| byte == 0) else {
        return Err(Moc3Error::InvalidData(format!(
            "{label} is not null-terminated"
        )));
    };
    if end == 0 {
        return Err(Moc3Error::InvalidData(format!("{label} is empty")));
    }
    let value = std::str::from_utf8(&bytes[..end])
        .map_err(|error| Moc3Error::InvalidData(format!("{label} is not valid UTF-8: {error}")))?;
    Ok(value.to_owned())
}

pub(crate) fn read_u16(bytes: &[u8], offset: usize, label: &str) -> Result<u16, Moc3Error> {
    checked_range(offset, 1, 2, bytes.len(), label)?;
    Ok(u16::from_le_bytes([bytes[offset], bytes[offset + 1]]))
}

pub(crate) fn read_u32(bytes: &[u8], offset: usize, label: &str) -> Result<u32, Moc3Error> {
    checked_range(offset, 1, 4, bytes.len(), label)?;
    Ok(u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ]))
}

pub(crate) fn read_i32(bytes: &[u8], offset: usize, label: &str) -> Result<i32, Moc3Error> {
    checked_range(offset, 1, 4, bytes.len(), label)?;
    Ok(i32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ]))
}

pub(crate) fn read_f32(bytes: &[u8], offset: usize, label: &str) -> Result<f32, Moc3Error> {
    checked_range(offset, 1, 4, bytes.len(), label)?;
    Ok(f32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ]))
}

pub(crate) fn read_u32_array(
    bytes: &[u8],
    offset: usize,
    count: usize,
    label: &str,
) -> Result<Vec<u32>, Moc3Error> {
    checked_range(offset, count, 4, bytes.len(), label)?;
    let mut out = Vec::new();
    out.try_reserve_exact(count)
        .map_err(|error| Moc3Error::InvalidData(format!("{label} is too large: {error}")))?;
    for index in 0..count {
        out.push(read_u32(bytes, offset + index * 4, label)?);
    }
    Ok(out)
}

pub(crate) fn read_i32_array(
    bytes: &[u8],
    offset: usize,
    count: usize,
    label: &str,
) -> Result<Vec<i32>, Moc3Error> {
    checked_range(offset, count, 4, bytes.len(), label)?;
    let mut out = Vec::new();
    out.try_reserve_exact(count)
        .map_err(|error| Moc3Error::InvalidData(format!("{label} is too large: {error}")))?;
    for index in 0..count {
        out.push(read_i32(bytes, offset + index * 4, label)?);
    }
    Ok(out)
}

pub(crate) fn read_f32_array(
    bytes: &[u8],
    offset: usize,
    count: usize,
    label: &str,
) -> Result<Vec<f32>, Moc3Error> {
    checked_range(offset, count, 4, bytes.len(), label)?;
    let mut out = Vec::new();
    out.try_reserve_exact(count)
        .map_err(|error| Moc3Error::InvalidData(format!("{label} is too large: {error}")))?;
    for index in 0..count {
        out.push(read_f32(bytes, offset + index * 4, label)?);
    }
    Ok(out)
}

pub(crate) fn read_u16_array(
    bytes: &[u8],
    offset: usize,
    count: usize,
    label: &str,
) -> Result<Vec<u16>, Moc3Error> {
    checked_range(offset, count, 2, bytes.len(), label)?;
    let mut out = Vec::new();
    out.try_reserve_exact(count)
        .map_err(|error| Moc3Error::InvalidData(format!("{label} is too large: {error}")))?;
    for index in 0..count {
        out.push(read_u16(bytes, offset + index * 2, label)?);
    }
    Ok(out)
}

pub(crate) fn find_source_project(bytes: &[u8]) -> Option<Project> {
    let mut offset = align_up(HEADER_SIZE, ALIGNMENT).ok()?;
    while offset
        .checked_add(8)
        .is_some_and(|end| end <= bytes.len())
    {
        if &bytes[offset..offset + 4] == b"L2D0" {
            let length = u32::from_le_bytes([
                bytes[offset + 4],
                bytes[offset + 5],
                bytes[offset + 6],
                bytes[offset + 7],
            ]) as usize;
            let start = offset + 8;
            if start
                .checked_add(length)
                .is_some_and(|end| end <= bytes.len())
            {
                if let Ok(project) = serde_json::from_slice::<Project>(&bytes[start..start + length]) {
                    return Some(project);
                }
            }
        }
        offset = offset.checked_add(ALIGNMENT)?;
    }
    None
}
