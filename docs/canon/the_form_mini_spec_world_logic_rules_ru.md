# The Form - Mini Spec: World Logic Rules

**SUPERSEDED: This document is historical/reference only. The current source of truth is docs/canon/authoring/...**

Заменено документами:
- `docs/canon/authoring/the_form_event_system_ru.md`
- `docs/canon/authoring/the_form_action_catalog_ru.md`
- `docs/canon/authoring/the_form_npc_behavior_authoring_ru.md`
- `docs/canon/authoring/the_form_debug_validation_ru.md`


## 1. Р¦РµР»СЊ

`World Logic Rules` РґРѕР±Р°РІР»СЏСЋС‚ world-level listener СЃР»РѕР№ РїРѕРІРµСЂС… Event Authoring Foundation.
Р­С‚Рѕ СЃР»РѕР№ РґР»СЏ СЂРµР°РєС†РёР№ РЅР° world/runtime СЃРѕР±С‹С‚РёСЏ, РЅРµ РїСЂРёРІСЏР·Р°РЅРЅС‹С… Рє trigger volume РіРµРѕРјРµС‚СЂРёРё.

## 2. Р РѕР»СЊ РІ Р°СЂС…РёС‚РµРєС‚СѓСЂРµ

- Rules РЅРµ Р·Р°РјРµРЅСЏСЋС‚ `trigger volumes`.
- `Trigger volumes` РѕСЃС‚Р°СЋС‚СЃСЏ РґР»СЏ spatial СЃРѕР±С‹С‚РёР№ (`onEnter/onExit/onStay`).
- Rules РёСЃРїРѕР»СЊР·СѓСЋС‚ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ:
  - `TestEventCondition`
  - `TestEventAction`
- РСЃРїРѕР»РЅРµРЅРёРµ Rules РёРґРµС‚ С‡РµСЂРµР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ Event Action Runtime.
- Rules РЅРµ СѓРїСЂР°РІР»СЏСЋС‚ РЅР°РїСЂСЏРјСѓСЋ NPC/cutscene/rendering РІРЅРµ action runtime API.

## 3. Scope MVP

РќСѓР¶РЅС‹Рµ use-case РіСЂСѓРїРїС‹:
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

## 4. РџСЂР°РІРёР»Р° guardrails

- No node graph.
- No arbitrary script.
- No giant controller/director.
- `once` РїРѕРІРµРґРµРЅРёРµ РґРѕР»Р¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `once` condition.
- Invalid/unknown rules РЅРµ РґРѕР»Р¶РЅС‹ РїР°РґР°С‚СЊ runtime.

## 5. Authoring contract

Rules authorСЏС‚СЃСЏ РІ `Logic > Rules`.

Tabs РІ Logic workspace:
1. `Triggers`
2. `Rules`
3. `Cutscenes`
4. `NPC Behavior`
5. `Flags`

`Logic > Triggers` СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РѕС‚РґРµР»СЊРЅС‹Рј tab Рё РЅРµ СѓРґР°Р»СЏРµС‚СЃСЏ.
