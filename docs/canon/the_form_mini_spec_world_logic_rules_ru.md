# The Form - Mini Spec: World Logic Rules

## 1. Цель

`World Logic Rules` добавляют world-level listener слой поверх Event Authoring Foundation.
Это слой для реакций на world/runtime события, не привязанных к trigger volume геометрии.

## 2. Роль в архитектуре

- Rules не заменяют `trigger volumes`.
- `Trigger volumes` остаются для spatial событий (`onEnter/onExit/onStay`).
- Rules используют уже существующие:
  - `TestEventCondition`
  - `TestEventAction`
- Исполнение Rules идет через существующий Event Action Runtime.
- Rules не управляют напрямую NPC/cutscene/rendering вне action runtime API.

## 3. Scope MVP

Нужные use-case группы:
- object state changed;
- breakable object destroyed/broken;
- npc event;
- cutscene finished;
- generic trigger_event.

MVP matcher vocabulary:
- `object_state_changed`
- `trigger_event`
- `npc_event`
- `cutscene_finished`

## 4. Правила guardrails

- No node graph.
- No arbitrary script.
- No giant controller/director.
- `once` поведение должно использовать существующий `once` condition.
- Invalid/unknown rules не должны падать runtime.

## 5. Authoring contract

Rules authorятся в `Logic > Rules`.

Tabs в Logic workspace:
1. `Triggers`
2. `Rules`
3. `Cutscenes`
4. `NPC Behavior`
5. `Flags`

`Logic > Triggers` сохраняется отдельным tab и не удаляется.
