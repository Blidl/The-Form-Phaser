# 03. Phase 2 — Shared Selection, Runtime Bridge, Overlay Primitives

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Создать общий selection foundation для всех вкладок: state, hit-test, canvas clicks, Phaser highlight.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Не начинать Objects/NPC editing без этого, иначе selection logic начнёт дублироваться.

---

## Task 2.1 — Global selection state model

**Исполнитель:** Codex.

### Что входит

- Define EditorObjectRef and EditorSelection.
- Add state helpers: set/clear/toggle.
- Keep compatibility with existing selected fields until migrated.

### Что не входит

- No hit-test.
- No overlay.
- No edit/save.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `01_TDD_editor_shell_input_time_grid.md`

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
Global selection state model

Goal:
Add shared none/single/multi selection state.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- 01_TDD_editor_shell_input_time_grid.md

Files to create/change:
- src/tools/authoring_editor/editor_state.ts
- optional src/tools/authoring_editor/state/editor_selection.ts

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
- Define EditorObjectRef and EditorSelection.
- Add state helpers: set/clear/toggle.
- Keep compatibility with existing selected fields until migrated.

Non-goals:
- No hit-test.
- No overlay.
- No edit/save.

Acceptance:
- State supports none/single/multi.
- Existing app still runs.
- Selection none by default.

Manual verification:
Open editor; no behavior regression.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```

---

## Task 2.2 — Runtime hit-test bridge

**Исполнитель:** Codex.

### Что входит

- Bridge method for hit-test worldX/worldY.
- Return stable refs/summaries, not Phaser objects.
- Start with level objects if full selection too broad.

### Что не входит

- No mutation.
- No overlay.
- No NPC/background unless trivial.

### Файлы, которые смотреть

- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/world/runtime/test_world_editor_adapters.ts`
- `src/game/world/runtime/test_world_runtime.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/** unless read-only summaries needed`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Средняя. Split if it requires legacy selection internals.

### Готовый prompt-кандидат

```text
Title:
Runtime hit-test bridge

Goal:
Expose selectable objects under world point through bridge.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/world/runtime/test_world_editor_adapters.ts
- src/game/world/runtime/test_world_runtime.ts

Files to create/change:
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- optional src/game/world/runtime/test_world_editor_adapters.ts

Files not to touch:
- src/game/player/**
- src/game/npc/** unless read-only summaries needed
- src/game/cutscene/**
- src/game/world/runtime/data/**

Implementation requirements:
- Bridge method for hit-test worldX/worldY.
- Return stable refs/summaries, not Phaser objects.
- Start with level objects if full selection too broad.

Non-goals:
- No mutation.
- No overlay.
- No NPC/background unless trivial.

Acceptance:
- Object point returns ref.
- Empty point returns none.
- No runtime mutation.

Manual verification:
Use temporary debug/test call; remove noisy logs.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 2.3 — Canvas click selection

**Исполнитель:** Codex.

### Что входит

- Left click object selects.
- Left click empty clears.
- Shift-click toggles multi-selection skeleton.
- Ignore clicks over DOM panels.
- Clean listeners on close.

### Что не входит

- No drag move.
- No resize.
- No save.
- No context menu.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Да/средняя.

### Готовый prompt-кандидат

```text
Title:
Canvas click selection

Goal:
Wire left click/empty click/Shift-click into global selection.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts

Files to create/change:
- src/tools/authoring_editor/editor_app.ts
- optional src/tools/authoring_editor/input/editor_pointer_controller.ts
- src/tools/authoring_editor/editor_state.ts

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**

Implementation requirements:
- Left click object selects.
- Left click empty clears.
- Shift-click toggles multi-selection skeleton.
- Ignore clicks over DOM panels.
- Clean listeners on close.

Non-goals:
- No drag move.
- No resize.
- No save.
- No context menu.

Acceptance:
- Click object selects.
- Click empty clears.
- Shift-click toggles multi.
- DOM clicks don't select.

Manual verification:
Open editor and click objects/empty/panels.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium; listener lifecycle.
```

---

## Task 2.4 — Phaser selection highlight overlay

**Исполнитель:** Codex.

### Что входит

- Single and multi highlight.
- Clear on close/empty selection.
- Use bridge bounds/summaries.
- Separate from DOM.

### Что не входит

- No transform gizmos.
- No resize handles.
- No DOM highlight.

### Файлы, которые смотреть

- `src/tools/authoring_editor/authoring_editor_phaser_overlay.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Средняя. Create separate overlay file if large.

### Готовый prompt-кандидат

```text
Title:
Phaser selection highlight overlay

Goal:
Render selected object highlights in Phaser.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/authoring_editor_phaser_overlay.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/editor_state.ts
- src/game/world/runtime/test_world_editor_runtime.ts

Files to create/change:
- src/tools/authoring_editor/authoring_editor_phaser_overlay.ts
- optional src/tools/authoring_editor/overlay/selection_overlay.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**
- src/game/world/runtime/data/**

Implementation requirements:
- Single and multi highlight.
- Clear on close/empty selection.
- Use bridge bounds/summaries.
- Separate from DOM.

Non-goals:
- No transform gizmos.
- No resize handles.
- No DOM highlight.

Acceptance:
- Selected objects visibly highlighted.
- Multi selection shows multiple highlights.
- Close clears overlay.

Manual verification:
Select/clear/close.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium; heterogeneous bounds.
```
