# The Form — Orchestrator State

## Назначение
Этот файл — главный рабочий снимок состояния проекта для оркестрации.

Его задача:
- удерживать общий контекст между многими внешними чатами;
- фиксировать текущий источник истины;
- показывать, в каком порядке двигаться;
- не давать перепутать временные workaround-решения с каноном.

Если возникает конфликт между памятью чата и этим файлом, приоритет у этого файла и фактического кода.

---

## Текущий Source of Truth

### Core canon
- `docs/canon/the_form_prototype_decisions_ru.md`
- `docs/canon/the_form_feature_input_and_marker_ru.md`
- `docs/canon/the_form_feature_form_switching_ru.md`
- `docs/canon/the_form_feature_ball_ru.md`
- `docs/canon/the_form_feature_triangle_ru.md`
- `docs/canon/the_form_feature_square_ru.md`
- `docs/canon/the_form_feature_camera_ru.md`
- `docs/canon/the_form_feature_level_objects_ru.md`

### Demo orchestration canon
- `docs/canon/the_form_demo_production_spec_ru.md`
- `docs/canon/the_form_mini_spec_ball_distance_coyote_ru.md`
- `docs/canon/the_form_mini_spec_square_rollover_trail_ru.md`
- `docs/canon/the_form_mini_spec_npc_archetypes_ru.md`
- `docs/canon/the_form_mini_spec_cutscene_vocabulary_ru.md`
- `docs/canon/the_form_mini_spec_lighting_direction_ru.md`

### Orchestrator docs
- `docs/canon/the_form_orchestrator_state_ru.md`
- `docs/canon/the_form_orchestrator_work_queue_ru.md`
- `docs/canon/the_form_orchestrator_log_ru.md`
- `docs/canon/the_form_external_chat_intake_template_ru.md`

---

## Проектный статус

### Движок
- `Phaser` остаётся целевым движком до завершения demo.
- `Unity` рассматривается только после demo как production-reset.

### Продуктовая цель
- web-first demo;
- 10–15 минут;
- 4–5 уровней;
- demo продаёт будущую игру, а не становится production foundation;
- формы, feel, атмосфера, NPC, катсцены и presentation — обязательны.

### Архитектурный курс
- не ломать существующий runtime editor;
- не строить giant-controller architecture;
- не строить giant universal toolset;
- layout/gameplay authoring оставлять в существующем editor;
- сложные системы author’ить через data profiles и registries;
- новые системы добавлять узкими runtime-slices.
- square collision safety не лечить post-tick coordinate correction-логикой, если можно удержать контракт `valid pose or detach` на уровне attach/runtime rules.
- square corner stability считать отдельным attach-runtime контрактом: внешний угол нельзя лечить случайным overlap retarget или post-factum depenetration; attached pose должна сама ограничивать minimum contact с текущей surface.
- `Triangle ↔ NPC/actor bounds` не лечить scene-event depenetration, remembered safe pose или post-factum bounce-resolve поверх actor contact runtime. Канонический путь: `actor contact runtime` остаётся detector-only, а модуль-владелец движения actor-а должен делать predictive movement clamp / push-before-commit против triangle polygon.
- Нормальный `Triangle ↔ NPC` contract включает не только боковой actor contact, но и world-support semantics: если Triangle может физически стоять на NPC, NPC должен предоставлять triangle runtime валидную support surface того же класса, что и остальные world/platform surfaces. Канонический путь для этого — synced Matter support-body у NPC, а не попытка эмулировать grounded/support через actor-contact флаги.

---

## Критические инварианты
- Персонаж не должен завершать кадр внутри solid geometry.
- Square rollover должен следовать input intent в валидных corner cases.
- Square trail должен быть непрерывным для игрока визуально и логически.
- Square не должен пассивно доползать до `corner-to-corner` external-edge стыка; attached pose обязана сохранять минимум `1/4` контакта с текущей surface.
- Triangle должен стабильно ломать breakable wall в валидном состоянии.
- Ball должен иметь предсказуемый jump feel и distance-based coyote.
- Dev/prod trigger behavior должен совпадать.

---

## Текущий порядок работ

### Сначала
1. Core stability
2. Campaign + level metadata
3. Demo flow
4. NPC foundation
5. Cutscene foundation
6. Presentation foundation
7. Audio
8. Первый vertical slice level
9. Build readiness

### Не делать раньше времени
- giant visual editor;
- giant sound editor;
- giant AI framework;
- universal cutscene editor;
- production-grade migration to Unity.

---

## Canon Patch - Player Form Animation Profiles (2026-04-21)
- NPC-first presentation backbone remains the target for full animation profile rollout.
- Allowed TEMPORARY exception for demo feel: narrow first-pass player-form hooks for `ball/triangle/square` only.
- First-pass vocabulary hooks: `jump_start`, `land_impact`, `airborne`, `form_switch`.
- Optional form-specific hooks: `ball_rebound_launch`, `triangle_flight_start`, `square_attach_start`, `square_attach_jump_start`.
- Scope guardrails: this is not a universal animation framework, not a new editor, not a player giant-controller migration, and does not change the physics contract.

---

## Stop Gates
- Не переходить к NPC/cutscene/presentation, пока core stability не закрыла критические баги форм.
- Не собирать многоуровневую demo flow, пока нет `finish + nextLevelId`.
- Не делать полноценный content pass, пока нет базового validator-а данных.
- Не делать финальный build pass, пока нет одного цельного vertical slice уровня.

---

## Как обновлять этот файл
Обновлять только когда меняется одно из следующего:
- порядок фаз;
- статус demo scope;
- источник истины;
- архитектурные ограничения;
- stop gates;
- список действительно обязательных систем.

Локальные результаты отдельных задач сюда не писать. Для этого есть:
- `the_form_orchestrator_log_ru.md`
- `the_form_orchestrator_work_queue_ru.md`
