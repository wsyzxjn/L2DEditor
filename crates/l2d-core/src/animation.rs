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
