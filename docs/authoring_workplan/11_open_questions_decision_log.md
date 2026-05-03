# 11. Open Questions and Decision Log

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Подтверждённые решения

- Новый editor открывается/закрывается через `F2`.
- Старый editor удаляется позже, только после parity checklist.
- Центр экрана — существующий Phaser canvas.
- DOM: toolbar, panels, forms, lists, timeline UI.
- Phaser: grid, ruler, selection, gizmos, overlays, paths/debug.
- Tabs: `Level`, `Player`, `Objects`, `Background`, `NPC`, `Cutscenes`, `Logic`.
- Time mode default при открытии: `Live`.
- Keyboard gameplay input работает в Live, если focus не в text input.
- Mouse input над canvas принадлежит editor.
- Right mouse drag = editor camera pan.
- Wheel = zoom.
- Focus selected только центрирует камеру.
- Zoom/pan сбрасываются при закрытии editor.
- Grid visible и Snap enabled — разные toggles.
- Grid sizes: 8/16/32.
- Pixel ruler включается вместе с grid.
- Mouse coordinates показываются всегда при открытом editor.
- Autosave recovery не нужен.
- Dirty indicator нужен.
- Undo локален по контексту.
- Logic canonical storage = JSON command lists.
- Logic text editing — known command lines, не natural language.
- Unknown instruction подсвечивается красным.
- Overlay tab в Cutscenes visible but disabled до реализации.
- Eyedropper нужен в первой версии.
- Copy/paste NPC копирует scripts.

## Нельзя молча выбрать

### Save pipeline

Варианты:
1. Dev server endpoint writes JSON.
2. Export/download JSON or patch.
3. Copy-to-clipboard JSON/patch.
4. Runtime setter + manual file update.

Рекомендация: сначала `Task 3.1 Save pipeline architecture audit`, потом решение. Не фиксировать без пользователя.

### Legacy fallback после F2 remap

Варианты:
1. Shift+F2 для old editor.
2. Dev flag only.
3. Убрать доступ сразу, код оставить.
4. URL/query param.

Рекомендация: временно dev flag или Shift+F2 после parity audit. Не фиксировать без пользователя.

### Game speed = 0

Варианты:
1. Разрешить 0.
2. Минимум 0.1.
3. 0 auto-switches Paused.
4. Запретить 0.

Рекомендация: минимум 0.1, Paused — единственный explicit stop. Не фиксировать без пользователя.

### Logic line syntax

Нужно подтвердить первую grammar. Возможные стили:
- object.move target=crate_01 x=10 y=0 duration=500
- move crate_01 by 10 0 in 500ms
- JSON-like one-liner.

Рекомендация: строгий `key=value`. Не фиксировать без пользователя.

### NPC copy/paste scripts

Подтверждено, что scripts копируются. Не решено:
1. deep-copy scripts with derived ids;
2. deep-copy with generated ids;
3. shared refs, но это противоречит “копирует scripts”, если отдельно не переопределить;
4. block copy/paste NPC with scripts until policy.

Рекомендация: generated ids или block until policy. Не фиксировать без пользователя.

### Eyedropper

Нужно решить source:
1. rendered pixel under cursor;
2. selected object visual/config color;
3. Phaser framebuffer sample;
4. object under cursor config.

Рекомендация: config/object color eyedropper first. Не фиксировать без пользователя.

### Background asset registry

Нужно определить source of truth:
- Phaser texture manager;
- content registry;
- static list;
- JSON registry.

Рекомендация: audit first. Не фиксировать без пользователя.

### Cutscene preview dirty draft

Варианты:
1. preview draft state;
2. preview last saved state;
3. ask user;
4. block preview until save.

Рекомендация: preview draft state with Stop restore. Не фиксировать без пользователя.

## Decision log template

```md
## Decision YYYY-MM-DD — <title>

Status: confirmed / rejected / deferred

Decision:
<text>

Why:
<reasoning>

Applies to:
<TDD sections / files / tasks>

Migration cost:
<low/medium/high>

Reversible:
<yes/no>

Notes:
<any constraints>
```

## Первый следующий prompt, который я бы дал Kilo CODE

См. `01_phase0_parity_audit_and_compile_baseline.md`, Task 0.1.

Не начинать с Codex implementation. Сначала inventory.
