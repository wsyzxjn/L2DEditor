use crate::animation::{AnimationTrack, CurveType, TimelineKeyframe};
use crate::model::Project;
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct PendulumState {
    pub position: [f32; 2],
    pub velocity: [f32; 2],
    pub angle: f32,
    pub angular_velocity: f32,
}

#[derive(Debug, Clone, Default)]
pub struct PhysicsSimulator {
    /// State per physics group ID -> list of pendulum states
    group_states: HashMap<String, Vec<PendulumState>>,
    prev_parameters: HashMap<String, f32>,
}

impl PhysicsSimulator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Resets all physical simulations to neutral resting positions.
    pub fn reset(&mut self) {
        self.group_states.clear();
        self.prev_parameters.clear();
    }

    /// Advances the physics simulation by delta time `dt` seconds given current parameters.
    /// Returns the output parameter modifications.
    pub fn update(
        &mut self,
        project: &Project,
        current_parameters: &HashMap<String, f32>,
        dt: f32,
    ) -> HashMap<String, f32> {
        let dt = dt.clamp(0.001, 0.1); // Clamp dt to prevent explosion on frame drops
        let mut output_params: HashMap<String, f32> = HashMap::new();

        for group in &project.physics {
            let num_pendulums = group.pendulums.len();
            if num_pendulums == 0 {
                continue;
            }

            // Ensure state vector exists for this group
            let states = self
                .group_states
                .entry(group.id.clone())
                .or_insert_with(|| vec![PendulumState::default(); num_pendulums]);

            if states.len() != num_pendulums {
                states.resize(num_pendulums, PendulumState::default());
            }

            // 1. Calculate input acceleration from parameter deltas
            let mut total_force_x = 0.0;

            for input in &group.inputs {
                let curr_val = current_parameters.get(&input.param_id).copied().unwrap_or(0.0);
                let prev_val = self
                    .prev_parameters
                    .get(&input.param_id)
                    .copied()
                    .unwrap_or(curr_val);

                let delta = curr_val - prev_val;
                let sign = if input.reflect { -1.0 } else { 1.0 };
                total_force_x += delta * input.weight * sign * 10.0;
            }

            // 2. Simulate pendulum chain
            let mut parent_pos = [0.0, 0.0];
            for (idx, pendulum) in group.pendulums.iter().enumerate() {
                let state = &mut states[idx];

                // Angular physics: spring force restoring to 0, plus input force, plus gravity
                let restoring_spring = -15.0 * state.angle;
                let damping_force = -pendulum.damping * state.angular_velocity * 4.0;
                let external_torque = total_force_x * 0.1;

                let angular_accel = (restoring_spring + damping_force + external_torque) / pendulum.mass.max(0.1);

                state.angular_velocity += angular_accel * dt;
                state.angle += state.angular_velocity * dt;

                // Clamp angle to [-PI/2, PI/2]
                state.angle = state.angle.clamp(-std::f32::consts::FRAC_PI_2, std::f32::consts::FRAC_PI_2);

                // Compute position based on parent and length
                let sin_a = state.angle.sin();
                let cos_a = state.angle.cos();
                state.position = [
                    parent_pos[0] + sin_a * pendulum.length,
                    parent_pos[1] + cos_a * pendulum.length,
                ];

                // Ground line collision clamping (Cubism 5.0 地面判定)
                if let Some(gy) = group.ground_y {
                    if state.position[1] > gy {
                        state.position[1] = gy;
                        // Dampen angular velocity and bounce
                        state.angular_velocity = -state.angular_velocity * 0.3;
                        let dy = (gy - parent_pos[1]).max(0.0);
                        let clamped_cos = (dy / pendulum.length.max(1.0)).clamp(0.0, 1.0);
                        let sign = if state.angle >= 0.0 { 1.0 } else { -1.0 };
                        state.angle = sign * clamped_cos.acos();
                    }
                }

                // Radial boundary limit
                if let Some(mr) = group.max_radius {
                    let r = (state.position[0].powi(2) + state.position[1].powi(2)).sqrt();
                    if r > mr && r > 1e-4 {
                        state.position[0] = (state.position[0] / r) * mr;
                        state.position[1] = (state.position[1] / r) * mr;
                    }
                }

                parent_pos = state.position;
            }

            // 3. Map to output parameters
            for output in &group.outputs {
                if output.pendulum_index < states.len() {
                    let angle_deg = states[output.pendulum_index].angle.to_degrees();
                    let val = angle_deg * output.angle_scale * output.weight;

                    // Blend or accumulate into output_params
                    let entry = output_params.entry(output.param_id.clone()).or_insert(0.0);
                    *entry += val;
                }
            }
        }

        // Store previous parameter values for delta calculation next frame
        self.prev_parameters = current_parameters.clone();

        output_params
    }
}

/// Simulates all `PhysicsGroup` pendulums across an animation's timeline and bakes the resulting
/// output parameter values directly into `AnimationTrack` keyframes (`CMD_BAKE_PHYSICS`).
/// Returns the number of output parameter tracks baked.
pub fn bake_physics_to_animation(
    project: &mut Project,
    animation_id: &str,
) -> Result<usize, String> {
    if project.physics.is_empty() {
        return Ok(0);
    }
    let anim_idx = project
        .animations
        .iter()
        .position(|a| a.id == animation_id)
        .ok_or_else(|| format!("Animation '{}' not found", animation_id))?;

    let fps = project.animations[anim_idx].fps.max(1.0);
    let duration = project.animations[anim_idx].duration_frames.max(1.0);
    let total_frames = duration.ceil() as usize;
    let dt = 1.0 / fps;

    // Collect all output parameter IDs driven by physics
    let mut output_param_ids: Vec<String> = Vec::new();
    for group in &project.physics {
        for out in &group.outputs {
            if !output_param_ids.contains(&out.param_id) {
                output_param_ids.push(out.param_id.clone());
            }
        }
    }

    if output_param_ids.is_empty() {
        return Ok(0);
    }

    // Exclude frozen tracks
    let frozen_ids: Vec<String> = project.animations[anim_idx]
        .tracks
        .iter()
        .filter(|t| t.frozen)
        .map(|t| t.target_param_id.clone())
        .collect();
    output_param_ids.retain(|id| !frozen_ids.contains(id));

    let mut sim = PhysicsSimulator::new();
    let mut baked_tracks: HashMap<String, Vec<TimelineKeyframe>> = HashMap::new();
    for pid in &output_param_ids {
        baked_tracks.insert(pid.clone(), Vec::with_capacity(total_frames + 1));
    }

    for f in 0..=total_frames {
        let frame_f = (f as f32).min(duration);
        let mut current_params = project.animations[anim_idx].evaluate_at_frame(frame_f);
        // Fill defaults for parameters not on tracks
        for p in &project.parameters {
            current_params.entry(p.id.clone()).or_insert(p.default);
        }
        let phys_out = sim.update(project, &current_params, dt);
        for pid in &output_param_ids {
            let val = phys_out.get(pid).copied().unwrap_or(0.0);
            if let Some(kfs) = baked_tracks.get_mut(pid) {
                kfs.push(TimelineKeyframe {
                    frame: frame_f,
                    value: (val * 1000.0).round() / 1000.0,
                    curve: CurveType::Linear,
                    bezier_handles: None,
                });
            }
        }
    }

    let anim = &mut project.animations[anim_idx];
    let mut baked_count = 0;
    for (pid, keyframes) in baked_tracks {
        if let Some(existing) = anim.tracks.iter_mut().find(|t| t.target_param_id == pid) {
            existing.keyframes = keyframes;
        } else {
            anim.tracks.push(AnimationTrack {
                target_param_id: pid,
                keyframes,
                fade_in_ms: None,
                fade_out_ms: None,
                frozen: false,
            });
        }
        baked_count += 1;
    }

    Ok(baked_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::animation::Animation;
    use crate::model::*;

    #[test]
    fn test_physics_simulation_oscillation() {
        let mut project = Project::default();
        project.physics.push(PhysicsGroup {
            id: "hair_front".into(),
            name: "Hair Front Physics".into(),
            inputs: vec![PhysicsInput {
                param_id: "ParamAngleX".into(),
                weight: 1.0,
                reflect: false,
            }],
            outputs: vec![PhysicsOutput {
                param_id: "ParamHairFront".into(),
                pendulum_index: 0,
                angle_scale: 1.0,
                weight: 1.0,
            }],
            pendulums: vec![PhysicsPendulum {
                length: 50.0,
                damping: 0.8,
                mass: 1.0,
            }],
            ground_y: None,
            max_radius: None,
        });

        let mut sim = PhysicsSimulator::new();

        let mut params = HashMap::new();
        params.insert("ParamAngleX".into(), 0.0);

        // Frame 1: at rest
        let out1 = sim.update(&project, &params, 0.016);
        assert_eq!(out1.get("ParamHairFront").copied().unwrap_or(0.0), 0.0);

        // Frame 2: sudden head turn to 30
        params.insert("ParamAngleX".into(), 30.0);
        let out2 = sim.update(&project, &params, 0.016);
        let hair_val = out2.get("ParamHairFront").copied().unwrap_or(0.0);
        // Should produce non-zero hair sway
        assert!(hair_val.abs() > 0.01);
    }

    #[test]
    fn test_bake_physics_to_animation() {
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
            id: "ParamHairFront".into(),
            name: "Hair Front".into(),
            min: -1.0,
            max: 1.0,
            default: 0.0,
            repeats: false,
            group_id: None,
            locked: false,
        });
        project.physics.push(PhysicsGroup {
            id: "hair_front".into(),
            name: "Hair Front Physics".into(),
            inputs: vec![PhysicsInput {
                param_id: "ParamAngleX".into(),
                weight: 1.0,
                reflect: false,
            }],
            outputs: vec![PhysicsOutput {
                param_id: "ParamHairFront".into(),
                pendulum_index: 0,
                angle_scale: 0.1,
                weight: 1.0,
            }],
            pendulums: vec![PhysicsPendulum {
                length: 40.0,
                damping: 0.85,
                mass: 1.0,
            }],
            ground_y: None,
            max_radius: None,
        });
        project.animations.push(Animation {
            id: "idle".into(),
            name: "Idle".into(),
            duration_frames: 10.0,
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
                        frame: 5.0,
                        value: 30.0,
                        curve: CurveType::Linear,
                        bezier_handles: None,
                    },
                    TimelineKeyframe {
                        frame: 10.0,
                        value: 0.0,
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
        });

        let baked = bake_physics_to_animation(&mut project, "idle").unwrap();
        assert_eq!(baked, 1);
        let hair_track = project.animations[0]
            .tracks
            .iter()
            .find(|t| t.target_param_id == "ParamHairFront")
            .expect("Expected baked ParamHairFront track");
        assert_eq!(hair_track.keyframes.len(), 11);
        assert!(hair_track.keyframes.iter().any(|k| k.value.abs() > 0.001));
    }

    #[test]
    fn test_physics_ground_clamping() {
        let mut project = Project::default();
        project.physics.push(PhysicsGroup {
            id: "skirt".into(),
            name: "Skirt Physics".into(),
            inputs: vec![PhysicsInput {
                param_id: "ParamAngleX".into(),
                weight: 1.0,
                reflect: false,
            }],
            outputs: vec![PhysicsOutput {
                param_id: "ParamSkirt".into(),
                pendulum_index: 0,
                angle_scale: 1.0,
                weight: 1.0,
            }],
            pendulums: vec![PhysicsPendulum {
                length: 100.0,
                damping: 0.5,
                mass: 1.0,
            }],
            ground_y: Some(50.0), // Ground at y = 50.0
            max_radius: Some(80.0),
        });

        let mut sim = PhysicsSimulator::new();
        let mut params = HashMap::new();
        params.insert("ParamAngleX".into(), 30.0);

        for _ in 0..10 {
            sim.update(&project, &params, 0.016);
        }
        let states = sim.group_states.get("skirt").unwrap();
        // Y position must not penetrate ground line 50.0
        assert!(states[0].position[1] <= 50.001);
    }
}
