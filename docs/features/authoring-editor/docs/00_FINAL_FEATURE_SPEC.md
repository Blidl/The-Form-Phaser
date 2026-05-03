# 00. Итоговое описание фичи — Authoring Editor

## 1. Цель фичи

Нужно реализовать новый in-game editor для Phaser/TypeScript проекта **TheFormPhaser**.

Editor нужен для настройки:

- уровней и их последовательности;
- player tuning;
- объектов уровня;
- background/parallax объектов;
- NPC;
- interactive cutscenes;
- logic scripts, которые используются объектами, NPC и cutscenes.

Editor открывается поверх игры по `F2`. Игровое окно остается настоящим игровым Phaser canvas, а не отдельным макетным viewport.

## 2. Основные UI-разделы

Верхняя панель содержит вкладки:

```txt
Level | Player | Objects | Background | NPC | Cutscenes | Logic
```

Выбранная вкладка подсвечивается зеленым.

Справа от вкладок находятся:

```txt
[ ] Stop game / Time mode
[1.0] Game speed
```

Точная подпись в UI может быть `Stop game`, но внутри архитектуры это лучше трактовать как `Paused/Live time mode`.

## 3. Общая компоновка

Editor всегда имеет одну и ту же базовую структуру:

```txt
+----------------------------------------------------------------------------+
| Top toolbar / tabs / time controls                                          |
+----------------------+-----------------------------------+-----------------+
| Left Inspector       | Real Phaser game canvas/level      | Right Inspector |
| select/create/search | grid/ruler/selection/gizmos        | settings/forms  |
| lists/catalogs       | camera pan/zoom                    | save/undo/etc   |
+----------------------+-----------------------------------+-----------------+
```

Левый inspector обычно отвечает за выбор того, что настраивается.

Правый inspector отвечает за параметры выбранного объекта/актора/скрипта/уровня.

Центр — реальный уровень. В нем видно actual runtime objects, а также editor overlays.

## 4. Не делать

Не делать:

- отдельный fake Phaser viewport внутри editor;
- placeholder UI вместо настоящего уровня;
- один гигантский `EditorScene`/`GodObject`;
- хранение всего состояния только в localStorage;
- ручной ввод script id там, где можно дать dropdown/search;
- произвольный natural-language parser без строгой структуры команд;
- сохранение с битыми ссылками без предупреждений.

## 5. Core architecture

```txt
EditorShell
  ├─ TopToolbar
  ├─ LeftInspector
  ├─ RightInspector
  ├─ EditorModeController
  ├─ EditorCameraController
  ├─ GridAndRulerOverlay
  ├─ SelectionSystem
  ├─ TransformGizmoSystem
  ├─ ProjectStore
  ├─ ValidationService
  ├─ ReferenceGraph
  ├─ SaveLoadService
  └─ UndoDirtyContextService

Runtime
  ├─ LevelLoader
  ├─ ObjectRuntimeFactory
  ├─ BackgroundRuntimeFactory
  ├─ NpcRuntimeFactory
  ├─ LogicScriptExecutor
  ├─ CutsceneRuntime
  └─ RuntimeBindings
```

Editor меняет данные. Runtime строит игру из данных.

## 6. Data-first модель

Canonical data хранится в JSON.

Editor не должен быть единственным источником истины. Phaser scene должна восстанавливаться из JSON.

Минимальный проект:

```txt
project.json
levels/
  level_1.json
  level_2.json
scripts/
  object/
  npc/
  cutscene/
cutscenes/
assets/
```

Допускается хранить scripts и cutscenes внутри `level.json` на MVP, но интерфейсы должны быть спроектированы так, чтобы позже вынести их в отдельные файлы.

## 7. Главные сущности

```ts
type ProjectData = {
  schemaVersion: number;
  levels: LevelMeta[];
  startLevelId: string;
  levelSequence: LevelSequenceRule[];
  playerSettings: PlayerSettings;
};

type LevelData = {
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
};

type ScriptAsset = {
  id: string;
  name: string;
  category: ScriptCategory;
  commands: ScriptCommand[];
};

type CutsceneData = {
  id: string;
  name: string;
  durationMs: number;
  type: "interactive" | "overlay";
  startCondition: CutsceneStartCondition;
  actors: CutsceneActorBinding[];
  actions: CutsceneActorAction[];
};
```

## 8. Editor modes

Каждая вкладка — отдельный editor mode:

```txt
LevelMode
PlayerMode
ObjectsMode
BackgroundMode
NpcMode
CutscenesMode
LogicMode
```

Mode отвечает за:

- наполнение left inspector;
- наполнение right inspector;
- реакцию на клики по canvas;
- доступные gizmos;
- список selectable entity types;
- save/undo context.

## 9. Время и управление

Когда editor открыт:

- в Live mode игра продолжает идти;
- в Paused/Stop game mode gameplay time остановлен;
- `Game speed` управляет scale времени runtime;
- mouse input над canvas принадлежит editor;
- keyboard input может управлять игроком в Live mode, когда фокус у game canvas;
- на закрытие editor zoom/pan editor camera сбрасываются в default gameplay camera state.

## 10. Grid, ruler, mouse coordinates

Grid/ruler/coords нужны во вкладках:

- Objects;
- Background;
- NPC;
- Cutscenes;
- Logic;
- опционально Player.

Grid имеет:

```txt
Grid visible: on/off
Snap enabled: on/off
Grid size: 1, 8, 16, 32
Mouse world coords: x/y
```

В исходном макете написано `Greed On`. В реализации лучше использовать `Grid On`.

## 11. Selection and transform

Общие правила:

- левый клик по entity выбирает ее;
- empty click очищает выбор;
- Shift + click добавляет entity к multi-select;
- selected entity подсвечивается;
- selected entity можно двигать;
- resize/rotate — для Objects, Background, NPC;
- snap применяется к move/resize, если включен;
- lock блокирует изменение entity;
- del удаляет entity после проверки ссылок;
- ctrl+c/ctrl+v копирует entity.

## 12. Save / Undo

Save/Undo должны быть context-local.

Примеры контекстов:

```txt
level.selected
level.sequence
player.common
object.selected
background.selected
npc.selected
cutscene.selected
logic.script
```

Save записывает canonical JSON.

Undo откатывает несохраненные изменения в текущем context к baseline последнего save/load.

Нужен dirty indicator.

## 13. Validation

Перед save/export нужно проверять:

- битые ссылки на scripts;
- битые ссылки на triggers;
- битые ссылки на levels;
- duplicate ids;
- пустые обязательные поля;
- object/NPC/cutscene action без target;
- cutscene duration меньше конца action;
- script command с неизвестным marker/object/actor;
- попытка удалить entity, на которую есть references.

## 14. Важное решение по Logic scripts

Скрипты выглядят в UI как список инструкций:

```txt
1. Walk to X=300
2. Wait 0.5 sec
3. Play emote "!"
4. Look at player
```

Но canonical storage — JSON commands:

```json
{
  "commands": [
    { "type": "moveTo", "x": 300, "y": 500, "speedPxSec": 120 },
    { "type": "wait", "durationMs": 500 },
    { "type": "playEmote", "emoteKey": "!" },
    { "type": "lookAt", "targetId": "player" }
  ]
}
```

Это нужно для validation, preview, rollback и вычисления длительности cutscene actions.

## 15. Главный deliverable

Фича считается готовой не когда “появились панели”, а когда:

- editor открывается по F2;
- UI соответствует макетам автора;
- можно создавать/редактировать/сохранять основные сущности;
- runtime использует сохраненные данные;
- references валидируются;
- cutscene preview работает с rollback;
- logic scripts можно запускать Play/Pause/Stop;
- save действительно пишет canonical JSON через выбранный механизм.
