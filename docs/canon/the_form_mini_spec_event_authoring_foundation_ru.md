# The Form — Mini Spec: Event Authoring Foundation

## 1. Цель

Зафиксировать единую authoring foundation для:
- NPC behavior;
- triggers;
- cutscenes;
- conditions;
- event actions.

Это не новая архитектура игры, не universal scripting language, не node graph editor и не full visual scripting.

## 2. Основные понятия

### `TestEventCondition`
Небольшая проверка, возвращающая `true/false`.

### `TestEventAction`
Одна authorable команда, исполняемая runtime-слоями через явные адаптеры.

### `TestEventBlock`
Пара:
- список `conditions`;
- список `actions`.

Блок выполняется так: если все условия истинны, выполняются actions по порядку.

### `NPC Behavior Page`
Страница поведения NPC с `priority`, `conditions`, режимом и hooks-блоками.

### `Trigger Event Blocks`
Списки блоков для `onEnter/onExit/onStay` у trigger volume.

### `Cutscene Timeline Step`
Один шаг timeline в cutscene, который либо orchestration-only, либо проксирует shared event/action runtime.

## 3. Разделение ответственности

- `Actor Action Layer` остается owner actor-local actions:
  - `move_to` / `walk_to_x`
  - `stop`
  - `face`
  - `play_animation`
  - `set_emotion`
- `Event Action Layer` только маршрутизирует authorable commands и не владеет actor physics/behavior.
- `Cutscene Runtime` оркестрирует timeline, но не владеет NPC behavior.
- `Trigger Runtime` только оценивает conditions и исполняет action blocks.
- `NPC Runtime` выбирает behavior page и вызывает event blocks/hooks.

## 4. MVP Conditions

Разрешены только:
- `flag == boolean`
- `once`
- `player_form`

Отложены:
- inventory;
- dialogue tree state;
- quest system;
- arbitrary script expressions;
- nested boolean logic;
- blackboard AI.

## 5. MVP Event Actions

Разрешены:
- `actor_action`
- `start_cutscene`
- `set_flag`
- `trigger_event`
- `play_sfx`
- `spawn_vfx`

## 6. Trigger Evolution

Текущий формат:
- `enterCommand`
- `exitCommand`

Сохраняется как legacy-compatible.

Новый формат:
- `onEnter: TestEventBlock[]`
- `onExit: TestEventBlock[]`
- `onStay?: TestEventBlock[]`

Правило совместимости:
- если есть legacy-поля, они продолжают исполняться;
- если есть новые блоки, они исполняются через Event Action Layer;
- оба режима могут сосуществовать в переходный период.

## 7. NPC Behavior Pages

Добавляется слой поверх существующих profile/instance/hooks:
- `pages[]` с `priority`;
- `conditions`;
- `behaviorMode`;
- `initialActions`;
- `onPlayerNear`;
- `onPlayerFar`;
- `onInteract`;
- `onTriggerEvent`.

Это не behavior tree и не универсальная AI система.

## 8. Cutscene 2.0

Cutscene step может быть:
- `lock_input`
- `unlock_input`
- `wait`
- `camera_focus_actor`
- `camera_pan_to`
- `subtitle`
- `event_action`
- `actor_action` shortcut
- `set_flag` shortcut

Правило:
- cutscene runtime вызывает shared event/action runtime;
- логика действий не дублируется отдельным cutscene-only execution path.

## 9. Editor UX

Фиксируются reusable компоненты:
- `Condition List Editor`
- `Action List Editor`
- `Event Block Editor`

Они переиспользуются в:
- Trigger Volume inspector;
- NPC inspector;
- Cutscene editor;
- Sequence editor (где применимо).

## 10. Migration

- existing trigger commands продолжают работать;
- existing NPC scripted sequences продолжают работать;
- existing cutscenes продолжают работать;
- old Manpu trigger demo continues to work;
- new model coexists с legacy полями, legacy помечается как deprecated.

## 11. Acceptance

- Author может настраивать Manpu, старт cutscene, flags и NPC reactions из editor.
- Для common cases не нужен ручной JSON-edit.
- Не появляется новый giant controller.
- Нет broad rewrite текущего runtime/editor.

## Canon Guardrails

- Phaser остается целевым движком до завершения demo.
- Runtime editor остается существующим источником authoring и не ломается.
- `enterCommand/exitCommand`, scripted sequences, cutscene registry и actor action layer не удаляются.

## 12. Editor Authoring First Pass

����������� ������ ������� ������� editor authoring:
- Trigger Volume inspector ����������� Event Blocks (`onEnter` / `onExit` / `onStay`).
- Condition editor ������������ `flag`, `once`, `player_form`.
- Action editor ������������: `actor_action` (� ������� �� `set_emotion`, `trigger_event`), `start_cutscene`, `set_flag`, `trigger_event`.
- `play_sfx` � `spawn_vfx` ������������ ��� TEMPORARY stub actions.
- Legacy `enterCommand/exitCommand` UI �������� ��� legacy-compatible ����.
- �������������� actor actions (`walk_to_x`, `face`, `play_animation`, `wait`, `move_to`) ��������� �� ������������� � Event Blocks editor �� ���������� runtime ���������.

## 13. World Logic Rules Extension (2026-04-24)

- Added world-level listener layer `World Logic Rules` on top of Event Authoring Foundation.
- MVP world rule matchers:
  - `object_state_changed`
  - `trigger_event`
  - `npc_event`
  - `cutscene_finished`
- Rules reuse existing `TestEventCondition` and `TestEventAction`.
- `once` continues to use existing condition semantics with stable rule owner key.
