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
