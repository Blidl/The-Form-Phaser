# The Form - Mini Spec: NPC Carry Sync (Arcade Forms)

## Purpose
Capture a reusable fix for cases where Ball/Square stand on a moving NPC but move slower than the NPC or jitter.

## Symptom Pattern
- Triangle rides NPC correctly.
- Ball and Square stand on top, but lag behind (lower effective horizontal speed).
- In unstable variants, contact flickers and carry intermittently drops.

## Root Cause
For Arcade forms, ground carry was present, but `dragX` was still applied while grounded.
That per-step drag reduced effective carried velocity, so Ball/Square drifted behind moving NPC support.

## Production Fix (Applied)
1. Keep NPC carry in `externalHorizontalInfluenceX` path for Arcade forms.
2. In player tick, detect grounded external carry:
   - `hasGroundExternalCarry = !isTriangleForm && grounded && abs(effectiveExternalInfluenceX) > epsilon`.
3. Disable `dragX` only while this carry is active:
   - `dragX = 0` when `hasGroundExternalCarry`.
   - otherwise keep normal grounded drag.

## Concrete Implementation
- File: `src/game/player/player_tick_runtime.ts`
- Logic added near motion setup:
  - compute `effectiveExternalInfluenceX`
  - set `hasGroundExternalCarry`
  - call `physicsBody.setDragX((grounded && !hasGroundExternalCarry) ? groundedDragX : 0)`

## Supporting Stability Notes
- Keep frame order so NPC updates before player tick in scene runtime.
- For Arcade support probes on NPC top, avoid over-strict one-frame gates that can flicker.
- If needed, use short support grace (2-3 frames), but avoid late-frame positional teleports that fight Arcade separation.

## Regression Guard Checklist
- Ball on moving NPC: no visible drift after 3+ seconds.
- Square on moving NPC: no visible drift after 3+ seconds.
- Triangle behavior unchanged.
- No bounce loop and no side kick-out when stepping on NPC top.
- Build check passes: `npm run build-nolog`.

