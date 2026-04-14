# The Form вЂ” Orchestrator Work Queue

## РќР°Р·РЅР°С‡РµРЅРёРµ
Р­С‚Рѕ СЂР°Р±РѕС‡Р°СЏ РѕС‡РµСЂРµРґСЊ РѕСЂРєРµСЃС‚СЂР°С‚РѕСЂР°.

Р—РґРµСЃСЊ С„РёРєСЃРёСЂСѓРµС‚СЃСЏ:
- РєР°РєРёРµ СЌРїРёРєРё Рё Р·Р°РґР°С‡Рё СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅС‹;
- С‡С‚Рѕ СЃРµР№С‡Р°СЃ Р°РєС‚РёРІРЅРѕ;
- С‡С‚Рѕ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ;
- С‡С‚Рѕ РјРѕР¶РЅРѕ Р·Р°РїСѓСЃРєР°С‚СЊ СЃР»РµРґСѓСЋС‰РёРј РІРЅРµС€РЅРёРј С‡Р°С‚РѕРј.

РЎС‚Р°С‚СѓСЃС‹:
- `todo`
- `in_progress`
- `blocked`
- `done`

---

## Epic 1 вЂ” Core Stability

| Task | Status | Notes |
| --- | --- | --- |
| Never Embed Contract | blocked | РЎС‚Р°СЂС‹Р№ post-tick/depenetration РїСѓС‚СЊ РѕС‚РІРµСЂРіРЅСѓС‚ РєР°Рє РЅРµРІРµСЂРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°; С‚РµРєСѓС‰РёР№ РєСѓСЂСЃ: valid attach pose or detach, Р±РµР· РєРѕРѕСЂРґРёРЅР°С‚РЅС‹С… РєРѕСЂСЂРµРєС†РёР№ РїРѕСЃР»Рµ С‚РёРєР° |
| Square Attach/Carry Invalid World Pose Resolution | in_progress | РћСЃС‚Р°РІР»РµРЅС‹ snapped-pose validation Рё immediate break attach; `lastValidSquarePose` Рё directed escape СѓРґР°Р»РµРЅС‹ РєР°Рє symptom-driven РІРµС‚РєР° |
| Square Attach Face Snap Regression on Moving Supports | in_progress | РЈР±СЂР°РЅС‹ corner-allowance hack Рё post-tick escape-СЃР»РѕР№; РЅСѓР¶РµРЅ СЂСѓС‡РЅРѕР№ retest normal face-snap РЅР° moving supports |
| Square Attach Commit Path Collision | in_progress | РќРѕРІР°СЏ СЂР°Р±РѕС‡Р°СЏ РіРёРїРѕС‚РµР·Р°: РїСЂРѕР±Р»РµРјР° РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµ РІ С„РёРЅР°Р»СЊРЅРѕР№ attach-pose, Р° РІ С‚РѕРј, С‡С‚Рѕ commit/snap РІ attach РёР»Рё РІРѕР·РІСЂР°С‚ attach-jump РЅРµ РїСЂРѕРІРµСЂСЏРµС‚ РїРµСЂРµСЃРµС‡РµРЅРёРµ РїСѓС‚Рё СЃ wall/floor/ceiling |
| Square Rollover by Input | todo | Input intent РґРѕР»Р¶РµРЅ РїРѕР±РµР¶РґР°С‚СЊ |
| Square Trail Continuity | todo | РЈР±СЂР°С‚СЊ РјРёРєСЂРѕРґС‹СЂС‹ Рё РїР»РѕС…РѕР№ reconnect |
| Triangle Break Wall Stability | todo | РЈСЃС‚СЂР°РЅРёС‚СЊ РЅРµСЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ break |
| Ball Distance Coyote + Wall Impulse | todo | Distance-led coyote Рё С‡РµСЃС‚РЅС‹Р№ wall hit |
| Marker / Point of Force Alignment | todo | РњР°СЂРєРµСЂ РґРѕР»Р¶РµРЅ СЃРѕРѕС‚РІРµС‚СЃС‚РІРѕРІР°С‚СЊ input |
| Trigger Build Parity | todo | Dev/prod РґРѕР»Р¶РЅС‹ СЃРѕРІРїР°РґР°С‚СЊ |

## Epic 2 вЂ” Demo Data Backbone

| Task | Status | Notes |
| --- | --- | --- |
| Campaign + Level Metadata | done | `campaign.json`, level json files, `finish`, `nextLevelId`, level-bound draft storage |
| Data Validator | done | Narrow demo-safe validation for level ids, `nextLevelId`, `finish`, `worldBounds` |
| Runtime Editor Level Authoring | done | Sidebar level controls, per-level scene restart, `worldBounds`, `finish`, `nextLevelId` |
| Runtime Editor Usability Contract | done | DOM input focus guard, scene placement mode, world bounds overlay/readability |
| Runtime Editor Authoring Contract Finalization | done | Placement/list semantics, create level, single-editor cleanup, shared topology refresh |

## Epic 3 вЂ” Demo Flow

| Task | Status | Notes |
| --- | --- | --- |
| Main Menu + Pause + End Screen | done | Scene-first `Boot -> MainMenu -> TestScene`, pause overlay РїРѕ `Esc`, `finish -> nextLevelId/end screen`, direct `levelId` boot override СЃРѕС…СЂР°РЅС‘РЅ РґР»СЏ dev |

## Epic 4 вЂ” NPC Foundation

| Task | Status | Notes |
| --- | --- | --- |
| NPC Runtime Foundation | todo | passive + enemy archetypes + narrow npcInstance contract |
| NPC Interaction + Reactions | todo | interaction nearby + reactions; не universal AI layer |
| Actor Action Layer Foundation | todo | shared actor-local actions отдельно от cutscene orchestration |

## Epic 5 вЂ” Cutscene System

| Task | Status | Notes |
| --- | --- | --- |
| Cutscene Runtime Foundation | todo | JSON runtime, РЅРµ editor; orchestration-only commands |
| NPC-triggered Cutscenes | todo | NPC interaction -> cutscene без переноса NPC логики в cutscene runtime |

## Epic 6 вЂ” Presentation Backbone

| Task | Status | Notes |
| --- | --- | --- |
| Animation Profiles | todo | РќР°С‡Р°С‚СЊ СЃ NPC |
| Lighting Profiles + Debug Tuning | todo | Atmosphere-first |
| Parallax Profiles | todo | Background profiles |
| VFX Profiles | todo | Square attach + triangle break |

## Epic 7 вЂ” Audio

| Task | Status | Notes |
| --- | --- | --- |
| Audio Manifest + Level Music | todo | Event-driven audio |
| Audio Debug Preview | todo | Dev-only panel |

## Epic 8 вЂ” Integration

| Task | Status | Notes |
| --- | --- | --- |
| First Vertical Slice Level | todo | РџСЂРѕРІРµСЂРєР° РІСЃРµР№ С†РµРїРѕС‡РєРё |
| Web Build Readiness | todo | Demo-safe web path |

---

## Р РµРєРѕРјРµРЅРґСѓРµРјС‹Р№ РїРѕСЂСЏРґРѕРє Р·Р°РїСѓСЃРєР° РІРЅРµС€РЅРёС… С‡Р°С‚РѕРІ
1. Never Embed Contract
2. Square Rollover by Input
3. Square Trail Continuity
4. Triangle Break Wall Stability
5. Ball Distance Coyote + Wall Impulse
6. Marker / Point of Force Alignment
7. Trigger Build Parity
8. Campaign + Level Metadata
9. Data Validator
10. Main Menu + Pause + End Screen
11. NPC Runtime Foundation
12. NPC Interaction + Reactions
13. Actor Action Layer Foundation
14. Cutscene Runtime Foundation
15. NPC-triggered Cutscenes
16. Animation Profiles
17. Lighting Profiles + Debug Tuning
18. Parallax Profiles
19. VFX Profiles
20. Audio Manifest + Level Music
21. Audio Debug Preview
22. First Vertical Slice Level
23. Web Build Readiness

---

## РџСЂР°РІРёР»Рѕ РѕР±РЅРѕРІР»РµРЅРёСЏ
РџРѕСЃР»Рµ РєР°Р¶РґРѕРіРѕ РІРЅРµС€РЅРµРіРѕ С‡Р°С‚Р°:
1. РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ Р·Р°РґР°С‡Рё;
2. РєРѕСЂРѕС‚РєРѕ РІРїРёСЃР°С‚СЊ РёС‚РѕРі РІ Р»РѕРі;
3. РµСЃР»Рё РёР·РјРµРЅРёР»СЃСЏ РєР°РЅРѕРЅ вЂ” РѕР±РЅРѕРІРёС‚СЊ `the_form_orchestrator_state_ru.md`.

## Latest Queue Update
- Date: 2026-04-12
- Task: Dev Helper Overlay + Level Jump + Click-Spawn
- Status: done
- Notes: Dev-only Numpad + overlay ? TestScene, prev/next level jump ?? campaign order ????? existing levelId scene-flow, click-spawn ????????? respawn point ? ?? ??????????? ? runtime editor.
- Next: ????? ??????? smoke ?? helper ???????????? ? NPC/cutscene/presentation ???????.

