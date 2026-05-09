# Current Project State

## Summary
Lightweight Git-tracked workflow documentation for AI/Codex tasks.

## Active Production Editor
`src/editor`

## Data Flow
- Runtime config / level JSON is source of truth.
- ProjectStore is not canonical.
- File-based scripts use `logic_scripts.json` manifest and external JSON files.

## Current Completed/Accepted State
- level sequence basics
- level size/world bounds basics
- platform move behavior
- trigger/onEnter
- script manifest + Logic tab browser/diagnostics/users
- NPC create/select/drag/delete
- NPC patrol behavior
- NPC control mode foundation
- legacy autonomous NPC behavior disabled
- NPC interactions scoped per NPC instance

## Next Feature
**XS10.11 — NPC Default Action Runtime**