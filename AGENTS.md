# AGENTS.md — L2DEditor Development & Agent Operations Guide

## 1. Hard Operational Constraints
- **Git Commit Signing**: Every Git commit MUST be signed (`commit.gpgsign=true`). Never bypass signing with `-c commit.gpgsign=false`. When running inside a sandbox, request escalation (`sandbox_permissions: "require_escalated"`) for `git commit` so the SSH signing agent is accessible.
- **Remote Git Safety**: Never run `git push` or modify remote Git repositories without explicit user confirmation in the current turn.
- **Zero Closed-Source Dependency**: Production and test code must have zero runtime reliance on closed-source Live2D Cubism binaries or local `/Volumes/AmatsukaM/Applications/Live2D Cubism*` paths. All core evaluation, `.moc3` serialization, runtime bundle generation, and neural inference run in pure Rust (`crates/l2d-core`).
- **Strict Wheel-Reuse Discipline**: Before implementing any non-core utility, evaluate and reuse mature libraries already in the workspace (`coss` / `@base-ui-components/react`, `dockview-react`, `cmdk`, `PixiJS v8`, `ag-psd`, `earcut`, `immer`, `zod`, `@modelcontextprotocol/sdk`, `serde`, `schemars`). Only self-implement core 2D puppet rigging, deformation, and binary format specifications where no open-source wheel exists.

---

## 2. Monorepo Architecture

| Path | Responsibility |
| :--- | :--- |
| `crates/l2d-core` | Pure-Rust kernel: hierarchical `WarpDeformer` / `RotationDeformer` / `DeformPath` / `ArtMesh` / `ArtPath` / `Glue` evaluation (`evaluator.rs`), multi-dimensional keyform interpolation (`ExtendedInterpolationType`: Linear, Circle, Bezier), spec-compliant Live2D `.moc3` v1–v5 binary serializer & parser (`moc3.rs`), full runtime bundle & 2D Shelf Atlas packer (`exporter.rs`), 3-layer MLP (`Gemm + ReLU`) & 13-class `PredClass` classifier (`neural.rs`), pendulum physics & track baking (`physics.rs`), `.mtn` parser with `IdConverter` & `$fadein`/`$fadeout` (`animation.rs`), and topology/protrusion/mask linter (`lint.rs`). |
| `crates/l2d-wasm` | WebAssembly bindings compiled via `wasm-pack` to `packages/schema/wasm-web` (Browser/Electron) and `packages/schema/wasm-node` (Node/CLI/MCP). |
| `packages/schema` | TypeScript contract types (`Project`, `Node`, `Parameter`, `KeyformBinding`, `PhysicsGroup`, `Animation`, `Expression`, `PoseGroup`), JSON Schema, and JS fallback evaluator. |
| `packages/command` | `immer` (`produceWithPatches`) + `zod` Command Bus with RFC 6902 JSON patches, atomic transactions (`beginTransaction` / `commitTransaction` / `rollbackTransaction`), dry-run preview, Undo/Redo stack, and 50+ editing commands & macros (`macro.synthesize_4_corners`, `deform.soft_brush`, `mesh.add_vertex`, `mesh.flip_edge`, `glue.paint_weights`, etc.). |
| `packages/psd` | Layered PSD import (`importPsdBuffer`), non-destructive artwork reload, `earcut` Delaunay mesh generation, and layered PSD export (`exportModelToPsdBuffer`). |
| `packages/renderer` | PixiJS v8 WebGL2 viewport adapter, `@napi-rs/canvas` headless deterministic PNG/GIF/WebM/MP4 renderer, WAV lip-sync analyzer (`analyzeWavForLipSync`), texture atlas composer (`generateTextureAtlas`), and runtime bundle exporter (`exportRuntimePackage`). |
| `apps/cli` | Headless `l2d` CLI tool providing 100% terminal parity with GUI operations. |
| `packages/mcp-server` | Official Model Context Protocol (MCP) stdio server + WebSocket External Integration server (port `22033`, compatible with Cubism 5.1–5.4 JSON-RPC actions). |
| `apps/desktop` | Electron + `coss` (24px high-density DCC dark theme) + `dockview-react` 4-pane desktop editor + trilingual i18n (`zh-CN`, `ja`, `en`) with automatic system language detection. |

---

## 3. Export Formats & Alignment Matrix

All runtime and exchange formats are generated in pure Rust (`crates/l2d-core/src/moc3.rs` and `crates/l2d-core/src/exporter.rs`) and exposed via Wasm, CLI, MCP, and Desktop UI:

- **`.moc3` (`ver = 1..=5`, default `5` = `V5_00_00`)**: 64-byte header (`0..64`), Section Offset Table (`64..704`), `EmCountInfo` (`1984..`), `EmCanvasInfo`, `Parts`, `Deformers`, `ArtMeshes` (including tessellated `ArtPath` strokes and `MorphTarget` blend shapes), `Parameters`, `KeyformPositions` (64-byte aligned), `ParameterBindingIndices`, `KeyformBindings`, `ParameterBindings`, `Keys`, `Uvs`, `PositionIndices`, `DrawableMasks`, `DrawOrderGroups` (`maxDrawOrder` / `minDrawOrder`), `MultiplyColors`/`ScreenColors` (v4+), and `BlendMode`/`Offscreen` (v5). Verified with `csmHasMocConsistency == 1`, `csmReviveMocInPlace`, `csmInitializeModelInPlace`, and `csmUpdateModel`.
- **`.model3.json`**: Runtime manifest linking `.moc3`, packed texture atlas sheets, `.physics3.json`, `.cdi3.json`, `.userdata3.json`, `.pose3.json`, `.motionsync3.json`, `motions/*.motion3.json`, `expressions/*.exp3.json`, `Groups` (`EyeBlink`, `LipSync`), and `HitAreas`.
- **`.physics3.json`**: Pendulum rig with `Meta` (`Fps`, `EffectiveForces`, `PhysicsDictionary`) and per-group `Normalization` (`Position`, `Angle`), `Input`, `Output`, and `Vertices`.
- **`.cdi3.json`**: Display info for `Parameters`, `ParameterGroups`, `Parts`, and 2D `CombinedParameters`.
- **`motions/*.motion3.json`**: Parameter curves (`Linear`, `Bezier` with custom tangent handles, `Stepped`), per-track `FadeInTime`/`FadeOutTime`, and timeline `UserData` events from `anim.markers`.
- **`expressions/*.exp3.json`**, **`.pose3.json`**, **`.userdata3.json`**, **`.motionsync3.json`**: Full runtime auxiliary manifests.
- **`.psd` & Modeling Templates (`.json`)**: Multi-layer evaluated PSD round-trip (`export-psd`), runtime package bidirectional import (`import-bundle` / `importRuntimePackage`), and reusable rig template export/apply (`export-template` / `template.apply`).

---

## 4. Agent-First Workflow (CLI & MCP)

Agents can drive the entire 2D puppet rigging lifecycle without opening a GUI window:

1. **Import PSD & Auto-Mesh**:
   - CLI: `node apps/cli/dist/index.js import-psd character.psd -o ./char.l2dproj -d 2`
   - MCP: `l2d_import_psd`
2. **Auto-Rig & AI Face Deformer Generation**:
   - CLI: `node apps/cli/dist/index.js auto-rig ./char.l2dproj && node apps/cli/dist/index.js ai-face-rig ./char.l2dproj`
   - MCP: `l2d_exec` (`macro.auto_rig` / `macro.ai_full_body_deformers`) + `l2d_ai_face_rig`
3. **Fine-Grained Command Execution & Dry-Run**:
   - CLI: `node apps/cli/dist/index.js exec ./char.l2dproj '{"id":"1","name":"keyform.reflect_horizontal","params":{"node_id":"FACE","param_id":"ParamAngleX"}}' --dry-run`
   - Mesh Editing & 4-Corner Synthesis: `macro.synthesize_4_corners`, `deform.soft_brush`, `mesh.add_vertex`, `mesh.flip_edge`, `glue.paint_weights`, `mesh.auto_generate_mesh`, `node.batch_reparent`
   - MCP: `l2d_exec`, `l2d_batch_exec`
4. **Dual-Loop Verification (Numerical Lint + Visual Snapshot)**:
   - Numerical Lint: `node apps/cli/dist/index.js lint ./char.l2dproj` (`l2d_lint`)
   - Visual Snapshot: `node apps/cli/dist/index.js render ./char.l2dproj -p ParamAngleX=20,ParamAngleY=-10 -o snap.png` (`l2d_render_snapshot`)
5. **Runtime Bundle & Standalone `.moc3` Export**:
   - Full Runtime Bundle: `node apps/cli/dist/index.js export ./char.l2dproj -o ./dist -n haru -s 2048` (`l2d_export`)
   - Standalone `.moc3`: `node apps/cli/dist/index.js export-moc3 ./char.l2dproj -o ./haru.moc3 -v 5` (`l2d_export_moc3`)
   - Import `.moc3`: `node apps/cli/dist/index.js import-moc3 ./haru.moc3 -o ./imported.l2dproj` (`l2d_import_moc3`)
   - Import Full Runtime Package: `node apps/cli/dist/index.js import-bundle ./dist/model.model3.json -o ./imported_pkg.l2dproj` (`l2d_import_bundle`)

---

## 5. Build & Verification Commands

When modifying Rust (`crates/l2d-core` or `crates/l2d-wasm`), always rebuild the Wasm packages before running TypeScript builds and E2E tests:

```bash
# 1. Run Rust unit tests
cargo test --workspace

# 2. Rebuild Web & Node Wasm bindings
pnpm run build:wasm && pnpm run build:wasm:node

# 3. Build all TypeScript packages & Electron bundle
pnpm run build

# 4. Run full Rust + Vitest E2E test suite
pnpm run test
```
