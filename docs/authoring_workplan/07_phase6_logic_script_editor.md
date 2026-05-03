# 07. Phase 6 — Logic / Script Editor

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Создать command-list script editor: JSON canonical, line-based editing surface, validation on every line, users, later safe preview.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Нельзя делать natural language parser или произвольный raw text. Каждая строка должна быть known command.

---

## Task 6.1 — Logic script inventory/read-only

**Исполнитель:** Codex.

### Что входит

- `Categories/list.`
- Selected script command lines rendered from JSON.
- Users if ReferenceGraph available.
- Read-only.

### Что не входит

- No parser.
- No editing.
- No save.
- No preview.

### Файлы, которые смотреть

- `src/game/authoring/actions/*`
- `src/game/authoring/programs/*`
- `src/game/npc/npc_scripted_sequences.ts`
- `src/game/cutscene/test_cutscene_registry.ts`
- `src/tools/authoring_editor/workspaces/logic_workspace.ts`
- `08_TDD_logic_scripts.md`

### Файлы, которые не трогать

- `src/game/npc/data/**`
- `src/game/cutscene/data/**`
- action runner behavior
- runtime gameplay files

### Маленькая ли задача?

Средняя. If scripts scattered, do Kilo inventory first.

### Готовый prompt-кандидат

```text
Title:
Logic script inventory/read-only

Goal:
Show script categories, scripts, selected command list and users if available.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/authoring/actions/*
- src/game/authoring/programs/*
- src/game/npc/npc_scripted_sequences.ts
- src/game/cutscene/test_cutscene_registry.ts
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- 08_TDD_logic_scripts.md

Files to create/change:
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- src/tools/authoring_editor/editor_app.ts if registration needed
- optional src/tools/authoring_editor/services/script_inventory.ts

Files not to touch:
- src/game/npc/data/**
- src/game/cutscene/data/**
- action runner behavior
- runtime gameplay files

Implementation requirements:
- Categories/list.
- Selected script command lines rendered from JSON.
- Users if ReferenceGraph available.
- Read-only.

Non-goals:
- No parser.
- No editing.
- No save.
- No preview.

Acceptance:
- Logic tab lists scripts.
- Selecting shows command lines.
- No data changes.

Manual verification:
Compare with registries/data.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 6.2 — Line parser for one confirmed command category

**Исполнитель:** Codex.

### Что входит

- Only one confirmed command category, recommended object.move.
- Formatter JSON -> line.
- Parser line -> JSON or validation error.
- Unknown instruction red.

### Что не входит

- No natural language.
- No full catalog.
- No save.
- No preview.

### Файлы, которые смотреть

- `src/game/authoring/actions/action_catalog.ts`
- `src/game/authoring/actions/action_types.ts`
- `src/game/authoring/actions/builtin_actor_movement_actions.ts`
- `src/game/authoring/programs/actor_program_types.ts`
- `src/tools/authoring_editor/workspaces/logic_workspace.ts`
- `08_TDD_logic_scripts.md`

### Файлы, которые не трогать

- action runner behavior
- `src/game/npc/data/**`
- `src/game/cutscene/data/**`
- unrelated command categories

### Маленькая ли задача?

Да после syntax decision. Без решения — нельзя.

### Готовый prompt-кандидат

```text
Title:
Line parser for one confirmed command category

Goal:
Implement parser/formatter/validation for one command syntax.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/authoring/actions/action_catalog.ts
- src/game/authoring/actions/action_types.ts
- src/game/authoring/actions/builtin_actor_movement_actions.ts
- src/game/authoring/programs/actor_program_types.ts
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- 08_TDD_logic_scripts.md

Files to create/change:
- src/tools/authoring_editor/services/logic_line_parser.ts
- src/tools/authoring_editor/workspaces/logic_workspace.ts

Files not to touch:
- action runner behavior
- src/game/npc/data/**
- src/game/cutscene/data/**
- unrelated command categories

Implementation requirements:
- Only one confirmed command category, recommended object.move.
- Formatter JSON -> line.
- Parser line -> JSON or validation error.
- Unknown instruction red.

Non-goals:
- No natural language.
- No full catalog.
- No save.
- No preview.

Acceptance:
- Known command parses.
- Unknown line red/error.
- Formatter stable.
- JSON remains canonical.

Manual verification:
Edit known/unknown line and inspect validation.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium; syntax is product decision.
```

---

## Task 6.3 — Logic edit/save/undo for one script type

**Исполнитель:** Codex.

### Что входит

- Text area edits selected script.
- Validate every line.
- Dirty per script.
- Undo baseline.
- Save JSON command list via chosen pipeline.
- Block invalid save.

### Что не входит

- No safe rename.
- No delete.
- No full catalog.
- No preview.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/logic_workspace.ts`
- `src/tools/authoring_editor/services/logic_line_parser.ts`
- chosen save pipeline files
- relevant script registry/data files

### Файлы, которые не трогать

- action runner behavior
- unrelated script registries
- `src/game/player/**`
- unrelated data files

### Маленькая ли задача?

Средняя/high. One script type only.

### Готовый prompt-кандидат

```text
Title:
Logic edit/save/undo for one script type

Goal:
Enable text editing, validation, dirty, undo, save for one script type.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- src/tools/authoring_editor/services/logic_line_parser.ts
- chosen save pipeline files
- relevant script registry/data files

Files to create/change:
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- shared dirty/save service files
- relevant script adapter

Files not to touch:
- action runner behavior
- unrelated script registries
- src/game/player/**
- unrelated data files

Implementation requirements:
- Text area edits selected script.
- Validate every line.
- Dirty per script.
- Undo baseline.
- Save JSON command list via chosen pipeline.
- Block invalid save.

Non-goals:
- No safe rename.
- No delete.
- No full catalog.
- No preview.

Acceptance:
- Valid edit dirty.
- Unknown line red and blocks save.
- Undo restores.
- Save persists canonical JSON.

Manual verification:
Edit invalid/valid, undo, save, reload.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; script JSON corruption.
```

---

## Task 6.4 — Edit links from refs to Logic tab

**Исполнитель:** Codex.

### Что входит

- Implement for one origin first: Objects or NPC or Cutscenes.
- Click Edit opens Logic tab at script.
- Missing script shows error.
- Users list shows ref if available.

### Что не входит

- No safe rename.
- No delete.
- No script creation.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/workspaces/npc_workspace.ts`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- `src/tools/authoring_editor/workspaces/logic_workspace.ts`
- `src/game/authoring/registry/reference_index.ts`

### Файлы, которые не трогать

- script data files
- action runner behavior
- unrelated workspaces

### Маленькая ли задача?

Средняя. Start with one origin.

### Готовый prompt-кандидат

```text
Title:
Edit links from refs to Logic tab

Goal:
Open Logic tab at script from one origin context.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- src/game/authoring/registry/reference_index.ts

Files to create/change:
- confirmed origin workspace
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- src/tools/authoring_editor/editor_state.ts

Files not to touch:
- script data files
- action runner behavior
- unrelated workspaces

Implementation requirements:
- Implement for one origin first: Objects or NPC or Cutscenes.
- Click Edit opens Logic tab at script.
- Missing script shows error.
- Users list shows ref if available.

Non-goals:
- No safe rename.
- No delete.
- No script creation.

Acceptance:
- Edit link opens Logic tab at selected script.
- Missing refs clear error.
- No data changes.

Manual verification:
Click Edit from chosen origin.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 6.5 — Logic preview runner audit/first safe command

**Исполнитель:** Kilo CODE or Codex report-first.

### Что входит

- Find runner path.
- Identify snapshot/restore needs.
- Identify safe commands.
- Produce split plan or one tiny preview.

### Что не входит

- No full runner rewrite.
- No cutscene preview.
- No unsafe commands.

### Файлы, которые смотреть

- `src/game/authoring/actions/action_runner.ts`
- `src/game/authoring/programs/actor_program_runner.ts`
- `src/game/authoring/programs/actor_program_types.ts`
- `src/tools/authoring_editor/workspaces/logic_workspace.ts`
- runtime bridge files
- `08_TDD_logic_scripts.md`

### Файлы, которые не трогать

- existing action semantics
- `src/game/world/runtime/data/**`
- unrelated runtime files

### Маленькая ли задача?

Нет как implementation; first report/split.

### Готовый prompt-кандидат

```text
Title:
Logic preview runner audit/first safe command

Goal:
Audit preview runner risk and implement only one safe preview if isolated.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/authoring/actions/action_runner.ts
- src/game/authoring/programs/actor_program_runner.ts
- src/game/authoring/programs/actor_program_types.ts
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- runtime bridge files
- 08_TDD_logic_scripts.md

Files to create/change:
- docs/authoring/logic_preview_runner_plan.md
- or tiny preview wrapper if clearly safe

Files not to touch:
- existing action semantics
- src/game/world/runtime/data/**
- unrelated runtime files

Implementation requirements:
- Find runner path.
- Identify snapshot/restore needs.
- Identify safe commands.
- Produce split plan or one tiny preview.

Non-goals:
- No full runner rewrite.
- No cutscene preview.
- No unsafe commands.

Acceptance:
- Plan exists, or one safe command previews and Stop restores state.
- No gameplay behavior changes outside preview.

Manual verification:
Run preview/stop if implemented.

Expected diff size:
Small/medium; split if it grows.

Risk:
High.
```
