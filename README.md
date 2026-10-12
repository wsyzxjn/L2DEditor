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

---

## 📄 License

Dual-licensed under either **MIT** or **Apache-2.0**.
