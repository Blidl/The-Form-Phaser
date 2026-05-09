# TEMPLATE_IMPLEMENT.md

## Project Path
`<project_path>`

## Task ID/Name
`<task_id> — <title>`

## Preflight Git Status
```bash
git status --short
```
Stop if working tree is dirty.

## Docs to Read
- docs/authoring_workflow/CURRENT.md
- docs/authoring_workflow/DECISION_LOG.md
- docs/authoring_workflow/features/<task_id>.md
- Relevant TDD docs in docs/canon/

## Scope
(list scoped items)

## Non-Goals
(list excluded items)

## Hard Constraints
- Docs only.
- Do not touch src/editor.
- Do not touch src/game.
- Do not touch src/game/authoring/editor_v2.
- Do not touch package.json.
- Do not modify existing TDD files.
- Do not change runtime/editor/game code.
- Do not commit.

## Validation Commands
```bash
npm run build-nolog
git status --short
git diff --stat
git diff --name-only
git diff --check
git diff --name-only -- src/game/authoring/editor_v2
```

## Report Format
A. Preflight status
B. Docs read
C. Summary
D. Files changed
E. Behavior implemented
F. Save/export safety
G. Build/validation result
H. Final status
I. Manual checks
J. Known limitations