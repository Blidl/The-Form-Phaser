# 07. Cutscene System

## 1. Цель

Cutscene editor должен позволять настраивать interactive cutscenes прямо на уровне:

- выбрать cutscene;
- добавить actors;
- назначить actor actions;
- связать actions со scripts;
- увидеть timeline;
- настроить start condition;
- проиграть preview;
- сохранить JSON.

## 2. Interactive vs Overlay

```ts
type CutsceneType = "interactive" | "overlay";
```

MVP:

- `interactive` реализуется;
- `overlay` виден в UI, но disabled.

Interactive:
- происходит на уровне;
- player control забирается;
- NPC default behavior временно отключается/понижается приоритетом;
- cutscene scripts управляют actors;
- после завершения управление восстанавливается.

Overlay:
- видео/визуал поверх уровня;
- не реализуется в первой версии.

## 3. Data model

```ts
type CutsceneData = {
  id: string;
  name: string;
  type: "interactive" | "overlay";
  durationMs: number;
  startCondition: CutsceneStartCondition;
  actors: CutsceneActorBinding[];
  actions: CutsceneActorAction[];
};

type CutsceneActorBinding = {
  id: string;
  label: string;
  kind: "camera" | "player" | "npc" | "object" | "trigger" | "other";
  targetId?: string;
};

type CutsceneActorAction = {
  id: string;
  actorBindingId: string;
  startMs: number;
  scriptId: string;
  delayMs?: number;
  durationOverrideMs?: number;
};
```

## 4. Actors

Default actor:
- Camera.

Available actor targets:
- Player;
- NPC on current level;
- objects/platforms/special objects;
- triggers if needed;
- camera.

Actor list in left inspector defines timeline rows.

## 5. Start condition

MVP options:

```ts
type CutsceneStartCondition =
  | { type: "trigger"; triggerId: string }
  | { type: "script"; scriptId: string }
  | { type: "manual" };
```

UI:
- Trigger dropdown lists triggers on current level.
- Script picker lists appropriate scripts.
- Manual start used for preview/dev only.

## 6. Timeline rendering

For each actor row:

```txt
red start dot -> arrow -> dark red end dot
```

Computations:

```ts
const effectiveStart = action.startMs + (action.delayMs ?? 0);
const effectiveDuration =
  action.durationOverrideMs ?? estimateScriptDuration(script, ctx);
const effectiveEnd = effectiveStart + effectiveDuration;
```

If duration unknown:
- display warning marker;
- show minimal arrow or dotted arrow;
- validation warning.

## 7. Preview controls

Buttons:

```txt
Play | Pause | Stop
```

Play:
- snapshots current state;
- starts cutscene from time 0 or playhead;
- disables player control;
- applies actor actions at times.

Pause:
- pauses cutscene timer;
- pauses active script handles/tweens if possible.

Stop:
- stops active handles;
- restores snapshot;
- resets playhead to 0 unless later scrub behavior implemented.

## 8. Runtime trigger execution

When start trigger fires in actual gameplay:

- do not use preview rollback;
- run cutscene as real gameplay event;
- on completion, restore controls;
- run `onComplete` actions later if needed.

## 9. Conflict handling

Potential conflicts:

- same actor has overlapping actions that both control movement;
- same camera has two pan/zoom scripts overlapping;
- cutscene references missing script;
- actor target deleted;
- trigger deleted;
- duration exceeds cutscene duration.

Validation should show:

```txt
error: Actor NPC 1 has two movement scripts overlapping 1500-2200ms
warning: Action duration unknown
error: Script CS1 zoom2 not found
```

## 10. Script categories for cutscene

```txt
cutscene.npc
cutscene.camera
cutscene.player
cutscene.other
```

Actor kind should restrict script picker category by default:

```txt
camera -> cutscene.camera
player -> cutscene.player
npc -> cutscene.npc
object/trigger/other -> cutscene.other
```

## 11. State restoration

Cutscene preview snapshot should include:

- player position/control;
- NPC positions/current AI state;
- object positions/rotation/visual if scripts can modify them;
- camera scroll/zoom/follow;
- active tweens/timers created by cutscene;
- time scale if modified.

## 12. Implementation slices

1. Cutscene list and settings only.
2. Actor list with camera default.
3. Action list per actor with script picker.
4. Timeline renderer from actions.
5. Play/Stop preview without pause.
6. Pause support.
7. Validation.
8. Runtime trigger integration.
9. Later: drag timeline editing.
