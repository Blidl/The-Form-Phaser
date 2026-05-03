# 11. Open Decisions

Этот файл фиксирует решения, которые надо подтвердить до или во время реализации.

## 1. Save mechanism

Выбрать canonical save:

- local dev server endpoint;
- File System Access API;
- export/download JSON;
- hybrid.

Recommendation:
- abstraction first;
- dev server endpoint for real workflow.

## 2. Player `P` behavior

PDF says: pressing `P` places player at mouse position.

Need confirm:
- changes runtime position only;
- changes spawn only;
- changes both.

Recommendation:
- `P` = runtime test position;
- separate "Set Spawn Here" action = save spawn.

## 3. Cutscene action Duration field

Mockup has `Start Time`, `Duration`, `Script`.

Need confirm meaning of `Duration`:
- delay before applying script;
- action duration override;
- read-only script duration;
- wait after script.

Recommendation:
- use `Start Time` + `Script`;
- show `Script Duration` read-only;
- add `Duration Override` only if needed.

## 4. NPC copy/paste scripts

When copy/paste NPC:

Option A:
- new NPC shares same script ids.

Option B:
- new NPC duplicates scripts with new ids.

Recommendation:
- A for MVP;
- B as explicit "Duplicate with scripts" later.

## 5. UI technology

Choose DOM implementation:

- vanilla DOM;
- React;
- Svelte;
- other.

Recommendation:
- use what current project already supports;
- avoid bringing large framework unless justified.

## 6. Script editor UX

Choose first implementation:

- strict text lines with parser;
- command form list;
- hybrid.

Recommendation:
- command form list for reliability;
- text view can be generated;
- if text first, keep strict syntax.

## 7. Overlay cutscenes

Overlay tab is visible but disabled.

Need define future behavior later:
- video;
- image sequence;
- UI scene animation;
- Phaser render texture overlay.

## 8. Time scale semantics

Confirm whether `Game speed` persists after editor close.

PDF says speed saves on editor close.

Need decide:
- dev setting persists;
- runtime gameplay setting persists;
- only editor session.

Recommendation:
- editor session setting persists during session;
- explicit save if project-level.
