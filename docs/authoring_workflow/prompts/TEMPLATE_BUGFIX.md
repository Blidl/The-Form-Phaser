# TEMPLATE_BUGFIX.md

## Project Path
`<project_path>`

## Bug ID
`<bug_id>`

## Symptom
(describe observed incorrect behavior)

## Expected Behavior
(describe correct behavior)

## Evidence
(screenshot / console output / trace / manual reproduction steps)

## Scope Restriction
(fix only this bug, do not expand architecture)

## Docs to Read
- docs/authoring_workflow/CURRENT.md
- docs/authoring_workflow/DECISION_LOG.md
- docs/authoring_workflow/features/<related>.md

## Fix Only This Bug
- Do not change unrelated systems.
- Do not expand architecture.

## Reproduction Steps
1. (step 1)
2. (step 2)
3. ...

## Root-Cause Requirement
(state the root cause before fixing)

## Manual Verification Checklist
- [ ] Bug reproduces before fix
- [ ] Fix resolves symptom
- [ ] No new warnings/errors
- [ ] No regressions in related features

## Rollback/Failure Instruction
If fix is not safe, revert with:
```bash
git checkout -- <file>
```

## Validation Commands
```bash
npm run build-nolog
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Report Format
A. Preflight status
B. Evidence gathered
C. Root cause
D. Fix applied
E. Validation result
F. Rollback verification