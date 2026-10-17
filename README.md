# L2DEditor

> An open-source, cross-platform 2D puppet rigging editor and runtime framework designed **Agent-First**.

L2DEditor is an open alternative to proprietary 2D puppet rigging tools like Live2D Cubism Editor. Instead of treating automation as a secondary scripting plugin, L2DEditor is architected from the ground up so that **coding agents, LLMs, and human artists share the exact same underlying Command Bus, headless pipeline, and inspection tools**.

---

## 🌟 Key Architecture & Highlights

1. **Agent-First (Headless-Native)**:
   - Complete headless workflow: create projects, import PSDs, auto-generate triangle meshes, bind hierarchical warp deformers, assign multi-dimensional keyforms, run linter checks, and render deterministic offline PNG snapshots without starting a GUI.
   - Built-in Model Context Protocol (`@l2d/mcp-server`) exposing `l2d_inspect`, `l2d_lint`, `l2d_exec_command`, `l2d_snapshot`, and `l2d_import_psd`.
2. **Pure Mathematical Rust Core (`crates/l2d-core` & `crates/l2d-wasm`)**:
   - High-performance, zero-allocation hierarchical Warp grid evaluation and multi-parameter Cartesian keyform interpolation.
   - Compiles to both native Rust and WebAssembly (`wasm-bindgen`).
3. **Deterministic Human- & Git-Friendly Format (`*.l2dproj`)**:
   - Clean, sorted `project.json` schema paired with extracted `textures/*.png`.
   - Reversible undo/redo powered by RFC 6902 JSON Patches (`immer`).
4. **Desktop GUI (`apps/desktop`)**:
   - Built with Electron, React, `dockview-react` (VS Code-like dockable panels), PixiJS v8 (WebGL2), and compact 24px DCC design tokens (`coss` / Tailwind).
   - Real-time 60fps mesh deformation viewport with interactive Warp Gizmo.
   - Global Command Palette (`cmdk`, `Cmd+K` / `Ctrl+K`).

For revision-bound parameter/expression checks, portable Save As, and state-texture
editing, see [Model Acceptance and Resource Workflows](docs/acceptance.md).

---

## 📁 Repository Structure

```
.
├── crates/
│   ├── l2d-core/        # Pure Rust core: data models, evaluator, warp/rotation math, linter
│   └── l2d-wasm/        # WebAssembly bindings (WasmModel, compile, evaluate, lint)
├── packages/
│   ├── schema/          # JSON Schema & TypeScript definitions generated from Rust
│   ├── command/         # Command Bus, Transaction manager, Undo/Redo (Immer patches)
│   ├── psd/             # PSD import (ag-psd), alpha contour extraction & earcut triangulation
│   ├── renderer/        # PixiJS v8 mesh adapter & pure headless Canvas PNG snapshot renderer
│   └── mcp-server/      # Model Context Protocol stdio server for LLM integration
├── apps/
│   ├── cli/             # Headless CLI (`l2d create`, `inspect`, `lint`, `render`, `exec`, `import-psd`)
│   └── desktop/         # Electron + React + dockview + coss desktop application
└── tests/
    └── agent_e2e.test.ts # Headless end-to-end automation test suite
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+ & pnpm 10+
- Rust 1.80+ & `wasm-pack`

### Build All
```bash
# Build Rust core and WebAssembly packages
pnpm run build:wasm
pnpm run build:wasm:node

# Build all TypeScript packages & desktop app
pnpm run build

# Run unit and end-to-end test suite
pnpm test
```

### Headless CLI Usage
```bash
# Create a new blank project
pnpm --filter l2d-cli exec l2d create MyModel.l2dproj

# Inspect project hierarchy and parameters
pnpm --filter l2d-cli exec l2d inspect MyModel.l2dproj

# Run topology and data linter
pnpm --filter l2d-cli exec l2d lint MyModel.l2dproj

# Execute an atomic command
pnpm --filter l2d-cli exec l2d exec MyModel.l2dproj '{"id":"c1","name":"parameter.add","params":{"id":"ParamAngleX","name":"Angle X","min":-30,"max":30,"default":0}}'

# Render an offline snapshot under specific parameter poses (for visual verification)
pnpm --filter l2d-cli exec l2d render MyModel.l2dproj --params "ParamAngleX=25,ParamAngleY=-10" --out preview.png
```

---

## 🤖 MCP Integration for AI Agents

To allow coding assistants (Codex, Claude Desktop, Cursor) to manage L2DEditor models, add the server to your MCP configuration:

```json
{
  "mcpServers": {
    "l2deditor": {
      "command": "node",
      "args": ["/path/to/L2DEditor/packages/mcp-server/dist/bin.js"]
    }
  }
}
```

### Control the running desktop window

The same MCP server also provides 12 `l2d_gui_*` tools. Start the desktop app before using them. They inspect or change the open window's document and preview; the existing tools with `projectPath` operate on files on disk.

| Tool | GUI operation |
| --- | --- |
| `l2d_gui_state` | Current file, paginated nodes, parameters, selection, viewport, timeline and history |
| `l2d_gui_open_project` | Open a `project.json` file or `.l2dproj` directory |
| `l2d_gui_select` | Select node IDs in the hierarchy and inspector |
| `l2d_gui_set_parameters` | Set live preview values with atomic ID/range validation |
| `l2d_gui_viewport` | Fit, zoom, pan, flip, solo, mesh editing and preview switches |
| `l2d_gui_playback` | Choose a motion, seek, play or pause |
| `l2d_gui_expression` | Preview or clear a named expression |
| `l2d_gui_show_panel` | Activate a panel tab |
| `l2d_gui_exec` | Run a Command Bus edit or dry run in the open document |
| `l2d_gui_history` | Undo, redo or jump to an undo-stack index (`-1` is the initial state) |
| `l2d_gui_save` | Save the open document to its current or an explicit path |
| `l2d_gui_screenshot` | Return the editor window or clean model canvas as PNG after rendering is ready |

For example, inspect the current window, preview a blink, then capture it:

```json
{"name":"l2d_gui_state","arguments":{"nodeOffset":0,"nodeLimit":50}}
{"name":"l2d_gui_set_parameters","arguments":{"values":{"ParamEyeLOpen":0,"ParamEyeROpen":0}}}
{"name":"l2d_gui_screenshot","arguments":{}}
```

To capture the artwork without panels, grids or selection gizmos, use `{"target":"model","scale":1}` with `l2d_gui_screenshot`. It uses the same Pixi renderer as the viewport and waits for a paused pose to finish rendering. This also supports deterministic frame capture for animation previews. Use `l2d_gui_expression` with an `expressionId` returned by GUI state, or `null` to clear the expression.

To edit the open document with the same undo stack used by mouse operations:

```json
{"name":"l2d_gui_exec","arguments":{"command":{"id":"rename-head","name":"node.update","params":{"id":"head","changes":{"name":"Head"}}},"dryRun":true}}
{"name":"l2d_gui_exec","arguments":{"command":{"id":"rename-head","name":"node.update","params":{"id":"head","changes":{"name":"Head"}}}}}
{"name":"l2d_gui_history","arguments":{"operation":"undo"}}
```

To preview an existing motion (use IDs returned by `l2d_gui_state`):

```json
{"name":"l2d_gui_playback","arguments":{"animationId":"idle","frame":24,"playing":false}}
{"name":"l2d_gui_viewport","arguments":{"fit":true}}
{"name":"l2d_gui_playback","arguments":{"playing":true}}
```

GUI parameter and camera changes do not write the document to disk. Commands remain undoable; saving is explicit. Opening another project replaces the current document, so save pending edits first. Saving a JSON file into a different directory does not copy its relative texture assets.

The desktop reuses the loopback WebSocket service on `127.0.0.1:22033`, including the existing parameter-integration messages. Browser-origin requests are rejected. To use another instance or port, set `L2D_EDITOR_PORT` for the desktop and the matching `L2D_EDITOR_URL` (for example `ws://127.0.0.1:22034`) for the MCP process. Inspect `filePath` before changing a document to confirm the target window.

---

## 📄 License

Dual-licensed under either **MIT** or **Apache-2.0**.
