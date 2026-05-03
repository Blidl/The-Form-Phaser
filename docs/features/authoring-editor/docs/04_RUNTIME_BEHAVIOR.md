# 04. Runtime Behavior

## 1. Runtime rule

The game runtime must load and execute the same JSON data edited by the editor.

No duplicate "editor-only" truth.

## 2. Level loading

```txt
ProjectData
  -> selected LevelMeta
  -> load LevelData
  -> create background
  -> create objects
  -> create triggers
  -> create NPC
  -> place player
  -> bind cutscenes
  -> bind scripts
```

## 3. Object runtime

For each `LevelObjectData`:

- create Phaser GameObject;
- apply bounds;
- apply visual;
- attach physics if `collision === solid`;
- place into layer;
- if `onlyDebugView`, hide outside debug/editor;
- start move/rotate script if assigned.

## 4. Background runtime

For each `BackgroundObjectData`:

- create image/tileSprite/rectangle depending visual;
- put behind gameplay layers;
- apply parallax factor;
- if tile repeat enabled, use `TileSprite` or texture repeat strategy;
- no collision.

## 5. NPC runtime

For each `NpcData`:

- create actor object;
- apply visual/type;
- apply spawn;
- attach physics/collision mode;
- start default patrol script;
- set default action reaction behavior;
- register alt actions but do not run until triggered.

## 6. LogicScriptExecutor

Script executor receives:

```ts
type ScriptExecutionContext = {
  scene: Phaser.Scene;
  bindings: RuntimeBindings;
  actor?: RuntimeActor;
  source?: RuntimeEntity;
  variables: Record<string, unknown>;
  signal: AbortSignal;
};
```

It returns control object:

```ts
type ScriptRunHandle = {
  id: string;
  state: "running" | "paused" | "stopped" | "completed" | "failed";
  pause(): void;
  resume(): void;
  stop(): void;
  finished: Promise<ScriptRunResult>;
};
```

Executor must support:

- sequential commands;
- parallel scripts on same entity only when allowed;
- cancellation;
- pause/resume;
- rollback support for preview where needed.

## 7. Cutscene runtime

Interactive cutscene behavior:

- triggered by start condition;
- disables player control;
- overrides NPC default scripts while cutscene scripts run;
- plays actor actions by start time;
- camera can be controlled by cutscene;
- after end, restores player/NPC control;
- NPC returns to own behavior scripts;
- state flags/actions on complete run if configured.

## 8. Time scale

Editor toolbar:

- Live/Paused controls game update/time scale;
- `Game speed` from 0 to 1 controls runtime time scale;
- cutscene preview should respect editor preview speed unless explicitly overridden.

Implementation idea:

```ts
class GameTimeController {
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  getEffectiveDelta(delta: number): number;
}
```

Need be careful:
- Phaser physics uses scene time/physics time;
- tweens and timers may need timeScale;
- script executor wait commands should use controlled time.

## 9. Preview rollback

Logic script preview and cutscene preview can move objects/camera.

Before preview:

```ts
type PreviewSnapshot = {
  actorTransforms: Map<string, BoundsData>;
  playerControlState: unknown;
  npcBehaviorStates: Map<string, unknown>;
  cameraState: CameraSnapshot;
  objectStates: Map<string, unknown>;
};
```

After Stop or completion:
- if preview is non-committing, restore snapshot;
- if runtime trigger runs actual cutscene, no rollback unless preview mode.

## 10. Input ownership

When editor is open:

- DOM controls own mouse over panels;
- canvas mouse belongs to editor;
- gameplay keyboard can remain active in Live mode;
- when typing in input/text editor, gameplay keyboard must be suppressed;
- Escape cancels editor operation first, then maybe closes dialogs, but should not always close editor.

## 11. Performance

Editor overlays should be disabled when editor is closed.

Avoid rebuilding all DOM on every frame.

Avoid rebuilding all Phaser objects when a single draft field changes; update selected object incrementally and save later.

Large lists need simple filtering/search and eventually virtualization if needed.
