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

#[cfg(test)]
mod tests {
    use super::*;
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
}
