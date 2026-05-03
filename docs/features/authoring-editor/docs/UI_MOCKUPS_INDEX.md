# UI Mockups Index

Этот файл фиксирует UI-макеты, которые нужно оставить в проекте и использовать как целевой reference.

## 1. Raw mockups

Исходные файлы автора лежат в:

```txt
assets/mockups_raw/
```

Эти файлы нельзя удалять. Реализацию UI нужно сверять с ними.

Ожидаемые raw files:

```txt
Frame 1 (4).png  — Editor shell / blank inspectors
Frame 2 (2).png  — Level settings
Frame 3 (1).png  — Level sequence
Frame 4 (3).png  — Player
Frame 5 (5).png  — Objects
Frame 6 (2).png  — Background
Frame 7 (4).png  — NPC
Frame 8 (1).png  — Cutscenes
Frame 9 (2).png  — Logic
78d457bf-0371-4fcc-afa8-7ecd05d534c4.png — дополнительный ранний cutscene mockup
```

## 2. Normalized mockups

Удобные имена лежат в:

```txt
assets/mockups/
```

### Editor shell

```txt
assets/mockups/editor_shell_blank_inspectors.png
```

Используется:
- `docs/00_FINAL_FEATURE_SPEC.md`
- `docs/01_ARCHITECTURE.md`
- `docs/02_UI_IMPLEMENTATION_SPEC.md`

Цель:
- показать F2 overlay;
- top toolbar;
- left/right inspectors;
- real Phaser level in center.

### Level settings

```txt
assets/mockups/level_window_settings.png
```

Используется:
- `docs/05_EDITOR_MODES.md`, Level Mode.

Цель:
- список levels слева;
- параметры выбранного level справа;
- Open Level / Save / Undo.

### Level sequence

```txt
assets/mockups/level_sequence_window.png
```

Используется:
- `docs/05_EDITOR_MODES.md`, Level Mode.

Цель:
- start level;
- trigger id -> level mapping;
- dropdowns;
- + / - rows.

### Player

```txt
assets/mockups/player_window.png
```

Используется:
- `docs/05_EDITOR_MODES.md`, Player Mode.

Цель:
- Common/Ball/Triangle/Square слева;
- System/Camera/Marker settings справа.

### Objects

```txt
assets/mockups/objects_window.png
```

Используется:
- `docs/05_EDITOR_MODES.md`, Objects Mode.

Цель:
- object catalog;
- objects list/search;
- grid/ruler;
- selected object bounds/visual/settings/actions.

### Background

```txt
assets/mockups/background_window.png
```

Используется:
- `docs/05_EDITOR_MODES.md`, Background Mode.

Цель:
- Static/Parallax tabs;
- background object placement;
- parallax movement settings;
- visual inspector.

### NPC

```txt
assets/mockups/npc_window.png
```

Используется:
- `docs/05_EDITOR_MODES.md`, NPC Mode.

Цель:
- create NPC;
- NPC list;
- bounds/settings/visual/action inspector.

### Cutscenes

```txt
assets/mockups/cutscenes_window_original.png
assets/mockups/cutscenes_window_timeline_corrected.png
```

Используется:
- `docs/07_CUTSCENE_SYSTEM.md`
- `docs/05_EDITOR_MODES.md`, Cutscenes Mode.

Цель:
- cutscene list;
- actors list;
- selected actor actions;
- timeline dots/arrows/end dots;
- Play/Pause/Stop.

Важно:
- реализация должна сохранять drawn layout автора;
- timeline can evolve, but first version must match drawn intent.

### Logic

```txt
assets/mockups/logic_window.png
```

Используется:
- `docs/06_LOGIC_SCRIPT_DSL.md`
- `docs/05_EDITOR_MODES.md`, Logic Mode.

Цель:
- scripts categories;
- instructions editor;
- scripts users;
- play/pause/stop.

## 3. Source PDF

Исходный PDF лежит в:

```txt
assets/source_spec/the_form_authoring_tools_original_spec.pdf
```

Он сохраняется как product reference.
