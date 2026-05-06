# 07. NPC Editor TDD

## Goal

Build a full NPC authoring workflow matching:

```txt
assets/mockups/npc_window.png
```

## Current state

- NPC tab lists runtime NPCs.
- Right inspector displays selected NPC read-only metadata.
- Logic binding UI exists for narrow slots.
- No create mode, placement, bounds/visual editor, copy/paste, or full script picker workflow.

## Scope

Implement in:

```txt
src/editor/modes/NpcEditorMode.ts
src/game/npc/*
src/editor/logic-authoring/*
src/editor/data/ReferenceGraphService.ts
src/editor/data/ValidationService.ts
```

Add `NpcAuthoringService` if needed:

```txt
src/editor/npc-authoring/NpcAuthoringService.ts
```

## UI requirements

Left inspector:

- title `NPC`;
- `Create NPC` toggle;
- active create mode highlighted green;
- NPC list;
- search;
- focus selected.

Right inspector:

- selected NPC title/name;
- ID read-only;
- profile/type;
- collision/body mode;
- bounds or spawn position:
  - X;
  - Y;
  - Width;
  - Height;
  - Rotation if supported;
- visual settings:
  - layer;
  - render order;
  - facing;
  - initial Manpu/emotion;
- script pickers:
  - Default Patrol;
  - Default Action;
  - Alt Actions list with add/remove;
  - Edit opens Logic;
- Save;
- Undo;
- Lock;
- Del;
- Copy/Paste/Duplicate.

## Canvas behavior

- Create NPC mode:
  - click on level creates NPC at mouse world position;
  - new NPC becomes selected;
  - create mode disables after successful creation.
- Click NPC selects it.
- Drag moves unlocked NPC.
- Resize if NPC bounds are authorable.
- Locked NPC selectable but not editable.

## Data behavior

- NPC instances are saved in level canonical config.
- Script picker stores script ref ids through logic binding/reference model.
- Manual script id input is not primary UI.
- Existing runtime NPC behavior must continue after reload.

## Validation

- NPC id unique;
- profile/type exists;
- spawn/bounds finite;
- script refs exist;
- alt actions do not duplicate invalid slots;
- delete blocked if referenced by cutscene, script command, trigger, or logic binding.

## Runtime integration

Authoring changes should apply through runtime config import/rebuild path or dedicated NPC runtime authoring API.

Avoid direct mutation of live NPC display objects unless the runtime config is also updated.

## Implementation plan

1. Add `NpcAuthoringService` gateway.
2. Add create mode and canvas placement.
3. Add list/search/focus.
4. Add selected NPC draft state.
5. Add editable fields and runtime preview updates.
6. Add script pickers from Logic refs.
7. Add Edit-to-Logic navigation.
8. Add copy/paste/duplicate/delete/lock.
9. Add Save/Undo context.
10. Add validation/delete protection.
11. Capture screenshot against NPC mockup.

## Tests

Manual:

- Create NPC by toggle + canvas click.
- Select NPC from list and canvas.
- Move NPC.
- Change profile/type/facing/visual fields.
- Assign patrol/action/alt action script.
- Use Edit to open Logic.
- Lock and verify edit blocked.
- Delete with references and verify protection.

Playwright:

- F2 -> NPC.
- Toggle create.
- Click canvas.
- Verify list count increments.
- Assign script ref after Logic script exists.
- Export JSON and verify NPC data.

Build:

```txt
npm run build-nolog
```

## Acceptance

- NPC tab is a true authoring editor, not read-only inspector.
- Create/list/search/focus work.
- Bounds/settings/visual/action inspector works.
- Script pickers are dropdown/search based.
- Save/Undo/Lock/Del/Copy/Paste work.

