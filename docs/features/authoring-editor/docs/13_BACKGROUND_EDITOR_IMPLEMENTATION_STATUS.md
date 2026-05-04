# 13. Background Editor Implementation Status

## 1. Active editor layer
- Active implementation is `src/editor/*`.
- Background tab is opened via `F2` active editor.
- `src/game/authoring/editor_v2/*` is frozen/placeholder and not used for this flow.

## 2. Source of truth and edit gateway
- `runtimeConfig.background` is canonical for Background data.
- Active F2 Background edits are applied through `BackgroundObjectAuthoringService`.
- `BackgroundAuthoringService` remains in codebase for legacy compatibility but is not wired to active F2 UI.
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

## 10. B3.3 object-based runtime rendering implemented
- Runtime renderer now projects object-based background entries:
  - `background.backgroundObjects`
  - `background.backgroundLayerSettings`
- Object-based background objects are now visible in scene runtime:
  - hidden objects are skipped
  - texture-backed objects render when texture exists
  - texture requests include object-based `textureKey` + `textureAsset` pairs
  - fill/stroke rectangle fallback is used when texture is unavailable and visual fallback data exists
- Object-based layer ordering is rendered in stable order:
  - `parallax1`
  - `parallax2`
  - `static`
  - while preserving source array order inside each layer
- Object-based parallax uses object-layer settings for parallax layers, while static layer follows legacy static behavior.
- Legacy renderer path remains active during transition:
  - `background.staticImage`
  - `background.layers`
- Deferred remains:
  - object-based canvas selection/move/resize tools
  - full asset picker
  - undo/redo

## 11. B3.3.1 full import clearing bugfix implemented
- Fixed full Import JSON semantics for object-based background fields.
- Root cause:
  - full import path normalized with `fallbackConfig=currentConfig`, so missing optional object-based fields inherited previous runtime state.
- Fix:
  - added full-import mode in runtime replace path, and disabled fallback preservation for missing object-based background fields in that mode.
  - when full import JSON omits `background.backgroundObjects`, previous object-based background entries are cleared.
  - when full import JSON omits `background.backgroundLayerSettings`, previous object-based layer settings are not inherited.
- Runtime/editor impact:
  - importing a legacy-only level now clears stale object-based background rendering and Background list entries.
  - object authoring patch flows continue to preserve current state because they apply runtime config clones through patch mode.

## 12. B3.5 legacy Background editor UI retired (runtime fallback kept)
- Legacy Background editor controls were removed from active F2 Background tab (`src/editor/modes/BackgroundEditorMode.ts`):
  - removed `Legacy Preview Background` section.
  - removed legacy Static/Parallax ensure/remove/reset controls.
  - removed legacy field editors for `background.staticImage` and `background.layers`.
- Object-based Background UI is now the primary authoring surface in F2:
  - layer tabs (`Static`, `Parallax 1`, `Parallax 2`)
  - per-layer `Background Objects` list
  - `Add Solid` and `Add Demo Texture`
  - selected object inspector (meta, bounds, visual, duplicate/delete)
  - object-based parallax layer settings
- Legacy runtime compatibility is intentionally preserved:
  - legacy config fields/schemas are still kept (`background.color`, `background.staticImage`, `background.layers`)
  - renderer keeps legacy fallback path for old levels when `background.backgroundObjects` is empty.
- Renderer composition rule updated:
  - always apply `background.color` to camera.
  - object-based background renders as primary when objects exist.
  - legacy static/parallax render only as fallback when no object-based entries exist.
- Deferred status remains unchanged:
  - canvas selection/move/resize tools are still not implemented.
  - full migration/removal of legacy background schema is still deferred.

## 13. B3.5.1 global background color control restored (object-based UI)
- Added `Global Background` section in active F2 Background inspector with `Color` field.
- Field edits `runtimeConfig.background.color` through `BackgroundObjectAuthoringService` runtime clone-import flow.
- Legacy `staticImage`/`layers` UI remains retired.
- Legacy runtime fallback behavior from B3.5 remains unchanged.

## 14. B3.6 canvas select/move MVP implemented (no resize handles)
- Added canvas pointer interactions in active `src/editor/modes/BackgroundEditorMode.ts` for object-based background objects.
- Pointer down now:
  - hit-tests only `background.backgroundObjects`;
  - scopes hit-test to the currently selected layer tab (`static`, `parallax1`, `parallax2`);
  - skips hidden objects;
  - picks topmost object by array order within layer (later entry wins);
  - selects locked objects but starts drag only for unlocked objects.
- Pointer move now drags the selected unlocked object by updating `bounds.x` / `bounds.y` through `BackgroundObjectAuthoringService.updateObjectBounds(...)`.
- Drag updates are quantized to 1px movement threshold to reduce import/apply churn.
- Pointer up ends drag state.
- Selection/list/inspector sync updates:
  - canvas click selects row + inspector target;
  - layer tab change clears selection when selected object is not in the active layer;
  - runtime/import refresh clears stale selection when the selected object no longer exists.
- Hit-test uses bounds with rotation-aware point-in-rotated-rect math (centered bounds), not pixel-perfect texture sampling.
- B3.6 limitation:
  - parallax editing uses stored config/world coordinates directly; when editor preview parallax offsets are active, click alignment can be imperfect.
- Deferred remains:
  - resize handles (and rotation handle) are not implemented yet.
- Legacy runtime fallback behavior from B3.5 remains unchanged for legacy-only levels.

## 15. B3.6.1 background selection outline MVP implemented (no resize handles)
- Active `src/editor/modes/BackgroundEditorMode.ts` now renders an editor-only canvas outline for the selected object-based background object.
- Outline tracks selected object bounds and transform:
  - `x`
  - `y`
  - `width`
  - `height`
  - `rotation`
- Outline updates/refreshes on:
  - canvas selection
  - list selection
  - drag move updates
  - inspector bounds edits
  - layer selection changes
  - delete/missing-object refresh
  - full Import JSON runtime refresh
- Hidden behavior:
  - hidden objects remain excluded from hit-test;
  - hidden selected object keeps list/inspector selection but does not render canvas outline.
- Locked behavior:
  - locked selected object still renders outline;
  - locked object drag remains disabled (unchanged from B3.6).
- Lifecycle/editor-only guarantees:
  - outline is a mode-owned Phaser `Graphics` overlay only;
  - no config persistence/export/runtime gameplay data changes;
  - outline clears on mode exit and editor close, and when selection becomes invalid for active layer/object visibility.
- Deferred remains unchanged:
  - resize handles still deferred;
  - rotation handle still deferred.
- Legacy runtime fallback behavior from B3.5 remains unchanged for legacy-only levels.

## 16. B3.7 background object resize handles MVP implemented (no rotation handle)
- Active `src/editor/modes/BackgroundEditorMode.ts` now adds editor-only resize handles for selected object-based background objects in Background mode.
- Handle scope in this MVP:
  - corner handles only (`top-left`, `top-right`, `bottom-right`, `bottom-left`)
  - no edge handles
- Handle lifecycle/editor-only guarantees:
  - handles are drawn in the mode-owned selection `Graphics` overlay (same lifecycle as outline)
  - handles are not persisted to runtime config/export data
  - bounds changes happen only through `BackgroundObjectAuthoringService.updateObjectBounds(...)`
- Pointer down priority in Background mode:
  - handle hit-test runs first
  - object hit-test/drag runs second when no handle is hit
- Resize behavior:
  - corner drag updates `x/y/width/height` through service
  - width/height minimum size is clamped to `>= 8` (service + mode clamp)
  - top bar unsaved state remains driven by runtime config mutation/signature changes
- Locked/hidden behavior:
  - locked selected object keeps outline + handles visible but resize drag is disabled
  - hidden selected object shows no outline/handles and cannot be resized
  - hidden objects remain present in list/inspector
- State sync:
  - resize transient state is cleared on pointer up, layer change, mode exit, and runtime import refresh
  - stale selected-object removal clears resize state through existing selection sync path
- Limitation (deferred):
  - rotation handle is not implemented
  - resize math is axis-aligned for MVP; on rotated objects, corner drag updates axis-aligned bounds while object rotation/outline remains rotated
