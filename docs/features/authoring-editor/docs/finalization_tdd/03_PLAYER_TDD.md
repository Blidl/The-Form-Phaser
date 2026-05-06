# 03. Player Editor TDD

## Goal

Replace the Player placeholder with a real player tuning and spawn editor matching:

```txt
assets/mockups/player_window.png
```

## Current state

- `PlayerEditorMode` is placeholder-only.
- Runtime has player tuning modules and a debug/tuning UI path outside this final editor.
- No Player tab save/undo/reset behavior exists in active F2 editor.

## Scope

Implement in:

```txt
src/editor/modes/PlayerEditorMode.ts
src/game/player/tuning/*
src/ui/runtime/player_tuning_*
src/editor/data/ProjectStore.ts
src/editor/core/UndoDirtyContextService.ts
```

Reuse existing player tuning schema/types. Do not invent a parallel player settings model if existing tuning data can be adapted.

## UI requirements

Left inspector:

- title `Player`;
- sub-tabs:
  - `Common`
  - `Ball`
  - `Triangle`
  - `Square`
- selected sub-tab green.

Right inspector:

- Common/System settings;
- Camera settings;
- Marker settings;
- form-specific movement settings;
- `Spawn X`;
- `Spawn Y`;
- `Set Spawn From Mouse` or equivalent workflow;
- `Save`;
- `Undo`;
- `Reset Defaults`.

Canvas behavior:

- pressing `P` places player/spawn at current mouse world position as specified;
- visual marker should update immediately;
- text input focus must not trigger placement.

## Data behavior

- Player tuning edits update runtime preview.
- Save commits to current canonical/project data or existing persisted tuning route.
- Undo restores current sub-tab context to baseline.
- Reset Defaults restores defaults for selected sub-tab, not necessarily every player setting.
- Spawn position persists in level data.

## Validation

- numeric fields must be finite;
- speeds/accelerations/durations must use schema-specific bounds;
- spawn must be inside or near valid level bounds unless intentionally allowed;
- invalid input reverts or displays inline error.

## Implementation plan

1. Audit existing tuning schema and persisted generated file.
2. Build Player mode UI around existing tuning categories.
3. Add draft state per sub-tab.
4. Wire fields to runtime preview.
5. Add Save/Undo/Reset Defaults.
6. Add spawn placement via mouse/P.
7. Add validation per field group.
8. Add export/import preservation.
9. Verify no gameplay key conflict while editing DOM inputs.

## Tests

Manual:

- Change a common tuning field and observe runtime effect.
- Switch forms and edit form-specific values.
- Use Reset Defaults.
- Use Undo.
- Place spawn with `P`.
- Reload/export/import and verify values persist.

Playwright:

- F2 -> Player.
- Verify no placeholder text.
- Switch sub-tabs.
- Edit numeric field.
- Trigger invalid value and verify rejection.

Build:

```txt
npm run build-nolog
```

## Acceptance

- Player tab no longer placeholder.
- Common/Ball/Triangle/Square sub-tabs work.
- Save/Undo/Reset Defaults work.
- Player tuning affects runtime.
- Spawn placement is implemented and documented.

