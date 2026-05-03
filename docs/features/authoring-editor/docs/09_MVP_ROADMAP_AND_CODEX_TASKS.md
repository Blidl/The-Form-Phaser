# 09. MVP Roadmap and Codex Tasks

## 1. Правило реализации

Не делать giant rewrite.

Каждый этап должен давать visible result и проходить acceptance checklist.

## 2. Phase 0 — Audit old editor

Goal:
- понять текущий editor/old button `0`;
- составить parity checklist;
- решить, что переносится в новый editor.

Deliverable:

```txt
docs/old_editor_parity_checklist.md
```

Acceptance:
- old features mapped to new tabs;
- old editor still works;
- no rewrite yet.

## 3. Phase 1 — Editor Shell

Tasks:
- F2 open/close;
- top toolbar;
- tabs;
- left/right fixed panels;
- active tab green;
- time controls;
- editor camera zoom/pan;
- reset camera on close;
- grid/ruler/coords overlay.

Acceptance:
- editor opens over real level;
- no fake viewport;
- mouse wheel zoom works;
- pan works;
- grid can be shown/hidden.

Codex prompt:

```txt
Implement new EditorShell for TheFormPhaser. It must open/close with F2 over the existing Phaser level. Do not create a separate fake viewport. Use DOM for toolbar/left/right panels and Phaser overlays for grid/ruler/coords. Add tabs Level, Player, Objects, Background, NPC, Cutscenes, Logic. Active tab green. Add time controls Stop game and Game speed. Keep implementation modular.
```

## 4. Phase 2 — Shared selection and overlays

Tasks:
- SelectionSystem;
- click select;
- empty click clear;
- Shift multi-select skeleton;
- selection outline;
- focus selected;
- TransformGizmo base.

Acceptance:
- can select existing object on level;
- outline visible;
- Focus centers camera.

## 5. Phase 3 — Objects MVP

Tasks:
- left catalog;
- create object;
- object list/search;
- bounds inspector;
- drag move with snap;
- Save/Undo context;
- lock/delete.

Acceptance:
- create platform;
- move/resize basic;
- save writes JSON or export;
- reload uses saved object.

## 6. Phase 4 — Object Visual/Actions

Tasks:
- fill/stroke/alpha/layer;
- texture/shader picker;
- only debug view;
- type/collision;
- script pickers for Move/Rotate/Actions;
- Edit button opens Logic.

Acceptance:
- visual changes apply and save;
- script refs validate.

## 7. Phase 5 — Background

Tasks:
- layers Static/Parallax1/Parallax2;
- asset list;
- background list;
- parallax X/Y;
- bounds/visual/tile repeat;
- save/load.

Acceptance:
- place background image;
- parallax works at runtime/editor preview.

## 8. Phase 6 — NPC

Tasks:
- Create NPC toggle;
- NPC list/search/focus;
- bounds/settings/visual/action inspector;
- script refs for patrol/action/alt;
- copy/paste behavior.

Acceptance:
- create NPC;
- assign script;
- save/reload;
- delete protection.

## 9. Phase 7 — Logic Scripts

Tasks:
- script categories/lists;
- create/delete scripts;
- command registry;
- line-based editor or command form;
- parse/validate;
- Save/Undo;
- Scripts Users;
- Play/Pause/Stop preview.

Acceptance:
- create simple move script;
- assign to object/NPC;
- play preview;
- users list shows reference.

## 10. Phase 8 — Cutscenes

Tasks:
- cutscene list;
- actors list;
- settings/start condition;
- actor actions;
- timeline renderer;
- script edit integration;
- preview Play/Pause/Stop;
- validation;
- runtime trigger.

Acceptance:
- create scene with camera/player/NPC;
- run timeline;
- player control disabled during interactive cutscene;
- NPC resumes behavior after scene.

## 11. Phase 9 — Level management

Tasks:
- levels list;
- create/delete level;
- edit name/width/height;
- open level;
- sequence editor;
- final screen fallback.

Acceptance:
- create level;
- open it;
- set sequence trigger->level;
- save/reload project.

## 12. Phase 10 — Polish and hardening

Tasks:
- dirty prompts;
- validation panel;
- robust delete dialogs;
- copy/paste full behavior;
- error toasts;
- UI polish to match mockups;
- performance pass;
- keyboard shortcuts.

Acceptance:
- TDD checklist passes;
- no known broken references;
- no fake UI remaining.

## 13. Codex working rules

Tell Codex:

- read current TDD file first;
- do not implement unrelated tabs;
- do not change gameplay architecture unless necessary;
- avoid large rewrites;
- keep runtime/editor separation;
- add/extend types before behavior;
- add validation for new references;
- use mockups as fixed UI reference.
