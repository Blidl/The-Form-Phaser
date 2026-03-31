import {
    clearSquareAttachEntryBuffer,
    pushJumpBuffer,
    pushSquareAttachEntryBuffer,
    refreshCoyoteTime,
    tickPlayerTimers
} from './player_timers';
import { resolveSquareAttachEntryBufferDirective } from './state/player_form_state_guards';
import { stopTriangleFlight } from './player_triangle_flight';
import { tickTriangleFlightResourceRuntime, prepareTriangleFlightRuntime, tryStartTriangleFlightRuntime, applyTriangleFlightMovement, tickTriangleOrientationRuntime, tickTriangleFlightActiveRuntime } from './player_triangle_runtime';
import { tickSquareRuntime, applySquareAttachedMovement, applySquareDetachedTrailRefund } from './player_square_runtime';
import { syncBallBoostState, updateBallGroundedState, tryApplyBallBoost, tickBallReboundRuntimeFlow, queueOrApplyBallActionBoost, tryConsumeQueuedGroundBoost } from './player_ball_runtime';
import { resolveEffectiveExternalInfluenceX, resolvePlayerMotionFlags, applyPauseOrLaunchMovement, applyCommonHorizontalMotion } from './player_motion_runtime';
import { handlePlayerJumpFlow, applyJumpCutRuntime } from './player_jump_runtime';
import { tickPlayerMarkerState } from './marker/player_marker_runtime';
import { resetTriangleCollisionState } from './geometry/player_triangle_collision_runtime';
import { applyPlayerVerticalProfile } from './player_vertical_profile_runtime';
import type { PlayerTickRuntimeContext } from './player_runtime_types';

export const tickPlayerRuntime = (context: PlayerTickRuntimeContext): void => {
    const { state, timers, physicsBody, input, deltaMs, ballReboundRuntime } = context;
    const deltaSec = deltaMs / 1000;

    context.handleFormSwitch();
    context.refreshTrianglePhysicsState();

    const isTriangleForm = state.currentForm === 'triangle';
    const isBallForm = state.currentForm === 'ball';
    const isSquareForm = state.currentForm === 'square';

    const grounded = isTriangleForm
        ? state.triangleCollision.hasGroundContact && state.triangleCollision.groundSupportEdgeIndex !== null
        : physicsBody.blocked.down || physicsBody.touching.down;
    physicsBody.setDragX(grounded ? context.groundedDragX : 0);
    const justLanded = grounded && !context.mutable.wasGrounded;
    if (grounded) {
        refreshCoyoteTime(timers);
    }

    updateBallGroundedState(context.mutable, ballReboundRuntime, physicsBody, grounded, justLanded);

    tickTriangleFlightResourceRuntime({
        state,
        grounded,
        deltaSec,
        isTriangleForm
    });

    syncBallBoostState(context.mutable, isBallForm, input);

    if (input.jumpPressed) {
        pushJumpBuffer(timers);
    }

    const preMoveVelocityX = physicsBody.velocity.x;
    const preMoveVelocityY = physicsBody.velocity.y;

    const squareAttachEntryBufferDirective = resolveSquareAttachEntryBufferDirective({
        currentForm: state.currentForm,
        actionPressed: input.actionPressed,
        actionHeld: input.actionHeld
    });
    if (squareAttachEntryBufferDirective.shouldPushEntryBuffer) {
        pushSquareAttachEntryBuffer(timers);
    }
    if (squareAttachEntryBufferDirective.shouldClearEntryBuffer) {
        clearSquareAttachEntryBuffer(timers);
    }

    const rawHorizontalDir = ((input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0)) as -1 | 0 | 1;
    const rawVerticalDir = ((input.moveDown ? 1 : 0) - (input.moveUp ? 1 : 0)) as -1 | 0 | 1;

    tickPlayerMarkerState(state.marker, state, input, deltaSec);

    if (isBallForm && grounded && input.actionHeld && !context.mutable.boostActive && rawHorizontalDir !== 0) {
        tryApplyBallBoost(context.mutable, physicsBody, grounded, rawHorizontalDir);
    }

    const reboundTick = tickBallReboundRuntimeFlow({
        mutable: context.mutable,
        runtime: ballReboundRuntime,
        physicsBody,
        physicsSprite: context.physicsSprite,
        isBallForm,
        grounded,
        deltaMs,
        rawHorizontalDir,
        rawVerticalDir
    });

    const horizontalDir = reboundTick.horizontalDir;
    const isBallReboundPauseHolding = reboundTick.isPauseHolding;
    const didLaunchBallReboundThisFrame = reboundTick.didLaunchThisFrame;
    const preservedReboundVelocityX = reboundTick.preservedVelocityX;

    let isTriangleFlightActive = isTriangleForm && state.triangleFlight.isActive;

    prepareTriangleFlightRuntime({
        state,
        input,
        isTriangleForm
    });

    if (isSquareForm) {
        tickSquareRuntime({
            state,
            timers,
            physicsBody,
            input,
            deltaMs,
            deltaSec,
            horizontalDir,
            resolveSquareTrailSurfacePoint: context.resolveSquareTrailSurfacePoint,
            querySquareAttachPose: context.querySquareAttachPose
        });
    }

    const flightStartedThisFrame = tryStartTriangleFlightRuntime({
        state,
        physicsBody,
        input,
        grounded,
        isTriangleForm,
        onFlightStarted: () => {
            context.mutable.jumpCutConsumed = false;
        }
    });
    if (flightStartedThisFrame) {
        isTriangleFlightActive = true;
    }

    const hasBoostHold = context.mutable.boostActive && input.actionHeld;
    const effectiveExternalInfluenceX = resolveEffectiveExternalInfluenceX({
        grounded,
        externalHorizontalInfluenceX: context.externalHorizontalInfluenceX
    });
    const motionFlags = resolvePlayerMotionFlags({
        state,
        isSquareForm
    });
    if (motionFlags.invalidTriangleFlightOutsideTriangle) {
        stopTriangleFlight(state.triangleFlight);
    }
    const isSquareAttached = motionFlags.isSquareAttached;
    const isSquareTrailRegenerating = motionFlags.isSquareTrailRegenerating;
    const isSquareAttachJumpActive = motionFlags.isSquareAttachJumpActive;
    physicsBody.setAllowGravity(
        !isTriangleFlightActive
        && !isSquareAttached
        && !isBallReboundPauseHolding
        && !isSquareTrailRegenerating
        && !isSquareAttachJumpActive
    );

    if (isTriangleFlightActive) {
        applyTriangleFlightMovement(state, physicsBody);
    } else if (applyPauseOrLaunchMovement(physicsBody, isBallReboundPauseHolding, didLaunchBallReboundThisFrame)) {
        // Pause/launch branch already applied.
    } else if (isSquareAttached || isSquareTrailRegenerating || isSquareAttachJumpActive) {
        applySquareAttachedMovement(physicsBody, state, input);
    } else {
        applyCommonHorizontalMotion({
            mutable: context.mutable,
            physicsBody,
            state,
            grounded,
            isBallForm,
            hasBoostHold,
            horizontalDir,
            deltaSec,
            effectiveExternalInfluenceX,
            preservedReboundVelocityX
        });
    }

    tickTriangleOrientationRuntime({
        state,
        grounded,
        justLanded,
        horizontalDir,
        horizontalVelocityX: physicsBody.velocity.x,
        deltaSec,
        isTriangleForm,
        isTriangleFlightActive
    });

    handlePlayerJumpFlow({
        mutable: context.mutable,
        state,
        timers,
        physicsBody,
        input,
        isBallForm,
        isTriangleFlightActive,
        isSquareAttached,
        isBallReboundPauseHolding,
        grounded,
        hasBoostHold,
        horizontalDir,
        rawHorizontalDir,
        rawVerticalDir,
        preMoveVelocityX,
        preMoveVelocityY,
        ballReboundRuntime
    });

    applyJumpCutRuntime({
        mutable: context.mutable,
        state,
        physicsBody,
        input,
        isTriangleFlightActive,
        isSquareAttached
    });

    applyPlayerVerticalProfile({
        state,
        physicsBody,
        input,
        grounded,
        isTriangleFlightActive,
        isSquareAttached,
        isBallReboundPauseHolding
    });

    queueOrApplyBallActionBoost(context.mutable, physicsBody, input, isBallForm, grounded, horizontalDir);
    tryConsumeQueuedGroundBoost(context.mutable, physicsBody, input, isBallForm, justLanded, grounded, horizontalDir);

    tickTriangleFlightActiveRuntime({
        state,
        physicsBody,
        input,
        deltaSec
    });

    if (isTriangleForm) {
        const transformLockMs = context.getTransformLockMs();
        if (transformLockMs <= 0) {
            context.commitTrianglePhysicsState(deltaSec);
        }
    } else {
        resetTriangleCollisionState(state.triangleCollision);
    }

    context.mutable.reboundWindowMs = Math.max(0, context.mutable.reboundWindowMs - deltaMs);
    context.mutable.boostCooldownMs = Math.max(0, context.mutable.boostCooldownMs - deltaMs);
    context.mutable.boostImpulseMs = Math.max(0, context.mutable.boostImpulseMs - deltaMs);
    tickPlayerTimers(timers, deltaMs);
    applySquareDetachedTrailRefund(state, deltaMs);
    context.mutable.wasGrounded = isTriangleForm
        ? state.triangleCollision.hasGroundContact
        : grounded;
};
