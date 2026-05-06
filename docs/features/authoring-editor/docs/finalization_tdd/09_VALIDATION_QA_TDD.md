# 09. Validation and QA TDD

## Goal

Add the final quality gate across the whole Authoring Editor:

- complete validation;
- reference graph;
- delete protection;
- reload-from-saved-data checks;
- screenshot/UI fidelity review;
- Playwright acceptance smoke.

## Current state

- Some validation exists in runtime/editor-specific modules.
- Logic diagnostics catch some broken refs.
- Delete protection is incomplete and inconsistent by tab.
- There is no one final acceptance automation pass for all tabs.

## Scope

Implement/complete:

```txt
src/editor/data/ValidationService.ts
src/editor/data/ReferenceGraphService.ts
src/editor/core/EditorShell.ts
src/editor/modes/*
scripts or tmp QA runners as appropriate
```

Add QA artifacts under:

```txt
output/playwright/authoring-finalization/
```

Do not add new top-level artifact folders.

## Validation rules

Project:

- schema version present;
- start level exists;
- level ids unique;
- level sequence targets exist;
- sequence trigger refs exist or warn/block by severity.

Level:

- id unique and non-empty;
- name non-empty;
- width/height positive;
- player spawn finite;
- object ids unique;
- background object ids unique;
- NPC ids unique;
- trigger ids unique;
- cutscene ids unique;
- script ids unique.

Objects:

- type exists;
- bounds finite and positive;
- collision valid;
- script refs exist;
- delete blocked when referenced.

Background:

- layer valid;
- bounds finite and positive;
- alpha valid;
- texture asset known or warned;
- render order deterministic.

NPC:

- profile/type exists;
- spawn/bounds finite;
- script refs exist;
- referenced NPC cannot be deleted silently.

Logic:

- script refs exist;
- commands match registry schema;
- command target refs exist;
- duplicate command ids blocked;
- delete script blocked if used.

Cutscenes:

- actors valid;
- camera actor present;
- target refs exist;
- action refs exist;
- action timing valid;
- preview rollback state available.

Save/export:

- validation runs before final save/export;
- blocking errors prevent save/export;
- warnings are visible.

## ReferenceGraphService

Graph must answer:

```ts
getUsers(entityRef: EntityRef): ReferenceUsage[];
canDelete(entityRef: EntityRef): DeleteValidationResult;
listBrokenReferences(): ValidationIssue[];
```

Entity refs:

- `level`
- `object`
- `backgroundObject`
- `npc`
- `trigger`
- `script`
- `cutscene`
- `cutsceneActor`

## UI requirements

- Save failure shows human-readable issue list.
- Delete confirmation lists references.
- Validation panel or section is available when issues exist.
- No save with broken references unless explicitly accepted as warning-level.

## QA automation

Add a Playwright smoke script or documented runner that:

1. opens `http://127.0.0.1:8080`;
2. starts demo;
3. presses `F2`;
4. visits every tab;
5. verifies no placeholder text in final tabs;
6. performs one create/edit flow for each implemented tab;
7. exports JSON;
8. imports JSON;
9. reloads page;
10. verifies restored state;
11. captures screenshots for each tab;
12. reports console errors.

Screenshot outputs:

```txt
output/playwright/authoring-finalization/level.png
output/playwright/authoring-finalization/player.png
output/playwright/authoring-finalization/objects.png
output/playwright/authoring-finalization/background.png
output/playwright/authoring-finalization/npc.png
output/playwright/authoring-finalization/cutscenes.png
output/playwright/authoring-finalization/logic.png
output/playwright/authoring-finalization/report.json
```

## UI fidelity pass

Compare against:

```txt
assets/mockups/editor_shell_blank_inspectors.png
assets/mockups/level_window_settings.png
assets/mockups/level_sequence_window.png
assets/mockups/player_window.png
assets/mockups/objects_window.png
assets/mockups/background_window.png
assets/mockups/npc_window.png
assets/mockups/cutscenes_window_timeline_corrected.png
assets/mockups/logic_window.png
```

Check:

- tab order;
- green active states;
- left/right panel widths;
- central real canvas visibility;
- field labels;
- button labels;
- scroll behavior;
- timeline layout;
- no text overflow/overlap.

## Implementation plan

1. Finalize `ReferenceGraphService`.
2. Finalize `ValidationService`.
3. Wire validation into save/export/delete flows.
4. Add issue display UI.
5. Add Playwright acceptance runner.
6. Capture screenshots for all tabs.
7. Fix UI fidelity issues.
8. Update `10_ACCEPTANCE_CHECKLIST.md` or add a checked status document.

## Tests

Build:

```txt
npm run build-nolog
```

Acceptance smoke:

```txt
node <authoring-finalization-smoke-runner>
```

Manual:

- Try to delete referenced script/object/NPC.
- Try to save with broken refs.
- Export/import/reload.

## Acceptance

- Validation blocks broken final save/export.
- Delete protection is consistent.
- Playwright smoke passes.
- Fresh screenshots exist.
- No final tab contains placeholder text.
- UI matches mockups closely enough for production iteration.

