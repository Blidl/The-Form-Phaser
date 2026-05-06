# 06. Logic Editor TDD

## Goal

Build the final Logic editor from the spec:

```txt
assets/mockups/logic_window.png
../06_LOGIC_SCRIPT_DSL.md
```

Logic scripts must be edited as readable instructions while saved as structured JSON commands.

## Current state

- Logic tab loads external script assets from `logic_scripts.json`.
- Script refs and bindings exist.
- Diagnostics exist.
- Preview is sandbox-only and does not execute in live gameplay runtime.
- Embedded scripts are transitional.
- There is no final instruction-line editor/parser workflow.

## Scope

Implement in:

```txt
src/editor/modes/LogicEditorMode.ts
src/editor/modes/logic/*
src/editor/logic-authoring/*
src/game/world/runtime/logic_script_registry.ts
src/game/world/runtime/logic_script_runtime.ts
src/game/world/runtime/data/logic_scripts.json
src/editor/data/ReferenceGraphService.ts
src/editor/data/ValidationService.ts
```

## UI requirements

Left inspector:

- script category groups:
  - Object: Move, Rotate, Action;
  - NPC: Patrol, Action, Alt Action;
  - Cutscenes: NPC, Camera, Player, Other;
  - Trigger/World if needed;
- script list;
- selected script green;
- add/delete script with reference protection.

Right inspector:

- selected script metadata:
  - ID read-only;
  - Name;
  - Category;
  - Lock;
- Instructions editor:
  - ordered lines;
  - add/remove/reorder;
  - command type picker or strict text parser;
  - per-command fields;
- validation errors;
- script users list;
- focus user where possible;
- Play/Pause/Stop preview.

## Command model

Canonical storage remains:

```ts
type LogicScriptCommand = {
  id: string;
  type: string;
  params: Record<string, unknown>;
};
```

Readable instruction examples:

```txt
1. Walk to X=300 Y=500 speed=120
2. Wait 0.5 sec
3. Play emote "!"
4. Look at player
```

No arbitrary natural-language parser. Each supported line must map to a strict command schema.

## Command registry MVP

Create a registry with:

- command type;
- display label;
- category compatibility;
- param schema;
- format-to-line;
- parse-line or form-field config;
- validation;
- preview support flag.

Initial commands:

- `wait`;
- `moveTo`;
- `lookAt`;
- `playEmote`;
- `setWorldFlag`;
- `startCutscene`;
- camera command placeholder if needed for Cutscenes.

## Preview behavior

MVP preview modes:

1. Sandbox trace for non-runtime-safe commands.
2. Runtime preview for supported commands.

Final acceptance requires:

- Play starts preview.
- Pause pauses preview.
- Stop restores state.
- Preview result is visible.
- Unsupported commands report explicit diagnostics.

## References

ReferenceGraph must show:

- Objects using script;
- NPCs using script;
- Cutscenes using script;
- world/trigger bindings using script;
- commands referencing objects/NPC/cutscenes/markers.

Delete script:

- blocked if referenced;
- dialog lists references;
- optional force-delete only if explicitly accepted by product decision.

## Save/Undo

- `logic.script` context for selected script.
- Save writes structured JSON.
- Undo reverts unsaved instruction and metadata changes.
- External script save path must be explicit:
  - file/backend endpoint in dev;
  - export if browser-only.

## Implementation plan

1. Add command registry types and initial command definitions.
2. Add format/parse/validate helpers.
3. Replace read-only command display with editable instruction UI.
4. Wire create/delete/duplicate script.
5. Wire script refs/users/reference graph.
6. Implement context Save/Undo.
7. Implement Play/Pause/Stop preview contract.
8. Update diagnostics to use command registry.
9. Fix existing bad data reference to unknown `cutscene_1` or make it a deliberate diagnostic fixture.
10. Capture screenshot against logic mockup.

## Tests

Unit:

- parse/format each command.
- invalid line reports clear validation issue.
- command refs validate missing targets.
- script delete blocked when referenced.

Manual:

- Create script.
- Add instructions.
- Save.
- Assign to Object/NPC/Cutscene.
- Verify users list.
- Run preview and stop rollback.

Playwright:

- F2 -> Logic.
- Create script.
- Add `wait` and `setWorldFlag`.
- Save/export.
- Verify JSON commands.

Build:

```txt
npm run build-nolog
```

## Acceptance

- Logic tab matches mockup structurally.
- Instructions are editable.
- Storage is structured JSON.
- Validation catches broken commands/refs.
- Users list is accurate.
- Play/Pause/Stop preview works with rollback for supported commands.

