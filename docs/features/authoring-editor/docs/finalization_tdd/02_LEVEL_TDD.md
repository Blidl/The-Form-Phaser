# 02. Level Editor TDD

## Goal

Replace the Level placeholder with a functional Level mode matching the Level mockups:

```txt
assets/mockups/level_window_settings.png
assets/mockups/level_sequence_window.png
```

The Level tab must manage project levels and level sequence rules.

## Current state

- `LevelEditorMode` is a placeholder.
- It shows active level metadata but cannot edit or open levels.
- Save/Undo is explicitly not implemented.

## Scope

Implement in:

```txt
src/editor/modes/LevelEditorMode.ts
src/editor/data/ProjectStore.ts
src/editor/data/ProjectData.ts
src/editor/data/LevelData.ts
src/editor/data/CanonicalSaveService.ts
src/editor/data/ValidationService.ts
```

Add helper modules if `LevelEditorMode.ts` becomes too large.

## UI requirements

Left inspector:

- title `Levels`;
- list of levels;
- selected level highlighted green;
- `Create Level`;
- `Delete Level`;
- button or subpanel for `The sequence of levels`.

Right inspector for settings:

- title with selected level name;
- `ID` read-only;
- `Name` editable;
- `Width` editable;
- `Height` editable;
- `Open Level`;
- `Save`;
- `Undo`.

Sequence view:

- start level selector;
- rows mapping `exit trigger id -> target level`;
- add/remove row controls;
- dropdowns instead of raw ids when possible;
- final screen fallback for unmapped exit trigger.

## Data behavior

- Creating a level generates stable unique id and name.
- Deleting a level:
  - requires confirmation;
  - cannot delete last level;
  - updates start level and sequence mappings safely.
- Opening a level loads selected level into runtime.
- Editing name/width/height only affects selected level context until save/commit.
- Sequence changes are stored in project-level sequence data.

## Runtime integration

Use the existing runtime/config load path through the active adapter. Do not create a fake level preview.

If full runtime level switching is not fully available, implement this step in two slices:

1. UI/data edit slice with disabled `Open Level` and clear status.
2. Runtime open-level integration slice.

The final acceptance requires real `Open Level`.

## Validation

Before save/export:

- duplicate level ids blocked;
- empty level name blocked;
- width/height must be positive finite numbers;
- sequence target level must exist;
- sequence trigger id must exist or be reported as unresolved;
- start level must exist.

## Implementation plan

1. Replace placeholder content with DOM custom content.
2. Add selected level draft state.
3. Add level list and green selected row.
4. Add create/delete commands.
5. Add editable fields with Enter/blur commit behavior.
6. Wire Save/Undo through `UndoDirtyContextService`.
7. Implement sequence editor subview.
8. Wire `Open Level` to runtime load path.
9. Add validation and status messages.
10. Capture before/after screenshot against mockups.

## Tests

Manual:

- Create a level.
- Rename it.
- Change width/height.
- Undo unsaved edit.
- Save draft/export.
- Delete level with confirmation.
- Open another level.
- Add sequence mapping.

Playwright:

- F2 -> Level.
- Verify no placeholder text.
- Create level and assert list count changes.
- Edit name and assert right title/list update.
- Add sequence row and export JSON.

Build:

```txt
npm run build-nolog
```

## Acceptance

- Level tab has no placeholder text.
- UI matches level settings and sequence mockups structurally.
- Level CRUD works.
- Sequence editor writes valid data.
- Save/Undo works for level contexts.
- Runtime can open selected level.

