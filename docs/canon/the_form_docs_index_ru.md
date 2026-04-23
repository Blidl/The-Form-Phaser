# The Form — Index новой MD-документации

## Назначение документа
Этот файл является входной точкой в новую MD-базу прототипа **The Form**.

Его задача — дать единый навигационный слой по актуальной документации, зафиксировать приоритет чтения и явно отделить:

- **canonical docs** — текущий источник истины;
- **working support docs** — опорные документы для настройки, prompt-сборки и реализации;
- **historical / reference docs** — старые материалы, которые больше не считаются прямым каноном, но могут использоваться как справочный слой.

---

## Source of truth
Текущий источник истины для нового прототипа:

1. **Новые зафиксированные решения пользователя**;
2. **Новая MD-документация**, собранная на их основе;
3. Старые `MD/DOCX` материалы — только как `historical/reference`, если они не противоречат новому канону.

Если старый документ расходится с новым каноном, приоритет всегда у:

- `prototype_decisions`;
- соответствующего нового `feature_*` документа;
- новых явно зафиксированных решений пользователя.

---

## Рекомендуемый порядок чтения
Если нужно быстро войти в проект с нуля, читать в таком порядке:

1. `the_form_prototype_concept_ru.md`
2. `the_form_prototype_decisions_ru.md`
3. `the_form_prototype_open_questions_ru.md`
4. `the_form_prototype_phaser_native_implementation_principles_ru.md`
5. `the_form_codex_feature_prompt_contract_ru.md`
6. `the_form_prototype_parameters_registry_ru.md`
7. `the_form_feature_input_and_marker_ru.md`
8. `the_form_feature_form_switching_ru.md`
9. `the_form_feature_ball_ru.md`
10. `the_form_feature_triangle_ru.md`
11. `the_form_feature_square_ru.md`
12. `the_form_feature_camera_ru.md`
13. `the_form_feature_level_objects_ru.md`

Если задача узкая, сначала читать `prototype_decisions`, затем только релевантный `feature_*` документ и, при необходимости, `parameters_registry`/`test_scene_spec`.

---

## Canonical core docs

### 1. Prototype Concept
**Файл:** `the_form_prototype_concept_ru.md`

**Назначение:**
- верхнеуровневая цель прототипа;
- scope первой playable/test-версии;
- игровые столпы;
- роль test scene;
- общий образ прототипа как Phaser-native / docs-first / Codex-first / scene-first / TypeScript-first системы.

---

### 2. Prototype Decisions
**Файл:** `the_form_prototype_decisions_ru.md`

**Назначение:**
- главный документ жёсткого канона;
- архитектурные решения;
- input contract;
- правила form switching;
- Ball / Triangle / Square;
- camera / UI / wind / checkpoint / death.

---

### 3. Prototype Open Questions
**Файл:** `the_form_prototype_open_questions_ru.md`

**Назначение:**
- хранение незакрытых вопросов;
- защита проекта от скрытых допущений;
- место для будущих decisions, которые ещё не стали каноном.

---

### 4. Phaser-Native Implementation Principles
**Файл:** `the_form_prototype_phaser_native_implementation_principles_ru.md`

**Назначение:**
- фиксирует `docs-first / Codex-first / scene-first / TypeScript-first`;
- задаёт правила Phaser-native реализации;
- запрещает giant-file и giant-controller подход;
- фиксирует роль `sc_test` и узких feature-slice prompt.

---

### 5. Codex Feature Prompt Contract
**Файл:** `the_form_codex_feature_prompt_contract_ru.md`

**Назначение:**
- фиксирует способ сборки коротких prompt для Codex;
- уменьшает расход токенов;
- удерживает workflow `1 prompt -> 1 feature`;
- задаёт состав обязательных блоков prompt.

---

## Feature docs

### 6. Input and Marker
**Файл:** `the_form_feature_input_and_marker_ru.md`

**Покрывает:**
- input map;
- контекстное значение кнопок;
- visual marker / point of force application;
- правила движения marker;
- связь input и читаемости поведения фигур.

---

### 7. Form Switching
**Файл:** `the_form_feature_form_switching_ru.md`

**Покрывает:**
- цикл `Ball → Triangle → Square → Ball`;
- `Q/E`;
- трансформацию;
- блокировку повторного переключения;
- поведение смены формы внутри активных состояний.

---

### 8. Ball
**Файл:** `the_form_feature_ball_ru.md`

**Покрывает:**
- ground jump;
- boost;
- rebound;
- bounce chaining;
- hit pause;
- wall assist;
- death / UI / wind interaction.

---

### 9. Triangle
**Файл:** `the_form_feature_triangle_ru.md`

**Покрывает:**
- особый jump через разворот;
- freeze;
- dash;
- charges;
- breakable interaction;
- застревание углом;
- поведение как «rigid-body-like landing» на грань.

---

### 10. Square
**Файл:** `the_form_feature_square_ru.md`

**Покрывает:**
- attach;
- trail-resource semantics;
- regen;
- attach jump with return;
- attach to moving compatible surfaces;
- rollover;
- rollback при невалидном завершении rollover.

---

### 11. Camera
**Файл:** `the_form_feature_camera_ru.md`

**Покрывает:**
- follow camera;
- deadzone / freedom frame;
- lower-center bias;
- читабельность платформинга;
- ограничения первой версии камеры.

---

### 12. Level Objects
**Файл:** `the_form_feature_level_objects_ru.md`

**Покрывает:**
- surface geometry;
- hazards;
- checkpoint;
- finish / exit;
- wind zone;
- moving platform;
- trigger platform;
- breakable objects;
- attach-compatible surfaces.

---

## Support docs

### Demo Production Spec
**Файл:** `the_form_demo_production_spec_ru.md`

**Назначение:**
- фиксирует реальный demo-scope на текущем Phaser-прототипе;
- даёт решение по движку именно для demo;
- связывает ответы пользователя с фактической текущей реализацией проекта;
- фиксирует архитектурные границы, риски и acceptance criteria для demo-production.

### Mini Spec: Ball Distance Coyote
**Файл:** `the_form_mini_spec_ball_distance_coyote_ru.md`

**Назначение:**
- фиксирует контракт distance-based coyote для мяча;
- задаёт границы между обычным jump и rebound;
- служит source of truth для доработки ball feel.

### Mini Spec: Square Rollover & Trail
**Файл:** `the_form_mini_spec_square_rollover_trail_ru.md`

**Назначение:**
- фиксирует rollover как input-driven механику;
- задаёт требования к непрерывности trail;
- фиксирует collision safety для square.

### Mini Spec: NPC Archetypes
**Файл:** `the_form_mini_spec_npc_archetypes_ru.md`

**Назначение:**
- фиксирует first-pass NPC authoring model;
- задаёт минимальные passive/enemy archetypes для demo;
- служит source of truth для profile-driven NPC runtime.

### Mini Spec: Cutscene Vocabulary
**Файл:** `the_form_mini_spec_cutscene_vocabulary_ru.md`

**Назначение:**
- задаёт минимальный словарь команд cutscene runtime;
- разделяет in-level и overlay cutscenes;
- фиксирует границы первой версии без giant editor.

### Mini Spec: Lighting Direction
**Файл:** `the_form_mini_spec_lighting_direction_ru.md`

**Назначение:**
- фиксирует художественное и техническое направление света для demo;
- задаёт profile-driven lighting contract;
- служит source of truth для live tuning и scene atmosphere.

### Orchestrator State
**Файл:** `the_form_orchestrator_state_ru.md`

**Назначение:**
- главный снимок текущего состояния оркестрации;
- фиксирует, какой canon и какой порядок фаз сейчас действуют;
- удерживает stop gates и проектные инварианты между внешними чатами.

### Orchestrator Work Queue
**Файл:** `the_form_orchestrator_work_queue_ru.md`

**Назначение:**
- рабочая очередь задач оркестратора;
- показывает, какие эпики и задачи уже закрыты, активны или заблокированы;
- задаёт рекомендуемый порядок запуска внешних Codex-чатов.

### Orchestrator Log
**Файл:** `the_form_orchestrator_log_ru.md`

**Назначение:**
- журнал результатов внешних чатов;
- фиксирует, что реально сделано, что проверено и что остаётся спорным;
- не даёт потерять контекст между отдельными feature-slice итерациями.

### External Chat Intake Template
**Файл:** `the_form_external_chat_intake_template_ru.md`

**Назначение:**
- шаблон для переноса результатов из внешних чатов обратно в основной оркестраторский контур;
- снижает риск путаницы между несколькими параллельными реализациями;
- помогает быстро обновлять log и work queue без копирования целых диалогов.

### Codex Prompt Pack (Game Studio)
**Файл:** `the_form_codex_prompt_pack_game_studio_ru.md`

**Назначение:**
- полный набор рабочих prompt-ов для внешних Codex-чатов;
- встраивает `Game Studio` как явную рабочую рамку;
- связывает каждый prompt с нужным specialist skill и canon проекта.

### 13. Parameters Registry
**Файл:** `the_form_prototype_parameters_registry_ru.md`

**Назначение:**
- единый реестр настраиваемых параметров;
- design-facing units;
- разделение параметров по системам и формам.

---

### 14. Phaser Project Structure
**Файл:** `the_form_phaser_project_structure_ru.md`

**Назначение:**
- фиксирует структуру репозитория и runtime-слоёв;
- определяет место `Scenes`, `assets`, `src`, `docs`;
- задаёт правила для `pf_*` как prefab-by-code modules.

---

### 15. First Setup Checklist
**Файл:** `the_form_first_setup_checklist_ru.md`

**Назначение:**
- фиксирует самые первые практические шаги сборки Phaser-основы;
- помогает правильно собрать каркас проекта до реализации механик.

---

### 16. Accepted Decisions
**Файл:** `the_form_accepted_decisions_ru.md`

**Назначение:**
- краткая фиксация уже принятых решений пользователя;
- быстрый reference-слой для проверки, не противоречит ли новый slice канону.

---

### 17. Canon Map
**Файл:** `the_form_canon_map_ru.md`

**Назначение:**
- карта канона;
- помогает быстро понять, где искать нужный слой истины.

---

### 18. Implementation Order
**Файл:** `the_form_implementation_order_ru.md`

**Назначение:**
- рекомендуемый порядок сборки прототипа;
- помогает делить работу на последовательные feature-slice.

---

### 19. Test Scene Spec
**Файл:** `the_form_test_scene_spec_ru.md`

**Назначение:**
- фиксирует состав и логику `sc_test`;
- задаёт среду acceptance-проверки.

---

## Практическое правило использования индекса
Перед новой задачей достаточно сделать так:

1. открыть `prototype_decisions`;
2. открыть релевантный `feature_*` документ;
3. если задача идёт через внешний чат, открыть `the_form_orchestrator_state_ru.md` и `the_form_orchestrator_work_queue_ru.md`;
4. при необходимости открыть `parameters_registry`, `test_scene_spec`, `implementation_principles`;
5. после внешнего чата заполнить `the_form_external_chat_intake_template_ru.md` и обновить `the_form_orchestrator_log_ru.md`.

Этот индекс существует именно для того, чтобы не тащить в каждый новый slice весь пакет целиком.

---

### 20. Mini Spec: NPC Carry Sync (Arcade Forms)
**����:** `the_form_mini_spec_npc_carry_sync_ru.md`

**����������:**
- ��������� ����������� ������� ���������� ����������� Ball/Square �� ���������� NPC;
- ��������� root cause (`dragX` vs external carry) � production-safe �������;
- ��� �������� regression checklist ��� ���������� ����������.
