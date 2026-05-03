# 06. Logic Script DSL

## 1. Цель

Logic scripts нужны для:

- движения объектов;
- вращения объектов;
- object actions;
- NPC patrol;
- NPC default action;
- NPC alt actions;
- cutscene actor scripts;
- camera scripts;
- player scripts;
- other utility commands.

## 2. Основной принцип

UI может выглядеть как line-based instructions editor.

Но canonical data must be structured JSON.

Это значит:

```txt
Line text -> parser/autocomplete -> ScriptCommand JSON -> validation -> executor
```

Raw text не является источником истины.

## 3. Script categories

```ts
type ScriptCategory =
  | "object.move"
  | "object.rotate"
  | "object.action"
  | "npc.patrol"
  | "npc.action"
  | "npc.altAction"
  | "cutscene.npc"
  | "cutscene.camera"
  | "cutscene.player"
  | "cutscene.other";
```

## 4. Command registry

Commands are registered in code:

```ts
type CommandDefinition<TParams> = {
  type: string;
  label: string;
  allowedCategories: ScriptCategory[];
  parseLine?(line: string): TParams | null;
  toLine?(command: ScriptCommand): string;
  validate(command: ScriptCommand, ctx: ValidationContext): ValidationIssue[];
  estimateDurationMs(command: ScriptCommand, ctx: DurationContext): number | "unknown";
  execute(command: ScriptCommand, ctx: ScriptExecutionContext): Promise<void>;
};
```

Benefits:

- Codex can add one command at a time;
- validation is local;
- duration estimation is local;
- UI autocomplete uses registry;
- executor dispatches by command type.

## 5. Initial commands

### Common

```txt
wait durationMs
setFlag key value
emitEvent eventName
runScript scriptId
stopScript scriptId
```

### Movement

```txt
moveTo x y speedPxSec
moveBy dx dy speedPxSec
moveToMarker markerId speedPxSec
followPath points speedPxSec loop
setPosition x y
```

### Rotation

```txt
rotateTo angleDeg durationMs
rotateBy deltaDeg durationMs
rotateLoop direction speedDegSec revolutions?
stopRotation
```

### Visual

```txt
setAlpha alpha durationMs?
setFill color
setStroke color
setTexture textureKey
setShader shaderKey
show
hide
```

### Animation/emote

```txt
playAnimation key loop?
playEmote key durationMs
lookAt targetId
faceDirection left|right|up|down
```

### NPC behavior

```txt
patrol points loop speedPxSec
chase targetId speedPxSec durationMs?
returnToSpawn speedPxSec
waitUntilPlayerNear radius
```

### Camera

```txt
cameraPan x y durationMs ease?
cameraPanToActor actorId durationMs ease?
cameraZoom zoom durationMs ease?
cameraShake durationMs intensity
cameraFollow actorId
cameraStopFollow
```

### Cutscene/player control

```txt
disablePlayerControl
enablePlayerControl
setNpcBrainEnabled npcId enabled
```

## 6. Duration estimation

Each command should define duration.

Examples:

```txt
wait 500 -> 500 ms
moveTo with speed -> distance / speed
moveTo with duration -> duration
setTexture -> 0
cameraShake -> duration
unknown target distance -> unknown
```

Script duration:

```ts
function estimateScriptDuration(script: ScriptAsset, ctx: DurationContext): number | "unknown" {
  // sum sequential command durations
}
```

Cutscene timeline should display warning if duration unknown.

## 7. Parser strategy

MVP can use command forms instead of free text:

```txt
[Command dropdown] [params...]
```

If text editor is implemented first:

- one command per line;
- strict syntax;
- autocomplete list;
- error if command is unknown;
- no fuzzy natural language.

Example accepted lines:

```txt
moveTo x=300 y=500 speed=120
wait ms=500
playEmote key="!"
lookAt target=player
cameraZoom zoom=1.5 duration=1000
```

## 8. Execution

Executor runs commands sequentially by default.

```ts
class LogicScriptExecutor {
  run(script: ScriptAsset, ctx: ScriptExecutionContext): ScriptRunHandle;
}
```

Execution requirements:

- pause/resume;
- stop/cancel;
- failed state;
- completion promise;
- controlled time;
- preview rollback support;
- no uncaught promise errors.

## 9. Scripts Users

ReferenceGraph provides users:

```ts
type ScriptUser =
  | { kind: "object"; objectId: string; field: string }
  | { kind: "npc"; npcId: string; field: string }
  | { kind: "cutsceneAction"; cutsceneId: string; actorId: string; actionId: string }
  | { kind: "trigger"; triggerId: string; actionId: string };
```

UI displays these and Focus works when target has world object.

## 10. Edit button behavior

When user clicks `Edit` near script picker:

```txt
current mode -> Logic
select category -> select script -> right inspector opens script -> scripts users highlights caller
```

If script field is empty:
- ask to create new script in correct category;
- after create, assign it to field and open Logic.

## 11. Save format example

```json
{
  "id": "script_cutscene_npc_001",
  "name": "NPC script 1",
  "category": "cutscene.npc",
  "commands": [
    { "id": "cmd_001", "type": "moveTo", "params": { "x": 300, "y": 500, "speedPxSec": 120 } },
    { "id": "cmd_002", "type": "wait", "params": { "durationMs": 500 } },
    { "id": "cmd_003", "type": "playEmote", "params": { "emoteKey": "!" } },
    { "id": "cmd_004", "type": "lookAt", "params": { "targetId": "player" } }
  ],
  "editor": {
    "rawLines": [
      "moveTo x=300 y=500 speed=120",
      "wait ms=500",
      "playEmote key=\"!\"",
      "lookAt target=player"
    ]
  }
}
```
