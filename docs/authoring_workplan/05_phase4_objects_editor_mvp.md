# 05. Phase 4 — Objects Editor MVP

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Первый реально полезный authoring flow: читать, выбирать, двигать, редактировать bounds, создавать и сохранять объекты уровня.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Objects MVP должен идти после shell, selection и dirty/save foundation.

---

## Task 4.1 — Objects read-only list/inspector

**Исполнитель:** Codex.

### Что входит

- Object list from runtimeBridge.getEditorObjects().
- `Search/filter.`
- Select from list.
- Focus button.
- Read-only id/type/bounds.

### Что не входит

- No editing.
- No create/delete.
- No save.
- No visual editor.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/*.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `03_TDD_objects_window.md`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Да.

### Готовый prompt-кандидат

```text
Title:
Objects read-only list/inspector

Goal:
Implement Objects tab read-only list, search, select, focus and inspector.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/*.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_adapters.ts
- 03_TDD_objects_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/editor_app.ts
- optional src/tools/authoring_editor/panels/objects_panel.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Object list from runtimeBridge.getEditorObjects().
- Search/filter.
- Select from list.
- Focus button.
- Read-only id/type/bounds.

Non-goals:
- No editing.
- No create/delete.
- No save.
- No visual editor.

Acceptance:
- Objects tab lists current objects.
- Selecting updates inspector.
- Focus centers camera.
- No data changes.

Manual verification:
Open Objects tab and compare with level objects.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low/medium.
```

---

## Task 4.2 — Objects selection sync

**Исполнитель:** Codex.

### Что входит

- Canvas selection updates list/inspector.
- List click updates global selection.
- Empty selection clears inspector.

### Что не входит

- No move/edit/save.
- No local selection source of truth.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/tools/authoring_editor/overlay/*`
- `src/tools/authoring_editor/input/*`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Да, если Phase 2 готова.

### Готовый prompt-кандидат

```text
Title:
Objects selection sync

Goal:
Sync Objects tab with global canvas/list selection.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/overlay/*
- src/tools/authoring_editor/input/*

Files to create/change:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- optional src/tools/authoring_editor/editor_state.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Canvas selection updates list/inspector.
- List click updates global selection.
- Empty selection clears inspector.

Non-goals:
- No move/edit/save.
- No local selection source of truth.

Acceptance:
- Click canvas object updates Objects inspector.
- Click list updates highlight.
- Click empty clears.

Manual verification:
Select via canvas and list.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```

---

## Task 4.3 — Move selected object with snap

**Исполнитель:** Codex.

### Что входит

- Drag selected object.
- Apply snap x/y when enabled.
- Update runtime preview/config through bridge.
- Mark dirty.
- Undo movement.

### Что не входит

- No resize/rotate.
- No save.
- No multi-select transform unless already trivial.

### Файлы, которые смотреть

- `src/tools/authoring_editor/input/*`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/services/dirty_contexts.ts`
- `src/tools/authoring_editor/editor_command_history.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Средняя/high. Split bridge mutation API first if needed.

### Готовый prompt-кандидат

```text
Title:
Move selected object with snap

Goal:
Drag selected object in Objects tab, preview runtime movement, dirty/undo.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/input/*
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/services/dirty_contexts.ts
- src/tools/authoring_editor/editor_command_history.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/world/runtime/test_world_editor_adapters.ts

Files to create/change:
- src/tools/authoring_editor/input/editor_pointer_controller.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/editor_command_history.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- optional src/tools/authoring_editor/services/object_edit_session.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Drag selected object.
- Apply snap x/y when enabled.
- Update runtime preview/config through bridge.
- Mark dirty.
- Undo movement.

Non-goals:
- No resize/rotate.
- No save.
- No multi-select transform unless already trivial.

Acceptance:
- Drag moves selected object.
- Snap on/off works.
- Dirty turns on.
- Undo restores position.

Manual verification:
Move object with snap on/off and undo.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; runtime mutation.
```

---

## Task 4.4 — Bounds inspector editing

**Исполнитель:** Codex.

### Что входит

- Editable numeric bounds.
- Positive width/height validation.
- Snap if enabled.
- Runtime preview.
- `Dirty/undo.`

### Что не входит

- No handles.
- No rotate.
- No save.
- No multi-select.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/editor_command_history.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Средняя.

### Готовый prompt-кандидат

```text
Title:
Bounds inspector editing

Goal:
Edit x/y/width/height with validation, runtime preview, dirty/undo.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/editor_command_history.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/world/runtime/test_world_editor_adapters.ts

Files to create/change:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Editable numeric bounds.
- Positive width/height validation.
- Snap if enabled.
- Runtime preview.
- Dirty/undo.

Non-goals:
- No handles.
- No rotate.
- No save.
- No multi-select.

Acceptance:
- Editing x/y moves object.
- Editing w/h resizes object.
- Invalid values blocked.
- Undo restores.

Manual verification:
Edit bounds of a platform/object and undo.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium/high; object classes vary.
```

---

## Task 4.5 — Create one object preset

**Исполнитель:** Codex.

### Что входит

- Preset catalog with one safe preset.
- Click canvas creates at snapped position.
- Auto id.
- Select new object.
- Dirty.

### Что не входит

- No full catalog.
- No polygon collision.
- No save.
- No background/NPC creation.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/game/world/runtime/test_world_config.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Средняя. Start with one basic platform/surface.

### Готовый prompt-кандидат

```text
Title:
Create one object preset

Goal:
Add minimal preset placement flow for one safe object type.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_world_editor_adapters.ts
- src/game/world/runtime/test_world_config.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts

Files to create/change:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- optional src/tools/authoring_editor/services/object_preset_catalog.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Preset catalog with one safe preset.
- Click canvas creates at snapped position.
- Auto id.
- Select new object.
- Dirty.

Non-goals:
- No full catalog.
- No polygon collision.
- No save.
- No background/NPC creation.

Acceptance:
- Preset click creates object.
- Appears in list.
- Selected after create.
- Dirty on.

Manual verification:
Create object and confirm not saved unless save implemented.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; config creation.
```

---

## Task 4.6 — Save object changes

**Исполнитель:** Codex.

### Что входит

- Use chosen save mechanism only.
- Save current object/level changes.
- Clear dirty on success.
- Show error on failure.

### Что не входит

- No save architecture decision.
- No global export gate.
- No NPC/cutscene/script save.

### Файлы, которые смотреть

- `docs/authoring/save_pipeline_options.md`
- `src/tools/authoring_editor/services/dirty_contexts.ts`
- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- chosen save pipeline files

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- unrelated data files

### Маленькая ли задача?

Неизвестно до решения save pipeline.

### Готовый prompt-кандидат

```text
Title:
Save object changes

Goal:
Save Objects changes through confirmed save pipeline.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- docs/authoring/save_pipeline_options.md
- src/tools/authoring_editor/services/dirty_contexts.ts
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- chosen save pipeline files

Files to create/change:
- Depends on confirmed save pipeline; keep to Objects/shared save service.

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- unrelated data files

Implementation requirements:
- Use chosen save mechanism only.
- Save current object/level changes.
- Clear dirty on success.
- Show error on failure.

Non-goals:
- No save architecture decision.
- No global export gate.
- No NPC/cutscene/script save.

Acceptance:
- Edit object, save, dirty clears.
- Reload confirms persistence per chosen pipeline.
- Failed save leaves dirty and shows error.

Manual verification:
Edit/save/reload/restart if needed.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; canonical data writes.
```

---

## Task 4.7 — Visual inspector MVP

**Исполнитель:** Codex.

### Что входит

- Fields for fill/stroke/alpha/layer.
- Alpha validation 0..1.
- Runtime preview.
- `Dirty/undo.`
- Multi-select only if already safe.

### Что не входит

- No shader/texture picker unless registry exists.
- No eyedropper.
- No only-debug-view.
- No save unless already done.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_config.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `03_TDD_objects_window.md`

### Файлы, которые не трогать

- asset files
- shader runtime
- `src/game/world/runtime/data/** unless save task`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Средняя. Split fill/stroke/alpha first.

### Готовый prompt-кандидат

```text
Title:
Visual inspector MVP

Goal:
Edit fill/stroke/alpha/layer for supported objects.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_world_config.ts
- src/game/world/runtime/test_world_editor_adapters.ts
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- 03_TDD_objects_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts

Files not to touch:
- asset files
- shader runtime
- src/game/world/runtime/data/** unless save task
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Fields for fill/stroke/alpha/layer.
- Alpha validation 0..1.
- Runtime preview.
- Dirty/undo.
- Multi-select only if already safe.

Non-goals:
- No shader/texture picker unless registry exists.
- No eyedropper.
- No only-debug-view.
- No save unless already done.

Acceptance:
- Visual edits preview.
- Invalid alpha rejected.
- Undo restores.
- Unsupported types handled honestly.

Manual verification:
Edit visual fields and undo.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 4.8 — Resize/rotate/lock/delete/copy/paste split

**Исполнитель:** Codex.

### Что входит

- Plan separate tasks for resize handles, rotate handle, lock, delete protection, copy/paste, polygon collision.
- List files/scope/risks per task.

### Что не входит

- No implementation.
- No deletion.
- No broad transform rewrite.

### Файлы, которые смотреть

- `03_TDD_objects_window.md`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/tools/authoring_editor/workspaces/objects_workspace.ts`
- `src/tools/authoring_editor/overlay/*`

### Файлы, которые не трогать

- `All source/data files; report only.`

### Маленькая ли задача?

План — да; реализация всего — нет.

### Готовый prompt-кандидат

```text
Title:
Resize/rotate/lock/delete/copy/paste split

Goal:
Create split plan for advanced object operations instead of giant patch.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- 03_TDD_objects_window.md
- src/game/world/runtime/test_world_editor_adapters.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/tools/authoring_editor/workspaces/objects_workspace.ts
- src/tools/authoring_editor/overlay/*

Files to create/change:
- docs/authoring/objects_advanced_ops_split_plan.md

Files not to touch:
- All source/data files; report only.

Implementation requirements:
- Plan separate tasks for resize handles, rotate handle, lock, delete protection, copy/paste, polygon collision.
- List files/scope/risks per task.

Non-goals:
- No implementation.
- No deletion.
- No broad transform rewrite.

Acceptance:
- Report has small Codex-ready tasks.
- Each task has files/scope/non-goals/acceptance.
- Risks explicit.

Manual verification:
Review plan before implementation.

Expected diff size:
One markdown report.

Risk:
Low for plan.
```
