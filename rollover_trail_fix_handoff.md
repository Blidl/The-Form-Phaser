# Rollover / Trail fix handoff

## Root cause

There are **two separate issues** in the square rollover flow:

1. `resolveRolloverAttachCommitCandidate()` checks only `isSquareSurfacePointOnTrail(...) || trailResourceCurrent > 0`.
   That is **stricter than normal attach**. Normal attach uses `resolveTrailCompatibleAttachPose(...)`, which can snap to the nearest trail point within `PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX`.

2. During active rollover, trail painting is skipped. On successful rollover commit there is no sealing of the gap from:
   - the last painted point on the source face to the pivot corner
   - the pivot corner to the snapped target trail point on the new face

Because of this, the corner and very edge of the new face stay unsealed.

## Safe fix

Do **not** change rollover motion / timing / pivot math.

Only change the **commit validation** and add a **small trail-corner sealing step** on successful commit.

### Change 1 — make rollover commit use normal attach trail rules

In `src/game/player/player_square_rollover.ts`, inside `resolveRolloverAttachCommitCandidate()`:

- replace the manual `isSquareSurfacePointOnTrail(...)` check
- use `resolveTrailCompatibleAttachPose(...)` instead

This makes rollover use the same attach compatibility logic as regular attach, including snapping to the nearest trail point when the bar is empty.

### Change 2 — seal the corner after rollover succeeds

Before `commitSquareAttachPose(...)`, add a helper that:

- finds the nearest existing trail point on the **source face** near the pivot
- if the gap to the pivot is within `PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX`, append a tiny trail segment to the pivot
- if the snapped **target pose surface point** is within `PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX` of the pivot, append a tiny trail segment from the pivot to that target point

This fills the missing edge/corner coverage without changing rollover kinematics.

### New helper

In `src/game/player/player_square_trail.ts` add an exported helper:

`appendSquareTrailSegmentFromWorldPoints(...)`

It converts world points to support-local coordinates and reuses `appendOrMergeSweptLocalInterval(...)`.
No resource spending is needed here — this is just sealing the missing short edge/corner gap caused by rollover commit logic.

## Why this is safer than changing core rollover math

- no changes to arc sampling
- no changes to pivot selection
- no changes to collision validation timing
- only aligns rollover commit with normal attach rules
- only adds tiny trail segments near the corner, bounded by existing acquire range

## Files touched

- `src/game/player/player_square_rollover.ts`
- `src/game/player/player_square_trail.ts`
