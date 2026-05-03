# 04. Phase 3 — Save, Dirty, Validation, References

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Создать foundation для mutable tools: dirty state, validation/reference panels, delete protection, и отдельно решить save pipeline.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Без этой фазы любые edit tools рискуют стать fake UI или corrupt-data UI.

---

## Task 3.1 — Save pipeline architecture audit

**Исполнитель:** Kilo CODE.

### Что входит

- Map current JSON registries and localStorage/draft flows.
- Evaluate save options: dev endpoint, export/download, clipboard patch, runtime setter/manual.
- Recommend but don't decide.

### Что не входит

- No implementation.
- No localStorage autosave.
- No UX decision for user.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_storage.ts`
- `src/game/world/runtime/test_world_editor_storage.ts`
- `src/game/world/runtime/test_campaign_registry.ts`
- `src/game/world/runtime/data/campaign.json`
- `src/game/world/runtime/data/levels/*.json`
- `src/game/cutscene/cutscene_storage.ts`
- `src/game/cutscene/test_cutscene_registry.ts`
- `src/game/npc/npc_scripted_sequences.ts`
- `src/game/npc/data/*.json`
- `vite/**`

### Файлы, которые не трогать

- `All source/data files; report only.`

### Маленькая ли задача?

Нет. Kilo CODE audit.

### Готовый prompt-кандидат

```text
Title:
Save pipeline architecture audit

Goal:
Audit canonical JSON/project-file save options before implementing Save.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_storage.ts
- src/game/world/runtime/test_world_editor_storage.ts
- src/game/world/runtime/test_campaign_registry.ts
- src/game/world/runtime/data/campaign.json
- src/game/world/runtime/data/levels/*.json
- src/game/cutscene/cutscene_storage.ts
- src/game/cutscene/test_cutscene_registry.ts
- src/game/npc/npc_scripted_sequences.ts
- src/game/npc/data/*.json
- vite/**

Files to create/change:
- docs/authoring/save_pipeline_options.md

Files not to touch:
- All source/data files; report only.

Implementation requirements:
- Map current JSON registries and localStorage/draft flows.
- Evaluate save options: dev endpoint, export/download, clipboard patch, runtime setter/manual.
- Recommend but don't decide.

Non-goals:
- No implementation.
- No localStorage autosave.
- No UX decision for user.

Acceptance:
- Report lists canonical data sources.
- Report explains save options and risks.
- User can choose architecture from report.

Manual verification:
Read report and choose save pipeline.

Expected diff size:
One markdown report.

Risk:
Low; read-only.
```

---

## Task 3.2 — Dirty context service

**Исполнитель:** Codex.

### Что входит

- Dirty contexts for major editor areas.
- mark/clear/read helpers.
- Global Unsaved changes yes/no.
- No actual save.

### Что не входит

- No file writes.
- No localStorage.
- No full undo stack.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/editor_command_history.ts`
- `src/tools/authoring_editor/editor_storage.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/test_world_editor_storage.ts`
- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Да.

### Готовый prompt-кандидат

```text
Title:
Dirty context service

Goal:
Add per-context dirty state and global indicator.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/editor_command_history.ts
- src/tools/authoring_editor/editor_storage.ts

Files to create/change:
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- optional src/tools/authoring_editor/services/dirty_contexts.ts

Files not to touch:
- src/game/world/runtime/test_world_editor_storage.ts
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Dirty contexts for major editor areas.
- mark/clear/read helpers.
- Global Unsaved changes yes/no.
- No actual save.

Non-goals:
- No file writes.
- No localStorage.
- No full undo stack.

Acceptance:
- Default no dirty.
- Marking one context makes global dirty yes.
- Clearing last context makes dirty no.

Manual verification:
Use temp workspace action/dev call to mark/clear; no localStorage writes.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```

---

## Task 3.3 — Validation panel read-only connection

**Исполнитель:** Codex.

### Что входит

- Show validation count and issue list.
- Manual refresh.
- Use runtimeBridge.validateCurrentLevel().

### Что не входит

- No new rules.
- No save gate.
- No delete protection.

### Файлы, которые смотреть

- `src/tools/authoring_editor/panels/validation_panel.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/authoring/validation/*`
- `src/game/level_authoring/level_asset_validation.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Да.

### Готовый prompt-кандидат

```text
Title:
Validation panel read-only connection

Goal:
Connect existing ValidationPanel to new shell using bridge validation snapshot.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/panels/validation_panel.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/authoring/validation/*
- src/game/level_authoring/level_asset_validation.ts

Files to create/change:
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/panels/validation_panel.ts
- optional workspace host file

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**
- src/game/world/runtime/data/**

Implementation requirements:
- Show validation count and issue list.
- Manual refresh.
- Use runtimeBridge.validateCurrentLevel().

Non-goals:
- No new rules.
- No save gate.
- No delete protection.

Acceptance:
- Validation count visible.
- Refresh updates list.
- Uses existing validation output.

Manual verification:
Compare with bridge validation snapshot.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```

---

## Task 3.4 — Reference graph panel read-only connection

**Исполнитель:** Codex.

### Что входит

- Show references/users read-only.
- Manual refresh.
- Clear empty state if no selection.

### Что не входит

- No safe rename.
- No delete protection.
- No navigation unless trivial.

### Файлы, которые смотреть

- `src/tools/authoring_editor/panels/reference_graph_panel.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/authoring/registry/reference_index.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Да.

### Готовый prompt-кандидат

```text
Title:
Reference graph panel read-only connection

Goal:
Connect existing ReferenceGraphPanel to buildReferenceIndex().

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/panels/reference_graph_panel.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/authoring/registry/reference_index.ts

Files to create/change:
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/panels/reference_graph_panel.ts
- optional workspace host file

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**
- src/game/world/runtime/data/**

Implementation requirements:
- Show references/users read-only.
- Manual refresh.
- Clear empty state if no selection.

Non-goals:
- No safe rename.
- No delete protection.
- No navigation unless trivial.

Acceptance:
- Reference info visible.
- Empty/no-selection state clear.
- No data mutation.

Manual verification:
Inspect known NPC/script/cutscene refs.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```

---

## Task 3.5 — Delete protection service skeleton

**Исполнитель:** Codex.

### Что входит

- Pure service API.
- `Allowed/blocked result with reasons.`
- Use ReferenceGraph incoming refs.

### Что не входит

- No actual deletion.
- No safe rename.
- No full entity coverage promise.

### Файлы, которые смотреть

- `src/game/authoring/registry/reference_index.ts`
- `src/tools/authoring_editor/panels/reference_graph_panel.ts`
- `09_TDD_validation_references_save_delete.md`

### Файлы, которые не трогать

- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/world/runtime/test_world_editor_sidebar.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/game/world/runtime/test_world_editor_storage.ts`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Да.

### Готовый prompt-кандидат

```text
Title:
Delete protection service skeleton

Goal:
Create canDelete(ref) service based on ReferenceGraph without wiring delete buttons.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/authoring/registry/reference_index.ts
- src/tools/authoring_editor/panels/reference_graph_panel.ts
- 09_TDD_validation_references_save_delete.md

Files to create/change:
- src/tools/authoring_editor/services/delete_protection.ts
- optional src/tools/authoring_editor/services/reference_graph_client.ts

Files not to touch:
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/world/runtime/test_world_editor_sidebar.ts
- src/game/world/runtime/test_world_editor_adapters.ts
- src/game/world/runtime/test_world_editor_storage.ts
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**

Implementation requirements:
- Pure service API.
- Allowed/blocked result with reasons.
- Use ReferenceGraph incoming refs.

Non-goals:
- No actual deletion.
- No safe rename.
- No full entity coverage promise.

Acceptance:
- Referenced ref blocked with reasons.
- Unreferenced ref allowed.
- No mutation.

Manual verification:
Call service with current reference index.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```
