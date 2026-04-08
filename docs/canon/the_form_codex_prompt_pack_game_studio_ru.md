# The Form — Codex Prompt Pack (Game Studio)

## Назначение
Этот файл хранит полный набор рабочих prompt-ов для внешних Codex-чатов.

Каждый prompt:
- использует `Game Studio` как общую рамку;
- указывает нужный specialist skill;
- опирается на canon проекта;
- не теряет ограничения текущей архитектуры;
- рассчитан на работу по одной задаче за чат.

## Общие правила использования
- Один внешний чат = один prompt из этого файла.
- Не смешивать соседние задачи в одном чате.
- После каждого результата заполнять `docs/canon/the_form_external_chat_intake_template_ru.md`.
- Затем обновлять:
  - `docs/canon/the_form_orchestrator_log_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`

---

## Prompt 1 — Never Embed Contract

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Demo остаётся на Phaser. Уже есть рабочий player runtime, world runtime и runtime editor. Нельзя ломать существующие механики игрока, нельзя ломать editor, нельзя делать giant-controller refactor. Нужно сохранять scene-first, runtime-slice, data-driven подход.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- персонаж ни при каких обстоятельствах не должен оказываться в текстуре
- сейчас есть баг, где square attach/carry/pit может уводить игрока в wall/floor

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_tick_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_jump.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_rollover.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts

Текущая задача:
Введи и реализуй never-embed contract для игрока. Особый акцент на сценарий square attach/carry/pit. Если нужно, добавь post-resolve safeguard, который гарантирует, что игрок не завершает кадр внутри solid.

Ограничения:
- не делать giant rewrite
- не ломать player feel
- если root cause не доказан полностью, отделяй факт от гипотезы
- решение должно быть совместимо с текущей архитектурой
- не удалять уже существующие механики, если их можно стабилизировать

Ожидаемый результат:
1. Что изучил
2. Как понимаешь проблему
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Как вручную проверить результат
```

---

## Prompt 1A — Square Attach/Carry Invalid World Pose Resolution

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. После первого прохода по `Never Embed Contract` стало ясно, что общий post-tick safeguard сам по себе не решает ключевой баг square. Реальный reproduce-case: square attached / carried object / pit edge / world corner. Сейчас квадрат продолжает проталкиваться в невалидную world-позу у стыка геометрии. Нужен не общий depenetration, а правильное разрешение конфликта `attach/carry/world collision`.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_log_ru.md

Дополнительный контекст из требований:
- персонаж не должен завершать кадр внутри solid
- в кейсе square attach/carry/pit мир должен побеждать
- текущий safeguard в `player_runtime.ts` уже пробовали, но manual/video acceptance провален

Визуальное подтверждение бага:
- f:\Projects\TheFormPhaser\tmp\video_review\contact_sheet_2_4s.png
- f:\Projects\TheFormPhaser\tmp\video_review\frame_06_3.25s.png
- f:\Projects\TheFormPhaser\tmp\video_review\frame_07_3.50s.png
- f:\Projects\TheFormPhaser\tmp\video_review\frame_08_3.75s.png

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_tick_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_jump.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_rollover.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\draggable_box.ts
- f:\Projects\TheFormPhaser\src\game\world\moving_platform.ts

Текущая задача:
Почини именно конфликт `square attach/carry` против `world collision`, который возникает у края pit и в стыках геометрии. Решение должно работать так, чтобы world collision побеждал, а square не продолжал удерживаться или протаскиваться в невалидную позу carried object-ом. Если нужно, вводи явное правило разрыва attach, остановки carried object или перехода в безопасную square pose.

Ограничения:
- не делай ещё один только post-tick safeguard как основное решение
- не переписывай весь square runtime без необходимости
- не ломай обычный attach, wall attach hold и attach jump, если это не связано напрямую с конфликтом
- если выбираешь между "красивым" поведением и железобетонной стабильностью, приоритет у стабильности
- если root cause не единственный, явно раздели: confirmed cause, likely cause, defensive fix

Ожидаемый результат:
1. Что изучил
2. Как формулируешь настоящий root cause этого кейса
3. Какое правило conflict resolution вводишь
4. Что именно меняешь
5. Какие файлы изменяешь/создаёшь
6. Как вручную проверить reproduce-case после фикса

Ответ выдай вот в таком формате:  the_form_external_chat_intake_template_ru.md
```

---

## Prompt 2 — Square Rollover by Input

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача только по square rollover. Квадрат — одна из центральных форм demo. Rollover должен быть input-driven и предсказуемым. Нельзя ломать остальные механики square.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- если квадрат на краю и игрок даёт ввод, он должен перевалиться в сторону ввода
- если есть несколько валидных сторон, input intent имеет приоритет

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_square_rollover.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_candidates.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts

Текущая задача:
Почини и ужесточи выбор rollover направления так, чтобы input intent был приоритетным в corner cases. Убери сценарий, где квадрат залипает на краю и не переваливается.

Ограничения:
- не переписывать square runtime целиком
- не ломать trail
- не ломать attach jump
- не превращать решение в giant state rewrite

Ожидаемый результат:
1. Что изучил
2. Что именно меняешь
3. Какие файлы изменяешь/создаёшь
4. Какие edge cases учитываешь
5. Ручной тест-кейс
```

---

## Prompt 3 — Square Trail Continuity

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача только по square trail. Trail — must-have механика demo. Он должен быть непрерывным визуально и логически. Нельзя ломать attach, rollover и resource semantics.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- след должен собираться полностью, без артефактов, дыр и хвостов
- старый и новый след должны реально соединяться визуально и физически

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_square_trail.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_trail_latch.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_candidates.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_rollover.ts
- f:\Projects\TheFormPhaser\src\game\player\view\player_view.ts

Текущая задача:
Почини square trail continuity. Убери сценарии с микродырами, хвостами, плохим reconnect и расхождением visual vs logic там, где это видно игроку.

Ограничения:
- не переписывать trail с нуля
- не ломать resource cost/refund
- не делать giant refactor без необходимости
- решение должно улучшать и visual, и gameplay layer

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Как это влияет на visual/logical continuity
5. Manual acceptance steps
```

---

## Prompt 4 — Triangle Break Wall Stability

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача только по triangle break wall. Механика треугольника должна быть стабильной и честной. Нельзя допустить "иногда пробивает, иногда нет" при валидном состоянии.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- triangle должен гарантированно ломать breakable wall в валидном состоянии
- текущее поведение нестабильно и ломает ценность формы

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\world\triangle_flight_break_wall.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_triangle_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_triangle_flight.ts
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts

Текущая задача:
Почини стабильность пробития breakable wall для triangle. Нужно, чтобы break reliably происходил при правильном active state и не зависел от случайных edge cases кадра/контакта.

Ограничения:
- не ослаблять механику до "ломает всё всегда"
- не ломать triangle flight
- если меняешь правило успешного break, опиши его явно
- не делать giant refactor triangle runtime без необходимости

Ожидаемый результат:
1. Что изучил
2. Как понимаешь root cause
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 5 — Ball Distance Coyote + Wall Impulse

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача только по ball. Для demo критичен хороший классический feel. Нужно исправить wall impulse behavior и внедрить distance-based coyote для обычного прыжка.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_ball_distance_coyote_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- мяч не должен сохранять jump impulse после wall hit
- coyote должен быть distance-based
- поведение должно стать ближе к классическому platformer feel

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_ball_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_ball_rebound_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_ball_rebound.ts
- f:\Projects\TheFormPhaser\src\game\player\player_jump_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_tick_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_constants.ts

Текущая задача:
Почини ball wall impulse handling и внедри distance-based coyote logic для обычного jump. Поведение должно стать предсказуемым и ближе к классическому platformer feel.

Ограничения:
- не ломать rebound system полностью
- не делать giant rewrite
- если нужен временный hybrid mode, опиши это явно
- решение должно быть удобным для дальнейшего tuning

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Как теперь определяется jump eligibility
5. Manual verification
```

---

## Prompt 6 — Marker / Point of Force Alignment

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача только по marker / point of force. Это часть читаемости форм, а не просто декор. Marker должен соответствовать input intent и корректно возвращаться к центру.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- marker должен быть там, где ввод игрока, а без ввода — по центру

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\marker\player_marker_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\marker\player_marker_math.ts
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\view\player_view.ts
- f:\Projects\TheFormPhaser\src\game\player\player_input.ts

Текущая задача:
Почини alignment marker / point-of-force для всех форм так, чтобы его позиция соответствовала фактическому input intent и корректно возвращалась к центру без ввода.

Ограничения:
- не менять input mapping
- не ломать smoothing без причины
- не переписывать весь player view

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Какие form-specific cases учтены
5. Manual verification
```

---

## Prompt 7 — Trigger Build Parity

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача только по trigger build parity. Есть баг: trigger в build ведёт себя иначе, чем в dev. Нужно найти причину и исправить её, а не гадать.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- до build trigger работал правильно
- после build состояние как будто инвертировано
- нужно добиться одинакового поведения в dev/prod

Сначала изучи:
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_bootstrap.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_editor_storage.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\trigger_platform.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_config.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_config_validation.ts
- f:\Projects\TheFormPhaser\vite\config.prod.mjs

Текущая задача:
Разбери и исправь trigger build parity issue. Особо проверь localStorage draft, config normalization, default trigger state и serialized state differences between dev/prod.

Ограничения:
- не ломать trigger runtime
- не удалять editor draft pipeline без причины
- root cause должен быть либо доказан, либо явно помечен как hypothesis
- решение должно быть безопасно для demo build

Ожидаемый результат:
1. Что изучил
2. Root cause или strongest hypothesis
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification plan
```

---

## Prompt 8 — Campaign + Level Metadata

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Existing runtime editor и world config сохраняются. Сейчас нужно добавить campaign и level metadata pipeline поверх текущего мира, чтобы проект стал многосценным demo, а не single test sandbox.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- layout/gameplay остаётся в editor/world config
- progression и внешние profile links идут через level metadata
- нужен finish + nextLevelId + несколько уровней

Сначала изучи:
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_bootstrap.ts
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_frame_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_config.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_editor_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_editor_storage.ts

Текущая задача:
Добавь campaign.json и level metadata pipeline. Введи finish object, nextLevelId и runtime переход между уровнями. Existing editor/world pipeline сохранить.

Ограничения:
- не переписывать editor
- не делать giant loading framework
- current test scene должен продолжать работать
- решение должно быть data-driven и human-readable

Ожидаемый результат:
1. Что изучил
2. Какой data contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Как вручную проверить переход между 2 уровнями
```

---

## Prompt 9 — Data Validator

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. После добавления campaign, levels и profile registries нужен жёсткий validator, чтобы user не боролся с Codex и не ловил silent data errors.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- pipeline включает campaign, levels, npc, cutscenes, audio, presentation profiles
- ошибки должны быть явными и удобными для ручного исправления

Сначала изучи:
- level/campaign loaders
- existing config validation files in f:\Projects\TheFormPhaser\src\game\world\runtime\
- current runtime data contracts

Текущая задача:
Добавь validator для demo data pipeline. Он должен проверять nextLevelId, profileId, cutsceneId, musicProfileId и другие cross references и выводить понятные ошибки.

Ограничения:
- не делать giant framework
- ошибки должны быть понятны человеку
- validator должен быть легко расширяемым
- не смешивать validation с gameplay logic

Ожидаемый результат:
1. Что изучил
2. Что валидируется
3. Какие файлы изменяешь/создаёшь
4. Как выглядит error reporting
5. Manual verification
```

---

## Prompt 10 — NPC Runtime Foundation

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. NPC обязательны и не режутся. Authoring model: instance в уровне + profile в json. Сейчас нужен first-pass foundation, не giant AI system.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_npc_archetypes_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- passive NPC обязательны
- enemy NPC обязательны
- настройка должна идти через profiles, а не хардкод
- нужно сохранить совместимость с текущим editor/world pipeline

Сначала изучи:
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_bootstrap.ts
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_frame_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_editor_adapters.ts
- f:\Projects\TheFormPhaser\src\game\player\player_runtime_contracts.ts

Текущая задача:
Добавь npc_profiles.json, NPC registry и NPC runtime. Реализуй passive idle_patrol и enemy patrol_alert_chase_return. Подключи instancing через level metadata.

Ограничения:
- не делать giant AI framework
- не ломать world/player runtime
- обязательно data-driven profiles
- state names должны быть debug-friendly

Ожидаемый результат:
1. Что изучил
2. Какой NPC data contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 11 — NPC Interaction + Reactions

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. NPC foundation уже есть или будет отдельной задачей. Сейчас нужен interaction layer: button nearby, cutscene launch и reaction hooks на состояние игрока.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_npc_archetypes_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_cutscene_vocabulary_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- passive NPC взаимодействует через кнопку рядом
- может запускать cutscene
- реагирует на состояние игрока

Сначала изучи:
- npc runtime files
- player runtime contracts
- current/future cutscene runtime files
- scene frame runtime

Текущая задача:
Добавь interaction button nearby для passive NPC, поддержку cutsceneId на interaction и базовые reaction hooks на player emotion/state.

Ограничения:
- не делать dialogue tree
- не переписывать NPC runtime foundation
- data-driven profiles обязательны
- interaction должен быть понятным для игрока

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Как это author’ится через profile
5. Manual verification
```

---

## Prompt 12 — Cutscene Runtime Foundation

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Катсцены обязательны. Нужен JSON cutscene runtime, не visual editor. Сейчас нужен first-pass vocabulary и execution model.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_cutscene_vocabulary_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- катсцены нужны по trigger и по interaction
- первая версия должна быть data-driven и расширяемой
- giant editor не нужен

Сначала изучи:
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_bootstrap.ts
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_frame_runtime.ts
- f:\Projects\TheFormPhaser\src\game\camera\follow_camera.ts
- level metadata files
- npc runtime files, если уже есть

Текущая задача:
Добавь JSON cutscene runtime. Поддержи lock_input, unlock_input, wait, camera_focus_actor, play_animation, move_actor, play_sfx, spawn_vfx. Подключи запуск из cutscene trigger.

Ограничения:
- не делать visual editor
- не делать branching
- не ломать normal gameplay camera behavior
- не смешивать cutscene control с giant gameplay manager

Ожидаемый результат:
1. Что изучил
2. Какой cutscene contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 13 — NPC-triggered Cutscenes

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Cutscene runtime есть или делается отдельно. Сейчас нужен только integration slice: NPC interaction -> cutscene.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_npc_archetypes_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_cutscene_vocabulary_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Сначала изучи:
- npc runtime files
- cutscene runtime files
- scene frame runtime
- player input lock flow

Текущая задача:
Свяжи NPC interaction с cutscene runtime так, чтобы passive NPC мог запускать cutscene по interaction button nearby.

Ограничения:
- не делать giant refactor
- не ломать NPC architecture
- не ломать player input flow
- integration должен быть чистым и расширяемым

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Manual verification
```

---

## Prompt 14 — Animation Profiles

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Пользователю критически важна тонкая настройка анимаций. Нужно profile-driven решение: clips, states, timing overrides. Сейчас first pass нужен для NPC и cutscenes.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_npc_archetypes_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_cutscene_vocabulary_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- анимации должны быть тонко настраиваемыми
- user не должен бороться с Codex за тайминги
- state mapping должен жить в данных

Сначала изучи:
- npc runtime files
- cutscene runtime files
- f:\Projects\TheFormPhaser\src\game\player\view\player_view.ts
- any existing animation-related code

Текущая задача:
Добавь animation profile registry и runtime binding. Поддержи clips, state mapping, loop/one-shot, defaultBlendMs и oneShotHoldMs. Сначала подключи к NPC.

Ограничения:
- не делать animator graph
- не делать editor
- не хардкодить states по месту без profile layer
- решение должно быть пригодно для последующего player presentation

Ожидаемый результат:
1. Что изучил
2. Какой animation data contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 15 — Lighting Profiles + Debug Tuning

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Пользователю критически важны атмосфера и тонко настраиваемое освещение в духе Tomas Was Alone. Нужен profile-driven lighting runtime и live tuning, а не giant visual editor.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_lighting_direction_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- lighting должен быть сценическим и атмосферным
- настройки должны быть удобны для user + Codex
- нужен live tuning путь

Сначала изучи:
- f:\Projects\TheFormPhaser\src\scenes\TestScene.ts
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_bootstrap.ts
- f:\Projects\TheFormPhaser\src\game\player\view\player_view.ts
- existing debug/tuning ui runtime files
- level metadata files, если уже есть

Текущая задача:
Добавь lighting profile runtime и debug tuning panel. Поддержи ambientColor, ambientIntensity, lights[], radius, intensity, falloff, color. Подключи lightingProfileId к уровню.

Ограничения:
- не делать giant visual editor
- не ломать current runtime
- web-first performance учитывать
- lighting — слой presentation, не фундамент симуляции

Ожидаемый результат:
1. Что изучил
2. Какой lighting contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Какие параметры доступны для tuning
6. Manual verification
```

---

## Prompt 16 — Parallax Profiles

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Для demo важны layered backgrounds и атмосфера. Нужен compact profile-driven parallax runtime, без отдельного editor.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_lighting_direction_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- background/parallax должны настраиваться через profiles
- задача — усилить атмосферу, не строя новый редактор

Сначала изучи:
- scene runtime files
- level metadata files
- any presentation runtime already added

Текущая задача:
Добавь parallax profile runtime. Поддержи layers с texture, scrollFactorX, scrollFactorY, alpha. Подключи backgroundProfileId к уровню.

Ограничения:
- не делать background editor
- не ломать scene runtime
- решение должно быть compact and data-driven

Ожидаемый результат:
1. Что изучил
2. Какой parallax contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 17 — VFX Profiles

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. VFX обязательны, но giant VFX editor не нужен. Сейчас нужен profile-driven runtime для ключевых demo events.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_lighting_direction_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- VFX должны работать через profiles
- сначала нужны square attach и triangle break wall
- потом систему можно расширять

Сначала изучи:
- square runtime files
- triangle break wall files
- world runtime files
- any presentation runtime already added

Текущая задача:
Добавь vfx profile runtime. Подключи VFX к square attach и triangle break wall. Подготовь API для дальнейшего расширения на trigger/emotion events.

Ограничения:
- не делать universal editor
- не ломать mechanics
- data-driven profiles обязательны
- web-first performance учитывать

Ожидаемый результат:
1. Что изучил
2. Какой VFX contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 18 — Audio Manifest + Level Music

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Звук обязателен. Нужен audio manifest runtime и level music binding. Giant sound editor не нужен.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_cutscene_vocabulary_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- музыка и SFX обязательны
- binding должен быть event-driven и data-driven
- нужно сохранить удобство настройки для user + Codex

Сначала изучи:
- scene runtime files
- player runtime files
- world runtime files
- ui runtime files

Текущая задача:
Добавь audio manifest runtime. Поддержи musicProfiles, sfxProfiles, eventBindings. Подключи музыку уровня и SFX на ball jump, square attach, triangle break wall.

Ограничения:
- не делать giant sound editor
- не ломать current runtime
- binding должен быть data-driven
- решение должно быть пригодно для дальнейшего ambient layer

Ожидаемый результат:
1. Что изучил
2. Какой audio contract вводишь
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification
```

---

## Prompt 19 — Audio Debug Preview

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. Audio runtime уже есть или делается отдельно. Сейчас нужен только удобный debug/preview слой, чтобы быстро проверять назначения и громкости.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- preview/debug нужен, но giant sound editor не нужен
- user должен быстро проверять, что на что назначено

Сначала изучи:
- audio runtime files
- existing ui/runtime panels
- scene bootstrap/runtime files

Текущая задача:
Добавь audio debug preview panel. Нужно видеть current music profile, event bindings и уметь проигрывать ключевые SFX для проверки.

Ограничения:
- не превращать это в полноценный sound editor
- dev-only pragmatic UI допустим

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Manual verification
```

---

## Prompt 20 — Main Menu + Pause + End Screen

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.
Secondary skill: game-studio:game-playtest.

Контекст проекта:
Это проект The Form на Phaser. Сейчас нужно превратить prototype loop в настоящий demo flow. Main menu, pause menu и end-of-demo screen обязательны.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- главное меню обязательно
- меню паузы обязательно
- финальный экран со ссылкой на проект обязателен
- flow должен работать с campaign progression

Сначала изучи:
- f:\Projects\TheFormPhaser\src\scenes\BootScene.ts
- f:\Projects\TheFormPhaser\src\scenes\TestScene.ts
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_bootstrap.ts
- f:\Projects\TheFormPhaser\src\scenes\runtime\test_scene_frame_runtime.ts
- existing scene/menu reference files, если пригодны

Текущая задача:
Добавь main menu, pause menu и end-of-demo screen. Интегрируй их с campaign progression. Existing gameplay scene не ломать.

Ограничения:
- не делать сложную metagame system
- UI может быть simple but solid
- не разводить лишний хаос между сценами

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Manual verification
```

---

## Prompt 21 — First Vertical Slice Level

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.
Secondary skill: game-studio:game-playtest.

Контекст проекта:
Это проект The Form на Phaser. Основные системы уже добавлены или добавляются отдельно. Сейчас нужен первый цельный vertical slice level, чтобы проверить весь pipeline вместе: gameplay, NPC, cutscene, звук, свет, фон, finish.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_npc_archetypes_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_cutscene_vocabulary_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_lighting_direction_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Сначала изучи:
- current level metadata files
- campaign file
- npc profiles
- cutscene files
- presentation profiles
- audio manifest

Текущая задача:
Собери первый полноценный vertical slice level pipeline: finish transition, passive NPC, enemy NPC, одна cutscene, background/parallax, lighting profile, music profile. Если чего-то не хватает в pipeline, добавь только минимально необходимое.

Ограничения:
- не переписывать runtime
- фокус на integration, не на endless polish
- не делать giant content tool
- цель — доказать, что pipeline реально собирает demo

Ожидаемый результат:
1. Что изучил
2. Что меняешь
3. Какие файлы изменяешь/создаёшь
4. Что именно должно проверяться в этом уровне вручную
```

---

## Prompt 22 — Web Build Readiness

```text
Use Game Studio capabilities for this task.
Primary skills: game-studio:game-studio, game-studio:phaser-2d-game.
Secondary skill: game-studio:game-playtest.

Контекст проекта:
Это проект The Form на Phaser. Сейчас задача не новая система, а build readiness для web-first demo. Нужно укрепить dev/prod parity и исключить runtime/editor state surprises в production build.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md

Дополнительный контекст из требований:
- demo должна быть web-first
- важно исключить build-only сюрпризы
- trigger/build parity уже известен как риск

Сначала изучи:
- f:\Projects\TheFormPhaser\vite\config.prod.mjs
- f:\Projects\TheFormPhaser\vite\config.dev.mjs
- scene bootstrap/runtime files
- campaign/level loading files
- trigger/editor draft related files

Текущая задача:
Сделай web build readiness pass. Проверь dev/prod parity, влияние editor draft/runtime state на production build и подготовь demo-safe loading behavior.

Ограничения:
- не ломать dev workflow
- не делать широкий refactor без необходимости
- изменения должны быть focused на стабильность demo build

Ожидаемый результат:
1. Что изучил
2. Какие build risks нашёл
3. Что меняешь
4. Какие файлы изменяешь/создаёшь
5. Manual verification checklist
```

---

## Prompt 22A — Square Multi-Solid Depenetration and Detach Ordering

`Status:` historical / superseded after `Square Architecture Reframe`. Не использовать как текущий основной prompt, если задача не состоит именно в анализе старой symptom-driven ветки.

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. После двух итераций по square attach/carry bug уже ясно, что проблема двухслойная:
1. attach/carry может держать square в world-invalid pose;
2. даже после разрыва конфликта square может оставаться в плохой финальной позе в multi-solid corner.

Current status:
- общий `Never Embed` safeguard уже есть;
- invalid attached pose validation и immediate break attach уже добавлены;
- но второе видео показало, что квадрат всё равно может остаться в неверной финальной позе после конфликта, когда carried object уже ушёл.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_log_ru.md

Визуальные материалы:
- f:\Projects\TheFormPhaser\tmp\video_review\contact_sheet_2_4s.png
- f:\Projects\TheFormPhaser\tmp\video_review\video2\contact_sheet_2_4_5s.png
- f:\Projects\TheFormPhaser\tmp\video_review\video2\frame_09_4.00s.png
- f:\Projects\TheFormPhaser\tmp\video_review\video2\frame_10_4.25s.png
- f:\Projects\TheFormPhaser\tmp\video_review\video2\frame_11_4.50s.png

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_tick_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_jump.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_rollover.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- f:\Projects\TheFormPhaser\src\game\world\runtime\test_world_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\draggable_box.ts
- f:\Projects\TheFormPhaser\src\game\world\moving_platform.ts

Текущая задача:
Почини именно второй слой бага: когда square уже попал в конфликтную world-позу в multi-solid corner, detach/depenetration порядок должен гарантированно выводить его в валидную финальную позу. Не нужен ещё один общий safeguard "на всякий случай"; нужен deterministic rule для escape vector и для порядка `detach -> body reset/depenetration -> velocity cleanup`.

Что важно проверить в коде:
- не происходит ли detach слишком поздно относительно `physicsBody.reset(...)`;
- не выбирает ли текущий minimal-axis depenetration неверное направление в углу из нескольких solid bodies;
- не нужно ли учитывать previous valid pose / support normal / preferred escape direction вместо чисто минимальной осевой коррекции;
- не остаётся ли square в состоянии, где attach уже очищен, но финальная поза не пересчитана на безопасную immediately.

Ограничения:
- не переписывать весь square runtime
- не ломать обычный attach, wall hold, attach jump и rollover
- если вводишь preferred escape rule, она должна быть объяснима и deterministic
- приоритет у железобетонной финальной валидной позы, а не у "красивого" промежуточного поведения

Ожидаемый результат:
1. Что изучил
2. Как разделяешь остаточный bug на concrete sub-causes
3. Какое правило detach/depenetration ordering вводишь
4. Как выбирается escape vector в multi-solid corner
5. Какие файлы изменяешь/создаёшь
6. Как вручную проверить именно второй видео-кейс после фикса
```

---

## Prompt 22B — Square Attach Face Snap Regression on Moving Supports

`Status:` historical / superseded after `Square Architecture Reframe`. Не использовать отдельно от нового clean-architecture контекста.

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. После последних square safety fix-ов появилась новая регрессия: при attach к движущемуся объекту квадрат смещается к углу support body вместо ожидаемого normal face-snap. Это не исходный `pit/carry` bug, а побочный эффект недавних square collision/pose fixes.

Current status:
- общие never-embed и square conflict fixes уже вносятся;
- пользователь вручную подтвердил новый симптом: при attach квадрат почему-то тянется к углу объекта;
- до последних fix-ов этого поведения не было.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_log_ru.md

Визуальный симптом:
- square при attach к moving support смещается к corner-snap вместо expected face-snap

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_candidates.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\world\moving_platform.ts
- f:\Projects\TheFormPhaser\src\game\world\draggable_box.ts
- последние изменения по square safety в git diff

Текущая задача:
Найди и почини регрессию, из-за которой square attach деградировал из normal face-snap в corner-snap на moving supports. Верни ожидаемое поведение attach к боковой/верхней/нижней face support body, но не откатывай новые safety guarantees против invalid world pose.

Что важно проверить:
- не стала ли `resolveSquarePoseClear(...)` слишком жёсткой именно для support body;
- не начала ли attach candidate selection предпочитать corner-safe позу вместо нормального face-snap;
- не ломает ли full-rect validation корректные support-face касания;
- не надо ли отдельно различать `support body overlap allowance` и `foreign solid overlap rejection`.

Ограничения:
- не откатывать wholesale последние safety fixes
- не возвращать исходный `pit/carry` bug
- не переписывать весь square runtime
- решение должно быть узким: вернуть expected face-snap без потери collision safety

Ожидаемый результат:
1. Что изучил
2. Где именно возникла регрессия
3. Какое узкое правило меняешь
4. Какие файлы изменяешь/создаёшь
5. Как вручную проверить, что face-snap вернулся и safety не сломалась
```

---

## Prompt 22C — Square Attach Clean Architecture Reframe

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. По square attach/carry уже было несколько итераций symptom-driven fixes, и они создали регрессии. Пользователь отверг архитектуру, где square "лечится" после тика через forced body reset, directed depenetration, remembered safe poses и похожие координатные коррекции. Нужен clean-architecture подход: мир и обычный collision layer остаются authoritative, square attach либо коммитится только в валидную pose, либо не начинается / рвётся.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_log_ru.md

Current architecture constraint:
- не вводить post-tick coordinate correction как базовый square-механизм;
- не пытаться "выталкивать" square в safe pose общим safeguard-слоем;
- если attach pose world-invalid, attach должен либо не стартовать, либо immediately break;
- square не должен проходить сквозь то, что читается как floor / wall / ceiling.

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_tick_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_candidates.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- f:\Projects\TheFormPhaser\src\game\world\draggable_box.ts
- f:\Projects\TheFormPhaser\src\game\world\moving_platform.ts
- последний git diff по square-файлам

Текущая задача:
Пересмотри square attach/carry решение по чистой архитектуре. Если текущий код всё ещё содержит symptom-driven слои, убери их. Приведи square к модели, где attach работает только через валидную support-face pose и не создаёт ни corner-snap regression, ни invalid world pose. Если для этого нужно поменять ordering или source of truth внутри square runtime — сделай это, но не превращай решение в giant refactor.

Что важно проверить в коде:
- нет ли ещё скрытой зависимости на post-tick reset/depenetration;
- не смешаны ли support-body allowance и foreign-solid rejection;
- не заставляет ли attach candidate selection искать "безопасный угол" вместо корректного face-snap;
- не коммитится ли attach раньше, чем финально известно, что snapped pose валидна;
- не держится ли attach после потери валидной pose дольше одного тика.

Ограничения:
- не делать giant rewrite всего square runtime;
- не возвращать symptom-driven coordinate correction;
- не ломать обычный wall/floor attach, attach jump и rollover;
- если меняешь архитектурное правило, сформулируй его явно.

Ожидаемый результат:
1. Что изучил
2. Какой архитектурный контракт для square attach/carry вводишь
3. Какие symptom-driven слои убираешь или не используешь
4. Что меняешь в runtime
5. Какие файлы изменяешь/создаёшь
6. Как вручную проверить и face-snap, и attach/carry/pit без регрессий
```

---

## Prompt 22D — Square Attach Commit Path Collision

```text
Use Game Studio capabilities for this task.
Primary skill: game-studio:phaser-2d-game.

Контекст проекта:
Это проект The Form на Phaser. По square attach/carry уже было несколько итераций фиксов. Сейчас появилась новая рабочая гипотеза: проблема может быть не в статической финальной attach-pose, а в том, что при attach commit или при возврате/отпрыгивании в attach квадрат временно игнорирует collision и не проверяет, встречает ли он wall / floor / ceiling по пути к snapped pose.

Source of truth:
- f:\Projects\TheFormPhaser\docs\canon\the_form_demo_production_spec_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_mini_spec_square_rollover_trail_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_state_ru.md
- f:\Projects\TheFormPhaser\docs\canon\the_form_orchestrator_log_ru.md

Current architecture rule:
- не лечить square через post-tick coordinate correction;
- мир должен оставаться authoritative;
- attach/snap не должен коммититься через wall / floor / ceiling.

Сначала изучи:
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_attach_jump.ts
- f:\Projects\TheFormPhaser\src\game\player\player_square_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\player_runtime.ts
- f:\Projects\TheFormPhaser\src\game\player\geometry\player_geometry_queries.ts
- все места, где используется `physicsBody.reset(...)`
- все места, где используется `checkCollision.none`

Текущая задача:
Проверь гипотезу, что square attach bug вызван отсутствием path collision gating при commit в attach-pose. Разбери, не телепортируется ли square в snapped pose или обратно в attach без проверки пути. Если гипотеза подтвердится, исправь это clean-architecture способом: attach commit не должен проходить через препятствие, а не должен "лечиться" после факта.

Что важно проверить:
- отключается ли collision во время attach/attach-jump дольше, чем допустимо;
- есть ли путь `reset(...)` сразу в target pose без проверки пересечения траектории;
- проверяется ли только конечная поза, но не путь до неё;
- не создаёт ли attach-jump return скрытый teleport через solid.

Ограничения:
- не вводить новый post-tick never-embed safeguard;
- не лечить баг очередным forced depenetration;
- не делать giant rewrite square runtime;
- если вводишь новый контракт, сформулируй его явно.

Ожидаемый результат:
1. Что изучил
2. Подтвердилась ли гипотеза path collision или нет
3. Где именно в коде происходит неправильный attach commit / return
4. Какой clean-architecture fix вводишь
5. Какие файлы изменяешь/создаёшь
6. Как вручную проверить, что square больше не проходит через floor / wall / ceiling при attach и attach-jump
```
