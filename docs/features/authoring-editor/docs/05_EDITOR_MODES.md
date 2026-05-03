# 05. Editor Modes

## 1. Level Mode

### Left inspector

```txt
[Levels]
[List of levels]
[Create Level] [Delete Level]
[The sequence of levels]
```

Rules:
- default selected = first level;
- selected level green;
- list scrolls;
- create level assigns new unique id and default name;
- delete asks confirmation and validates references;
- `The sequence of levels` opens sequence editor on right.

### Right inspector — selected level

```txt
[Level 3 (main)]
ID [read-only]
Name [editable]
Width [editable]
Height [editable]
[Open Level]
[Save] [Undo]
```

Rules:
- ID cannot be changed;
- Name/Width/Height are editable;
- Save updates left list and right title;
- Undo reverts unsaved changes;
- Open Level loads selected level in game.

### Right inspector — sequence

```txt
[The sequence of levels]
Start Level [dropdown]

End ID -> Level
[trigger id dropdown] [level dropdown]
...
[-] [+]
[Save] [Undo]
```

Rules:
- used trigger IDs and levels are excluded from dropdowns;
- if list is long, scroll;
- `-` removes last position;
- `+` adds empty row;
- exit trigger with no mapped level opens final screen.

## 2. Player Mode

### Left inspector

```txt
[Common]
[Ball]
[Triangle]
[Square]

[Save] [Undo]
[Reset defaults]
```

### Right inspector examples

```txt
[System]
Coyote Time sec
Jump Buffer sec

[Camera]
Follow Lerp ratio

[Marker]
Marker Move Speed px/sec
```

Rules:
- move existing old editor `button 0` functionality into this mode;
- `P` places player at mouse position while editor open;
- decide whether `P` updates runtime only or spawn too;
- recommendation: `P` moves runtime player, explicit "Set Spawn" updates spawn.

## 3. Objects Mode

### Left inspector

```txt
[Objects]
[Grid On] [16 ▼] [x,y]

[Platforms] [Special] [Objects]
[List of presets]

[Objects list]
[Search]
[List]
[Focus]
```

Rules:
- click preset selects creation tool;
- click level creates object;
- created object selected;
- list includes objects on current level;
- search filters by name;
- focus centers camera and selects object.

### Right inspector

```txt
[Bounds]
X Y Width Height Rotation

[Visual]
Shader
Texture
Fill
Stroke
Alpha
Layer
Only debug view

[Settings]
Type
Collision: Solid / Visual only

[Actions]
Move [script picker] [Edit]
Rotate [script picker] [Edit]
Default Action [dropdown]
Action 1 [script picker] [Edit]
[-] [+]

[Save] [Lock]
[Undo] [Del]
```

Rules:
- Type changes only inside object class;
- Move and Rotate scripts can run together;
- default action initially supports hazard and break wall;
- actions list extendable;
- copy/paste object supported.

## 4. Background Mode

### Left inspector

```txt
[Background]
[Grid On] [16 ▼] [x,y]

[Parallax 1] [Parallax 2] [Static]
[Objects]

[Background list]
[Search]
[List]
[Focus]

[Parallax N move]
Game parallax X
Game parallax Y
```

Rules:
- selected layer green;
- asset list comes from texture/image registry;
- click level creates background object on selected layer;
- background list shows only current layer;
- parallax fields apply to selected layer.

### Right inspector

```txt
[Bounds]
X Y Width Height Rotation

[Visual]
Shader
Texture
Fill
Stroke
Alpha
Tile horizontal repeat
Tile vertical repeat

[Save] [Lock]
[Undo] [Del]
```

Rules:
- background has no collision;
- background is behind gameplay;
- copy/paste supported.

## 5. NPC Mode

### Left inspector

```txt
[NPC]
[Grid On] [16 ▼] [x,y]
[Create NPC]
[Search]
[List of NPC on level]
[Focus]
```

Rules:
- Create NPC toggles green;
- left click level creates NPC and disables create mode;
- clicking Create NPC again cancels create mode;
- created NPC selected;
- list scrolls/searches;
- focus centers/selects NPC.

### Right inspector

```txt
[Bounds]
X Y Width Height Rotation

[Settings]
Type
Collision
Name

[Visual]
Shader
Texture
Fill
Stroke

[Action]
Spawn X/Y
Default Patrol Behaviour [script picker] [Edit]
Default Action [script picker] [Edit]
Alt Action 1 [script picker] [Edit]
[-] [+]

[Save] [Lock]
[Undo] [Del]
```

Rules:
- type controls visual/function form;
- collision mode controls player interaction;
- alt actions can be added/removed;
- copy/paste supported;
- delete validates references.

## 6. Cutscenes Mode

### Left inspector

```txt
[Cutscenes]
[Grid On] [16 ▼] [x,y]

[Cutscenes List]
[Search]
[Interactive] [Overlay]
[List]
[-] [+]

[Actors SceneName]
[Camera]
[Player]
[NPC 1]
[NPC 2]
[-] [+]

[Save] [Undo]
```

Rules:
- Interactive implemented first;
- Overlay visible but disabled until implemented;
- Camera actor always exists by default;
- actor can bind to player/NPC/object/trigger/camera;
- actor list scrolls;
- selected actor green.

### Right inspector

```txt
[SceneName]

[Settings]
Name
Time

[Start Condition]
Trigger [dropdown]
Script [script picker]

[Selected Actor]
Actor [dropdown]

[Action 1]
Start Time
Duration/Delay
Script [script picker] [Edit]
...
[-] [+]

[Save] [Lock]
[Undo]
```

Rules:
- choose trigger from current level triggers;
- actions create timeline markers;
- script edit opens Logic at that script;
- cutscene preview Play/Pause/Stop;
- player control is taken during interactive cutscene;
- NPC cutscene scripts override NPC own behavior and restore after cutscene.

## 7. Logic Mode

### Left inspector

```txt
[Logic]
[Grid On] [16 ▼] [x,y]

[Objects Scripts]
[Move] [Rotate] [Action]
[List] [-] [+]

[NPC Scripts]
[Patrol] [Action] [Alt Action]
[List] [-] [+]

[Cutscenes Scripts]
[NPC] [Camera] [Player] [Other]
[List] [-] [+]
```

### Right inspector

```txt
[Script Edit]
Name

[Instructions]
1. ...
2. ...

[Save] [Undo]

[Scripts Users]
[Search]
[List]
[Play] [Pause] [Stop]
[Focus]
```

Rules:
- opened directly or via Edit;
- via Edit selects target script and user;
- script users show all references;
- Focus centers referenced object/NPC when possible;
- focus does not work for pure cutscene reference unless actor target exists;
- Play/Pause/Stop previews script.
