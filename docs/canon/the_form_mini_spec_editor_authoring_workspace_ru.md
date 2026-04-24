# The Form — Mini Spec: Editor Authoring Workspace

## 1. Проблема

`F2` / object inspector не должен становиться местом, где авторится вся логика игры.
Authoring для trigger/event/cutscene/NPC behavior должен иметь отдельное рабочее пространство.

## 2. Разделение режимов

### F2 / Level Editor отвечает за

- placement объектов уровня;
- placement NPC instances;
- геометрию trigger volumes;
- placement платформ и world objects;
- базовые object properties;
- ссылки на уже authored logic;
- переход в logic authoring через кнопки вида `Open Logic Editor for this object`.

### Logic / Director Editor отвечает за

- Trigger logic:
  - `onEnter` / `onExit` / `onStay` Event Blocks;
  - conditions;
  - actions.
- Cutscene authoring:
  - список катсцен;
  - timeline/steps;
  - actor actions;
  - subtitles/camera/flags — позже.
- NPC behavior authoring:
  - behavior pages;
  - `onInteract` / `onPlayerNear` / `onPlayerFar`;
  - initial actions.
- World flags/debug.
- Reusable editors для actions/conditions/event blocks.

## 3. Ownership и ограничения

- Logic editor редактирует только data.
- Runtime execution остаётся в текущих runtime slices:
  - Event Action Runtime;
  - Trigger Runtime;
  - NPC Runtime;
  - Cutscene Runtime;
  - Actor Action Layer.
- Не вводится giant editor controller.
- Не вводится node graph editor.
- Не вводится arbitrary scripting.
- Не делается Unity migration.

## 4. UX принцип

- `F2` отвечает на вопрос: `где находится объект?`.
- Logic editor отвечает на вопрос: `что происходит?`.
- Object inspector может показывать summary логики и deep-link в Logic editor, но не должен содержать полный nested authoring logic stack.

## 5. Migration

- Текущий F2 inspector остаётся рабочим.
- Existing Event Blocks UI можно переносить из trigger inspector в Logic menu.
- Legacy trigger commands (`enterCommand`/`exitCommand`) остаются видимыми и совместимыми в переходный период.
- Existing runtime editor draft/localStorage flow продолжает работать.

## 6. Initial menu proposal

Допустимые названия верхнего меню: `Logic` / `Director` / `Events`.

Предпочтительный first pass:
- top-level editor tab/menu: `Logic`;
- tabs внутри:
  - `Triggers`
  - `Cutscenes`
  - `NPC Behavior`
  - `Flags`

Ограничение first implementation:
- только вкладка `Triggers` требует полного first-pass implementation;
- `Cutscenes` и `NPC Behavior` могут быть placeholder/disabled до готовности их runtime-срезов.

## 7. Acceptance

- Designer может настраивать trigger Event Blocks из Logic menu.
- `F2` остаётся легче и сфокусирован на level objects.
- Нет rewrite существующих runtime systems.
- Нет потери текущих trigger/NPC/cutscene data.

## Canon guardrails

- Спек расширяет Event Authoring Foundation и не меняет ownership, зафиксированный в:
  - `the_form_mini_spec_event_authoring_foundation_ru.md`
  - `the_form_mini_spec_actor_action_layer_ru.md`
  - `the_form_mini_spec_cutscene_vocabulary_ru.md`
- Это workspace split в editor UX/data-authoring, а не новая gameplay architecture.

## Implementation Note - First Pass Runtime Editor Integration (2026-04-24)
- Implemented top-level `Logic` workspace in runtime editor sidebar.
- Added Logic inner tabs:
  - `Triggers` (implemented)
  - `Cutscenes` (placeholder)
  - `NPC Behavior` (placeholder)
  - `Flags` (debug snapshot / pending editor)
- `Logic > Triggers` now owns full trigger Event Blocks authoring via existing reusable helper `buildTriggerEventEditorSections(...)`.
- `F2 / Inspector` for trigger volumes is slimmed to placement/geometry/legacy commands + Event Blocks summary + `Open in Logic` deep-link.
- Unsupported actor actions stay hidden in Event Blocks editor (`walk_to_x`, `face`, `play_animation`, `stop`, `wait`, `move_to`).
- Legacy `enterCommand/exitCommand` compatibility remains intact.
- Existing draft/localStorage flow remains unchanged (same mutation + save paths).

## Implementation Note - World Logic Rules Layer (2026-04-24)
- Added `Logic > Rules` as separate tab next to `Logic > Triggers`.
- Rules are world-level event listeners and do not replace trigger volume spatial authoring.
- Trigger volumes remain in `Logic > Triggers`; world listener authoring lives in `Logic > Rules`.

## Implementation Note - F2 Cleanup Pass (2026-04-24)
- F2 Trigger Volume inspector further slimmed to placement/basic editing + compact logic summary.
- F2 no longer exposes full legacy command authoring controls (`enter/exit target/operation/value`) to avoid duplicate logic authoring surface.
- F2 keeps compact logic summary only:
  - `Legacy enterCommand`: present/none;
  - `Legacy exitCommand`: present/none;
  - `onEnter/onExit/onStay` blocks count;
  - deep-link action `Open in Logic`.
- `Logic > Triggers` remains the full source for Event Blocks/Conditions/Actions authoring.
- F2 NPC inspector slimmed to placement/basic reference + compact summary and deep-link to `Logic > NPC Behavior` placeholder.
- Hidden fields are not deleted from config; cleanup is UI-level only.
- Sidebar field-edit rerender keeps scroll position more reliably by restoring scroll after focus restoration.
