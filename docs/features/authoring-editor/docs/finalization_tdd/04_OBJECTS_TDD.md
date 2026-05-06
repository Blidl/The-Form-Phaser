# 04. Objects Editor Completion TDD

## Goal

Finish the Objects tab so it satisfies:

```txt
assets/mockups/objects_window.png
```

Objects is already the most advanced tab. This TDD closes missing production pieces.

## Current state

Implemented:

- runtime object list;
- create/delete;
- select from list/canvas;
- drag/move;
- resize handles;
- bounds inspector;
- visual inspector;
- copy/paste/duplicate;
- lock;
- draft save/export/import path;
- partial logic binding UI.

Known gaps:

- context-local Save/Undo incomplete;
- rotation runtime sync incomplete;
- actions/settings not fully aligned with mockup;
- delete reference protection incomplete;
- script `Edit` navigation to Logic incomplete;
- some runtime visual fields are partial.

## Scope

Implement in:

```txt
src/editor/modes/ObjectsEditorMode.ts
src/editor/object-authoring/ObjectAuthoringService.ts
src/editor/bridge/*
src/editor/logic-authoring/*
src/editor/data/ReferenceGraphService.ts
src/editor/data/ValidationService.ts
```

## UI requirements

Left inspector:

- `Grid On`;
- snap/grid size;
- mouse world coordinates;
- category tabs:
  - `Platforms`
  - `Special`
  - `Objects`
- catalog list;
- object list/search;
- `Focus`.

Right inspector:

- `Bounds`: X/Y/Width/Height/Rotation;
- `Visual`: Shader/Texture/Fill/Stroke/Alpha/Layer/Only debug view;
- `Settings`: Type/Collision;
- `Actions`: Move/Rotate/Default Action/Action list with `Edit`, `+`, `-`;
- bottom actions:
  - `Save`
  - `Undo`
  - `Lock`
  - `Del`.

## Behavior requirements

- Left click creates selected catalog object.
- Created object becomes selected.
- Drag/move respects snap.
- Resize respects snap when enabled.
- Rotation field syncs to runtime where supported.
- If runtime cannot rotate a type, UI must show clear limitation and avoid false persistence.
- Lock blocks drag/resize/delete/edit.
- Delete checks references first.
- Ctrl/Cmd+C/V/D work outside text inputs.
- Script pickers use dropdowns/search, never raw id input as primary workflow.
- `Edit` opens Logic tab focused on selected script.

## Data and runtime

- Runtime/currentConfig remains canonical for Objects.
- `ProjectStore` remains UI mirror.
- No fake fallback rectangles for known runtime-backed object types.
- Object mutations go through `ObjectAuthoringService` or legacy adapter gateway.

## Validation

- duplicate object ids blocked;
- missing script refs blocked/warned before save;
- delete protected when object is referenced by logic/cutscene/script command;
- invalid bounds blocked;
- invalid layer/collision/type blocked.

## Implementation plan

1. Add mode context snapshot for selected object.
2. Wire `Save`/`Undo` to `UndoDirtyContextService`.
3. Complete Actions section against Logic script refs.
4. Add `Edit` navigation contract from Objects to Logic.
5. Implement/finish rotation runtime sync or explicit unsupported state.
6. Add delete reference graph checks.
7. Tighten Settings section to match mockup.
8. Add validation messages in inspector.
9. Update object status doc.
10. Capture screenshot against objects mockup.

## Tests

Manual:

- Create platform from catalog.
- Select, drag, resize, rotate.
- Change visual fields.
- Assign scripts to Move/Rotate/Default Action.
- Use Edit to jump to Logic.
- Lock and verify edits are blocked.
- Copy/paste/duplicate.
- Delete object with/without references.

Playwright:

- F2 -> Objects.
- Create object by click.
- Select row.
- Edit bounds field.
- Assign script after adding a script ref.
- Export JSON and verify object fields.

Build:

```txt
npm run build-nolog
```

## Acceptance

- All Objects checklist items are either complete or explicitly documented with accepted deferral.
- No placeholder Actions/Settings sections remain.
- Save/Undo/Lock/Del work.
- Script pickers and Logic jump work.
- Delete protection lists references.

