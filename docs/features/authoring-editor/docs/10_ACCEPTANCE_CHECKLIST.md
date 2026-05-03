# 10. Acceptance Checklist

## 1. Global editor

- [ ] `F2` opens editor.
- [ ] `F2` closes editor.
- [ ] Editor appears over real Phaser level.
- [ ] No fake/placeholder viewport is used.
- [ ] Top toolbar matches mockups.
- [ ] Left and right inspectors match mockups.
- [ ] Active tab is green.
- [ ] Last active tab can be restored while session is active.
- [ ] Game speed input exists.
- [ ] Stop game/time mode exists.
- [ ] Closing editor hides grid and overlays.
- [ ] Closing editor resets editor zoom/pan to gameplay default.

## 2. Camera/grid/input

- [ ] Mouse wheel zooms editor camera.
- [ ] Middle/right drag pans editor camera.
- [ ] Grid can be shown/hidden.
- [ ] Grid size can be changed.
- [ ] Mouse world coordinates display correctly.
- [ ] Snap works when enabled.
- [ ] Typing in UI inputs does not control player.
- [ ] Canvas clicks are handled by editor while editor open.
- [ ] Live mode can allow player keyboard input as specified.

## 3. Level

- [ ] Levels list displays project levels.
- [ ] Selected level green.
- [ ] Create Level creates unique id/name.
- [ ] Delete Level asks confirmation.
- [ ] ID is read-only.
- [ ] Name/Width/Height editable.
- [ ] Save updates list/title.
- [ ] Undo reverts unsaved changes.
- [ ] Open Level loads selected level.
- [ ] Sequence editor maps exit trigger id -> level.
- [ ] Used dropdown items are excluded.
- [ ] Final screen fallback works for unmapped exit trigger.

## 4. Player

- [ ] Old player tuning fields are migrated.
- [ ] Common/Ball/Triangle/Square tabs work.
- [ ] Save/Undo works.
- [ ] Reset defaults works.
- [ ] Pressing `P` places player at mouse position as specified.
- [ ] Player spawn/runtime behavior is documented and implemented.

## 5. Objects

- [ ] Objects tab shows Platforms/Special/Objects catalogs.
- [ ] Object preset selection highlighted green.
- [ ] Left click canvas creates selected object.
- [ ] Created object selected.
- [ ] Object list updates.
- [ ] Search filters list.
- [ ] Focus centers selected object.
- [ ] Bounds inspector works.
- [ ] Drag move works.
- [ ] Resize works.
- [ ] Rotate works.
- [ ] Visual fields work.
- [ ] Collision Solid/Visual only works.
- [ ] Script pickers work.
- [ ] Edit opens Logic at script.
- [ ] Save/Undo/Lock/Del work.
- [ ] Ctrl+C/Ctrl+V work.

## 6. Background

- [ ] Static/Parallax1/Parallax2 tabs work.
- [ ] Asset list creates background object.
- [ ] Background list shows selected layer only.
- [ ] Focus works.
- [ ] Parallax X/Y works.
- [ ] Bounds/Visual/tile repeat works.
- [ ] Background renders behind gameplay.
- [ ] Save/Undo/Lock/Del work.

## 7. NPC

- [ ] Create NPC toggle works.
- [ ] Create NPC becomes green when active.
- [ ] Click level creates NPC and disables create mode.
- [ ] NPC list updates.
- [ ] Search/focus works.
- [ ] Bounds works.
- [ ] Type/collision/name works.
- [ ] Visual works.
- [ ] Spawn X/Y works.
- [ ] Default Patrol script picker works.
- [ ] Default Action script picker works.
- [ ] Alt Actions add/remove works.
- [ ] Edit opens Logic.
- [ ] Save/Undo/Lock/Del work.
- [ ] Copy/paste works as specified.

## 8. Logic

- [ ] Logic lists object scripts by Move/Rotate/Action.
- [ ] Logic lists NPC scripts by Patrol/Action/Alt Action.
- [ ] Logic lists Cutscene scripts by NPC/Camera/Player/Other.
- [ ] Add/delete script works with reference protection.
- [ ] Selected script green.
- [ ] Name edit works.
- [ ] Instructions editor works.
- [ ] Lines parse to structured commands.
- [ ] Validation errors display.
- [ ] Save writes script JSON.
- [ ] Undo reverts unsaved script.
- [ ] Scripts Users list is correct.
- [ ] Focus from users works where possible.
- [ ] Play/Pause/Stop preview works.
- [ ] Preview stop restores state.

## 9. Cutscenes

- [ ] Interactive tab works.
- [ ] Overlay tab visible but disabled.
- [ ] Cutscene list/search works.
- [ ] Add/delete cutscene works.
- [ ] Actors list appears for selected scene.
- [ ] Camera actor always exists.
- [ ] Add/remove actors works.
- [ ] Actor target dropdown lists current level entities.
- [ ] Settings name/time works.
- [ ] Start condition trigger dropdown works.
- [ ] Start condition script picker works.
- [ ] Selected actor actions add/remove works.
- [ ] Action Start Time works.
- [ ] Action script picker works.
- [ ] Edit opens Logic.
- [ ] Timeline renders dots/arrows/end dots.
- [ ] Play/Pause/Stop preview works.
- [ ] Player control disabled during interactive cutscene.
- [ ] NPC behavior overridden during cutscene.
- [ ] NPC behavior restored after cutscene.
- [ ] Validation catches missing refs and overlaps.
- [ ] Save/Undo/Lock works.

## 10. Save/validation

- [ ] Save is honest and writes canonical JSON or clearly exports.
- [ ] localStorage is not final canonical save.
- [ ] Dirty state visible.
- [ ] Switching dirty context prompts or safely preserves draft.
- [ ] Delete protection lists references.
- [ ] Missing script refs blocked.
- [ ] Missing trigger refs blocked.
- [ ] Duplicate ids blocked.
- [ ] Schema version stored.
- [ ] Reload from saved JSON recreates level.

## 11. UI fidelity

- [ ] Raw mockup files are stored in repository.
- [ ] Layout proportions match mockups closely.
- [ ] Top tabs order matches.
- [ ] Inspector titles match.
- [ ] Buttons/inputs/dropdowns match.
- [ ] Green selected states match.
- [ ] Scrollbars appear where lists overflow.
- [ ] Cutscene timeline panel matches drawn concept.
