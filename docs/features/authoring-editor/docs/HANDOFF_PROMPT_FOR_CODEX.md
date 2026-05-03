# HANDOFF PROMPT FOR CODEX / IMPLEMENTATION AGENT

Ты работаешь над Phaser/TypeScript проектом **TheFormPhaser** и реализуешь новый in-game Authoring Editor.

## Сначала прочитай

1. `README.md`
2. `docs/00_FINAL_FEATURE_SPEC.md`
3. `docs/UI_MOCKUPS_INDEX.md`
4. документ по текущему этапу из `docs/`
5. relevant mockup PNG from `assets/mockups_raw/`

## Самые важные правила

- Не создавай fake viewport.
- Центр editor — настоящий Phaser canvas/уровень.
- UI должен соответствовать макетам автора.
- DOM рисует toolbar, inspectors, forms, lists, timeline.
- Phaser рисует grid, ruler, selection, gizmos, debug overlays.
- Не делай giant rewrite.
- Не смешивай editor UI, store, runtime execution в один класс.
- Canonical data — JSON.
- Logic scripts — structured command list, не произвольный текст.
- Save должен быть честным: либо реально пишет JSON, либо явно export/download.
- localStorage не считается final canonical save.
- Любая ссылка script/object/npc/trigger/level должна валидироваться.
- Delete должен быть reference-safe.
- Edit button у script field должен открыть Logic mode на нужном script.

## Как работать

1. Возьми одну phase из `docs/09_MVP_ROADMAP_AND_CODEX_TASKS.md`.
2. Составь маленький plan.
3. Измени минимальное количество файлов.
4. Добавь/обнови types.
5. Реализуй UI по макету.
6. Реализуй runtime/editor separation.
7. Добавь validation, если появились новые references.
8. Проверь acceptance checklist для phase.
9. Не переходи к следующей phase без green acceptance.

## Антипример

Если ты сделал отдельный серый rectangle "viewport" или standalone scene preview вместо настоящего текущего уровня — это неправильно.

Если UI визуально не совпадает с макетом из `assets/mockups_raw/` — это не готово.

Если script field — простой input, куда можно вписать несуществующее имя без validation/dropdown — это не готово.
