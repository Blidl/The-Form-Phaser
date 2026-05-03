# 02. Phase 1 — Editor Shell, Input, Time, Camera, Grid

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Создать правильную оболочку нового editor по TDD-01: без fake viewport, с real canvas center, toolbar, panels, time/camera/grid controls.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Не смешивать shell, save, selection и editing в один патч.

---

## Task 1.1 — Shell layout without fake viewport

**Исполнитель:** Codex.

### Что входит

- Remove `Phaser viewport/gizmos placeholder`.
- Render top toolbar and fixed left/right inspectors.
- Leave center transparent/pass-through over real Phaser canvas.
- DOM panels capture pointer events.

### Что не входит

- No F2 remap.
- No time/camera/grid tools.
- No selection/save.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/editor_dev_launcher.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/tools/authoring_editor/workspaces/*.ts`
- `01_TDD_editor_shell_input_time_grid.md`
- `UI_MOCKUPS_INDEX.md`

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

Да, если это только layout. Если Codex трогает runtime — split.

### Готовый prompt-кандидат

```text
Title:
Shell layout without fake viewport

Goal:
Replace V2 fake viewport with full-screen shell over real Phaser canvas.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_dev_launcher.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/workspaces/*.ts
- 01_TDD_editor_shell_input_time_grid.md
- UI_MOCKUPS_INDEX.md

Files to create/change:
- src/tools/authoring_editor/editor_dev_launcher.ts
- src/tools/authoring_editor/editor_app.ts
- optional style/helper file

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
- Remove `Phaser viewport/gizmos placeholder`.
- Render top toolbar and fixed left/right inspectors.
- Leave center transparent/pass-through over real Phaser canvas.
- DOM panels capture pointer events.

Non-goals:
- No F2 remap.
- No time/camera/grid tools.
- No selection/save.

Acceptance:
- No fake viewport text remains.
- Top toolbar + left/right panels visible.
- Center is existing game canvas.
- Closing editor removes shell.

Manual verification:
Open current V2 hotkey and verify layout over real canvas.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium; DOM can steal input.
```

---

## Task 1.2 — Target toolbar tabs and last active tab

**Исполнитель:** Codex.

### Что входит

- Tabs: Level, Player, Objects, Background, NPC, Cutscenes, Logic.
- One active tab.
- Fallback unknown tab to Level.
- Create empty honest workspaces if needed.

### Что не входит

- No feature content.
- No localStorage tab persistence.
- No old editor deletion.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/workspaces/*.ts`
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
Target toolbar tabs and last active tab

Goal:
Use confirmed target tabs and remember last active tab in memory.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/workspaces/*.ts
- 01_TDD_editor_shell_input_time_grid.md

Files to create/change:
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/workspaces/*.ts

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
- Tabs: Level, Player, Objects, Background, NPC, Cutscenes, Logic.
- One active tab.
- Fallback unknown tab to Level.
- Create empty honest workspaces if needed.

Non-goals:
- No feature content.
- No localStorage tab persistence.
- No old editor deletion.

Acceptance:
- All target tabs switch.
- No Director/Events/Debug as main tabs.
- Last active tab survives app instance reopen.

Manual verification:
Click every tab, close/open V2.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low/medium.
```

---

## Task 1.3 — F2 opens new editor, legacy fallback remains

**Исполнитель:** Codex.

### Что входит

- F2 toggles new editor.
- Legacy editor remains behind documented temporary fallback/dev flag.
- Both editors cannot be open simultaneously.
- Help/status text updated.

### Что не входит

- No legacy deletion.
- No new tools.
- No gameplay control changes except editor hotkey ownership.

### Файлы, которые смотреть

- `docs/authoring/editor_entrypoint_import_graph.md`
- `docs/authoring/old_editor_parity_inventory.md`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/tools/authoring_editor/editor_dev_launcher.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Средняя/рискованная. Делать только после Phase 0.1/0.2.

### Готовый prompt-кандидат

```text
Title:
F2 opens new editor, legacy fallback remains

Goal:
Route F2 to new editor while keeping legacy editor available behind explicit fallback.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- docs/authoring/editor_entrypoint_import_graph.md
- docs/authoring/old_editor_parity_inventory.md
- src/game/world/runtime/test_world_editor_runtime.ts
- src/tools/authoring_editor/editor_dev_launcher.ts

Files to create/change:
- src/game/world/runtime/test_world_editor_runtime.ts
- optional src/tools/authoring_editor/editor_dev_launcher.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- F2 toggles new editor.
- Legacy editor remains behind documented temporary fallback/dev flag.
- Both editors cannot be open simultaneously.
- Help/status text updated.

Non-goals:
- No legacy deletion.
- No new tools.
- No gameplay control changes except editor hotkey ownership.

Acceptance:
- F2 opens/closes new editor.
- Legacy fallback still reachable and documented.
- No simultaneous editors.
- Camera restored after closing.

Manual verification:
Test F2 and fallback.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; hotkey/camera ownership.
```

---

## Task 1.4 — Live/Paused and Game Speed controls

**Исполнитель:** Codex.

### Что входит

- Live/Paused toggle.
- Game speed numeric default 1.0.
- Paused stops simulation.
- Speed affects Live only.
- Closing editor resets Paused to Live.

### Что не входит

- No cutscene/script preview.
- No speed persistence.
- No broad gameplay rewrite.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/scenes/TestScene.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/player/** unless a tiny existing time hook is explicitly needed`

### Маленькая ли задача?

Средняя. Если нет централизованного pause/speed hook — сначала audit.

### Готовый prompt-кандидат

```text
Title:
Live/Paused and Game Speed controls

Goal:
Add top toolbar time controls through runtime bridge.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/scenes/TestScene.ts

Files to create/change:
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/player/** unless a tiny existing time hook is explicitly needed

Implementation requirements:
- Live/Paused toggle.
- Game speed numeric default 1.0.
- Paused stops simulation.
- Speed affects Live only.
- Closing editor resets Paused to Live.

Non-goals:
- No cutscene/script preview.
- No speed persistence.
- No broad gameplay rewrite.

Acceptance:
- Editor opens Live.
- Pause stops sim; Live resumes.
- Speed changes Live simulation.
- Close returns gameplay normal.

Manual verification:
Open editor, pause/resume/change speed/close.

Expected diff size:
Small/medium; split if it grows.

Risk:
High if runtime lacks centralized time control.
```

---

## Task 1.5 — Editor camera pan/zoom/focus

**Исполнитель:** Codex.

### Что входит

- On open stop gameplay follow.
- Right-drag pans camera.
- Wheel zooms.
- Focus selected centers camera, zoom unchanged.
- On close reset pan/zoom and restore follow.

### Что не входит

- No transform drag.
- No selection hit-test except using existing selection.
- No camera bounds.

### Файлы, которые смотреть

- `src/tools/authoring_editor/editor_dev_launcher.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/tools/authoring_editor/authoring_editor_phaser_overlay.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Средняя. Split lifecycle vs pointer controls if needed.

### Готовый prompt-кандидат

```text
Title:
Editor camera pan/zoom/focus

Goal:
Implement editor camera ownership and controls.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/editor_dev_launcher.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- src/tools/authoring_editor/authoring_editor_phaser_overlay.ts

Files to create/change:
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/tools/authoring_editor/editor_app.ts
- src/game/world/runtime/test_world_editor_runtime.ts
- optional src/tools/authoring_editor/input/editor_camera_controller.ts

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**

Implementation requirements:
- On open stop gameplay follow.
- Right-drag pans camera.
- Wheel zooms.
- Focus selected centers camera, zoom unchanged.
- On close reset pan/zoom and restore follow.

Non-goals:
- No transform drag.
- No selection hit-test except using existing selection.
- No camera bounds.

Acceptance:
- Right-drag pans.
- Wheel zooms.
- Focus centers selected object if any.
- Close restores gameplay camera.

Manual verification:
Pan/zoom/focus/close in a level.

Expected diff size:
Small/medium; split if it grows.

Risk:
High; camera bugs are disruptive.
```

---

## Task 1.6 — Grid/ruler/coordinates/snap settings

**Исполнитель:** Codex.

### Что входит

- Grid visible toggle.
- Grid size 8/16/32.
- Snap enabled toggle independent from grid.
- Mouse world coordinates.
- Ruler follows grid visible for first version.

### Что не входит

- No drag/resize snap application yet.
- No DOM grid/ruler.
- No persistence.

### Файлы, которые смотреть

- `src/tools/authoring_editor/authoring_editor_phaser_overlay.ts`
- `src/tools/authoring_editor/editor_state.ts`
- `src/tools/authoring_editor/editor_app.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `src/game/world/runtime/test_world_editor_runtime.ts`

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- `src/game/world/runtime/data/**`

### Маленькая ли задача?

Да/средняя. Split settings model and overlay if needed.

### Готовый prompt-кандидат

```text
Title:
Grid/ruler/coordinates/snap settings

Goal:
Add UI settings and Phaser overlay control for grid/ruler/coords/snap state.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/authoring_editor_phaser_overlay.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- src/game/world/runtime/test_world_editor_runtime.ts

Files to create/change:
- src/tools/authoring_editor/authoring_editor_phaser_overlay.ts
- src/tools/authoring_editor/editor_state.ts
- src/tools/authoring_editor/editor_app.ts
- optional src/tools/authoring_editor/state/editor_grid_settings.ts

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- src/game/world/runtime/data/**

Implementation requirements:
- Grid visible toggle.
- Grid size 8/16/32.
- Snap enabled toggle independent from grid.
- Mouse world coordinates.
- Ruler follows grid visible for first version.

Non-goals:
- No drag/resize snap application yet.
- No DOM grid/ruler.
- No persistence.

Acceptance:
- Grid toggle works.
- Size changes 8/16/32.
- Snap state independent.
- Coordinates update over canvas.
- Close hides overlay.

Manual verification:
Toggle grid/snap, change size, move mouse.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```
