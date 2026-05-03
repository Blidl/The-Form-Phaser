# 08. Save, Load, Undo, Validation, Delete Protection

## 1. Save model

Edits apply to working draft immediately.

Save writes canonical JSON.

Undo reverts unsaved changes in current context to last saved baseline.

No global undo stack required in MVP.

## 2. Dirty contexts

```ts
type SaveContext =
  | "level.list"
  | "level.selected"
  | "level.sequence"
  | "player.common"
  | "object.selected"
  | "background.selected"
  | "npc.selected"
  | "cutscene.selected"
  | "logic.script";
```

Each context has:

```ts
type DirtyContext<T> = {
  baseline: T;
  draft: T;
  dirty: boolean;
  setDraft(next: T): void;
  save(): Promise<void>;
  undo(): void;
};
```

## 3. Save pipeline

```txt
User clicks Save
  -> validate current context
  -> if errors: show errors, block save
  -> if warnings: allow save with confirmation or show warning
  -> write to ProjectStore canonical data
  -> SaveLoadService writes JSON
  -> update baseline
  -> clear dirty flag
```

## 4. Browser file writing

Important: browser cannot freely write arbitrary project files.

Supported implementation choices:

### Option A — local dev server endpoint

```txt
POST /__editor/save-level
POST /__editor/save-script
POST /__editor/save-project
```

Pros:
- best for Codex/dev workflow;
- real files update in repo;
- can validate paths server-side.

Cons:
- must implement secure local-only server.

### Option B — File System Access API

Pros:
- direct browser workflow;
- no backend.

Cons:
- browser support limitations;
- user permission flow.

### Option C — export/download

Pros:
- easiest MVP;
- safe.

Cons:
- not ideal for iterative authoring.

Recommendation:
- implement SaveLoadService abstraction first;
- MVP can export/download;
- dev workflow should use local endpoint.

## 5. ReferenceGraph

Track references:

```txt
LevelSequenceRule -> level, trigger
Object move/rotate/action -> script
NPC patrol/action/alt -> script
Cutscene startCondition -> trigger/script
Cutscene actor -> target entity
Cutscene action -> script
Trigger action -> level/cutscene/script
Script command -> marker/object/npc/player/trigger
```

## 6. Delete protection

When deleting:

```txt
collect references
if references exist:
  show dialog:
    - list users
    - cancel
    - remove references
    - delete anyway disabled for critical refs
```

Examples:
- cannot delete level used as start level without choosing new start;
- cannot delete trigger used in level sequence/cutscene without removing reference;
- cannot delete script used by object/NPC/cutscene without confirmation and cleanup.

## 7. Rename safety

IDs should not be user-renamed.

Names can change freely.

If later script file path/name changes:
- keep stable id;
- update display name;
- do not break references.

## 8. Validation issues

```ts
type ValidationIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  source: {
    entityKind: string;
    entityId?: string;
    path?: string;
  };
};
```

Examples:

```txt
error: NPC npc_001 references missing script script_007
error: Cutscene scene_1 action action_2 has no actor
warning: Cutscene scene_1 duration 5500ms is shorter than action ending 6200ms
warning: Background object has texture key that is not found in registry
error: Level sequence uses trigger id that does not exist in source level
```

## 9. Scripts Users panel

Use ReferenceGraph.

For selected script show:

```txt
Scene 1 / NPC 1 / Action 1
NPC 1 / Default Patrol Behaviour
Moving Platform / Move
Trigger 1 / runScript
```

Focus:
- object/NPC/trigger -> center camera and select;
- cutscene actor -> select cutscene and actor;
- pure cutscene reference without world object -> select cutscene, no camera focus.

## 10. Dirty navigation

If user switches selected entity/context with unsaved changes:

Options:
- save;
- discard;
- cancel.

MVP can auto-keep draft until explicit Save/Undo, but UI must make dirty state visible.

Recommended:
- prompt when switching selection away from dirty selected object/NPC/script.
