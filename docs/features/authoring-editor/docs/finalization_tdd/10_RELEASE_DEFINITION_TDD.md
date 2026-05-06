# 10. Release Definition TDD

## Goal

Define the final release gate for the complete Authoring Editor feature.

This document is used after all individual TDD steps are implemented.

## Release candidate requirements

Global:

- F2 opens editor.
- F2 closes editor.
- Editor appears over real Phaser level.
- No fake/placeholder viewport is used.
- Top toolbar matches mockups.
- Left/right inspectors match mockups.
- Active tab is green.
- Stop game/time mode works.
- Game speed works.
- Closing editor hides grid/overlays.
- Closing editor resets editor zoom/pan to gameplay default.

Data:

- canonical JSON can be exported.
- canonical JSON can be imported.
- reload from saved/exported JSON recreates level.
- schema version stored.
- localStorage draft is not presented as final save.
- Save/draft/export semantics are explicit.

Validation:

- missing script refs blocked;
- missing trigger refs blocked;
- missing level refs blocked;
- duplicate ids blocked;
- delete protection lists references.

Tabs:

- Level complete.
- Player complete.
- Objects complete.
- Background complete.
- NPC complete.
- Cutscenes complete.
- Logic complete.

Preview:

- Logic Play/Pause/Stop works.
- Logic Stop restores preview state.
- Cutscene Play/Pause/Stop works.
- Cutscene Stop restores player/NPC/camera state.

## Required verification

Build:

```txt
npm run build-nolog
```

Recommended after existing baseline TS errors are cleaned:

```txt
npx tsc --noEmit
```

Browser:

- run final Playwright smoke from `09_VALIDATION_QA_TDD.md`;
- inspect generated screenshots;
- inspect console output.

Manual:

- create/edit/save one entity in every tab;
- export JSON;
- reload/import JSON;
- verify runtime uses saved data.

## Release artifacts

Required artifacts:

```txt
output/playwright/authoring-finalization/report.json
output/playwright/authoring-finalization/*.png
```

Required docs updates:

- update implementation status docs;
- update acceptance checklist status or create a completion report;
- document known limitations if any remain.

## Known limitations policy

A limitation may remain only if:

- it is not part of the final acceptance checklist, or
- it is explicitly accepted as deferred, and
- UI does not pretend the feature works.

Examples of acceptable wording:

```txt
Overlay cutscenes are visible but disabled.
Shader picker is deferred; texture picker works.
```

Examples of unacceptable state:

```txt
Button appears enabled but does nothing.
Save says saved but only wrote localStorage draft.
Preview says Play but only prints static diagnostics.
```

## Final acceptance

The feature is done when:

- all blocking checklist items pass;
- no final-tab placeholder text remains;
- all major entity workflows survive reload;
- validation catches broken references;
- preview rollback works;
- build passes;
- fresh screenshots are reviewed against mockups.

