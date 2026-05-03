# 00. START HERE — TheFormPhaser Authoring Tools Workplan

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Главная цель

Довести новый dev-mode editor для уровней, NPC, logic scripts и cutscenes до состояния, в котором через него можно собрать demo.

## Что известно по проекту

- Старый editor: `src/game/world/runtime/test_world_editor_runtime.ts` и связанные runtime/sidebar/storage/adapters.
- Новый V2: `src/tools/authoring_editor/*`.
- Сейчас V2 — shell/adapter, не готовая фича.
- Сейчас V2 открывается через `Shift+F2`, старый editor через `F2`.
- Текущий V2 содержит антипример `Phaser viewport/gizmos placeholder`; TDD запрещает такой fake viewport.
- Целевые вкладки: `Level / Player / Objects / Background / NPC / Cutscenes / Logic`.
- Существуют foundation pieces: runtime bridge, Phaser grid/ruler overlay, validation panel, reference graph panel, action/authoring registries.
- Save pipeline архитектурно не выбран. Это blocker для mutable features.

## TypeScript baseline

В архивном окружении `npm run build-nolog` не является надёжной проверкой из-за перенесённого `node_modules`. Прямой `tsc` запускается:

```bash
node ./node_modules/typescript/bin/tsc --noEmit --pretty false
```

Текущий baseline сломан. Самые проблемные зоны:
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/player/player_square_runtime.ts`
- `src/game/world/runtime/test_world_config_validation.ts`
- `src/game/world/runtime/test_world_trigger_runtime.ts`
- `src/game/world/runtime/test_world_actor_contact_runtime.ts`

Следствие: Codex-задачи должны быть маленькими и не требовать “починить весь проект”, пока baseline не вынесен в отдельный этап.

## Первый шаг

**Первым шагом должен быть Phase 0 Task 0.1 — old editor feature inventory.**

Почему:
- это read-only;
- это снижает риск удаления старого editor;
- это широкая задача, значит её лучше отдать Kilo CODE;
- результат сократит будущие prompts для Codex;
- без parity checklist удаление старого editor нарушает TDD.

## Рекомендуемый порядок

1. `01_phase0_parity_audit_and_compile_baseline.md`
2. `02_phase1_editor_shell_input_time_grid.md`
3. `03_phase2_selection_overlay_runtime_bridge.md`
4. `04_phase3_save_dirty_validation_references.md`
5. `05_phase4_objects_editor_mvp.md`
6. `06_phase5_level_player_background.md`
7. `07_phase6_logic_script_editor.md`
8. `08_phase7_npc_editor.md`
9. `09_phase8_cutscenes_editor.md`
10. `10_phase9_old_editor_removal.md`
11. `11_open_questions_decision_log.md`

## Mini-discovery перед каждой задачей

1. Я понял задачу так:
2. Почему это важно сейчас:
3. Подтвержденные требования:
4. Пользовательский сценарий:
5. Что видно на экране:
6. Что можно кликнуть/изменить:
7. Что происходит в Phaser:
8. Что происходит в DOM:
9. Какие данные читаем:
10. Какие данные пишем:
11. Undo/redo:
12. Validation:
13. Scope:
14. Non-goals:
15. Риски:
16. Acceptance:
17. Вопросы:

После этого вопрос пользователю:

**Is this task small enough for Codex, or should we split it?**
