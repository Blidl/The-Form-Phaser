# 08. Phase 7 — NPC Editor

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Сделать NPC tab для demo: list/create/transform/spawn/settings/visual/script refs/delete protection/copy-paste decision.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Особый риск: copy/paste scripts и physics body resizing. Не угадывать UX/data policy.

---

## Task 7.1 — NPC read-only list/select/focus

**Исполнитель:** Codex.

### Что входит

- NPC list/search.
- Select NPC.
- Focus NPC.
- Read-only inspector current/spawn/type/name if available.

### Что не входит

- No create/edit.
- No transform.
- No scripts editing.
- No delete/copy.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/npc_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/npc/npc_types.ts`
- `src/game/npc/npc_profiles.ts`
- `src/game/npc/npc_runtime.ts`
- `src/game/world/runtime/test_world_config.ts`
- `06_TDD_npc_window.md`

### Файлы, которые не трогать

- `src/game/npc/data/**`
- `src/game/cutscene/data/**`
- `src/game/player/**`
- NPC behavior runtime except read-only summaries

### Маленькая ли задача?

Да/средняя.

### Готовый prompt-кандидат

```text
Title:
NPC read-only list/select/focus

Goal:
Show actual current-level NPCs, not placeholder list.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/npc/npc_types.ts
- src/game/npc/npc_profiles.ts
- src/game/npc/npc_runtime.ts
- src/game/world/runtime/test_world_config.ts
- 06_TDD_npc_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- runtime bridge implementation if summaries needed

Files not to touch:
- src/game/npc/data/**
- src/game/cutscene/data/**
- src/game/player/**
- NPC behavior runtime except read-only summaries

Implementation requirements:
- NPC list/search.
- Select NPC.
- Focus NPC.
- Read-only inspector current/spawn/type/name if available.

Non-goals:
- No create/edit.
- No transform.
- No scripts editing.
- No delete/copy.

Acceptance:
- NPC tab lists actual NPCs.
- Select/focus works.
- Inspector reflects selection.
- No data changes.

Manual verification:
Open level with NPCs and select/focus.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 7.2 — Create default NPC

**Исполнитель:** Codex.

### Что входит

- Create mode button.
- Click level creates default NPC.
- Set spawn X/Y and current position.
- Unique id.
- Select and mark dirty.

### Что не входит

- No script refs.
- No copy/paste.
- No runtime type changing.
- No save unless confirmed.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_config.ts`
- `src/game/npc/npc_types.ts`
- `src/game/npc/npc_profiles.ts`
- `src/tools/authoring_editor/workspaces/npc_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `06_TDD_npc_window.md`

### Файлы, которые не трогать

- `src/game/npc/behavior_v2/**`
- `src/game/cutscene/data/**`
- `src/game/player/**`
- `src/game/world/runtime/data/** unless save task`

### Маленькая ли задача?

Средняя. Audit first if default construction unclear.

### Готовый prompt-кандидат

```text
Title:
Create default NPC

Goal:
Create default NPC by toggle + canvas click.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_world_config.ts
- src/game/npc/npc_types.ts
- src/game/npc/npc_profiles.ts
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- 06_TDD_npc_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- runtime bridge implementation

Files not to touch:
- src/game/npc/behavior_v2/**
- src/game/cutscene/data/**
- src/game/player/**
- src/game/world/runtime/data/** unless save task

Implementation requirements:
- Create mode button.
- Click level creates default NPC.
- Set spawn X/Y and current position.
- Unique id.
- Select and mark dirty.

Non-goals:
- No script refs.
- No copy/paste.
- No runtime type changing.
- No save unless confirmed.

Acceptance:
- Click creates visible/runtime NPC.
- NPC appears in list and selected.
- Dirty on.

Manual verification:
Create NPC, switch tabs, focus it.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; NPC runtime/config creation.
```

---

## Task 7.3 — NPC transform/current vs spawn

**Исполнитель:** Codex.

### Что входит

- Drag changes current position only.
- Inspector current x/y and spawn x/y separately.
- Resize affects physics body if supported.
- `Dirty/undo.`
- Snap applies.

### Что не входит

- No patrol/path editing.
- No script refs.
- No behavior rewrite.
- No save unless confirmed.

### Файлы, которые смотреть

- `src/game/npc/npc_runtime.ts`
- `src/game/npc/npc_types.ts`
- `src/game/world/runtime/test_world_config.ts`
- `src/tools/authoring_editor/workspaces/npc_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `06_TDD_npc_window.md`

### Файлы, которые не трогать

- `src/game/npc/behavior_v2/**`
- `src/game/npc/combat/**`
- `src/game/npc/perception/**`
- `src/game/cutscene/**`
- `src/game/player/**`

### Маленькая ли задача?

Средняя/high. Split drag/spawn/resize if needed.

### Готовый prompt-кандидат

```text
Title:
NPC transform/current vs spawn

Goal:
Edit current transform and separate spawn fields.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/npc/npc_runtime.ts
- src/game/npc/npc_types.ts
- src/game/world/runtime/test_world_config.ts
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- 06_TDD_npc_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- runtime bridge implementation

Files not to touch:
- src/game/npc/behavior_v2/**
- src/game/npc/combat/**
- src/game/npc/perception/**
- src/game/cutscene/**
- src/game/player/**

Implementation requirements:
- Drag changes current position only.
- Inspector current x/y and spawn x/y separately.
- Resize affects physics body if supported.
- Dirty/undo.
- Snap applies.

Non-goals:
- No patrol/path editing.
- No script refs.
- No behavior rewrite.
- No save unless confirmed.

Acceptance:
- Move changes current, not spawn.
- Spawn fields edit spawn.
- Resize updates body if supported.
- Undo restores.

Manual verification:
Move/resize/edit spawn/undo.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; physics body resizing.
```

---

## Task 7.4 — NPC settings, visual and script refs

**Исполнитель:** Codex.

### Что входит

- Name.
- Form/type from allowed forms.
- Two collision modes only.
- `Fill/stroke.`
- Default Patrol/Action/Alt Action refs.
- Edit link to Logic.
- Missing refs validation.

### Что не входит

- No behavior v2 editor.
- No script creation.
- No copy/paste.
- No delete.

### Файлы, которые смотреть

- `src/game/npc/npc_types.ts`
- `src/game/npc/npc_profiles.ts`
- `src/game/npc/npc_scripted_sequences.ts`
- `src/tools/authoring_editor/workspaces/npc_workspace.ts`
- `src/tools/authoring_editor/workspaces/logic_workspace.ts`
- `src/game/authoring/registry/reference_index.ts`
- `06_TDD_npc_window.md`

### Файлы, которые не трогать

- `src/game/npc/behavior_v2/**`
- `src/game/npc/combat/**`
- `src/game/npc/perception/**`
- `src/game/cutscene/data/**`
- `src/game/player/**`

### Маленькая ли задача?

Средняя/high. Split settings/visual and script refs.

### Готовый prompt-кандидат

```text
Title:
NPC settings, visual and script refs

Goal:
Edit name/form/collision/visual and script references.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/npc/npc_types.ts
- src/game/npc/npc_profiles.ts
- src/game/npc/npc_scripted_sequences.ts
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/workspaces/logic_workspace.ts
- src/game/authoring/registry/reference_index.ts
- 06_TDD_npc_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/editor_state.ts if Logic navigation needed

Files not to touch:
- src/game/npc/behavior_v2/**
- src/game/npc/combat/**
- src/game/npc/perception/**
- src/game/cutscene/data/**
- src/game/player/**

Implementation requirements:
- Name.
- Form/type from allowed forms.
- Two collision modes only.
- Fill/stroke.
- Default Patrol/Action/Alt Action refs.
- Edit link to Logic.
- Missing refs validation.

Non-goals:
- No behavior v2 editor.
- No script creation.
- No copy/paste.
- No delete.

Acceptance:
- Settings edit and undo.
- Invalid/missing script refs visible.
- Edit opens Logic.
- Runtime preview updates where supported.

Manual verification:
Edit fields/refs and undo.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; behavior semantics must stay unchanged.
```

---

## Task 7.5 — NPC delete protection with cutscene refs

**Исполнитель:** Codex.

### Что входит

- Delete button.
- Use ReferenceGraph/delete protection.
- Block with message and refs.
- Allowed delete asks confirm and marks dirty.

### Что не входит

- No force delete.
- No related script deletion.
- No safe rename.

### Файлы, которые смотреть

- `src/tools/authoring_editor/services/delete_protection.ts`
- `src/game/authoring/registry/reference_index.ts`
- `src/game/cutscene/test_cutscene_registry.ts`
- `src/tools/authoring_editor/workspaces/npc_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`

### Файлы, которые не трогать

- `src/game/cutscene/data/** unless save pipeline`
- `src/game/npc/behavior_v2/**`
- `src/game/player/**`

### Маленькая ли задача?

Средняя.

### Готовый prompt-кандидат

```text
Title:
NPC delete protection with cutscene refs

Goal:
Block deleting NPC if referenced by cutscenes.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/services/delete_protection.ts
- src/game/authoring/registry/reference_index.ts
- src/game/cutscene/test_cutscene_registry.ts
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts

Files to create/change:
- src/tools/authoring_editor/workspaces/npc_workspace.ts
- src/tools/authoring_editor/services/delete_protection.ts if needed
- runtime bridge deletion method if needed

Files not to touch:
- src/game/cutscene/data/** unless save pipeline
- src/game/npc/behavior_v2/**
- src/game/player/**

Implementation requirements:
- Delete button.
- Use ReferenceGraph/delete protection.
- Block with message and refs.
- Allowed delete asks confirm and marks dirty.

Non-goals:
- No force delete.
- No related script deletion.
- No safe rename.

Acceptance:
- Referenced NPC delete blocked with message.
- Unreferenced NPC deletes after confirm.
- Dirty updates.

Manual verification:
Try referenced/unreferenced NPC delete.

Expected diff size:
Small/medium; split if it grows.

Risk:
High if ReferenceGraph incomplete.
```

---

## Task 7.6 — NPC copy/paste scripts decision gate

**Исполнитель:** Codex.

### Что входит

- Decision needed: new script ids vs generated copies vs shared refs vs block.
- After decision, implement copy model and paste action.

### Что не входит

- No silent ref-copy.
- No guessing id policy.
- No cutscene duplication.

### Файлы, которые смотреть

- `src/game/npc/npc_scripted_sequences.ts`
- `src/game/npc/data/test_npc_scripted_sequences.json`
- `src/game/world/runtime/test_world_config.ts`
- `src/tools/authoring_editor/workspaces/npc_workspace.ts`

### Файлы, которые не трогать

- Do not implement before decision.
- `src/game/npc/behavior_v2/**`
- `src/game/cutscene/data/**`
- `src/game/player/**`

### Маленькая ли задача?

Нет до решения. После решения split copy model and paste action.

### Готовый prompt-кандидат

```text
Title:
NPC copy/paste scripts decision gate

Goal:
Do not implement NPC copy/paste until script-copy id policy is confirmed.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/npc/npc_scripted_sequences.ts
- src/game/npc/data/test_npc_scripted_sequences.json
- src/game/world/runtime/test_world_config.ts
- src/tools/authoring_editor/workspaces/npc_workspace.ts

Files to create/change:
- None until decision; then NPC workspace/bridge/script adapter.

Files not to touch:
- Do not implement before decision.
- src/game/npc/behavior_v2/**
- src/game/cutscene/data/**
- src/game/player/**

Implementation requirements:
- Decision needed: new script ids vs generated copies vs shared refs vs block.
- After decision, implement copy model and paste action.

Non-goals:
- No silent ref-copy.
- No guessing id policy.
- No cutscene duplication.

Acceptance:
- Policy documented before code.
- Copy/paste creates separate NPC and script refs follow policy.
- Validation has no missing refs.

Manual verification:
Copy NPC with scripts, paste, verify original not affected unexpectedly.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; reference corruption.
```
