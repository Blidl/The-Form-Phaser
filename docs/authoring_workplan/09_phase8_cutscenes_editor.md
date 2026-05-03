# 09. Phase 8 — Cutscenes Editor

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Сделать Cutscenes tab: list, actors, timeline, settings editing, action editing, preview. Preview — самый рискованный кусок.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Timeline редактируется через fields, не мышью. Overlay tab visible but disabled until implemented.

---

## Task 8.1 — Cutscene list read-only

**Исполнитель:** Codex.

### Что входит

- List interactive cutscenes.
- Select cutscene.
- Show id/name/duration/start read-only.
- Overlay tab visible disabled if present.

### Что не входит

- No actor list.
- No timeline.
- No editing.
- No preview.

### Файлы, которые смотреть

- `src/game/cutscene/test_cutscene_registry.ts`
- `src/game/cutscene/cutscene_types.ts`
- `src/game/cutscene/cutscene_storage.ts`
- `src/game/director/timeline/*`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- `07_TDD_cutscenes_window.md`

### Файлы, которые не трогать

- `src/game/cutscene/data/**`
- `src/game/npc/**`
- `src/game/player/**`
- runtime playback files

### Маленькая ли задача?

Да/средняя.

### Готовый prompt-кандидат

```text
Title:
Cutscene list read-only

Goal:
Show interactive cutscenes and selected settings read-only.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/cutscene/test_cutscene_registry.ts
- src/game/cutscene/cutscene_types.ts
- src/game/cutscene/cutscene_storage.ts
- src/game/director/timeline/*
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- 07_TDD_cutscenes_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- src/tools/authoring_editor/editor_app.ts if registration needed
- optional src/tools/authoring_editor/services/cutscene_inventory.ts

Files not to touch:
- src/game/cutscene/data/**
- src/game/npc/**
- src/game/player/**
- runtime playback files

Implementation requirements:
- List interactive cutscenes.
- Select cutscene.
- Show id/name/duration/start read-only.
- Overlay tab visible disabled if present.

Non-goals:
- No actor list.
- No timeline.
- No editing.
- No preview.

Acceptance:
- Cutscenes tab lists interactive cutscenes.
- Selecting shows settings.
- Overlay disabled clearly.
- No data changes.

Manual verification:
Compare with registry/data.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low/medium.
```

---

## Task 8.2 — Actor/action read-only view

**Исполнитель:** Codex.

### Что входит

- Actor list.
- Select actor.
- Show actions read-only.
- Show missing refs if validation exists.

### Что не входит

- No action editing.
- No timeline display.
- No preview.
- No create/delete.

### Файлы, которые смотреть

- `src/game/cutscene/cutscene_types.ts`
- `src/game/director/timeline/director_timeline_types.ts`
- `src/game/director/timeline/director_timeline_validation.ts`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- `07_TDD_cutscenes_window.md`

### Файлы, которые не трогать

- `src/game/cutscene/data/**`
- runtime playback files
- `src/game/npc/**`
- `src/game/player/**`

### Маленькая ли задача?

Да/средняя.

### Готовый prompt-кандидат

```text
Title:
Actor/action read-only view

Goal:
Show actors and read-only action list for selected cutscene.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/cutscene/cutscene_types.ts
- src/game/director/timeline/director_timeline_types.ts
- src/game/director/timeline/director_timeline_validation.ts
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- 07_TDD_cutscenes_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- optional src/tools/authoring_editor/services/cutscene_actor_adapter.ts

Files not to touch:
- src/game/cutscene/data/**
- runtime playback files
- src/game/npc/**
- src/game/player/**

Implementation requirements:
- Actor list.
- Select actor.
- Show actions read-only.
- Show missing refs if validation exists.

Non-goals:
- No action editing.
- No timeline display.
- No preview.
- No create/delete.

Acceptance:
- Selected cutscene shows actors.
- Selected actor shows actions.
- No data changes.

Manual verification:
Compare actor/action list with data.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium; data model mismatch possible.
```

---

## Task 8.3 — Timeline display read-only

**Исполнитель:** Codex.

### Что входит

- Timeline above center/level area.
- Actor rows.
- Action markers/bars.
- Validation/error markers if available.
- No mouse editing.

### Что не входит

- No playback.
- No drag-to-edit.
- No action editing.
- No save.

### Файлы, которые смотреть

- `src/tools/authoring_editor/panels/event_timeline_panel.ts`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- `src/game/director/timeline/*`
- `07_TDD_cutscenes_window.md`
- `UI_MOCKUPS_INDEX.md`

### Файлы, которые не трогать

- `src/game/cutscene/data/**`
- runtime playback files
- `src/game/player/**`
- `src/game/npc/**`

### Маленькая ли задача?

Средняя.

### Готовый prompt-кандидат

```text
Title:
Timeline display read-only

Goal:
Render DOM timeline rows and action markers from data.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/panels/event_timeline_panel.ts
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- src/game/director/timeline/*
- 07_TDD_cutscenes_window.md
- UI_MOCKUPS_INDEX.md

Files to create/change:
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- optional src/tools/authoring_editor/panels/cutscene_timeline_panel.ts

Files not to touch:
- src/game/cutscene/data/**
- runtime playback files
- src/game/player/**
- src/game/npc/**

Implementation requirements:
- Timeline above center/level area.
- Actor rows.
- Action markers/bars.
- Validation/error markers if available.
- No mouse editing.

Non-goals:
- No playback.
- No drag-to-edit.
- No action editing.
- No save.

Acceptance:
- Selected cutscene shows timeline rows/markers.
- Changes with selection.
- No data changes.

Manual verification:
Compare marker timing with data.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 8.4 — Cutscene settings edit/save/undo

**Исполнитель:** Codex.

### Что входит

- Edit settings.
- Validate duration/start condition.
- Dirty/undo/save through chosen pipeline.

### Что не входит

- No actor action editing.
- No preview.
- No create/delete.
- No Overlay implementation.

### Файлы, которые смотреть

- `src/game/cutscene/test_cutscene_registry.ts`
- `src/game/cutscene/cutscene_types.ts`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- chosen save service
- `07_TDD_cutscenes_window.md`

### Файлы, которые не трогать

- runtime playback files
- `src/game/npc/**`
- `src/game/player/**`
- unrelated data files

### Маленькая ли задача?

Средняя.

### Готовый prompt-кандидат

```text
Title:
Cutscene settings edit/save/undo

Goal:
Edit name/duration/start condition with validation and save pipeline.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/cutscene/test_cutscene_registry.ts
- src/game/cutscene/cutscene_types.ts
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- chosen save service
- 07_TDD_cutscenes_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- relevant cutscene save adapter/service

Files not to touch:
- runtime playback files
- src/game/npc/**
- src/game/player/**
- unrelated data files

Implementation requirements:
- Edit settings.
- Validate duration/start condition.
- Dirty/undo/save through chosen pipeline.

Non-goals:
- No actor action editing.
- No preview.
- No create/delete.
- No Overlay implementation.

Acceptance:
- Editing marks dirty.
- Invalid values shown.
- Undo restores.
- Save persists/clears dirty.

Manual verification:
Edit/undo/save/reload.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium/high; save path.
```

---

## Task 8.5 — Actor action editing split plan

**Исполнитель:** Kilo CODE or Codex report-only.

### Что входит

- Plan schema display, edit fields, add action, remove action, script picker, validation markers, save/undo.
- Identify data model conflicts.

### Что не входит

- No implementation.
- No preview.
- No timeline drag editing.

### Файлы, которые смотреть

- `src/game/director/timeline/*`
- `src/game/authoring/actions/*`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- `src/tools/authoring_editor/panels/cutscene_timeline_panel.ts`
- `07_TDD_cutscenes_window.md`

### Файлы, которые не трогать

- `All source/data files; report only.`

### Маленькая ли задача?

План — да; implementation — нет.

### Готовый prompt-кандидат

```text
Title:
Actor action editing split plan

Goal:
Split action editing into small tasks instead of giant implementation.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/director/timeline/*
- src/game/authoring/actions/*
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- src/tools/authoring_editor/panels/cutscene_timeline_panel.ts
- 07_TDD_cutscenes_window.md

Files to create/change:
- docs/authoring/cutscene_action_editing_split_plan.md

Files not to touch:
- All source/data files; report only.

Implementation requirements:
- Plan schema display, edit fields, add action, remove action, script picker, validation markers, save/undo.
- Identify data model conflicts.

Non-goals:
- No implementation.
- No preview.
- No timeline drag editing.

Acceptance:
- Plan has Codex-sized slices.
- Risks/unresolved decisions explicit.

Manual verification:
Review plan before coding.

Expected diff size:
One markdown report.

Risk:
Low for plan.
```

---

## Task 8.6 — Cutscene preview playback audit/vertical slice

**Исполнитель:** Kilo CODE or Codex report-first.

### Что входит

- Find playback APIs.
- Identify snapshot/restore for actors/camera/player input.
- Keep non-cutscene NPC behavior running.
- Plan slices or implement one safe wrapper.

### Что не входит

- No director rewrite.
- No Overlay mode.
- No timeline editing.
- No data changes.

### Файлы, которые смотреть

- `src/game/cutscene/*`
- `src/game/director/timeline/*`
- `src/game/director/replay/*`
- `src/game/npc/npc_runtime.ts`
- `src/tools/authoring_editor/workspaces/cutscenes_workspace.ts`
- `07_TDD_cutscenes_window.md`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- core playback semantics unless wrapping
- `src/game/player/** unless disabling input has existing bridge`
- `src/game/npc/behavior_v2/**`

### Маленькая ли задача?

Нет. First audit/split.

### Готовый prompt-кандидат

```text
Title:
Cutscene preview playback audit/vertical slice

Goal:
Audit real preview Play/Pause/Stop with snapshot/restore and implement only if tiny safe slice exists.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/cutscene/*
- src/game/director/timeline/*
- src/game/director/replay/*
- src/game/npc/npc_runtime.ts
- src/tools/authoring_editor/workspaces/cutscenes_workspace.ts
- 07_TDD_cutscenes_window.md

Files to create/change:
- docs/authoring/cutscene_preview_playback_plan.md
- or tiny wrapper if safe

Files not to touch:
- src/game/world/runtime/data/**
- core playback semantics unless wrapping
- src/game/player/** unless disabling input has existing bridge
- src/game/npc/behavior_v2/**

Implementation requirements:
- Find playback APIs.
- Identify snapshot/restore for actors/camera/player input.
- Keep non-cutscene NPC behavior running.
- Plan slices or implement one safe wrapper.

Non-goals:
- No director rewrite.
- No Overlay mode.
- No timeline editing.
- No data changes.

Acceptance:
- Plan exists or one safe preview play/stop/restore works.
- Player control/camera restored after stop/close.

Manual verification:
Run preview/stop/close and test gameplay controls.

Expected diff size:
Small/medium; split if it grows.

Risk:
Very high.
```
