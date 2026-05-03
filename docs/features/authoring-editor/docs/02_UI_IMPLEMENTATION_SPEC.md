# 02. UI Implementation Spec

## 1. Источник UI

Интерфейс должен реализовываться по макетам автора.

Обязательные файлы:

```txt
assets/mockups_raw/
assets/mockups/
docs/UI_MOCKUPS_INDEX.md
```

`assets/mockups_raw/` содержит исходные PNG-фреймы автора. Их нужно сохранить в репозитории рядом с ТЗ.

## 2. Общие правила UI

- Верхнее меню всегда сверху.
- Активная вкладка зеленая.
- Левый inspector фиксирован слева.
- Правый inspector фиксирован справа.
- Центр — реальный Phaser canvas/уровень.
- Панели имеют серый инструментальный стиль как на макетах.
- Кнопки `Save`, `Undo`, `Lock`, `Del`, `Focus`, `+`, `-` сохраняют визуальную логику макета.
- Dropdown, input, checkbox выглядят как простые editor controls.
- Списки scrollable, когда контент не помещается.
- Выбранный элемент списка подсвечивается зеленым.
- `Lock` становится зеленым, когда включен.
- Disabled элементы серые и не реагируют.

## 3. Top toolbar

```txt
[Level] [Player] [Objects] [Background] [NPC] [Cutscenes] [Logic]
[ ] Stop game
[1.0] Game speed
```

Rules:

- tabs switch editor mode by mouse click;
- active tab highlighted green;
- `F2` opens/closes editor;
- closing editor hides panels and overlays;
- closing editor must reset editor camera zoom/pan;
- closing editor does not permanently change game speed unless confirmed as saved setting.

## 4. Left inspector pattern

Левый inspector отвечает за:

- выбор сущностей;
- создание сущностей;
- списки;
- поиск;
- category tabs;
- focus;
- context save/undo when needed.

Pattern:

```txt
[Section title]
[Grid On] [Grid Size ▼] [x:..., y:...]

[Creation/catalog area]

[List title]
[Search]
[List]
[Focus]

[Save] [Undo]
```

Не все разделы используют все блоки.

## 5. Right inspector pattern

Правый inspector отвечает за properties selected entity/context.

Pattern:

```txt
[Context title]

[Foldable Section ▼]
fields...

[Foldable Section ▼]
fields...

[Save] [Lock]
[Undo] [Del]
```

Foldable sections:

- Bounds;
- Visual;
- Settings;
- Actions;
- Start Condition;
- Selected Actor;
- Instructions;
- Scripts Users.

## 6. Grid/ruler/coords UI

В левом inspector:

```txt
[✓ Grid On] [16 ▼] [x:231,y:580]
```

Correct spelling: `Grid On`.

`Grid size` values:

```txt
1, 8, 16, 32
```

`1` means free movement/no visible snap or effectively 1 px snap. UX label can be `Off/1`.

## 7. Viewport/canvas interactions

Mouse over canvas:

- wheel = editor zoom;
- middle mouse drag or right mouse drag = editor pan;
- left click = select/create depending on active tool;
- Shift + left click = multi-select;
- drag selected = move;
- drag handles = resize/rotate;
- empty click = clear selection.

The editor should prevent browser context menu on right click inside canvas.

## 8. Selection visuals

Selected entity:

- yellow outline;
- corner handles for resize;
- rotate handle if supported;
- bounding box;
- lock visual if locked.

Multi-select:

- combined bounding box;
- individual outlines optional;
- move allowed;
- mass scale disabled for first version;
- visual changes can apply to all selected.

## 9. Cutscene timeline UI

Target from mockup:

```txt
Timeline 0 1 2 ... 5.5

Player    red start dot -> arrow -> dark red end dot
Camera    red start dot -> arrow -> dark red end dot
NPC       red start dot -> arrow -> dark red end dot

[Play]
[Pause]
[Stop]
```

Rules:

- timeline is horizontal;
- actor rows align to Actors list;
- action start time comes from actor action `startMs`;
- arrow length comes from script duration or explicit action duration;
- dark end dot shows action end;
- initially editing through right inspector fields is acceptable;
- drag editing can be later phase.

## 10. Logic editor UI

Right panel has line-numbered instructions area.

Important:

- UI may look like text editor;
- canonical storage is structured command list;
- each line must parse/validate into supported command;
- validation errors should be visible near the line or in Validation panel;
- `Scripts Users` shows references to selected script;
- `Play/Pause/Stop` runs selected script in current level preview.

## 11. Accessibility/UX minimum

- All buttons have hover/click states.
- Inputs are keyboard-editable.
- Escape cancels creation mode and active drag.
- Delete key deletes selected entity after reference check.
- Ctrl+C/Ctrl+V copy/paste selected entity.
- Unsaved dirty state is visible.
- User is warned before destructive operations.
