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
            }],
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
    /// Parses a legacy Live2D Animator .mtn file into an Animation.
    pub fn from_mtn_str(id: &str, name: &str, content: &str) -> Result<Self, String> {
        let mut fps = 30.0;
        let mut tracks = Vec::new();
        let mut max_frames = 0.0f32;

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

            if let Some((target, values_str)) = trimmed.split_once('=') {
                let target_param = target.trim();
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
                        target_param_id: target_param.to_string(),
                        keyframes,
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
}

    #[test]
    fn test_parse_real_haru_idle_file() {
        let path = "/Volumes/AmatsukaM/Applications/Live2D Cubism 5.3/data/template/mtn/idle/haru_idle_01.mtn";
        if std::path::Path::new(path).exists() {
            let content = std::fs::read_to_string(path).expect("Failed to read haru_idle_01.mtn");
            let anim = Animation::from_mtn_str("haru_idle_01", "Haru Idle 01", &content).unwrap();
            assert_eq!(anim.fps, 30.0);
            assert!(anim.duration_frames > 100.0);
            assert!(anim.tracks.len() >= 15);

            // Verify evaluating at frame 10 produces expected continuous motion
            let f10 = anim.evaluate_at_frame(10.0);
            assert!(f10.contains_key("PARAM_ANGLE_X"));
            assert!(f10.contains_key("PARAM_EYE_L_OPEN"));
            assert_eq!(f10.get("PARAM_EYE_L_OPEN").copied().unwrap(), 1.0);
        }
    }
