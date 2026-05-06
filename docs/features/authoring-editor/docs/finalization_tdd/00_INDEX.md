# 00. Authoring Editor Finalization TDD Index

Этот каталог содержит отдельные технические дизайн-документы для доведения active F2 Authoring Editor до финального результата из PDF и макетов.

## Source of truth

- Product spec: `../00_FINAL_FEATURE_SPEC.md`
- Architecture: `../01_ARCHITECTURE.md`
- UI spec: `../02_UI_IMPLEMENTATION_SPEC.md`
- Data model: `../03_DATA_MODEL_AND_FILE_FORMATS.md`
- Runtime behavior: `../04_RUNTIME_BEHAVIOR.md`
- Editor modes: `../05_EDITOR_MODES.md`
- Logic DSL: `../06_LOGIC_SCRIPT_DSL.md`
- Cutscenes: `../07_CUTSCENE_SYSTEM.md`
- Save/undo/validation: `../08_SAVE_LOAD_UNDO_VALIDATION.md`
- Acceptance checklist: `../10_ACCEPTANCE_CHECKLIST.md`
- Active editor layer rule: `../11_ACTIVE_EDITOR_LAYER.md`
- Mockups index: `../UI_MOCKUPS_INDEX.md`

## Active implementation rule

Work must target the active editor layer:

```txt
src/editor/*
```

Do not implement new production behavior in:

```txt
src/game/authoring/editor_v2/*
```

That layer is frozen/reference/placeholder only.

## Execution order

1. `01_CORE_TDD.md` - shared editor systems: time, save semantics, dirty/undo, validation shell.
2. `02_LEVEL_TDD.md` - level list, level settings, open level, sequence editor.
3. `03_PLAYER_TDD.md` - player tuning editor and spawn placement.
4. `04_OBJECTS_TDD.md` - complete Objects tab: actions, rotation, save/undo, delete protection.
5. `05_BACKGROUND_TDD.md` - complete Background tab: asset picker, rotation, save/undo.
6. `06_LOGIC_TDD.md` - command/instructions editor, strict parser, refs, preview.
7. `07_NPC_TDD.md` - create/edit NPC workflow.
8. `08_CUTSCENES_TDD.md` - cutscene authoring, timeline, preview rollback.
9. `09_VALIDATION_QA_TDD.md` - full validation, acceptance automation, UI fidelity pass.
10. `10_RELEASE_DEFINITION_TDD.md` - final readiness definition and release checklist.

## Definition of done for every TDD

Each step must satisfy:

- `npm run build-nolog` passes.
- No new TypeScript errors are introduced in touched code.
- The active F2 editor still opens over the real Phaser level.
- No fake viewport is introduced.
- UI remains visually aligned with the relevant mockup.
- Existing user/runtime data is not silently dropped.
- Any new references have validation and delete protection.
- Any new file/data format changes are documented in the same TDD or linked docs.

## How to hand a TDD to Codex

Give Codex:

1. `../HANDOFF_PROMPT_FOR_CODEX.md`
2. this `00_INDEX.md`
3. the specific TDD file for the current step
4. the relevant mockup path from `../UI_MOCKUPS_INDEX.md`

Ask for one vertical slice at a time. Do not ask for multiple major tabs in one task unless the work is only a shared service needed by both.

