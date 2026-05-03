# 10. Phase 9 — Old Editor Removal

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Удалить старый editor только после green parity checklist, working new editor и ручного smoke test.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Gate: старый editor нельзя удалять до подтверждения parity/migration/save/demo flows.

---

## Task 9.1 — Disable legacy fallback access

**Исполнитель:** Codex.

### Что входит

- New editor remains F2.
- Legacy fallback disabled/hidden after approval.
- Help/status text updated.
- No code deletion.

### Что не входит

- No file deletion.
- No import cleanup except direct access references.
- No new editor features.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/tools/authoring_editor/editor_dev_launcher.ts`
- `docs/authoring/old_editor_parity_inventory.md`
- parity checklist document

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `legacy implementation body except access/hotkey`

### Маленькая ли задача?

Да/средняя after gate.

### Готовый prompt-кандидат

```text
Title:
Disable legacy fallback access

Goal:
Disable user-accessible legacy editor fallback while keeping code for one iteration.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_world_editor_runtime.ts
- src/tools/authoring_editor/editor_dev_launcher.ts
- docs/authoring/old_editor_parity_inventory.md
- parity checklist document

Files to create/change:
- src/game/world/runtime/test_world_editor_runtime.ts
- optional docs/authoring/old_editor_removal_log.md

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- legacy implementation body except access/hotkey

Implementation requirements:
- New editor remains F2.
- Legacy fallback disabled/hidden after approval.
- Help/status text updated.
- No code deletion.

Non-goals:
- No file deletion.
- No import cleanup except direct access references.
- No new editor features.

Acceptance:
- F2 opens new editor.
- Legacy cannot be opened by user hotkey.
- No old editor UI appears.
- No new errors beyond baseline.

Manual verification:
Try F2 and old fallback.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium; hotkey/input.
```

---

## Task 9.2 — Legacy editor removal split plan

**Исполнитель:** Kilo CODE or Codex report-only.

### Что входит

- Identify legacy UI-only code.
- Identify runtime bridge code to keep.
- Propose deletion batches with validation.
- Warn about dependencies.

### Что не входит

- No code deletion.
- No new features.
- No opportunistic rewrite.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/world/runtime/test_world_editor_sidebar.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/game/world/runtime/test_world_editor_storage.ts`
- `src/game/world/runtime/test_world_event_authoring_editor.ts`
- `src/game/world/runtime/test_world_logic_rules_editor.ts`
- parity checklist document

### Файлы, которые не трогать

- `All source/data files; report only.`

### Маленькая ли задача?

План — да; deletion — нет.

### Готовый prompt-кандидат

```text
Title:
Legacy editor removal split plan

Goal:
Plan deletion batches before deleting legacy code.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/world/runtime/test_world_editor_sidebar.ts
- src/game/world/runtime/test_world_editor_adapters.ts
- src/game/world/runtime/test_world_editor_storage.ts
- src/game/world/runtime/test_world_event_authoring_editor.ts
- src/game/world/runtime/test_world_logic_rules_editor.ts
- parity checklist document

Files to create/change:
- docs/authoring/legacy_editor_removal_split_plan.md

Files not to touch:
- All source/data files; report only.

Implementation requirements:
- Identify legacy UI-only code.
- Identify runtime bridge code to keep.
- Propose deletion batches with validation.
- Warn about dependencies.

Non-goals:
- No code deletion.
- No new features.
- No opportunistic rewrite.

Acceptance:
- Plan distinguishes remove vs keep/adapt.
- Batches are small.
- Validation steps included.

Manual verification:
Review plan before deletion.

Expected diff size:
One markdown report.

Risk:
Low for plan.
```

---

## Task 9.3 — Delete one approved legacy-only batch

**Исполнитель:** Codex.

### Что входит

- Delete only approved batch.
- Update direct imports.
- Run targeted typecheck if possible.
- Document remaining baseline errors separately.

### Что не входит

- No unrelated cleanup.
- No new features.
- No gameplay changes.

### Файлы, которые смотреть

- `docs/authoring/legacy_editor_removal_split_plan.md`
- approved batch files

### Файлы, которые не трогать

- Anything outside approved batch
- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- new editor features unrelated to import cleanup

### Маленькая ли задача?

Да if batch is small; otherwise split again.

### Готовый prompt-кандидат

```text
Title:
Delete one approved legacy-only batch

Goal:
Delete exactly one approved legacy-only batch and update imports.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- docs/authoring/legacy_editor_removal_split_plan.md
- approved batch files

Files to create/change:
- Only approved batch files and direct import cleanup.

Files not to touch:
- Anything outside approved batch
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- new editor features unrelated to import cleanup

Implementation requirements:
- Delete only approved batch.
- Update direct imports.
- Run targeted typecheck if possible.
- Document remaining baseline errors separately.

Non-goals:
- No unrelated cleanup.
- No new features.
- No gameplay changes.

Acceptance:
- Approved batch removed.
- New editor still opens.
- No old UI from batch remains.
- No new type errors attributable to deletion.

Manual verification:
Open editor and smoke-test affected flows.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; deletion can break bridge.
```
