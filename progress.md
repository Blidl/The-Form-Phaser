Original prompt: Реализовать production-safe first pass pair-specific form switch transition для The Form (Phaser) с одним transition proxy, commitDelay=40ms, totalDuration=140ms, без generic morph/overlay framework, сначала добиться качественного ball->triangle и только затем довести остальные пары.

- Started: canon + runtime audit completed.
- Decision: pair-specific path aligns with canon; no canon-state/work-queue patch needed, only factual orchestrator log entry after real changes.
- Implemented new pair-specific transition data layer: src/game/player/view/player_form_switch_transition_data.ts.
- Replaced old generic overlay transition runtime with single-proxy pose-parameter silhouette runtime: src/game/player/view/player_form_switch_transition.ts.
- Updated gameplay switch window timing wiring in src/game/player/player_runtime.ts to use shared transition constants (total=140ms, commit=40ms).
- Completed focused manual acceptance pass for ball->triangle using Playwright snapshots/reports in:
  - tmp/acceptance_form_switch_ball_triangle_firstpass/
  - tmp/acceptance_form_switch_ball_triangle_zoom/
  Runtime checks confirm proxy-only visual window (base form visuals hidden) and delayed gameplay commit within transition window.
- Added remaining pair data entries (triangle->square, square->ball) after ball->triangle pass.
- Skill tooling note: original $WEB_GAME_CLIENT path failed to resolve 'playwright' module from skill directory; fallback used a local temporary copy at tmp/web_game_playwright_client.local.js for equivalent Playwright loop execution.

- Reworked morph system to parameterized silhouette model (topWidth/bottomWidth/cornerHardness/bulges/apexSharpness) and replaced reverse-derived profiles with explicit 6 directional specs in src/game/player/view/player_form_switch_transition_data.ts.
- Updated transition renderer to use parameterized geometry interpolation + stable transition core rendering (no marker pop-out) in src/game/player/view/player_form_switch_transition.ts.
- Kept grounded baseline anchoring behavior and single silhouette render path (no dual-shape overlay).

- Added explicit 6-direction transition specs with pair-specific durations: triangle<->ball (160ms), ball<->square (140ms), triangle<->square (170ms).
- Transition renderer now keeps base visuals hidden during active switch and renders inner core inside the morph silhouette to avoid eye/core pop-out.
- Verification run: npm run build-nolog (pass), npm run build (pass), npx tsc --noEmit (fails with pre-existing baseline errors outside this task).
- In-engine smoke: Playwright captures generated at tmp/acceptance_form_switch_all_pairs and tmp/acceptance_form_switch_framewalk; transitions are smooth and single-silhouette, but triangle shape readability in early triangle->ball frames is still weaker than reference and needs one more tuning pass for near 1:1 match.

- Fixed NPC carry parity for non-triangle forms: NPC runtime now publishes per-frame carry delta for arcade riders, and player runtime applies that carry when ball/square are grounded on top of a moving NPC.

- Tightened arcade NPC carry detection to geometry-based support probing with a strict top-face gap, avoiding missed carry when Arcade down-contact flags momentarily drop on rider forms.

- Added dev-only NPC position exposure in src/scenes/runtime/test_scene_bootstrap.ts for targeted carry diagnostics. Build remains green (
pm run build-nolog). Automated NPC-ride smoke on the passive observer is noisy because its scripted hooks change body/focus timing; manual in-game verification is still recommended for ball/square on moving NPCs.

- Reverted NPC Arcade setImmovable(...) change after regression: block-mode NPCs started falling through to the level boundary. Carry-delta/data-tag changes remain; immovable was the unsafe part.

- Reworked Arcade player<->NPC block contact in test_world_actor_contact_runtime.ts: player-vs-NPC block pairs now use overlap + manual top/side/bottom resolution, so landing on NPC is handled like a support surface instead of default Arcade actor separation.

- Added explicit arcade NPC support state in player_runtime.ts: non-triangle forms now treat close top-face NPC contact as grounded support, snap to NPC top, zero downward velocity, and carry horizontally with the NPC.

- Added an Arcade top-support strip for block-mode NPCs and wired it into actor world colliders as a platform surface. This is the first real attempt to make NPC tops behave like moving platforms for ball/square instead of pure actor-actor contacts.

- Widened NPC top-support strip and expanded the no-side-push top zone for player-vs-NPC manual resolution. Goal: stop shoulder-clips from kicking ball/square off the NPC instead of landing on top.

- Limited player-vs-NPC side blocking to the lower 65% of the NPC body. Upper body zone now yields to the separate top-support strip so ball/square can settle on top without shoulder pushes.

- Switched to NPC strip+blocker architecture: player-vs-NPC pair collision is overlap-only; physical blocking now comes from hidden NPC lower blockers, while top riding uses hidden platform strips with carry delta data.
- 2026-04-23: Reworked player-vs-NPC contact path again to remove the unstable overlap-only pair mode. Player-NPC block pairs now go through manual top/side resolution in `test_world_actor_contact_runtime.ts`, while NPC top support strips are still wired as player world colliders (no lower blocker world collider usage).
- 2026-04-23: Fixed NPC carry snap Y bug in `player_runtime.ts`: support top is now read as `supportBody.y - supportBody.height * 0.5` instead of center Y, preventing persistent vertical oscillation from wrong snap target.
- 2026-04-23: Increased manual top-capture tolerances for player landing on NPC (`TOP_CONTACT_TOLERANCE=28`, `TOP_SUPPORT_CAPTURE=40`, `SIDE_MARGIN=40`, overlap threshold lowered) to reduce shoulder-kick rejects when approaching from above.
- 2026-04-23: Rewired world runtime NPC support provider through `npcRuntimeRef` and force-collider rebuild on NPC object rebuild so support colliders stay in sync after editor/runtime NPC recreation.
- Verification: `npm run build-nolog` passes after these changes.
- Verification: ran `tmp/npc_carry_smoke.js` and additional dynamic `tmp/npc_carry_smoke_dynamic.js`; these scripts are currently noisy/inconclusive for true ride quality due teleport setup interactions with level geometry/scripted NPC motion.
- 2026-04-23: Switched actor-contact back to strip+blocker ownership for non-triangle player: player-vs-NPC pair mode forced to `overlap`, while world colliders now include both `getNpcSupportBodies()` and `getNpcBlockerBodies()` for player actors.
- 2026-04-23: Expanded hidden NPC support/blocker widths (`+20` support, `+10` blocker) in npc runtime to reduce edge slip-through and shoulder misses.
- 2026-04-23: Tightened player carry-support detection by replacing naive overlap `find(...)` with `resolveSquareSupportIntervalFromOverlap(...)` face-compatible support resolution before applying NPC carry snap.
- Verification: `npm run build-nolog` passes after each patch set.
- 2026-04-23: Implemented "NPC behaves like floor" unification for Arcade forms: removed hidden support/blocker proxy bodies from active usage and now expose NPC `bodyObject` itself as the Arcade support collider source.
- 2026-04-23: For block-mode NPCs, `bodyObject` is now tagged with `markAsPlatformSurface(...)` so carry/support detection uses the same body shape as physical blocking.
- 2026-04-23: `getArcadePlayerBlockerBodies()` now returns empty list; blocker responsibility consolidated into the NPC body.
- Verification: build passes (`npm run build-nolog`).
- 2026-04-23: Replaced split hidden NPC support/blocker scheme with a single static Arcade follower body (`topSupportObject`) that matches NPC body size and tracks NPC position each frame.
- 2026-04-23: NPC body itself is no longer used as Arcade platform surface marker for player carry; carry + ride now come from the single follower support body to mimic floor-like static collision semantics.
- 2026-04-23: Fresh carry attempt from reverted baseline: added per-frame NPC delta capture in actor-contact runtime and applied top-face carry push (`npcDeltaX/npcDeltaY`) for player-vs-NPC Arcade pairs when player is standing on NPC top. This keeps existing collision architecture intact and avoids extra proxy bodies.
- Verification: npm run build-nolog (pass).
- 2026-04-23: New approach from clean baseline: connected NPC carry for Arcade forms via existing `externalHorizontalInfluenceX` path (instead of pair-contact pushes). NPC body is tagged as carry source in npc runtime; world runtime now detects top-support contact under player and adds NPC body velocity.x as horizontal influence.
- Verification: npm run build-nolog (pass).
- Smoke note: `tmp/npc_carry_smoke_dynamic.js` failed against current baseline because debug bridge no longer exposes `getNpcBodySnapshot`.
- 2026-04-23: Fixed residual NPC carry lag by switching from velocity-influence carry to post-NPC-update positional carry (delta-based). Added `applyNpcArcadeCarry()` in world runtime and call sites in scene frame runtime immediately after `updateNpcs(...)`.
- Carry now uses exact NPC per-frame displacement (`deltaX/deltaY`) with top-face overlap checks, then applies `player.applyActorContactPush(...)` to keep Arcade forms synced 1:1 with NPC motion.
- Removed NPC carry contribution from `resolveWindInfluenceX(...)` to avoid smoothing/accel lag and double-application.
- Verification: npm run build-nolog (pass).
- 2026-04-23: Rolled back last positional-carry experiment (`applyNpcArcadeCarry`) after regression (bounce + unstable stand-on-NPC). Restored prior carry path via `resolveWindInfluenceX` NPC velocity contribution.
- Regression cause hypothesis: positional push was applied after player physics step and after NPC movement, so next Arcade solver pass repeatedly re-resolved penetration/top-gap, producing vertical oscillation and side kick-out near edge contact.
