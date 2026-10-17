# Reusable Model Acceptance

The CLI and MCP share the existing Rust/Wasm evaluator, linter and CPU renderer.
No closed-source runtime or additional test runner is required.

## Run and inspect

```bash
node apps/cli/dist/index.js acceptance ./character.l2dproj -o ./out/character-check-001
node apps/cli/dist/index.js check-acceptance ./character.l2dproj ./out/character-check-001/report.json
```

Use a new output directory for each run. Inspect `contact.png`, individual PNGs
and `report.json`. A numerical failure exits with status 1. Default sweeps include
five values per parameter, each expression, head/mouth/blink/gaze combinations,
expressions with head rotation, and five samples per animation. These are bounded
samples, not exhaustive animation or physics verification. To inspect all frames
or specific cases, provide a plan with `--plan plan.json` (up to 1,000 cases/run).

```json
{
  "cases": [
    { "id": "neutral" },
    { "id": "half-blink", "parameters": { "ParamEyeLOpen": 0.5, "ParamEyeROpen": 0.5 } },
    { "id": "laugh-yaw", "expressionId": "laugh", "parameters": { "ParamAngleX": 30 } },
    { "id": "idle-68", "animationId": "idle", "frame": 68 },
    { "id": "restored" }
  ],
  "comparisons": [
    {
      "reference": "neutral",
      "actual": "restored",
      "region": [0, 0, 64, 64],
      "tolerance": 2,
      "maxChangedPixels": 0
    }
  ]
}
```

Regions are `[x, y, width, height]` in the model canvas. Choose regions that should
remain unchanged, such as protected side-hair pixels in eye-open/eye-closed
comparisons. Thresholds are per-project decisions; the example is not a universal
visual quality standard. Cases reset parameter and expression state independently.
The linter and frame checks report out-of-range track values, non-finite geometry
and triangle flips relative to the neutral evaluated mesh. Legitimate collapsed
closed-eye meshes are not automatically treated as failures.

MCP equivalents:

- `l2d_acceptance({projectPath, outputDirectory, plan?})`
- `l2d_check_acceptance({projectPath, reportPath})`

## Evidence and limits

The report fingerprints the actual project bytes, every texture, evaluator Wasm,
Wasm loader, schema entry, acceptance runner and CPU renderer. The freshness check
also verifies the generated PNG hashes. Editing a PNG without changing the project
JSON invalidates the report. Keep the source inputs stable during a run; the
freshness check detects subsequent changes.

`current: true` means the evidence matches these inputs, not that it passed.
`numericalPass` is independent of `visualReview: "required"`,
`externalRuntime: "not-tested"` and `completeModelAccepted: false`.
The CPU screenshots cannot establish GUI pixel equivalence, character-design
fidelity or target-player compatibility. Continue the existing GUI/video and
export round-trip checks separately. Realtime unbaked physics is not simulated
by this sweep.

## Portable Save As

Desktop Save As and MCP `l2d_gui_save` collect textures relative to the source
project, validate every source file before writing, and publish the project JSON
only after its resources are available. Relative resource names are retained
where safe; external or conflicting names become content-addressed files under
`textures/`. Existing, different destination textures are not overwritten.
Keep the destination directory with its project JSON when moving the result.

Missing resources cause a save error without replacing the destination JSON.
Ordinary saves retain undo history. If external or conflicting paths must be
rewritten, the editor resets undo history for the new resource base and says so
in the save notification. If the document changes during the asynchronous save,
the saved copy is left on disk, but the active document/path is not replaced.

## State textures in the inspector

Select an ArtMesh and expand **State textures**. Choose its driving parameter,
add generated textures with distinct parameter values, and align their X/Y
offsets relative to the base state. Apply once, then scrub Preview to check the
blend. The operation uses `macro.sprite_swap`, preserves shape keyforms on other
parameters and supports undo/redo. It does not generate or hand-draw artwork.

Existing states made by this inspector reopen with their textures and offsets.
After applying, their state values and parameter are fixed in this form to avoid
silently discarding an existing rig; textures and offsets remain editable.
Undo the initial setup to change its state layout. Materials must already be
imported in the texture list; adding an arbitrary external image is not part of
this form. Aligned textures should use the same component canvas framing.
