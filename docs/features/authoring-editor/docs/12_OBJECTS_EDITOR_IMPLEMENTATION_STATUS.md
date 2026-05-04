# 12. Objects Editor Implementation Status

## 1. Active editor layer
- Active implementation: `src/editor/*`.
- Opened by `F2`.
- Legacy/reference editor: `src/game/world/runtime/test_world_editor_runtime.ts` via `Shift+F2`.
- Frozen/placeholder editor: `src/game/authoring/editor_v2/*`.
- Future work should target `src/editor/*` unless explicitly migrating.

## 2. Objects source of truth
- `ObjectAuthoringService` is the object gateway.
- Runtime/currentConfig is canonical for Objects.
- `ProjectStore` is UI mirror only.
- Known runtime-backed objects must not use fake fallback rectangles.

## 3. Implemented Objects features
- runtime object list.
- create/delete.
- select by mouse/list.
- drag/move.
- resize handles.
- Bounds inspector.
- Visual inspector.
- Fill/Stroke/Alpha/Layer.
- No Fill / No Stroke.
- gradient color picker.
- Copy/Paste.
- Lock.
- Save draft.
- Clear Draft.
- Export JSON.
- Import JSON.

## 4. Persistence
- Save writes localStorage draft.
- Export JSON downloads runtime config.
- Import JSON applies config to runtime but does not auto-save.
- Clear Draft removes browser draft; reload is needed to use source level.
- Visual values persist through runtime config fields.
- Direct file write is not available from browser.

## 5. Deferred Objects sections
- Settings remains placeholder.
- Actions remains placeholder.
- Settings and Actions should be implemented together with Logic tab because actions need logic/event bindings.
- Do not build temporary standalone Actions behavior before Logic architecture exists.

## 6. Known limitations
- `shaderKey`/`textureKey` not fully persisted/runtime-previewed yet.
- true pixel-perfect eyedropper is not reliable/complete.
- Undo/Redo not implemented.
- Background/NPC/Cutscenes/Logic not implemented.
- `editor_v2` is frozen.

## 7. Rules for future Codex work
- Target `src/editor/*`.
- Do not edit `editor_v2` unless explicitly asked.
- Object CRUD must go through `ObjectAuthoringService`.
- Bounds changes must go through `ObjectAuthoringService.updateObjectBounds`.
- Visual changes must go through `ObjectAuthoringService.updateObjectVisual`.
- Save/Export/Import must use runtime config, not stale `ProjectStore`.
- `ProjectStore` is mirror, not source of truth for Objects.
- No fallback rectangles for known runtime object types.
