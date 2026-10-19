# L2DEditor

> Agent-first, open-source 2D puppet rigging editor and runtime toolkit.

L2DEditor is an open alternative to proprietary 2D puppet authoring tools. It
is designed so that humans, coding agents, CLIs, and the desktop editor all use
the same Rust evaluator, Command Bus, project format, and inspection tools.

The project does not require proprietary Cubism binaries at runtime. Core
evaluation, `.moc3` export/import, runtime bundle generation, physics baking,
and neural rig helpers are implemented in Rust.

## Project status

L2DEditor is under active development. Core rigging, runtime export, CLI/MCP
automation, and desktop workflows are implemented and tested, but APIs and file
formats may still change. Third-party runtime compatibility and production
asset fidelity should be validated for each exported package.

L2DEditor is not affiliated with or endorsed by Live2D Inc. "Live2D" and
"Cubism" are trademarks of their respective owners.

## Highlights

- **Headless-native automation**: import PSDs, generate meshes, auto-rig, edit
  keyforms, lint, render snapshots, run acceptance sweeps, and export runtime
  packages without opening the desktop UI.
- **Shared Command Bus**: mouse edits, CLI commands, and MCP tools use the same
  validated operations and undo/redo model.
- **Pure-Rust core**: hierarchical warp/rotation evaluation, multidimensional
  keyforms, physics, animation, `.moc3` serialization/parsing, and runtime
  bundle export.
- **Desktop editor**: Electron, React, dockable panels, PixiJS viewport,
  trilingual UI, command palette, inspector, timeline, physics, and history.
- **Agent integration**: 21 headless MCP tools plus 12 tools for controlling a
  live desktop editor through an authenticated loopback bridge.

## Repository layout

```text
.
|-- crates/
|   |-- l2d-core/          Rust evaluator, formats, exporter, physics and lint
|   `-- l2d-wasm/          WebAssembly bindings for browser and Node.js
|-- packages/
|   |-- schema/            TypeScript contracts, JSON Schema, Wasm loaders
|   |-- command/           Validated command bus, transactions and undo/redo
|   |-- psd/               PSD import, mesh generation and PSD export
|   |-- renderer/          Pixi adapter, headless rendering, atlas and video
|   `-- mcp-server/        MCP stdio server and desktop editor bridge
|-- apps/
|   |-- cli/               Headless `l2d` CLI
|   `-- desktop/           Electron + React desktop application
|-- skills/                Agent operating guides for this repository
|-- docs/                  Acceptance and workflow documentation
`-- tests/                 Rust-backed Vitest and Electron E2E tests
```

## Requirements

- Node.js 22 or newer
- pnpm 11 (the repository pins `pnpm@11.21.0`)
- Rust stable toolchain
- `wasm-pack`
- FFmpeg, optional, for MP4/WebM export

## Setup

```bash
git clone https://github.com/wsyzxjn/L2DEditor.git
cd L2DEditor

pnpm install

# Required before TypeScript builds and E2E tests.
pnpm run build:wasm
pnpm run build:wasm:node

pnpm run build
```

Start the desktop editor in development mode:

```bash
pnpm dev:desktop
```

Run the Rust and Vitest suites:

```bash
pnpm test
```

The browser/Electron UI suite is available separately:

```bash
pnpm test:ui
```

## CLI

The CLI is emitted to `apps/cli/dist/index.js` by `pnpm run build`.

```bash
# Create and inspect a project.
node apps/cli/dist/index.js create MyModel.l2dproj
node apps/cli/dist/index.js inspect MyModel.l2dproj
node apps/cli/dist/index.js lint MyModel.l2dproj

# Import layered PSD artwork.
node apps/cli/dist/index.js import-psd character.psd \
  -o MyModel.l2dproj -d 2

# Execute one validated command.
node apps/cli/dist/index.js exec MyModel.l2dproj \
  '{"id":"c1","name":"parameter.add","params":{"id":"ParamAngleX","name":"Angle X","min":-30,"max":30,"default":0}}'

# Render a deterministic PNG pose.
node apps/cli/dist/index.js render MyModel.l2dproj \
  -p "ParamAngleX=25,ParamAngleY=-10" -o preview.png

# Export a runtime package or a standalone MOC3.
node apps/cli/dist/index.js export MyModel.l2dproj \
  -o dist -n MyModel
node apps/cli/dist/index.js export-moc3 MyModel.l2dproj \
  -o MyModel.moc3 -v 5
```

Run `node apps/cli/dist/index.js --help` for the full command list.

## Desktop releases and in-app updates

Desktop packages are built with Electron Builder and published to GitHub
Releases. The application uses Electron Updater with the generated
`app-update.yml`; it checks once after launch and every six hours, then lets the
user explicitly download and restart to install the update. The same check is
available from the application update button in the toolbar.

Build a local package after building the desktop and its dependencies:

```bash
pnpm --filter l2d-desktop... build
pnpm --filter l2d-desktop package:desktop
```

Artifacts are written to `apps/desktop/release/`. Tagging a commit with `v*`
triggers `.github/workflows/release-desktop.yml`, which builds macOS arm64,
Windows x64, and Linux x64 packages plus `latest*.yml` update metadata.

macOS automatic updates require a stable Developer ID signature. Set
`MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` as repository secrets for signed CI
builds. Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` to
enable notarization. Windows signing is optional but recommended through
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

## MCP integration

Build the MCP server first with `pnpm run build`, then register it with an MCP
client:

```json
{
  "mcpServers": {
    "l2deditor": {
      "command": "node",
      "args": ["/absolute/path/to/L2DEditor/packages/mcp-server/dist/bin.js"]
    }
  }
}
```

Headless tools receive a `projectPath`; GUI tools operate on the document
currently open in the desktop editor.

### Desktop bridge

The desktop bridge listens only on loopback and requires a per-run token. The
desktop writes the token to `editor-bridge-token` in its user-data directory.
The MCP server checks the common desktop data locations automatically. Set
`L2D_EDITOR_TOKEN_FILE` when the desktop uses a custom `--user-data-dir`.

To use another port, set `L2D_EDITOR_PORT` for the desktop and the matching
`L2D_EDITOR_URL` for the MCP process:

```bash
L2D_EDITOR_PORT=22034 pnpm dev:desktop
L2D_EDITOR_URL=ws://127.0.0.1:22034 ...
```

### GUI tools

| Tool | Operation |
| --- | --- |
| `l2d_gui_state` | Inspect the active file, nodes, parameters, selection and history |
| `l2d_gui_open_project` | Open a project in the desktop editor |
| `l2d_gui_select` | Select node IDs |
| `l2d_gui_set_parameters` | Apply validated live preview values |
| `l2d_gui_viewport` | Fit, zoom, pan, flip, solo, mesh editing and preview switches |
| `l2d_gui_playback` | Select, seek, play or pause a motion |
| `l2d_gui_expression` | Preview or clear an expression |
| `l2d_gui_show_panel` | Activate an editor panel |
| `l2d_gui_exec` | Execute a dry-run or undoable Command Bus edit |
| `l2d_gui_history` | Undo, redo or jump within the undo stack |
| `l2d_gui_save` | Save the active document |
| `l2d_gui_screenshot` | Capture the window or clean model canvas |

Example:

```json
{"name":"l2d_gui_state","arguments":{"nodeOffset":0,"nodeLimit":50}}
{"name":"l2d_gui_set_parameters","arguments":{"values":{"ParamEyeLOpen":0,"ParamEyeROpen":0}}}
{"name":"l2d_gui_screenshot","arguments":{"target":"model","scale":1}}
```

Preview parameters, expressions, viewport changes, and playback do not save the
document. Command Bus edits remain undoable and saving is explicit.

Desktop Save As and `l2d_gui_save` collect textures relative to the source
project before publishing the destination JSON. Missing resources fail the
save without replacing the destination; conflicting names are moved to
content-addressed files under `textures/`.

## Acceptance workflow

Acceptance runs can sweep parameter, expression, and motion samples, produce
revision-bound PNG evidence, and detect stale reports after project or texture
changes:

```bash
node apps/cli/dist/index.js acceptance ./character.l2dproj \
  -o ./out/character-check-001
node apps/cli/dist/index.js check-acceptance ./character.l2dproj \
  ./out/character-check-001/report.json
```

See [docs/acceptance.md](docs/acceptance.md) for plans, comparisons, evidence
semantics, and limitations.

## License

Licensed under either of:

- [MIT License](LICENSE-MIT)
- [Apache License 2.0](LICENSE-APACHE)

at your option.
