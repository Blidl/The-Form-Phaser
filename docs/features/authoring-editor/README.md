# TheFormPhaser — итоговая документация по фиче Authoring Editor

Этот пакет описывает итоговую архитектуру и реализационное ТЗ для нового in-game editor в Phaser/TypeScript проекте **TheFormPhaser**.

## Что внутри

```txt
docs/
  00_FINAL_FEATURE_SPEC.md
  01_ARCHITECTURE.md
  02_UI_IMPLEMENTATION_SPEC.md
  03_DATA_MODEL_AND_FILE_FORMATS.md
  04_RUNTIME_BEHAVIOR.md
  05_EDITOR_MODES.md
  06_LOGIC_SCRIPT_DSL.md
  07_CUTSCENE_SYSTEM.md
  08_SAVE_LOAD_UNDO_VALIDATION.md
  09_MVP_ROADMAP_AND_CODEX_TASKS.md
  10_ACCEPTANCE_CHECKLIST.md
  11_OPEN_DECISIONS.md
  HANDOFF_PROMPT_FOR_CODEX.md
  UI_MOCKUPS_INDEX.md

assets/
  mockups/
    нормализованные PNG-макеты интерфейса
  mockups_raw/
    исходные PNG-фреймы, загруженные автором
  source_spec/
    исходный PDF с ТЗ
  current_state/
    если присутствует, антипример/текущее состояние, не целевой UI
```

## Источник истины для UI

1. Макеты в `assets/mockups_raw/` — исходные картинки автора. Их нельзя удалять.
2. Макеты в `assets/mockups/` — удобные имена для тех же экранов/состояний.
3. Документ `docs/UI_MOCKUPS_INDEX.md` связывает макеты с разделами.
4. Реализовывать интерфейс нужно по макетам автора: верхняя панель, левый inspector, правый inspector, центральное игровое окно и состав вкладок должны сохраняться.

## Главный принцип реализации

Editor не является отдельной игрой и не создает fake viewport. Он открывается поверх текущей Phaser-сцены по `F2`.

- DOM/HTML UI рисует toolbar, tabs, left inspector, right inspector, forms, lists, dropdowns, buttons, timeline UI.
- Phaser рисует сам уровень, grid, ruler, selection outline, transform handles, paths, trigger zones, camera frame и debug overlays.
- Данные editor сохраняются в JSON.
- Runtime игры строится из тех же JSON-данных.
- Logic scripts хранятся как структурированные команды, а не как произвольный текст.

## Как давать это Codex

1. Сначала дать Codex `docs/HANDOFF_PROMPT_FOR_CODEX.md`.
2. Затем дать конкретный TDD-документ по текущему этапу.
3. Реализовывать маленькими вертикальными срезами.
4. Не разрешать giant rewrite.
5. Не принимать UI, который не соответствует макетам в `assets/mockups_raw/`.
