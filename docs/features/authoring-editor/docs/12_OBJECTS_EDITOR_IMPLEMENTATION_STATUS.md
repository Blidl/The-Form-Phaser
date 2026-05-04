# 12. Objects Editor Implementation Status

## 1. Active Editor Layer
- Active implementation layer: `src/editor/*`.
- Editor entrypoint for this layer: `F2`.
- `editor_v2` (`src/game/authoring/editor_v2/*`) is frozen and not the active development target.
- Legacy reference path remains available on `Shift+F2` (`src/game/world/runtime/test_world_editor_runtime.ts`) for comparison/debug only.

## 2. Objects Source of Truth
- Object CRUD and object visual/bounds update flow is centralized in `ObjectAuthoringService` (`src/editor/object-authoring/ObjectAuthoringService.ts`).
- Runtime object data in runtime config/current config is canonical for Objects persistence.
- `ProjectStore` (`src/editor/data/ProjectStore.ts`) is the editor/UI mirror used by inspectors and lists.

## 3. Implemented Objects Features
- Runtime-backed object listing in Objects mode.
- Create/Delete object flow.
- Drag/Move object flow.
- Resize handles and resize interactions.
- Bounds inspector editing.
- Visual inspector editing.
- Fill/Stroke/Alpha/Layer editing.
- `No Fill` / `No Stroke` (`transparent`) visual states.
- Gradient-style color picker UI workflow in Objects inspector.
- Copy/Paste object flow (including visual/bounds carryover).
- Lock/Unlock object flow.
- Save/Export/Import integration paths.

## 4. Persistence
- Save to localStorage draft is supported.
- Export JSON is supported.
- Import JSON is supported.
- Clear Draft is supported.
- Visual persistence fields currently include object visual color/alpha/layer and debug visibility through runtime config paths (with editor-side mirror sync in `ProjectStore`).
- Limitation: direct file write from browser runtime is unavailable; persistence is via runtime config + localStorage + explicit JSON export/import.

## 5. Known Limitations
- `shaderKey` / `textureKey` are not yet fully persisted/runtime-previewed end-to-end for Objects.
- True pixel eyedropper sampling is not fully implemented/reliable yet.
- `editor_v2` remains frozen.
- NPC/Cutscenes/Logic authoring modes are not implemented in the active Objects workflow.
- Undo/Redo is not implemented yet.

## 6. Rules for Future Codex Work
- Target `src/editor/*` for editor implementation changes.
- Do not edit `editor_v2` unless explicitly requested.
- Object CRUD and core object mutation paths must go through `ObjectAuthoringService`.
- Runtime/currentConfig remains the source of truth for Objects.
- `ProjectStore` remains a mirror for editor UI/state.
- Do not introduce fallback rectangle rendering/placeholder-object paths for known runtime object types.
