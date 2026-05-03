# 01. Архитектура

## 1. High-level разделение

Фича делится на три слоя:

```txt
Presentation Layer
  DOM UI + Phaser editor overlays

Editor Application Layer
  Modes, selection, inspectors, dirty contexts, validation

Runtime/Data Layer
  ProjectStore, JSON schemas, loaders, runtime executors
```

## 2. Presentation Layer

### DOM UI

DOM/HTML отвечает за:

- top toolbar;
- tabs;
- left/right inspectors;
- forms;
- lists;
- search inputs;
- dropdowns;
- buttons;
- text editor для Logic;
- cutscene timeline panel.

DOM UI должен быть поверх Phaser canvas.

Рекомендуется структура:

```txt
src/editor/ui/
  EditorRoot.tsx or EditorRoot.ts
  TopToolbar.tsx
  LeftInspector.tsx
  RightInspector.tsx
  forms/
  lists/
  timeline/
```

Если проект не использует React, можно реализовать на vanilla DOM, но компоненты все равно должны быть разделены.

### Phaser overlays

Phaser отвечает за:

- grid;
- ruler;
- mouse world coordinates;
- selection outlines;
- transform handles;
- trigger zones;
- path preview;
- movement arrows;
- camera frame;
- preview ghosts;
- debug-only objects.

Рекомендуется структура:

```txt
src/editor/overlays/
  GridOverlay.ts
  RulerOverlay.ts
  SelectionOverlay.ts
  TransformGizmo.ts
  TriggerZoneOverlay.ts
  PathOverlay.ts
  CutscenePreviewOverlay.ts
```

## 3. EditorShell

`EditorShell` управляет жизненным циклом editor:

```ts
class EditorShell {
  open(): void;
  close(): void;
  toggle(): void;
  setMode(modeId: EditorModeId): void;
  update(time: number, delta: number): void;
}
```

Обязанности:

- слушать `F2`;
- показать/скрыть UI;
- включить/выключить overlays;
- запомнить последнюю вкладку;
- управлять time mode и game speed;
- сбросить editor camera на close;
- раздать события active mode.

## 4. EditorModeController

```ts
type EditorModeId =
  | "level"
  | "player"
  | "objects"
  | "background"
  | "npc"
  | "cutscenes"
  | "logic";

interface EditorMode {
  id: EditorModeId;
  enter(): void;
  exit(): void;
  renderLeftInspector(): UiNode;
  renderRightInspector(): UiNode;
  onCanvasPointerDown(event: EditorPointerEvent): void;
  onCanvasPointerMove(event: EditorPointerEvent): void;
  onCanvasPointerUp(event: EditorPointerEvent): void;
  onKeyDown(event: KeyboardEvent): void;
  update(time: number, delta: number): void;
}
```

Каждая вкладка реализуется как отдельный mode.

## 5. ProjectStore

`ProjectStore` хранит working copy проекта.

```ts
class ProjectStore {
  project: ProjectData;
  currentLevel: LevelData;

  getLevel(id: string): LevelData | undefined;
  setCurrentLevel(id: string): Promise<void>;
  updateObject(id: string, patch: Partial<LevelObjectData>): void;
  updateNpc(id: string, patch: Partial<NpcData>): void;
  updateCutscene(id: string, patch: Partial<CutsceneData>): void;
  updateScript(id: string, patch: Partial<ScriptAsset>): void;
}
```

Важно: `ProjectStore` не должен напрямую писать файлы. Он изменяет состояние. Запись — через `SaveLoadService`.

## 6. SaveLoadService

```ts
interface SaveLoadService {
  loadProject(): Promise<ProjectData>;
  loadLevel(levelId: string): Promise<LevelData>;
  saveProject(project: ProjectData): Promise<void>;
  saveLevel(level: LevelData): Promise<void>;
  saveScript(script: ScriptAsset): Promise<void>;
}
```

Варианты реализации:

1. local dev server endpoint;
2. File System Access API;
3. export/download JSON;
4. hybrid.

Для production-quality dev workflow предпочтителен local dev server write endpoint, потому что browser сам по себе не может надежно писать произвольные файлы проекта.

## 7. DirtyContextService

Context-local Save/Undo:

```ts
type SaveContextId =
  | "level.list"
  | "level.selected"
  | "level.sequence"
  | "player.common"
  | "object.selected"
  | "background.selected"
  | "npc.selected"
  | "cutscene.selected"
  | "logic.script";

type EditorContextState<T> = {
  id: SaveContextId;
  baseline: T;
  draft: T;
  dirty: boolean;
  save(): Promise<void>;
  undo(): void;
};
```

Каждый inspector работает через context, а не напрямую пишет canonical data без baseline.

## 8. SelectionSystem

```ts
type SelectionTarget =
  | { kind: "object"; id: string }
  | { kind: "background"; id: string }
  | { kind: "npc"; id: string }
  | { kind: "trigger"; id: string }
  | { kind: "cutsceneActor"; cutsceneId: string; actorId: string }
  | { kind: "script"; id: string };

class SelectionSystem {
  selected: SelectionTarget[];
  select(target: SelectionTarget, mode?: "replace" | "add" | "toggle"): void;
  clear(): void;
  isSelected(target: SelectionTarget): boolean;
}
```

Mode определяет, какие target kind можно выбирать.

## 9. TransformGizmoSystem

Обязанности:

- drag move;
- resize by handles;
- rotate by handle;
- snap to grid;
- multi-select movement;
- lock check;
- update right inspector draft.

Не должен выполнять save. Он меняет draft/current editor state.

## 10. ValidationService

```ts
type ValidationSeverity = "error" | "warning" | "info";

type ValidationIssue = {
  id: string;
  severity: ValidationSeverity;
  message: string;
  source: {
    kind: string;
    id?: string;
    path?: string;
  };
  fix?: {
    label: string;
    actionId: string;
  };
};
```

Validation должна запускаться:

- при save;
- при delete;
- при rename;
- при open level;
- при play cutscene;
- при play script;
- при export.

## 11. ReferenceGraph

Отслеживает, кто на кого ссылается:

```txt
Object -> Script
NPC -> Script
Cutscene Actor Action -> Script
Cutscene Start Condition -> Trigger
Level Sequence Rule -> Trigger + Level
Script Command -> Marker/Object/NPC/Player/Trigger
```

Нужен для:

- safe delete;
- rename propagation;
- Scripts Users panel;
- validation;
- focus from reference.

## 12. Runtime bindings

Cutscene и Logic scripts должны работать через bindings:

```ts
type RuntimeBindings = {
  player?: Phaser.GameObjects.GameObject;
  camera: Phaser.Cameras.Scene2D.Camera;
  objects: Map<string, Phaser.GameObjects.GameObject>;
  npcs: Map<string, Phaser.GameObjects.GameObject>;
  triggers: Map<string, TriggerRuntime>;
};
```

Script не должен искать глобальные объекты по именам в Phaser scene. Он должен получать bindings.

## 13. Ошибки проектирования, которых нужно избегать

- Один `EditorManager` на 3000 строк.
- UI-компонент, который сам пишет JSON и двигает Phaser объект.
- Script command как строка без parsed representation.
- Timeline, который знает о внутренностях NPC AI.
- Сохранение через localStorage как финальная система.
- Разные реализации Save/Undo в разных панелях.
