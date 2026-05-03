# 03. Data Model and File Formats

## 1. Naming conventions

All canonical ids are strings.

Recommended id format:

```txt
level_001
object_0001
npc_0001
trigger_0001
cutscene_0001
script_0001
```

Display names can be user-editable. IDs should not change in normal UI.

## 2. ProjectData

```ts
type ProjectData = {
  schemaVersion: number;
  gameId: string;
  startLevelId: string;
  levels: LevelMeta[];
  levelSequence: LevelSequenceRule[];
  playerSettings: PlayerSettings;
};

type LevelMeta = {
  id: string;
  name: string;
  file: string;
};

type LevelSequenceRule = {
  fromLevelId: string;
  exitTriggerId: string;
  toLevelId: string | null;
};
```

Rule:
- if exit trigger exists but no `toLevelId`, runtime opens final game screen.

## 3. LevelData

```ts
type LevelData = {
  schemaVersion: number;
  id: string;
  name: string;
  width: number;
  height: number;
  playerSpawn: Point;
  objects: LevelObjectData[];
  backgroundObjects: BackgroundObjectData[];
  npcs: NpcData[];
  triggers: TriggerData[];
  cutscenes: CutsceneData[];
  scripts: ScriptAsset[];
  layers: LayerDefinition[];
};
```

## 4. Common primitives

```ts
type Point = { x: number; y: number };

type BoundsData = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
};

type VisualData = {
  shader?: string;
  texture?: string;
  fill?: string;
  stroke?: string | null;
  alpha: number;
  layerId?: string;
  onlyDebugView?: boolean;
};

type LayerDefinition = {
  id: string;
  name: string;
  order: number;
};
```

## 5. Objects

```ts
type ObjectClass = "platform" | "special" | "object";

type ObjectCollision = "solid" | "visualOnly";

type LevelObjectData = {
  id: string;
  name: string;
  class: ObjectClass;
  type: string;
  bounds: BoundsData;
  visual: VisualData;
  settings: {
    collision: ObjectCollision;
  };
  actions: {
    moveScriptId?: string;
    rotateScriptId?: string;
    defaultActionId?: string;
    actionScriptIds: string[];
  };
  editor?: {
    locked?: boolean;
  };
};
```

Initial object presets:

```txt
Platforms:
  Default rectangle platform
  1/4 tube platform
  Angle 45 platform
  Round platform

Special:
  Checkpoint
  Player Spawn
  Finish
  Wind Zone
  Trigger Volume

Objects:
  Triangle Pickup
  Drag Box
```

Object `type` can change only within its class.

## 6. Background

```ts
type BackgroundLayerId = "static" | "parallax1" | "parallax2";

type BackgroundObjectData = {
  id: string;
  name: string;
  layer: BackgroundLayerId;
  bounds: BoundsData;
  visual: VisualData & {
    tileHorizontalRepeat?: boolean;
    tileVerticalRepeat?: boolean;
  };
  editor?: {
    locked?: boolean;
  };
};

type BackgroundLayerSettings = {
  id: BackgroundLayerId;
  parallaxX: number;
  parallaxY: number;
};
```

Default:

```txt
static: parallaxX=0, parallaxY=0
parallax1: closer to game layer
parallax2: farther
```

## 7. NPC

```ts
type NpcCollisionMode =
  | "withPlayer"
  | "environmentAndNpcOnly";

type NpcData = {
  id: string;
  name: string;
  type: string; // ball, triangle, square, rectangle...
  bounds: BoundsData;
  spawn: Point;
  collisionMode: NpcCollisionMode;
  visual: VisualData;
  actions: {
    defaultPatrolScriptId?: string;
    defaultActionScriptId?: string;
    altActionScriptIds: string[];
  };
  editor?: {
    locked?: boolean;
  };
};
```

Copy/paste NPC should decide whether scripts are shared or duplicated. Recommended: duplicate NPC instance and keep script references by default; offer "duplicate with scripts" later.

## 8. Triggers

```ts
type TriggerData = {
  id: string;
  name: string;
  bounds: BoundsData;
  shape: "rectangle" | "circle" | "polygon";
  activators: Array<"player" | "npc" | "object">;
  once: boolean;
  actions: TriggerAction[];
};

type TriggerAction =
  | { type: "openLevel"; levelId?: string }
  | { type: "playCutscene"; cutsceneId: string }
  | { type: "runScript"; scriptId: string }
  | { type: "setFlag"; key: string; value: boolean };
```

## 9. Cutscenes

```ts
type CutsceneType = "interactive" | "overlay";

type CutsceneData = {
  id: string;
  name: string;
  type: CutsceneType;
  durationMs: number;
  skippable?: boolean;
  startCondition: CutsceneStartCondition;
  actors: CutsceneActorBinding[];
  actions: CutsceneActorAction[];
  editor?: {
    lockedActorIds?: string[];
  };
};

type CutsceneStartCondition =
  | { type: "trigger"; triggerId: string }
  | { type: "script"; scriptId: string }
  | { type: "manual" };

type CutsceneActorBinding = {
  id: string;
  label: string;
  kind: "camera" | "player" | "npc" | "object" | "trigger" | "other";
  targetId?: string; // absent for camera
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

Important:
- use `startMs`;
- avoid ambiguous field name `duration` unless its meaning is explicit;
- visual timeline end = `startMs + effectiveDurationMs`.

## 10. Scripts

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

type ScriptAsset = {
  id: string;
  name: string;
  category: ScriptCategory;
  commands: ScriptCommand[];
  editor?: {
    rawLines?: string[];
    locked?: boolean;
  };
};

type ScriptCommand = {
  id: string;
  type: string;
  params: Record<string, unknown>;
};
```

## 11. Save format example

```json
{
  "schemaVersion": 1,
  "id": "level_003",
  "name": "Level 3 (main)",
  "width": 2200,
  "height": 900,
  "playerSpawn": { "x": 120, "y": 720 },
  "objects": [],
  "backgroundObjects": [],
  "npcs": [],
  "triggers": [],
  "cutscenes": [],
  "scripts": []
}
```

## 12. Migrations

Each JSON file must include `schemaVersion`.

Future migration shape:

```ts
type Migration = {
  from: number;
  to: number;
  run(data: unknown): unknown;
};
```
