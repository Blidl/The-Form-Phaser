# 08. Cutscenes Editor TDD

## Goal

Build a full interactive cutscene editor matching:

```txt
assets/mockups/cutscenes_window_original.png
assets/mockups/cutscenes_window_timeline_corrected.png
```

## Current state

- Cutscenes tab lists registered test cutscenes.
- Right inspector displays selected cutscene steps.
- Logic binding UI exists for `onFinish`.
- No create/delete authoring, actor editor, start condition editor, action editor, timeline editor, or rollback preview.

## Scope

Implement in:

```txt
src/editor/modes/CutscenesEditorMode.ts
src/game/cutscene/*
src/scenes/runtime/cinematic_overlay_scene.ts
src/scenes/runtime/test_cutscene_runtime.ts
src/editor/logic-authoring/*
src/editor/data/ReferenceGraphService.ts
src/editor/data/ValidationService.ts
```

Add service if needed:

```txt
src/editor/cutscene-authoring/CutsceneAuthoringService.ts
```

## UI requirements

Left inspector:

- tabs:
  - `Interactive` active;
  - `Overlay` visible but disabled until supported;
- cutscene list;
- search;
- add/delete cutscene.

Right inspector:

- selected cutscene settings:
  - ID read-only;
  - Name;
  - Duration;
  - Lock;
- start condition:
  - trigger dropdown;
  - script picker;
- actors:
  - camera actor always exists;
  - add/remove actor;
  - actor target dropdown from current level entities;
- selected actor actions:
  - add/remove action;
  - start time;
  - duration if needed;
  - action script picker;
  - Edit opens Logic;
- timeline:
  - dots;
  - arrows;
  - end dots;
  - actor rows;
- preview controls:
  - Play;
  - Pause;
  - Stop;
- Save;
- Undo;
- Lock.

## Data model

Use or adapt canonical shape:

```ts
type CutsceneData = {
  id: string;
  name: string;
  durationMs: number;
  type: 'interactive' | 'overlay';
  startCondition: CutsceneStartCondition;
  actors: CutsceneActorBinding[];
  actions: CutsceneActorAction[];
};
```

MVP can store cutscenes in current level JSON, but APIs must allow later extraction to separate files.

## Preview behavior

Play:

- snapshots player/camera/NPC relevant state;
- disables player control for interactive cutscene;
- overrides NPC behavior for bound NPC actors;
- starts timeline from beginning or current preview cursor.

Pause:

- freezes preview time without committing runtime state.

Stop:

- restores player/camera/NPC behavior and positions from snapshot;
- clears preview overlays/state.

## Validation

- cutscene id unique;
- name non-empty;
- duration positive;
- all actors have valid target except camera actor;
- start trigger/script refs exist;
- action scripts exist;
- action end <= cutscene duration;
- no invalid overlaps for mutually exclusive actor actions;
- referenced NPC/object/player target exists.

## Implementation plan

1. Add `CutsceneAuthoringService`.
2. Convert registered/test cutscenes into editable level cutscene data or bridge them.
3. Add cutscene list/search/create/delete.
4. Add settings/start condition editor.
5. Add actor list and target dropdown.
6. Add selected actor action editor.
7. Add timeline renderer matching corrected mockup.
8. Add Play/Pause/Stop preview with rollback snapshot.
9. Add Save/Undo/Lock context.
10. Add validation and delete protection.
11. Capture screenshot against corrected cutscene mockup.

## Tests

Unit:

- cutscene validation for missing actor target;
- action duration beyond cutscene duration;
- overlap validation;
- reference graph users.

Manual:

- Create cutscene.
- Add NPC actor and camera actor.
- Add actor action with script.
- Set start trigger.
- Play/Pause/Stop and verify rollback.
- Save/export/import/reload.

Playwright:

- F2 -> Cutscenes.
- Create cutscene.
- Add actor.
- Add action.
- Verify timeline elements render.
- Run preview controls.

Build:

```txt
npm run build-nolog
```

## Acceptance

- Cutscenes tab is a real authoring editor.
- Interactive tab works.
- Overlay tab visible but disabled.
- Actor/action/timeline workflows work.
- Preview rollback works.
- Validation catches missing refs and timeline issues.

