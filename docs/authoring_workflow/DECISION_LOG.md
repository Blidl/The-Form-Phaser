# Decision Log

## Pipeline
- Active editor/runtime pipeline only.
- Production editor layer is `src/editor`.
- Do not implement new production features in `src/game/authoring/editor_v2`.
- Old editor/runtime sidebar may be used only as reference, not as production feature target.

## Data Architecture
- Do not make ProjectStore canonical.
- Runtime config / level JSON remains source of truth.

## Scripts
- Scripts are authored in IDE/project files, not in browser editor.
- Browser editor assigns, validates, reloads, previews, and shows diagnostics/users.
- External script refs use script ids, not file paths.
- Runtime/debug/trace/control state must not be saved/exported.

## NPC Behavior
- NPC behaviorScripts replace old autonomous/profile/scriptedLoop behavior.
- NPC without explicit new behavior should not run legacy autonomous behavior.
- NPC control mode foundation exists for future cutscene/forced action ownership.
- Cutscene must be able to take over NPC control later.

## Process
- Codex/Kilo must not commit unless explicitly instructed.