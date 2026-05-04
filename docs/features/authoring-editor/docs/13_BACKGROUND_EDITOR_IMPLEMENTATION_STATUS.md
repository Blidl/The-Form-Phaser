# 13. Background Editor Implementation Status

## 1. Active editor layer
- Active implementation is `src/editor/*`.
- Background tab is opened via `F2` active editor.
- `src/game/authoring/editor_v2/*` is frozen/placeholder and not used for this flow.

## 2. Source of truth and edit gateway
- `runtimeConfig.background` is canonical for Background data.
- `BackgroundAuthoringService` is the gateway for background edits.
- `ProjectStore` is not canonical for Background.
- Background edits apply through `legacyObjectAdapter.importRuntimeConfig(...)` so runtime preview, Save, Export, and Import stay aligned.
- Background edits do not auto-save.

## 3. Persistence behavior
- Import JSON applies runtime preview but does not auto-save.
- Save writes draft through the existing legacy-compatible save flow.
- Clear Draft removes the draft and requires reload to return to source-level data.

## 4. B1 implemented
- Global background color.
- Static target.
- Parallax 1.
- Parallax 2.
- Ensure buttons.
- Runtime preview refresh.
- Validation and clamping.

## 5. Deferred
- Canvas placement/drag/resize for background.
- Asset picker.
- Texture/shader preview.
- Lock/delete.
- Undo/Redo.
- Copy/Paste.
- Full object-like background items.

## 6. B2 lifecycle + B2.1 bugfixes implemented
- Background list rows are selectable for:
  - Static
  - Parallax 1
  - Parallax 2
- Target buttons and list active state are synchronized through one selected target state.
- Remove actions implemented:
  - Remove Static removes only `background.staticImage` (keeps `background.color` and `background.layers`).
  - Remove Parallax 1 removes only `parallax_1`.
  - Remove Parallax 2 removes only `parallax_2`.
- Reset actions implemented:
  - Reset Static restores only static defaults (keeps global color/layers).
  - Reset Parallax 1 resets only `parallax_1`.
  - Reset Parallax 2 resets only `parallax_2`.
- Parallax slots now resolve by canonical ids first (`parallax_1`, `parallax_2`) with safe legacy index fallback only for non-canonical legacy rows, so slot edits/removes/resets stay independent.
- Right inspector explicitly shows `Editing: Static|Parallax 1|Parallax 2`, and lifecycle actions are scoped to the selected target panel.
- Remove/Reset actions use lightweight `confirm()` prompts.
- Runtime config remains canonical and all background edits apply via runtime import path without auto-save.
- Still not implemented:
  - Canvas tools (selection/drag/resize handles)
  - Asset picker
  - Undo/Redo

## 7. B3.0 schema/validation foundation implemented
- Added object-based background config foundation in runtime schema:
  - `background.backgroundObjects?: TestWorldBackgroundObjectConfig[]`
  - `background.backgroundLayerSettings?: TestWorldBackgroundLayerSettingsConfig`
- Legacy slot model remains active and unchanged for editing:
  - `background.staticImage`
  - `background.layers`
- No object-based Background UI is implemented yet.
- No renderer migration to object-based background is implemented yet.
- Save/Import/Export pipelines now preserve object-based background fields through runtime config normalization.

## 8. B3.1 service foundation implemented
- Added `BackgroundObjectAuthoringService`:
  - `src/editor/background-authoring/BackgroundObjectAuthoringService.ts`
- Service provides object-based background CRUD foundation:
  - snapshot/list/get
  - create/update/delete/duplicate object APIs
  - layer settings update API
- Service uses runtime config (`legacyObjectAdapter.getRuntimeConfig()`) as source of truth.
- Service applies edits via runtime import (`legacyObjectAdapter.importRuntimeConfig(...)`).
- Service does not auto-save.
- Object-based Background UI is still not wired yet.
- Renderer is still legacy (`background.staticImage` + `background.layers` path).
- Temporary legacy slot editor in F2 Background tab remains active.
- Next intended step: object list UI MVP for object-based background authoring.

## 9. B3.2 object list UI MVP implemented
- F2 Background tab now wires object-based authoring through `BackgroundObjectAuthoringService` in `BackgroundEditorMode`.
- Object-based layer tabs are active:
  - `Static` -> `static`
  - `Parallax 1` -> `parallax1`
  - `Parallax 2` -> `parallax2`
- Left panel now provides:
  - per-layer `Background Objects` list from `background.backgroundObjects`
  - `Add Solid` create action
  - `Add Demo Texture` create action
- Selecting an object opens right inspector editing for:
  - meta (`name`, `layer`, `locked`, `hidden`)
  - bounds (`x`, `y`, `width`, `height`, `rotation`)
  - visual (`shaderKey`, `textureKey`, `textureAsset`, `fillColor`, `strokeColor`, `alpha`, tile repeat flags)
- Object actions implemented:
  - duplicate
  - delete with confirm prompt
- Per-layer settings UI implemented for object layers:
  - `Static`: informational note only
  - `Parallax 1` and `Parallax 2`: `scrollFactorX/Y` via object service
- Legacy renderer-backed preview controls remain available under:
  - `Legacy Preview Background`
  - with explicit temporary note
- Deferred remains unchanged:
  - object-based renderer migration
  - canvas selection/drag/resize tools
  - full asset picker/preview
