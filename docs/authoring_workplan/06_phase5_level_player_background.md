# 06. Phase 5 — Level, Player, Background

> Статус: рабочий handoff-план. Prompts ниже — **кандидаты**. Перед запуском конкретной задачи всё равно провести mini-discovery и получить подтверждение пользователя.
>
> Жёсткие правила: не удалять старый editor без parity checklist; не создавать второй Phaser canvas; не делать DOM fake viewport/gizmos; не рисовать grid/gizmos через DOM; не раздувать `test_world_editor_runtime.ts` без сильной причины; не менять gameplay behavior без отдельного решения.


## Цель

Добавить оставшиеся demo-critical setup windows после Objects MVP: Level, Player и Background.


## Формат каждой задачи

1. Что входит.
2. Что не входит.
3. Файлы, которые Codex/Kilo должен смотреть.
4. Файлы, которые нельзя трогать.
5. Маленькая ли задача.
6. Готовый prompt-кандидат.


Player и Background начинать с аудита/read-only. Editing только после save/dirty foundation.

---

## Task 5.1 — Level read-only panel

**Исполнитель:** Codex.

### Что входит

- Level list.
- Current level marker.
- Selected id/name/size read-only.
- Open disabled until unsaved confirm exists.

### Что не входит

- No create/delete.
- No save.
- No sequence.
- No navigation.

### Файлы, которые смотреть

- `src/game/world/runtime/test_campaign_registry.ts`
- `src/game/world/runtime/data/campaign.json`
- `src/game/world/runtime/data/levels/*.json`
- `src/tools/authoring_editor/workspaces/level_workspace.ts`
- `02_TDD_level_window.md`

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
Level read-only panel

Goal:
Show campaign levels and selected level settings read-only.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_campaign_registry.ts
- src/game/world/runtime/data/campaign.json
- src/game/world/runtime/data/levels/*.json
- src/tools/authoring_editor/workspaces/level_workspace.ts
- 02_TDD_level_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/level_workspace.ts
- optional src/tools/authoring_editor/panels/level_panel.ts

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Level list.
- Current level marker.
- Selected id/name/size read-only.
- Open disabled until unsaved confirm exists.

Non-goals:
- No create/delete.
- No save.
- No sequence.
- No navigation.

Acceptance:
- Level list visible.
- Current level marked.
- Selecting updates inspector.
- No data changes.

Manual verification:
Compare with campaign.json.

Expected diff size:
Small/medium; split if it grows.

Risk:
Low.
```

---

## Task 5.2 — Level edit name/width/height

**Исполнитель:** Codex.

### Что входит

- Edit name/width/height.
- Validate non-empty/positive.
- `Dirty/undo.`
- Save via chosen pipeline.

### Что не входит

- No create/delete.
- No sequence.
- No trigger mapping.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/level_workspace.ts`
- `src/game/world/runtime/test_campaign_registry.ts`
- `src/game/world/runtime/test_world_config.ts`
- `src/game/world/runtime/test_world_config_validation.ts`
- chosen save pipeline files

### Файлы, которые не трогать

- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`
- unselected level data

### Маленькая ли задача?

Средняя.

### Готовый prompt-кандидат

```text
Title:
Level edit name/width/height

Goal:
Edit basic level settings with validation, dirty, undo, save through confirmed pipeline.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/level_workspace.ts
- src/game/world/runtime/test_campaign_registry.ts
- src/game/world/runtime/test_world_config.ts
- src/game/world/runtime/test_world_config_validation.ts
- chosen save pipeline files

Files to create/change:
- src/tools/authoring_editor/workspaces/level_workspace.ts
- shared save/dirty files

Files not to touch:
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**
- unselected level data

Implementation requirements:
- Edit name/width/height.
- Validate non-empty/positive.
- Dirty/undo.
- Save via chosen pipeline.

Non-goals:
- No create/delete.
- No sequence.
- No trigger mapping.

Acceptance:
- Editing marks dirty.
- Invalid values blocked.
- Undo restores.
- Save persists and clears dirty.

Manual verification:
Edit/undo/save/reload.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium/high; dimensions affect world/camera.
```

---

## Task 5.3 — Open level with unsaved confirmation

**Исполнитель:** Codex.

### Что входит

- Open selected level.
- If dirty contexts exist, confirm/cancel.
- Cancel preserves current level.
- Confirm switches and resets appropriate state.

### Что не входит

- No create/delete.
- No autosave.
- No sequence.

### Файлы, которые смотреть

- `src/tools/authoring_editor/workspaces/level_workspace.ts`
- `src/tools/authoring_editor/services/dirty_contexts.ts`
- `src/game/world/runtime/test_campaign_registry.ts`
- `src/game/world/runtime/test_world_runtime.ts`

### Файлы, которые не трогать

- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Средняя/high. Split if level switching complex.

### Готовый prompt-кандидат

```text
Title:
Open level with unsaved confirmation

Goal:
Switch selected level safely with dirty confirmation.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/tools/authoring_editor/workspaces/level_workspace.ts
- src/tools/authoring_editor/services/dirty_contexts.ts
- src/game/world/runtime/test_campaign_registry.ts
- src/game/world/runtime/test_world_runtime.ts

Files to create/change:
- src/tools/authoring_editor/workspaces/level_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- runtime bridge implementation

Files not to touch:
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Open selected level.
- If dirty contexts exist, confirm/cancel.
- Cancel preserves current level.
- Confirm switches and resets appropriate state.

Non-goals:
- No create/delete.
- No autosave.
- No sequence.

Acceptance:
- Clean open switches.
- Dirty open asks confirm.
- Cancel prevents switch.
- Confirm switches without claiming save.

Manual verification:
Make unsaved edit, test open/cancel/confirm.

Expected diff size:
Small/medium; split if it grows.

Risk:
High.
```

---

## Task 5.4 — Player legacy settings audit

**Исполнитель:** Kilo CODE.

### Что входит

- Find old player settings and button 0 functionality.
- Map field label/data path/runtime effect/save behavior.
- Group into Common/Ball/Triangle/Square/Camera/Marker.

### Что не входит

- No code.
- No player behavior changes.

### Файлы, которые смотреть

- `src/game/world/runtime/test_world_editor_runtime.ts`
- `src/game/player/**`
- `src/game/world/runtime/test_world_config.ts`
- `src/game/world/runtime/test_world_config_validation.ts`
- `05_TDD_player_window.md`

### Файлы, которые не трогать

- `All source/data files; report only.`

### Маленькая ли задача?

Нет для Codex; Kilo audit.

### Готовый prompt-кандидат

```text
Title:
Player legacy settings audit

Goal:
Audit old player editor/button 0 fields before implementing Player tab.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/world/runtime/test_world_editor_runtime.ts
- src/game/player/**
- src/game/world/runtime/test_world_config.ts
- src/game/world/runtime/test_world_config_validation.ts
- 05_TDD_player_window.md

Files to create/change:
- docs/authoring/player_editor_legacy_audit.md

Files not to touch:
- All source/data files; report only.

Implementation requirements:
- Find old player settings and button 0 functionality.
- Map field label/data path/runtime effect/save behavior.
- Group into Common/Ball/Triangle/Square/Camera/Marker.

Non-goals:
- No code.
- No player behavior changes.

Acceptance:
- Report lists fields/data paths/runtime effects.
- Unknowns listed.
- Ready for Player tab implementation.

Manual verification:
Compare report with old editor UI.

Expected diff size:
One markdown report.

Risk:
Low.
```

---

## Task 5.5 — Player read-only shell

**Исполнитель:** Codex.

### Что входит

- Subsections from audit.
- Read-only current values.
- Honest unavailable states.

### Что не входит

- No edits.
- No save/undo.
- No P move.
- No reset defaults.

### Файлы, которые смотреть

- `docs/authoring/player_editor_legacy_audit.md`
- `src/tools/authoring_editor/workspaces/player_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `player/config files from audit`

### Файлы, которые не трогать

- `src/game/player/** implementation unless tiny read-only getters needed`
- `src/game/world/runtime/data/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Да/средняя.

### Готовый prompt-кандидат

```text
Title:
Player read-only shell

Goal:
Create Player tab subsections with read-only values from audit.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- docs/authoring/player_editor_legacy_audit.md
- src/tools/authoring_editor/workspaces/player_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- player/config files from audit

Files to create/change:
- src/tools/authoring_editor/workspaces/player_workspace.ts
- src/tools/authoring_editor/editor_app.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts if getters needed

Files not to touch:
- src/game/player/** implementation unless tiny read-only getters needed
- src/game/world/runtime/data/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Subsections from audit.
- Read-only current values.
- Honest unavailable states.

Non-goals:
- No edits.
- No save/undo.
- No P move.
- No reset defaults.

Acceptance:
- Player tab opens.
- Subsections work.
- Values display.
- No data changes.

Manual verification:
Compare display with audit/config.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 5.6 — Background read-only layers

**Исполнитель:** Codex.

### Что входит

- Three layers exactly.
- List objects for selected layer.
- `Select/focus.`
- Read-only inspector.

### Что не входит

- No create/edit.
- No transform.
- No scripts/tile repeat.

### Файлы, которые смотреть

- `src/game/level_authoring/background_authoring_types.ts`
- `src/scenes/runtime/test_scene_background_runtime.ts`
- `src/game/world/runtime/test_world_config.ts`
- `src/tools/authoring_editor/workspaces/background_workspace.ts`
- `04_TDD_background_window.md`

### Файлы, которые не трогать

- asset files
- `src/game/world/runtime/data/**`
- `src/game/player/**`
- `src/game/npc/**`
- `src/game/cutscene/**`

### Маленькая ли задача?

Да/средняя.

### Готовый prompt-кандидат

```text
Title:
Background read-only layers

Goal:
Show Static/Parallax 1/Parallax 2 layers and background object list.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/level_authoring/background_authoring_types.ts
- src/scenes/runtime/test_scene_background_runtime.ts
- src/game/world/runtime/test_world_config.ts
- src/tools/authoring_editor/workspaces/background_workspace.ts
- 04_TDD_background_window.md

Files to create/change:
- src/tools/authoring_editor/workspaces/background_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts if summaries needed

Files not to touch:
- asset files
- src/game/world/runtime/data/**
- src/game/player/**
- src/game/npc/**
- src/game/cutscene/**

Implementation requirements:
- Three layers exactly.
- List objects for selected layer.
- Select/focus.
- Read-only inspector.

Non-goals:
- No create/edit.
- No transform.
- No scripts/tile repeat.

Acceptance:
- Layers visible.
- Layer object list works.
- Select/focus read-only.
- No data changes.

Manual verification:
Compare with level background config.

Expected diff size:
Small/medium; split if it grows.

Risk:
Medium.
```

---

## Task 5.7 — Background editing split plan

**Исполнитель:** Kilo CODE or Codex report-only.

### Что входит

- Plan create background object.
- Plan transform.
- Plan visual fields.
- Plan parallax preview.
- Plan tile repeat.
- Plan script refs.

### Что не входит

- No implementation.
- No asset changes.
- No save.

### Файлы, которые смотреть

- `src/game/level_authoring/background_authoring_types.ts`
- `src/scenes/runtime/test_scene_background_runtime.ts`
- `src/tools/authoring_editor/workspaces/background_workspace.ts`
- `src/tools/authoring_editor/authoring_editor_runtime_bridge.ts`
- `04_TDD_background_window.md`

### Файлы, которые не трогать

- `All source/data files; report only.`

### Маленькая ли задача?

План — да; вся background editing — нет.

### Готовый prompt-кандидат

```text
Title:
Background editing split plan

Goal:
Split background create/transform/visual/parallax/tile/scripts into safe tasks.

Context:
TheFormPhaser is migrating from the legacy F2 editor to the new TDD v2 authoring editor. Keep the task small and do not implement adjacent features.

Files to inspect:
- src/game/level_authoring/background_authoring_types.ts
- src/scenes/runtime/test_scene_background_runtime.ts
- src/tools/authoring_editor/workspaces/background_workspace.ts
- src/tools/authoring_editor/authoring_editor_runtime_bridge.ts
- 04_TDD_background_window.md

Files to create/change:
- docs/authoring/background_mvp_split_plan.md

Files not to touch:
- All source/data files; report only.

Implementation requirements:
- Plan create background object.
- Plan transform.
- Plan visual fields.
- Plan parallax preview.
- Plan tile repeat.
- Plan script refs.

Non-goals:
- No implementation.
- No asset changes.
- No save.

Acceptance:
- Plan contains small Codex-ready tasks.
- Data gaps and risks explicit.

Manual verification:
Review plan before code.

Expected diff size:
One markdown report.

Risk:
Low for plan.
```
