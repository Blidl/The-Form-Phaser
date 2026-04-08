# The Form — Orchestrator Work Queue

## Назначение
Это рабочая очередь оркестратора.

Здесь фиксируется:
- какие эпики и задачи уже завершены;
- что сейчас активно;
- что заблокировано;
- что можно запускать следующим внешним чатом.

Статусы:
- `todo`
- `in_progress`
- `blocked`
- `done`

---

## Epic 1 — Core Stability

| Task | Status | Notes |
| --- | --- | --- |
| Never Embed Contract | blocked | Старый post-tick/depenetration путь отвергнут как неверная архитектура; текущий курс: valid attach pose or detach, без координатных коррекций после тика |
| Square Attach/Carry Invalid World Pose Resolution | in_progress | Оставлены snapped-pose validation и immediate break attach; `lastValidSquarePose` и directed escape удалены как symptom-driven ветка |
| Square Attach Face Snap Regression on Moving Supports | in_progress | Убраны corner-allowance hack и post-tick escape-слой; нужен ручной retest normal face-snap на moving supports |
| Square Attach Commit Path Collision | in_progress | Новая рабочая гипотеза: проблема может быть не в финальной attach-pose, а в том, что commit/snap в attach или возврат attach-jump не проверяет пересечение пути с wall/floor/ceiling |
| Square Rollover by Input | todo | Input intent должен побеждать |
| Square Trail Continuity | todo | Убрать микродыры и плохой reconnect |
| Triangle Break Wall Stability | todo | Устранить нестабильность break |
| Ball Distance Coyote + Wall Impulse | todo | Distance-led coyote и честный wall hit |
| Marker / Point of Force Alignment | todo | Маркер должен соответствовать input |
| Trigger Build Parity | todo | Dev/prod должны совпадать |

## Epic 2 — Demo Data Backbone

| Task | Status | Notes |
| --- | --- | --- |
| Campaign + Level Metadata | todo | `finish`, `nextLevelId`, `campaign.json` |
| Data Validator | todo | Cross references и profile ids |

## Epic 3 — Demo Flow

| Task | Status | Notes |
| --- | --- | --- |
| Main Menu + Pause + End Screen | todo | Связать с campaign progression |

## Epic 4 — NPC Foundation

| Task | Status | Notes |
| --- | --- | --- |
| NPC Runtime Foundation | todo | passive + enemy archetypes |
| NPC Interaction + Reactions | todo | interaction nearby + reactions + cutscene hook |

## Epic 5 — Cutscene System

| Task | Status | Notes |
| --- | --- | --- |
| Cutscene Runtime Foundation | todo | JSON runtime, не editor |
| NPC-triggered Cutscenes | todo | NPC interaction -> cutscene |

## Epic 6 — Presentation Backbone

| Task | Status | Notes |
| --- | --- | --- |
| Animation Profiles | todo | Начать с NPC |
| Lighting Profiles + Debug Tuning | todo | Atmosphere-first |
| Parallax Profiles | todo | Background profiles |
| VFX Profiles | todo | Square attach + triangle break |

## Epic 7 — Audio

| Task | Status | Notes |
| --- | --- | --- |
| Audio Manifest + Level Music | todo | Event-driven audio |
| Audio Debug Preview | todo | Dev-only panel |

## Epic 8 — Integration

| Task | Status | Notes |
| --- | --- | --- |
| First Vertical Slice Level | todo | Проверка всей цепочки |
| Web Build Readiness | todo | Demo-safe web path |

---

## Рекомендуемый порядок запуска внешних чатов
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
13. Cutscene Runtime Foundation
14. NPC-triggered Cutscenes
15. Animation Profiles
16. Lighting Profiles + Debug Tuning
17. Parallax Profiles
18. VFX Profiles
19. Audio Manifest + Level Music
20. Audio Debug Preview
21. First Vertical Slice Level
22. Web Build Readiness

---

## Правило обновления
После каждого внешнего чата:
1. обновить статус задачи;
2. коротко вписать итог в лог;
3. если изменился канон — обновить `the_form_orchestrator_state_ru.md`.
