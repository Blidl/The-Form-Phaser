# The Form вЂ” Mini Spec: Event Authoring Foundation

**SUPERSEDED: This document is historical/reference only. The current source of truth is docs/canon/authoring/...**

Заменено документами:
- `docs/canon/authoring/the_form_action_catalog_ru.md`
- `docs/canon/authoring/the_form_event_system_ru.md`
- `docs/canon/authoring/the_form_debug_validation_ru.md`
- `docs/canon/authoring/the_form_storage_migration_ru.md`


## 1. Р¦РµР»СЊ

Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ РµРґРёРЅСѓСЋ authoring foundation РґР»СЏ:
- NPC behavior;
- triggers;
- cutscenes;
- conditions;
- event actions.

Р­С‚Рѕ РЅРµ РЅРѕРІР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР° РёРіСЂС‹, РЅРµ universal scripting language, РЅРµ node graph editor Рё РЅРµ full visual scripting.

## 2. РћСЃРЅРѕРІРЅС‹Рµ РїРѕРЅСЏС‚РёСЏ

### `TestEventCondition`
РќРµР±РѕР»СЊС€Р°СЏ РїСЂРѕРІРµСЂРєР°, РІРѕР·РІСЂР°С‰Р°СЋС‰Р°СЏ `true/false`.

### `TestEventAction`
РћРґРЅР° authorable РєРѕРјР°РЅРґР°, РёСЃРїРѕР»РЅСЏРµРјР°СЏ runtime-СЃР»РѕСЏРјРё С‡РµСЂРµР· СЏРІРЅС‹Рµ Р°РґР°РїС‚РµСЂС‹.

### `TestEventBlock`
РџР°СЂР°:
- СЃРїРёСЃРѕРє `conditions`;
- СЃРїРёСЃРѕРє `actions`.

Р‘Р»РѕРє РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ С‚Р°Рє: РµСЃР»Рё РІСЃРµ СѓСЃР»РѕРІРёСЏ РёСЃС‚РёРЅРЅС‹, РІС‹РїРѕР»РЅСЏСЋС‚СЃСЏ actions РїРѕ РїРѕСЂСЏРґРєСѓ.

### `NPC Behavior Page`
РЎС‚СЂР°РЅРёС†Р° РїРѕРІРµРґРµРЅРёСЏ NPC СЃ `priority`, `conditions`, СЂРµР¶РёРјРѕРј Рё hooks-Р±Р»РѕРєР°РјРё.

### `Trigger Event Blocks`
РЎРїРёСЃРєРё Р±Р»РѕРєРѕРІ РґР»СЏ `onEnter/onExit/onStay` Сѓ trigger volume.

### `Cutscene Timeline Step`
РћРґРёРЅ С€Р°Рі timeline РІ cutscene, РєРѕС‚РѕСЂС‹Р№ Р»РёР±Рѕ orchestration-only, Р»РёР±Рѕ РїСЂРѕРєСЃРёСЂСѓРµС‚ shared event/action runtime.

## 3. Р Р°Р·РґРµР»РµРЅРёРµ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё

- `Actor Action Layer` РѕСЃС‚Р°РµС‚СЃСЏ owner actor-local actions:
  - `move_to` / `walk_to_x`
  - `stop`
  - `face`
  - `play_animation`
  - `set_emotion`
- `Event Action Layer` С‚РѕР»СЊРєРѕ РјР°СЂС€СЂСѓС‚РёР·РёСЂСѓРµС‚ authorable commands Рё РЅРµ РІР»Р°РґРµРµС‚ actor physics/behavior.
- `Cutscene Runtime` РѕСЂРєРµСЃС‚СЂРёСЂСѓРµС‚ timeline, РЅРѕ РЅРµ РІР»Р°РґРµРµС‚ NPC behavior.
- `Trigger Runtime` С‚РѕР»СЊРєРѕ РѕС†РµРЅРёРІР°РµС‚ conditions Рё РёСЃРїРѕР»РЅСЏРµС‚ action blocks.
- `NPC Runtime` РІС‹Р±РёСЂР°РµС‚ behavior page Рё РІС‹Р·С‹РІР°РµС‚ event blocks/hooks.

## 4. MVP Conditions

Р Р°Р·СЂРµС€РµРЅС‹ С‚РѕР»СЊРєРѕ:
- `flag == boolean`
- `once`
- `player_form`

РћС‚Р»РѕР¶РµРЅС‹:
- inventory;
- dialogue tree state;
- quest system;
- arbitrary script expressions;
- nested boolean logic;
- blackboard AI.

## 5. MVP Event Actions

Р Р°Р·СЂРµС€РµРЅС‹:
- `actor_action`
- `start_cutscene`
- `set_flag`
- `trigger_event`
- `play_sfx`
- `spawn_vfx`

## 6. Trigger Evolution

РўРµРєСѓС‰РёР№ С„РѕСЂРјР°С‚:
- `enterCommand`
- `exitCommand`

РЎРѕС…СЂР°РЅСЏРµС‚СЃСЏ РєР°Рє legacy-compatible.

РќРѕРІС‹Р№ С„РѕСЂРјР°С‚:
- `onEnter: TestEventBlock[]`
- `onExit: TestEventBlock[]`
- `onStay?: TestEventBlock[]`

РџСЂР°РІРёР»Рѕ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё:
- РµСЃР»Рё РµСЃС‚СЊ legacy-РїРѕР»СЏ, РѕРЅРё РїСЂРѕРґРѕР»Р¶Р°СЋС‚ РёСЃРїРѕР»РЅСЏС‚СЊСЃСЏ;
- РµСЃР»Рё РµСЃС‚СЊ РЅРѕРІС‹Рµ Р±Р»РѕРєРё, РѕРЅРё РёСЃРїРѕР»РЅСЏСЋС‚СЃСЏ С‡РµСЂРµР· Event Action Layer;
- РѕР±Р° СЂРµР¶РёРјР° РјРѕРіСѓС‚ СЃРѕСЃСѓС‰РµСЃС‚РІРѕРІР°С‚СЊ РІ РїРµСЂРµС…РѕРґРЅС‹Р№ РїРµСЂРёРѕРґ.

## 7. NPC Behavior Pages

Р”РѕР±Р°РІР»СЏРµС‚СЃСЏ СЃР»РѕР№ РїРѕРІРµСЂС… СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… profile/instance/hooks:
- `pages[]` СЃ `priority`;
- `conditions`;
- `behaviorMode`;
- `initialActions`;
- `onPlayerNear`;
- `onPlayerFar`;
- `onInteract`;
- `onTriggerEvent`.

Р­С‚Рѕ РЅРµ behavior tree Рё РЅРµ СѓРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ AI СЃРёСЃС‚РµРјР°.

## 8. Cutscene 2.0

Cutscene step РјРѕР¶РµС‚ Р±С‹С‚СЊ:
- `lock_input`
- `unlock_input`
- `wait`
- `camera_focus_actor`
- `camera_pan_to`
- `subtitle`
- `event_action`
- `actor_action` shortcut
- `set_flag` shortcut

РџСЂР°РІРёР»Рѕ:
- cutscene runtime РІС‹Р·С‹РІР°РµС‚ shared event/action runtime;
- Р»РѕРіРёРєР° РґРµР№СЃС‚РІРёР№ РЅРµ РґСѓР±Р»РёСЂСѓРµС‚СЃСЏ РѕС‚РґРµР»СЊРЅС‹Рј cutscene-only execution path.

## 9. Editor UX

Р¤РёРєСЃРёСЂСѓСЋС‚СЃСЏ reusable РєРѕРјРїРѕРЅРµРЅС‚С‹:
- `Condition List Editor`
- `Action List Editor`
- `Event Block Editor`

РћРЅРё РїРµСЂРµРёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РІ:
- Trigger Volume inspector;
- NPC inspector;
- Cutscene editor;
- Sequence editor (РіРґРµ РїСЂРёРјРµРЅРёРјРѕ).

## 10. Migration

- existing trigger commands РїСЂРѕРґРѕР»Р¶Р°СЋС‚ СЂР°Р±РѕС‚Р°С‚СЊ;
- existing NPC scripted sequences РїСЂРѕРґРѕР»Р¶Р°СЋС‚ СЂР°Р±РѕС‚Р°С‚СЊ;
- existing cutscenes РїСЂРѕРґРѕР»Р¶Р°СЋС‚ СЂР°Р±РѕС‚Р°С‚СЊ;
- old Manpu trigger demo continues to work;
- new model coexists СЃ legacy РїРѕР»СЏРјРё, legacy РїРѕРјРµС‡Р°РµС‚СЃСЏ РєР°Рє deprecated.

## 11. Acceptance

- Author РјРѕР¶РµС‚ РЅР°СЃС‚СЂР°РёРІР°С‚СЊ Manpu, СЃС‚Р°СЂС‚ cutscene, flags Рё NPC reactions РёР· editor.
- Р”Р»СЏ common cases РЅРµ РЅСѓР¶РµРЅ СЂСѓС‡РЅРѕР№ JSON-edit.
- РќРµ РїРѕСЏРІР»СЏРµС‚СЃСЏ РЅРѕРІС‹Р№ giant controller.
- РќРµС‚ broad rewrite С‚РµРєСѓС‰РµРіРѕ runtime/editor.

## Canon Guardrails

- Phaser РѕСЃС‚Р°РµС‚СЃСЏ С†РµР»РµРІС‹Рј РґРІРёР¶РєРѕРј РґРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ demo.
- Runtime editor РѕСЃС‚Р°РµС‚СЃСЏ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРј РёСЃС‚РѕС‡РЅРёРєРѕРј authoring Рё РЅРµ Р»РѕРјР°РµС‚СЃСЏ.
- `enterCommand/exitCommand`, scripted sequences, cutscene registry Рё actor action layer РЅРµ СѓРґР°Р»СЏСЋС‚СЃСЏ.

## 12. Editor Authoring First Pass

Фактический статус первого прохода editor authoring:
- Trigger Volume inspector редактирует Event Blocks (`onEnter` / `onExit` / `onStay`).
- Condition editor поддерживает `flag`, `once`, `player_form`.
- Action editor поддерживает: `actor_action` (с фокусом на `set_emotion`, `trigger_event`), `start_cutscene`, `set_flag`, `trigger_event`.
- `play_sfx` и `spawn_vfx` отображаются как TEMPORARY stub actions.
- Legacy `enterCommand/exitCommand` UI сохранён как legacy-compatible путь.
- Неподдержанные actor actions (`walk_to_x`, `face`, `play_animation`, `wait`, `move_to`) намеренно не экспонируются в Event Blocks editor до расширения runtime поддержки.

## 13. World Logic Rules Extension (2026-04-24)

- Added world-level listener layer `World Logic Rules` on top of Event Authoring Foundation.
- MVP world rule matchers:
  - `object_state_changed`
  - `trigger_event`
  - `npc_event`
  - `cutscene_finished`
- Rules reuse existing `TestEventCondition` and `TestEventAction`.
- `once` continues to use existing condition semantics with stable rule owner key.
