# The Form — Phaser Docs Pack (RU)

Этот пакет содержит переписанную документацию прототипа `The Form` под разработку в `Phaser`.

## Базовая рамка пакета
- `Phaser-native`
- `docs-first`
- `Codex-first`
- `scene-first`
- `TypeScript-first`
- маленькие атомарные runtime-модули вместо giant-file подхода
- один `pf_player` с тремя формами внутри: `Ball / Triangle / Square`
- `custom platformer`, а не physics-sim first prototype
- каноническая среда проверки: `sc_test`
- целевой workflow: `1 prompt -> 1 готовая feature slice` настолько часто, насколько это реально без потери качества
- prompt для Codex должен быть коротким и ссылаться только на релевантные документы, чтобы минимизировать расход токенов

## Что переписано
Пакет сохраняет структуру исходного набора документов, но адаптирует её под Phaser-термины и Phaser/Codex workflow:

- `Rooms` -> `Scenes`
- `Objects` -> `scene objects / prefab-by-code modules / factories`
- `obj_*`-слой -> `pf_* / controller_* / scene object`-слой
- `GML / DnD`-ориентация -> `Phaser Scene / TypeScript / config objects / small modules`-ориентация
- `GameMaker-native` -> `Phaser-native`
- `Unity editor / Inspector / Prefab wiring` -> `repo structure / scene config / factory wiring / typed config`
- `C# component` -> `TypeScript module / class / helper`

## Документы, специально переписанные заново как engine-heavy слой
- `the_form_phaser_project_structure_ru.md`
- `the_form_first_setup_checklist_ru.md`
- `the_form_prototype_phaser_native_implementation_principles_ru.md`
- `the_form_codex_feature_prompt_contract_ru.md`

Остальные документы сохранены максимально близко к исходному канону по смыслу, механическому контракту и порядку чтения, но переведены в Phaser-эквиваленты и Phaser/Codex vocabulary.

## Главный практический смысл пакета
Пакет должен позволять работать так:

1. Пользователь даёт мне задачу и нужный контекст.
2. Я читаю только релевантные документы из пакета.
3. Я собираю короткий, узкий prompt для Codex.
4. Codex меняет только нужный slice Phaser-проекта.
5. На выходе стремимся получать одну законченную фичу за один prompt без giant-context и без giant-file архитектуры.
