# 01. Phase 0 — Parity Audit and Compile Baseline

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Сначала понять старый editor и текущий compile baseline. Этот этап снижает риск и экономит токены Codex.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Первый executable шаг: Task 0.1 для Kilo CODE.

---

## Task 0.1 — Old editor feature inventory

**Исполнитель:** Kilo CODE.

### Что входит

- Inventory visible legacy editor features, panels, hotkeys, storage/draft actions.
- Group by Level/Player/Objects/Background/NPC/Cutscenes/Logic/Debug.
- Map each item to TDD v2 section or mark unknown.
- Mark must-have/optional/obsolete-candidate/unknown, but do not decide for user.

### Что не входит

- No code changes.
- No deletion.
- No new editor implementation.
- No UX decisions.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/world/runtime/test_world_editor_sidebar.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/game/world/runtime/test_world_editor_storage.ts`
- `src/game/world/runtime/test_world_event_authoring_editor.ts`
- `src/game/world/runtime/test_world_logic_rules_editor.ts`
- `src/game/world/runtime/test_campaign_registry.ts`
- `src/game/world/runtime/data/campaign.json`
- `src/game/world/runtime/data/levels/*.json`
- `src/game/npc/npc_scripted_sequences.ts`
- `src/game/cutscene/test_cutscene_registry.ts`

### Файлы, которые не трогать

- All source files; report only.

### Маленькая ли задача?

Нет. Это широкая read-only задача для Kilo CODE, не для Codex.

### Готовый prompt-кандидат

```text
Title:
Old editor feature inventory

Goal:
Produce a read-only parity inventory of the legacy F2 editor.

Context:
Legacy editor cannot be removed until we know which features must be preserved, replaced, or intentionally dropped.

Files to inspect:
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/world/runtime/test_world_editor_sidebar.ts
- src/game/world/runtime/test_world_editor_adapters.ts
- src/game/world/runtime/test_world_editor_storage.ts
- src/game/world/runtime/test_world_event_authoring_editor.ts
- src/game/world/runtime/test_world_logic_rules_editor.ts
- src/game/world/runtime/test_campaign_registry.ts
- src/game/world/runtime/data/campaign.json
- src/game/world/runtime/data/levels/*.json
- src/game/npc/npc_scripted_sequences.ts
- src/game/cutscene/test_cutscene_registry.ts

Files to create/change:
- docs/authoring/old_editor_parity_inventory.md

Files not to touch:
- All source files; report only.

Implementation requirements:
- Inventory visible legacy editor features, panels, hotkeys, storage/draft actions.
- Group by Level/Player/Objects/Background/NPC/Cutscenes/Logic/Debug.
- Map each item to TDD v2 section or mark unknown.
- Mark must-have/optional/obsolete-candidate/unknown, but do not decide for user.

Non-goals:
- No code changes.
- No deletion.
- No new editor implementation.
- No UX decisions.

Acceptance:
- Report contains a parity table.
- Every old editor tab/hotkey/storage flow is represented or explicitly marked unknown.
- Report lists deletion blockers.

Manual verification:
Read the report and compare it against old editor UI.

Expected diff size:
One markdown report.

Risk:
Low; read-only.
```

---

## Task 0.2 — Editor entrypoint/import graph audit

**Исполнитель:** Kilo CODE.

### Что входит

- Find F2/Shift+F2 ownership.
- Find new editor launcher creation.
- Find camera ownership flow.
- List files affected by making F2 open new editor.
- List missing TDD-01 bridge APIs.

### Что не входит

- No code changes.
- No hotkey change.
- No refactor.

### Файлы, которые смотреть

- `src/scenes/TestScene.ts`
- `src/game/world/runtime/test_world_runtime.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/tools/authoring_editor/editor_dev_launcher.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/tools/authoring_editor/authoring_editor_phaser_overlay.ts`

### Файлы, которые не трогать

- All source files; report only.

### Маленькая ли задача?

Нет. Kilo CODE audit.

### Готовый prompt-кандидат

```text
Title:
Editor entrypoint/import graph audit

Goal:
Map how legacy editor, V2 launcher, hotkeys, bridge and overlay are wired.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/scenes/TestScene.ts
- src/game/world/runtime/test_world_runtime.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/tools/authoring_editor/editor_dev_launcher.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/authoring_editor_phaser_overlay.ts

Files to create/change:
- docs/authoring/editor_entrypoint_import_graph.md

Files not to touch:
- All source files; report only.

Implementation requirements:
- Find F2/Shift+F2 ownership.
- Find new editor launcher creation.
- Find camera ownership flow.
- List files affected by making F2 open new editor.
- List missing TDD-01 bridge APIs.

Non-goals:
- No code changes.
- No hotkey change.
- No refactor.

Acceptance:
- Report explains current F2/Shift+F2 behavior.
- Report lists exact files for Phase 1.
- Report identifies risks.

Manual verification:
Confirm report matches runtime behavior.

Expected diff size:
One markdown report.

Risk:
Low; read-only.
```

---

## Task 0.3 — TypeScript baseline triage

**Исполнитель:** Kilo CODE.

### Что входит

- `Run or document failure of `node ./node_modules/typescript/bin/tsc --noEmit --pretty false`.`
- Group errors by file and pattern.
- Separate editor-related errors from gameplay errors.
- Propose small Codex fix batches.

### Что не входит

- No code changes.
- No tsconfig weakening.
- No fixing all errors at once.

### Файлы, которые смотреть

- `package.json`
- `tsconfig.json`
- all files reported by tsc

### Файлы, которые не трогать

- All source files; report only.
- `tsconfig.json`

### Маленькая ли задача?

Отчёт — средний. Исправление всех ошибок — слишком большое.

### Готовый prompt-кандидат

```text
Title:
TypeScript baseline triage

Goal:
Group existing TypeScript errors and propose small independent fix batches.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- package.json
- tsconfig.json
- all files reported by tsc

Files to create/change:
- docs/authoring/typescript_baseline_triage.md

Files not to touch:
- All source files; report only.
- tsconfig.json

Implementation requirements:
- Run or document failure of `node ./node_modules/typescript/bin/tsc --noEmit --pretty false`.
- Group errors by file and pattern.
- Separate editor-related errors from gameplay errors.
- Propose small Codex fix batches.

Non-goals:
- No code changes.
- No tsconfig weakening.
- No fixing all errors at once.

Acceptance:
- Report has command/output summary.
- Report proposes small fix batches.
- No strictness-disable suggestions.

Manual verification:
Rerun tsc and compare grouping.

Expected diff size:
One markdown report.

Risk:
Low; read-only.
```
