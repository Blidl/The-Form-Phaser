# The Form вЂ” Mini Spec: Cutscene Vocabulary

**SUPERSEDED: This document is historical/reference only. The current source of truth is docs/canon/authoring/...**

Заменено документами:
- `docs/canon/authoring/the_form_director_cutscenes_ru.md`
- `docs/canon/authoring/the_form_overlay_replay_cutscenes_ru.md`
- `docs/canon/authoring/the_form_action_catalog_ru.md`
- `docs/canon/authoring/the_form_debug_validation_ru.md`


## РќР°Р·РЅР°С‡РµРЅРёРµ

Р—Р°РґР°С‚СЊ РјРёРЅРёРјР°Р»СЊРЅС‹Р№, РЅРѕ РґРѕСЃС‚Р°С‚РѕС‡РЅС‹Р№ РЅР°Р±РѕСЂ РєРѕРјР°РЅРґ РґР»СЏ demo cutscenes.

## РўРёРїС‹ РєР°С‚СЃС†РµРЅ

### 1. `in_level`

- Р¶РёРІС‹Рµ РѕР±СЉРµРєС‚С‹ СЃС†РµРЅС‹
- player input locked
- camera moves in current level

### 2. `overlay`

- РѕС‚РґРµР»СЊРЅС‹Р№ СЃР»РѕР№ РїРѕРІРµСЂС… РёРіСЂС‹
- РјРѕР¶РµС‚ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ РґР»СЏ РјРµР¶СѓСЂРѕРІРЅРµРІС‹С… РІСЃС‚Р°РІРѕРє

## РћР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РєРѕРјР°РЅРґС‹ РїРµСЂРІРѕР№ РІРµСЂСЃРёРё

- `lock_input`
- `unlock_input`
- `wait`
- `camera_focus_actor`
- `camera_pan_to`
- `play_animation`
- `move_actor`
- `set_emotion`
- `play_sfx`
- `spawn_vfx`
- `trigger_event`

## Р Р°Р·РґРµР»РµРЅРёРµ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё РєРѕРјР°РЅРґ

### Shared actor-local actions

- `play_animation`
- `move_actor`
- `set_emotion`

Р­С‚Рѕ РЅРµ orchestration-only vocabulary: cutscene runtime РјРѕР¶РµС‚ РІС‹Р·С‹РІР°С‚СЊ РёС…, РЅРѕ semantic owner РѕСЃС‚Р°РµС‚СЃСЏ Сѓ shared actor action layer.

### Orchestration-only commands

- `lock_input`
- `unlock_input`
- `wait`
- `camera_focus_actor`
- `camera_pan_to`
- `play_sfx`
- `spawn_vfx`
- `trigger_event`

Р­С‚Рё РєРѕРјР°РЅРґС‹ РїСЂРёРЅР°РґР»РµР¶Р°С‚ timeline/orchestration СЃР»РѕСЋ Рё РЅРµ РґРѕР»Р¶РЅС‹ СЃС‚Р°РЅРѕРІРёС‚СЊСЃСЏ РѕР±С‰РµР№ action-РјРѕРґРµР»СЊСЋ РґР»СЏ NPC.

## Р”РµС„РѕР»С‚РЅС‹Рµ РїСЂР°РІРёР»Р°

- РљР°С‚СЃС†РµРЅС‹ РїРµСЂРІРѕР№ РІРµСЂСЃРёРё РЅРµСЃРєРёРїР°РµРјС‹Рµ, РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЏРІРЅРѕ РЅРµ СЂРµС€РёС‚ РёРЅР°С‡Рµ РїРѕР·Р¶Рµ.
- Gameplay РІРѕ РІСЂРµРјСЏ `in_level` cutscene РїРѕР»РЅРѕСЃС‚СЊСЋ lock.
- РљРѕРјР°РЅРґС‹ РІС‹РїРѕР»РЅСЏСЋС‚СЃСЏ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕ.
- РќРёРєР°РєРѕРіРѕ branching timeline РІ РїРµСЂРІРѕР№ РІРµСЂСЃРёРё.
- Subtitle layer РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РїРѕР·Р¶Рµ, РЅРѕ runtime РґРѕР»Р¶РµРЅ РЅРµ РјРµС€Р°С‚СЊ РµРіРѕ Р±СѓРґСѓС‰РµРјСѓ РґРѕР±Р°РІР»РµРЅРёСЋ.
- `attach_start` Рё `attach_release` РЅРµ РІС…РѕРґСЏС‚ РІ first-pass vocabulary.
- cutscene runtime РЅРµ РІР»Р°РґРµРµС‚ physics/contact, РѕР±С‹С‡РЅС‹Рј NPC behavior loop РёР»Рё interaction gating.

## Acceptance Criteria

- Cutscene РјРѕР¶РЅРѕ Р·Р°РїСѓСЃС‚РёС‚СЊ РёР· trigger.
- Cutscene РјРѕР¶РЅРѕ Р·Р°РїСѓСЃС‚РёС‚СЊ РѕС‚ NPC interaction.
- РљР°РјРµСЂР°, animation Рё input lock СЂР°Р±РѕС‚Р°СЋС‚ РїСЂРµРґСЃРєР°Р·СѓРµРјРѕ.
- Sequence СЂРµРґР°РєС‚РёСЂСѓРµС‚СЃСЏ С‡РµСЂРµР· JSON Р±РµР· РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё Р»РµР·С‚СЊ РІ РєРѕРґ СѓСЂРѕРІРЅСЏ.

## Р РёСЃРєРё

- РџРѕРїС‹С‚РєР° СЃР»РёС€РєРѕРј СЂР°РЅРѕ СЃРґРµР»Р°С‚СЊ СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ timeline editor.
- РЎРјРµС€РµРЅРёРµ gameplay events Рё cutscene events Р±РµР· СЏРІРЅС‹С… РєРѕРЅС‚СЂР°РєС‚РѕРІ.
- Р–С‘СЃС‚РєРёРµ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РЅР° РєРѕРЅРєСЂРµС‚РЅС‹Рµ scene objects Р±РµР· СЃС‚Р°Р±РёР»СЊРЅС‹С… ids.
- РџСЂРµРІСЂР°С‰РµРЅРёРµ cutscene vocabulary РІ universal actor/AI command bus.

## Р§С‚Рѕ РїРѕС‚РѕРј РјРѕР¶РЅРѕ СѓС‚РѕС‡РЅРёС‚СЊ

- subtitle layer;
- overlay cinematic transitions;
- conditional branches;
- replay/recorded scene semantics.
