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
| Animation Profiles | in_progress | NPC-first backbone сохраняется; TEMPORARY узкий demo-feel first-pass для player forms (`ball/triangle/square`) разрешён через hooks `jump_start`, `land_impact`, `airborne`, `form_switch` + optional `ball_rebound_launch`, `triangle_flight_start`, `square_attach_start`, `square_attach_jump_start`; это не universal animation framework и не новый editor |
| NPC Manpu emotions from triggers | done | Реализовано узким runtime-slice: NPC presentation overlay + trigger volume command `targetType: "npc"`, `operation: "set_emotion"`; canonical IDs `sweat_drop/anger/sparkles`, hide через `calm`; `npm run build-nolog` passed |
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
- Date: 2026-04-21
- Task: Animation Profiles - Player Forms First-Pass Hooks (canon patch)
- Status: in_progress
- Notes: Зафиксирован TEMPORARY узкий demo-feel slice для player forms без отмены NPC-first presentation backbone. Vocabulary first-pass hooks: `jump_start`, `land_impact`, `airborne`, `form_switch`; optional form-specific: `ball_rebound_launch`, `triangle_flight_start`, `square_attach_start`, `square_attach_jump_start`.
- Next: Реализовать player-form hook emission/consumption в существующих player/view runtime slices и подключить live tuning без добавления нового editor/framework.

- Date: 2026-04-24
- Task: NPC Manpu Editor Authoring
- Status: done
- Notes: Закрыт editor authoring слой в 4 местах: NPC initial Manpu, Trigger Volume npc/set_emotion dropdown UX, Sequence set_emotion canonical dropdown, Cutscene direct set_emotion step (actor-local path).
- Next: Условные/контекстные rules для эмоций оставлены на отдельный future polish, без расширения текущей архитектуры.

- Date: 2026-04-24
- Task: Editor Authoring Workspace Split (canon patch)
- Status: done
- Notes: Added mini spec `the_form_mini_spec_editor_authoring_workspace_ru.md`. Canon split fixed: `F2` keeps level/object placement + lightweight inspector; new top-level `Logic` menu owns trigger/cutscene/NPC behavior/flags authoring with `Triggers` as first full tab.
- Next: Implementation stages — (1) add `Logic` menu shell with tabs (`Triggers/Cutscenes/NPC Behavior/Flags`), (2) move Trigger Event Blocks UI from F2 trigger inspector into `Logic > Triggers` while keeping deep-links/legacy visibility, (3) keep cutscene/NPC tabs placeholder until runtime readiness.

## Canon-derived Workspace Split Work Packages (2026-04-24)

| Task | Status | Notes |
| --- | --- | --- |
| Logic Menu Shell (`Logic` top-level + tabs) | todo | Add `Triggers/Cutscenes/NPC Behavior/Flags`; Cutscenes/NPC tabs may be disabled placeholders first |
| Trigger Logic Authoring in Logic Menu | todo | Move/reuse existing Event Blocks editor into `Logic > Triggers` without runtime rewrite |
| F2 Inspector Slimming + Deep Links | todo | Keep placement/basics/references only; add `Open Logic Editor` links |
| Legacy Compatibility Bridge | todo | Keep `enterCommand/exitCommand` visible/compatible during transition |
| Draft/localStorage Continuity | todo | Existing runtime editor draft flow must remain unchanged |
| Data Safety Verification | todo | No trigger/NPC/cutscene data loss after workspace split |

- Date: 2026-04-24
- Task: Logic Workspace First Pass (runtime editor UX)
- Status: done
- Notes: Added top-level `Logic` workspace with tabs (`Triggers/Cutscenes/NPC Behavior/Flags`). `Logic > Triggers` now hosts full Event Blocks authoring for trigger volumes; F2 trigger inspector reduced to geometry/legacy + Event Blocks summary with `Open in Logic` deep-link.
- Next: choose next implementation package: (1) widen actor_action runtime support, (2) Cutscene 2.0 shared event-action integration, (3) NPC Behavior Pages runtime/editor.

- Date: 2026-04-24
- Task: World Logic Rules / Event Listeners layer
- Status: done
- Notes: Added world-level `Logic > Rules` tab and runtime listener execution path with matcher kinds `object_state_changed`, `trigger_event`, `npc_event`, `cutscene_finished`. `Logic > Triggers` kept separate and unchanged for spatial trigger authoring.
- Next: widen object-state emitters and actor_action coverage as follow-up.

- Date: 2026-04-24
- Task: F2 cleanup pass (placement/basic only, logic in Logic workspace)
- Status: done
- Notes: Trigger inspector in F2 now shows geometry/basic refs + compact logic summary (`enter/exit present|none`, block counts) and `Open in Logic`; nested trigger logic authoring removed from F2 surface. NPC inspector in F2 reduced to placement/profile/basic summary + `Open in Logic / NPC Behavior` placeholder. Rules list label improved to compact `WHEN ... -> DO ...` summary; sections in rule card use `WHEN / IF / DO` headings.
- Next: run manual smoke for scroll preservation in F2 + Logic (Triggers/Rules) and verify legacy/event/rules data is preserved after F2 geometry edits.
