# 05. Background Editor Completion TDD

## Goal

Finish Background authoring against:

```txt
assets/mockups/background_window.png
```

## Current state

Implemented:

- object-based background config foundation;
- Static/Parallax1/Parallax2 layer tabs;
- background object list;
- object creation from hardcoded asset presets;
- selected object inspector;
- object-based runtime rendering;
- canvas selection/move;
- selection outline;
- resize handles;
- delete/duplicate/copy/paste;
- global background color.

Known gaps:

- full asset picker/manager missing;
- rotation handle missing;
- Undo/Redo not implemented;
- parallax hit-test alignment can be imperfect;
- external upload/file browser missing;
- shader picker missing.

## Scope

Implement in:

```txt
src/editor/modes/BackgroundEditorMode.ts
src/editor/background-authoring/BackgroundObjectAuthoringService.ts
src/scenes/runtime/test_scene_background_runtime.ts
src/editor/data/ReferenceGraphService.ts
src/editor/data/ValidationService.ts
```

## UI requirements

Left inspector:

- title `Background`;
- current level info;
- layer tabs:
  - `Static`
  - `Parallax 1`
  - `Parallax 2`
- `Background Objects` list scoped by selected layer;
- asset picker with preview or clear asset labels;
- create/apply selected asset.

Right inspector:

- global background color;
- layer parallax settings;
- selected object meta:
  - name;
  - layer;
  - locked;
  - hidden;
- bounds:
  - X/Y/Width/Height/Rotation;
- visual:
  - shader;
  - texture key;
  - asset path;
  - fill/stroke/alpha;
  - tile repeat;
- actions:
  - Save;
  - Undo;
  - Lock;
  - Del;
  - Duplicate.

Canvas behavior:

- click selects object in active layer;
- drag moves unlocked object;
- corner handles resize;
- rotation handle rotates;
- hidden objects not hit-tested;
- locked objects selectable but not editable;
- parallax click alignment works with preview offsets.

## Asset picker MVP

Minimum acceptable asset picker:

- lists known project assets from a single registry/manifest;
- shows display name, texture key, asset path;
- supports solid fill preset;
- supports applying asset to selected object;
- supports creating object from selected asset.

External file upload may remain deferred if clearly documented.

## Data behavior

- `background.backgroundObjects` is canonical for object-based background.
- Legacy background fields remain runtime fallback only.
- Save/export/import preserves object-based fields.
- Full import clears stale object-based fields when omitted.

## Validation

- object id unique;
- layer valid;
- width/height positive;
- alpha in range;
- texture asset path known or warning;
- hidden/locked fields normalized;
- no stale object in selected layer after import/delete.

## Implementation plan

1. Add asset registry/manifest reader for background assets.
2. Replace hardcoded picker with registry-backed picker.
3. Add mode context Save/Undo.
4. Add rotation handle and runtime update path.
5. Fix parallax hit-test alignment.
6. Add validation messages.
7. Add delete reference protection if background objects become referencable.
8. Update status doc.
9. Capture screenshot against background mockup.

## Tests

Manual:

- Add asset to each layer.
- Move/resize/rotate object.
- Change parallax values.
- Hide/lock selected object.
- Save/export/import/reload.
- Verify render order: Static behind Parallax 1 behind Parallax 2.

Playwright:

- F2 -> Background.
- Add selected asset.
- Select row and edit bounds.
- Switch layer and verify selection scoping.
- Export JSON and verify `background.backgroundObjects`.

Build:

```txt
npm run build-nolog
```

## Acceptance

- Background tab matches mockup structurally.
- Object-based background is primary authoring surface.
- Asset picker is usable.
- Canvas select/move/resize/rotate work.
- Save/Undo/Lock/Del work.

