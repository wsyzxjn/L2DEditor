use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
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
    /// Tangents for cubic bezier: [cx1, cy1, cx2, cy2]
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
    pub fn evaluate_at_frame(&self, frame: f32) -> HashMap<String, f32> {
        let mut result = HashMap::new();
        let target_frame = if self.loop_playback && self.duration_frames > 0.0 {
            frame.rem_euclid(self.duration_frames)
        } else {
            frame.clamp(0.0, self.duration_frames)
        };

        for track in &self.tracks {
            if track.keyframes.is_empty() {
                continue;
            }
            if track.keyframes.len() == 1 {
                result.insert(track.target_param_id.clone(), track.keyframes[0].value);
                continue;
            }

            // Before first keyframe
            if target_frame <= track.keyframes[0].frame {
                result.insert(track.target_param_id.clone(), track.keyframes[0].value);
                continue;
            }

            // After last keyframe
            let last_idx = track.keyframes.len() - 1;
            if target_frame >= track.keyframes[last_idx].frame {
                result.insert(track.target_param_id.clone(), track.keyframes[last_idx].value);
                continue;
            }

            // Find segment [kf_i, kf_{i+1}]
            for i in 0..track.keyframes.len() - 1 {
                let k0 = &track.keyframes[i];
                let k1 = &track.keyframes[i + 1];

                if target_frame >= k0.frame && target_frame <= k1.frame {
                    let span = k1.frame - k0.frame;
                    let t = if span.abs() < 1e-6 {
                        0.0
                    } else {
                        (target_frame - k0.frame) / span
                    };

                    let val = match k0.curve {
                        CurveType::Stepped => k0.value,
                        CurveType::Linear => k0.value + t * (k1.value - k0.value),
                        CurveType::Bezier => {
                            // Smooth Hermite / Bezier ease
                            let t2 = t * t;
                            let t3 = t2 * t;
                            let h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
                            let h10 = t3 - 2.0 * t2 + t;
                            let h01 = -2.0 * t3 + 3.0 * t2;
                            let h11 = t3 - t2;
                            // Tangents default to smooth curve
                            let m0 = k1.value - k0.value;
                            let m1 = m0;
                            h00 * k0.value + h10 * m0 + h01 * k1.value + h11 * m1
                        }
                    };

                    result.insert(track.target_param_id.clone(), val);
                    break;
                }
            }
        }

        result
    }

    /// Evaluates parameter values given elapsed time in seconds.
    pub fn evaluate_at_time(&self, time_sec: f32) -> HashMap<String, f32> {
        self.evaluate_at_frame(time_sec * self.fps)
    }
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
