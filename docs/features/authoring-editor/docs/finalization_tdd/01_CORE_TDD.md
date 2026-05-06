# 01. Core Editor Systems TDD

## Goal

Build the shared systems required by every tab:

- real `Stop game` / live time mode;
- real `Game speed`;
- honest save/draft/export semantics;
- context-local dirty and undo;
- validation entry point;
- stable editor lifecycle on open/close/tab switch.

This step turns the editor shell from a visual frame into a reliable authoring surface.

## Current state

- F2 opens the active editor over real Phaser canvas.
- Top tabs exist and active tab is green.
- `Stop game` and `Game speed` controls exist but are disabled.
- Save UI currently reports draft/localStorage-oriented state.
- Dirty state is inferred mostly from runtime config signatures.
- There is no shared context-local undo service.

## Scope

### New services

Add:

```txt
src/editor/core/EditorTimeController.ts
src/editor/core/UndoDirtyContextService.ts
src/editor/data/ValidationService.ts
src/editor/data/ReferenceGraphService.ts
src/editor/data/CanonicalSaveService.ts
```

Services may start with MVP behavior, but APIs must be stable enough for later tabs.

### EditorTimeController

Responsibilities:

- track whether editor is live or stopped;
- pause/resume gameplay simulation when `Stop game` changes;
- apply runtime speed scale from `Game speed`;
- restore default runtime state on editor close;
- avoid breaking DOM text input focus.

API target:

```ts
export interface EditorTimeController {
  setEditorOpen(open: boolean): void;
  setStopped(stopped: boolean): void;
  setGameSpeed(scale: number): void;
  getSnapshot(): EditorTimeSnapshot;
  resetForClose(): void;
}
```

### UndoDirtyContextService

Responsibilities:

- store baseline per context after load/save;
- compare current snapshot against context baseline;
- return undo snapshot for current context;
- avoid one global undo stack for all tabs.

Initial context ids:

```txt
level.selected
level.sequence
player.common
player.ball
player.triangle
player.square
object.selected
background.selected
npc.selected
cutscene.selected
logic.script
```

API target:

```ts
beginContext(contextId: string, baseline: unknown): void;
updateCurrent(contextId: string, current: unknown): void;
isDirty(contextId: string): boolean;
getDirtyContexts(): string[];
undo(contextId: string): unknown | null;
commit(contextId: string, baseline: unknown): void;
clear(contextId?: string): void;
```

### CanonicalSaveService

Responsibilities:

- make save/export naming honest;
- expose canonical JSON snapshot;
- preserve current draft flow without calling it final save;
- provide later file/backend save integration point.

Initial UI semantics:

- `Save Draft`: writes browser draft.
- `Export JSON`: downloads canonical runtime config/project JSON.
- `Import JSON`: replaces runtime preview from selected JSON.
- `Clear Draft`: clears browser draft.

If the existing top toolbar keeps a `Save` label temporarily, tooltip/status must clearly say `Saved draft`, not final save.

### ValidationService and ReferenceGraphService

Core step only creates shared foundation:

- validation issue shape;
- reference graph node/ref shape;
- helper to validate duplicate ids and missing script refs where current data supports it.

Full validation rules are implemented in `09_VALIDATION_QA_TDD.md`.

## UI requirements

- `Stop game` checkbox enabled.
- `Game speed` input enabled and validates finite positive numbers.
- Invalid speed input reverts or shows inline error without corrupting runtime.
- Dirty state label distinguishes:
  - `Saved`
  - `Unsaved`
  - `Draft saved`
  - `Exported JSON`
  - `Validation failed`
- Closing editor hides grid/overlays and resets editor camera.

## Implementation plan

1. Add service files with tests or focused runtime-free checks where practical.
2. Wire `EditorTimeController` into `EditorShell` and `EditorTopTabs`.
3. Replace disabled top-tab controls with callbacks.
4. Add `UndoDirtyContextService` to `EditorShell`.
5. Add context adapter methods, but keep individual tab undo buttons disabled until their tab TDD wires them.
6. Split save button behavior/status into draft/export/import semantics.
7. Add validation service shell and call it before export/save draft where safe.
8. Update docs/status if behavior differs from this TDD.

## Tests

Manual/browser:

- Open game, start demo, press F2.
- Toggle `Stop game`; gameplay movement stops.
- Untoggle `Stop game`; gameplay resumes.
- Change `Game speed` to `0.5` and `2.0`; runtime speed visibly changes.
- Enter invalid speed text; UI rejects safely.
- Close editor; runtime returns to normal speed and overlays hide.

Build:

```txt
npm run build-nolog
```

Playwright smoke:

- capture screenshot of top toolbar with enabled controls;
- verify no console errors except known WebGL performance warnings.

## Acceptance

- Checklist global editor time controls are no longer cosmetic.
- Save/draft/export semantics are honest in UI/status.
- Shared dirty/undo service exists and can be used by modes.
- Shared validation/reference graph foundation exists.
- No mode regresses from current behavior.

