use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CurveType {
    Linear,
    Stepped,
    Bezier,
}

impl Default for CurveType {
    fn default() -> Self {
        Self::Linear
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct TimelineKeyframe {
    pub frame: f32,
    pub value: f32,
    #[serde(default)]
    pub curve: CurveType,
    /// Cubic Bézier handles in absolute timeline coordinates:
    /// `[in_frame, in_value, out_frame, out_value]`. The out-handle shapes the segment that
    /// starts at this keyframe, the in-handle shapes the segment that ends here.
    /// See [`bezier_segment_controls`] for defaults and clamping.
    #[serde(default)]
    pub bezier_handles: Option<[f32; 4]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AnimationTrack {
    pub target_param_id: String,
    pub keyframes: Vec<TimelineKeyframe>,
    #[serde(default)]
    pub fade_in_ms: Option<f32>,
    #[serde(default)]
    pub fade_out_ms: Option<f32>,
    #[serde(default)]
    pub frozen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct TimelineMarker {
    pub frame: f32,
    pub label: String,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FormAnimationKeyframe {
    pub frame: f32,
    pub offsets: Vec<[f32; 2]>,
    #[serde(default)]
    pub curve: CurveType,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FormAnimationTrack {
    pub target_node_id: String,
    pub keyframes: Vec<FormAnimationKeyframe>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Animation {
    pub id: String,
    pub name: String,
    pub duration_frames: f32,
    #[serde(default = "default_fps")]
    pub fps: f32,
    #[serde(default)]
    pub loop_playback: bool,
    pub tracks: Vec<AnimationTrack>,
    #[serde(default)]
    pub markers: Vec<TimelineMarker>,
    #[serde(default)]
    pub form_tracks: Vec<FormAnimationTrack>,
}

fn default_fps() -> f32 {
    30.0
}

impl Animation {
    /// Evaluates all parameter values at the given frame position.
    ///
    /// Never panics: a NaN frame is treated as frame 0, and a negative/NaN `duration_frames`
    /// is treated as 0. Keyframes are evaluated in frame order (see [`sanitized_keyframes`]),
    /// exactly as they are written to `.motion3.json`, so preview matches export.
    pub fn evaluate_at_frame(&self, frame: f32) -> HashMap<String, f32> {
        let mut result = HashMap::new();
        let frame = if frame.is_nan() { 0.0 } else { frame };
        let duration = if self.duration_frames > 0.0 { self.duration_frames } else { 0.0 };
        let target_frame = if self.loop_playback && duration > 0.0 && duration.is_finite() && frame.is_finite() {
            frame.rem_euclid(duration)
        } else {
            frame.max(0.0).min(duration)
        };

        for track in &self.tracks {
            if let Some(val) = evaluate_keyframes(&sanitized_keyframes(&track.keyframes), target_frame) {
                result.insert(track.target_param_id.clone(), val);
            }
        }

        result
    }

    /// Evaluates parameter values given elapsed time in seconds.
    pub fn evaluate_at_time(&self, time_sec: f32) -> HashMap<String, f32> {
        self.evaluate_at_frame(time_sec * self.fps)
    }
}

/// Returns the keyframes that can actually be played back: entries with a non-finite frame or
/// value are dropped and the rest are stably sorted by frame. Shared by preview evaluation and
/// the motion3 exporter so both see the same curve.
pub fn sanitized_keyframes(keyframes: &[TimelineKeyframe]) -> Cow<'_, [TimelineKeyframe]> {
    let all_finite = keyframes.iter().all(|k| k.frame.is_finite() && k.value.is_finite());
    let sorted = keyframes.windows(2).all(|w| w[0].frame <= w[1].frame);
    if all_finite && sorted {
        return Cow::Borrowed(keyframes);
    }
    let mut out: Vec<TimelineKeyframe> = keyframes
        .iter()
        .filter(|k| k.frame.is_finite() && k.value.is_finite())
        .cloned()
        .collect();
    out.sort_by(|a, b| a.frame.total_cmp(&b.frame));
    Cow::Owned(out)
}

/// Cubic Bézier control points `(P1, P2)` for the segment `k0 -> k1`, in absolute
/// (frame, value) coordinates.
///
/// Handle convention (`bezier_handles = [in_frame, in_value, out_frame, out_value]`, absolute
/// timeline coordinates, as written by [`auto_smooth_track_tangents`]):
/// - `P1` is `k0`'s out-handle, `P2` is `k1`'s in-handle.
/// - A missing handle defaults to a flat tangent placed at one third of the segment
///   (`(f0 + span/3, v0)` / `(f1 - span/3, v1)`), i.e. an ease-in-out.
/// - Handle frames are clamped into `[f0, f1]` so the curve stays a function of time
///   (the motion3 runtime requires this as well). Non-finite handles fall back to the default.
pub fn bezier_segment_controls(k0: &TimelineKeyframe, k1: &TimelineKeyframe) -> ([f32; 2], [f32; 2]) {
    let (f0, f1) = (k0.frame, k1.frame);
    let third = (f1 - f0) / 3.0;
    let finite = |h: &[f32; 4], a: usize| h[a].is_finite() && h[a + 1].is_finite();
    let p1 = match &k0.bezier_handles {
        Some(h) if finite(h, 2) => [h[2].max(f0).min(f1), h[3]],
        _ => [f0 + third, k0.value],
    };
    let p2 = match &k1.bezier_handles {
        Some(h) if finite(h, 0) => [h[0].max(f0).min(f1), h[1]],
        _ => [f1 - third, k1.value],
    };
    (p1, p2)
}

fn cubic(a: f64, b: f64, c: f64, d: f64, t: f64) -> f64 {
    let u = 1.0 - t;
    u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d
}

/// Evaluates the cubic Bézier segment `k0 -> k1` at `frame` by solving `x(t) = frame`
/// (bisection; `x(t)` is monotonic because the control frames are clamped into the segment).
pub fn evaluate_bezier_segment(k0: &TimelineKeyframe, k1: &TimelineKeyframe, frame: f32) -> f32 {
    let (p1, p2) = bezier_segment_controls(k0, k1);
    let (x0, x1, x2, x3) = (k0.frame as f64, p1[0] as f64, p2[0] as f64, k1.frame as f64);
    if (x3 - x0).abs() < 1e-9 {
        return k1.value;
    }
    let x = (frame as f64).clamp(x0, x3);
    let (mut lo, mut hi) = (0.0f64, 1.0f64);
    for _ in 0..48 {
        let mid = 0.5 * (lo + hi);
        if cubic(x0, x1, x2, x3, mid) < x {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let t = 0.5 * (lo + hi);
    cubic(k0.value as f64, p1[1] as f64, p2[1] as f64, k1.value as f64, t) as f32
}

/// Evaluates a sorted keyframe list at `frame`; `None` for an empty list.
fn evaluate_keyframes(keyframes: &[TimelineKeyframe], frame: f32) -> Option<f32> {
    let first = keyframes.first()?;
    let last = keyframes.last()?;
    if frame <= first.frame {
        return Some(first.value);
    }
    if frame >= last.frame {
        return Some(last.value);
    }
    // First segment whose end is past `frame` (keyframes are sorted).
    let i = keyframes.partition_point(|k| k.frame <= frame).max(1) - 1;
    let k0 = &keyframes[i];
    let k1 = &keyframes[(i + 1).min(keyframes.len() - 1)];
    let span = k1.frame - k0.frame;
    if span <= 1e-6 {
        return Some(k1.value);
    }
    let t = (frame - k0.frame) / span;
    Some(match k0.curve {
        CurveType::Stepped => k0.value,
        CurveType::Linear => k0.value + t * (k1.value - k0.value),
        CurveType::Bezier => evaluate_bezier_segment(k0, k1, frame),
    })
}

/// Automatically computes smooth cubic Bézier tangent handles for all keyframes in an animation track.
/// Matches Cubism Animator "自動スムージング" / Catmull-Rom Hermite slope estimation.
pub fn auto_smooth_track_tangents(track: &mut AnimationTrack) {
    let n = track.keyframes.len();
    if n < 2 {
        return;
    }
    for i in 0..n {
        track.keyframes[i].curve = CurveType::Bezier;
        let t_curr = track.keyframes[i].frame;
        let v_curr = track.keyframes[i].value;

        let dt_prev = if i > 0 { t_curr - track.keyframes[i - 1].frame } else { 1.0 };
        let dt_next = if i + 1 < n { track.keyframes[i + 1].frame - t_curr } else { 1.0 };

        let slope = if i == 0 {
            (track.keyframes[1].value - v_curr) / dt_next.max(1e-4)
        } else if i == n - 1 {
            (v_curr - track.keyframes[i - 1].value) / dt_prev.max(1e-4)
        } else {
            let total_dt = track.keyframes[i + 1].frame - track.keyframes[i - 1].frame;
            (track.keyframes[i + 1].value - track.keyframes[i - 1].value) / total_dt.max(1e-4)
        };

        let cx1 = t_curr - dt_prev / 3.0;
        let cy1 = v_curr - slope * (dt_prev / 3.0);
        let cx2 = t_curr + dt_next / 3.0;
        let cy2 = v_curr + slope * (dt_next / 3.0);
        track.keyframes[i].bezier_handles = Some([cx1, cy1, cx2, cy2]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_animation_linear_interpolation() {
        let anim = Animation {
            id: "anim1".into(),
            name: "Test Motion".into(),
            duration_frames: 30.0,
            fps: 30.0,
            loop_playback: false,
            tracks: vec![AnimationTrack {
                target_param_id: "ParamAngleX".into(),
                keyframes: vec![
                    TimelineKeyframe {
                        frame: 0.0,
                        value: -30.0,
                        curve: CurveType::Linear,
                        bezier_handles: None,
                    },
                    TimelineKeyframe {
                        frame: 30.0,
                        value: 30.0,
                        curve: CurveType::Linear,
                        bezier_handles: None,
                    },
                ],
                fade_in_ms: None,
                fade_out_ms: None,
                frozen: false,
            }],
            markers: vec![],
            form_tracks: vec![],
        };

        // At frame 0 -> -30
        let val0 = anim.evaluate_at_frame(0.0);
        assert!((val0.get("ParamAngleX").unwrap() - -30.0).abs() < 1e-4);

        // At frame 15 -> 0
        let val15 = anim.evaluate_at_frame(15.0);
        assert!((val15.get("ParamAngleX").unwrap() - 0.0).abs() < 1e-4);

        // At frame 30 -> 30
        let val30 = anim.evaluate_at_frame(30.0);
        assert!((val30.get("ParamAngleX").unwrap() - 30.0).abs() < 1e-4);
    }

    #[test]
    fn test_animation_bezier_uses_cubic_segment_not_linear() {
        let anim = Animation {
            id: "bezier".into(),
            name: "Bezier".into(),
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
                        bezier_handles: None,
                    },
                    TimelineKeyframe {
                        frame: 30.0,
                        value: 30.0,
                        curve: CurveType::Linear,
                        bezier_handles: None,
                    },
                ],
                fade_in_ms: None,
                fade_out_ms: None,
                frozen: false,
            }],
            markers: Vec::new(),
            form_tracks: Vec::new(),
        };
        let value = anim.evaluate_at_frame(7.5)["ParamAngleX"];
        assert!((value - 4.6875).abs() < 1e-3, "got {value}");
        assert!((value - 7.5).abs() > 1.0);
    }
}

impl Animation {
    /// Converts legacy Cubism 2.1 parameter IDs (`PARAM_ANGLE_X`) to Cubism 3/4/5 standard IDs (`ParamAngleX`).
    /// Matches `com/live2d/cubism/doc/model/io/IdConverter`.
    pub fn convert_legacy_param_id(legacy_id: &str) -> String {
        let trimmed = legacy_id.trim();
        if !trimmed.starts_with("PARAM_") {
            return trimmed.to_string();
        }
        let mut out = String::from("Param");
        for part in trimmed["PARAM_".len()..].split('_') {
            if part.is_empty() {
                continue;
            }
            let mut chars = part.chars();
            if let Some(first) = chars.next() {
                out.push(first.to_ascii_uppercase());
                for c in chars {
                    out.push(c.to_ascii_lowercase());
                }
            }
        }
        out
    }

    /// Parses a legacy Live2D Animator .mtn file into an Animation.
    pub fn from_mtn_str(id: &str, name: &str, content: &str) -> Result<Self, String> {
        Self::from_mtn_str_with_options(id, name, content, false)
    }

    /// Parses a .mtn file with optional legacy parameter ID conversion (`PARAM_ANGLE_X` -> `ParamAngleX`).
    pub fn from_mtn_str_with_options(
        id: &str,
        name: &str,
        content: &str,
        normalize_ids: bool,
    ) -> Result<Self, String> {
        let mut fps = 30.0;
        let mut tracks = Vec::new();
        let mut max_frames = 0.0f32;
        let mut fade_in_map: HashMap<String, f32> = HashMap::new();
        let mut fade_out_map: HashMap<String, f32> = HashMap::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if let Some(rest) = trimmed.strip_prefix("$fps=") {
                if let Ok(val) = rest.parse::<f32>() {
                    fps = val;
                }
                continue;
            }

            if let Some(rest) = trimmed.strip_prefix("$fadein:") {
                if let Some((param, val_str)) = rest.split_once('=') {
                    if let Ok(ms) = val_str.trim().parse::<f32>() {
                        let pid = if normalize_ids {
                            Self::convert_legacy_param_id(param)
                        } else {
                            param.trim().to_string()
                        };
                        fade_in_map.insert(pid, ms);
                    }
                }
                continue;
            }

            if let Some(rest) = trimmed.strip_prefix("$fadeout:") {
                if let Some((param, val_str)) = rest.split_once('=') {
                    if let Ok(ms) = val_str.trim().parse::<f32>() {
                        let pid = if normalize_ids {
                            Self::convert_legacy_param_id(param)
                        } else {
                            param.trim().to_string()
                        };
                        fade_out_map.insert(pid, ms);
                    }
                }
                continue;
            }

            // Skip any other metadata directives starting with '$'
            if trimmed.starts_with('$') {
                continue;
            }

            if let Some((target, values_str)) = trimmed.split_once('=') {
                let target_param = if normalize_ids {
                    Self::convert_legacy_param_id(target)
                } else {
                    target.trim().to_string()
                };
                let mut keyframes = Vec::new();

                for (frame_idx, val_str) in values_str.split(',').enumerate() {
                    let val_trimmed = val_str.trim();
                    if let Ok(v) = val_trimmed.parse::<f32>() {
                        let f = frame_idx as f32;
                        if f > max_frames {
                            max_frames = f;
                        }
                        keyframes.push(TimelineKeyframe {
                            frame: f,
                            value: v,
                            curve: CurveType::Linear,
                            bezier_handles: None,
                        });
                    }
                }

                if !keyframes.is_empty() {
                    tracks.push(AnimationTrack {
                        fade_in_ms: fade_in_map.get(&target_param).copied(),
                        fade_out_ms: fade_out_map.get(&target_param).copied(),
                        target_param_id: target_param,
                        keyframes,
                        frozen: false,
                    });
                }
            }
        }

        Ok(Animation {
            id: id.to_string(),
            name: name.to_string(),
            duration_frames: max_frames,
            fps,
            loop_playback: true,
            tracks,
            markers: Vec::new(),
            form_tracks: Vec::new(),
        })
    }
}

#[cfg(test)]
mod mtn_tests {
    use super::*;

    #[test]
    fn test_parse_mtn_data() {
        let mtn = "$fps=30\nPARAM_ANGLE_X=0.0,5.0,10.0\nPARAM_ANGLE_Y=0.0,-2.5,-5.0\n";
        let anim = Animation::from_mtn_str("m1", "Haru Idle", mtn).unwrap();
        assert_eq!(anim.fps, 30.0);
        assert_eq!(anim.duration_frames, 2.0);
        assert_eq!(anim.tracks.len(), 2);

        let frame1 = anim.evaluate_at_frame(1.0);
        assert!((frame1.get("PARAM_ANGLE_X").unwrap() - 5.0).abs() < 1e-4);
        assert!((frame1.get("PARAM_ANGLE_Y").unwrap() - -2.5).abs() < 1e-4);
    }

    #[test]
    fn test_parse_mtn_fadein_fadeout_and_id_converter() {
        let mtn = "$fps=30\n$fadein:PARAM_EYE_L_OPEN=200\n$fadeout:PARAM_EYE_L_OPEN=250\nPARAM_EYE_L_OPEN=1.0,0.5,0.0\nPARAM_MOUTH_OPEN_Y=0.0,1.0\n";
        let anim = Animation::from_mtn_str_with_options("eps1", "Epsilon", mtn, true).unwrap();
        // Must not create bogus tracks for $fadein / $fadeout
        assert_eq!(anim.tracks.len(), 2);
        let eye_track = anim
            .tracks
            .iter()
            .find(|t| t.target_param_id == "ParamEyeLOpen")
            .expect("Expected converted ParamEyeLOpen track");
        assert_eq!(eye_track.fade_in_ms, Some(200.0));
        assert_eq!(eye_track.fade_out_ms, Some(250.0));
        assert!(anim.tracks.iter().any(|t| t.target_param_id == "ParamMouthOpenY"));
    }
}

    #[test]
    fn test_parse_complex_idle_mtn_stream() {
        let content = "# Live2D Animator Motion Data\n$fps=30\nPARAM_ANGLE_X=0,1.5,3.2,5.0,8.4,10.0,12.5,14.0,12.0,8.0,4.0,0.0\nPARAM_ANGLE_Y=0,-1.0,-2.5,-4.0,-6.0,-8.0,-6.0,-4.0,-2.0,0.0,0.0,0.0\nPARAM_EYE_L_OPEN=1,1,1,1,0.5,0,0,0.5,1,1,1,1\nPARAM_EYE_R_OPEN=1,1,1,1,0.5,0,0,0.5,1,1,1,1\n";
        let anim = Animation::from_mtn_str("idle_01", "Idle 01", content).unwrap();
        assert_eq!(anim.fps, 30.0);
        assert_eq!(anim.duration_frames, 11.0);
        assert_eq!(anim.tracks.len(), 4);
        let f5 = anim.evaluate_at_frame(5.0);
        assert_eq!(f5.get("PARAM_ANGLE_X").copied().unwrap(), 10.0);
        assert_eq!(f5.get("PARAM_EYE_L_OPEN").copied().unwrap(), 0.0);
    }
