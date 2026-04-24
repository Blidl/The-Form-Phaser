import {
    PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY,
    PLAYER_START_FORM,
    PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS
} from './player_constants';
import {
    clearCoyoteTime,
    clearJumpBuffer,
    clearSquareAttachEntryBuffer
} from './player_timers';
import { getNextPlayerForm, getPrevPlayerForm } from './player_form_switch';
import {
    resetTriangleShellState
} from './player_triangle_shell';
import {
    resetSquareShellState
} from './player_square_shell';
import { clearSquareAttach } from './player_square_attach';
import {
    resetTriangleFlightState,
    stopTriangleFlight
} from './player_triangle_flight';
import { clampPlayerMarkerStateToForm, resetPlayerMarkerState } from './marker/player_marker_runtime';
import { resetTriangleCollisionState } from './geometry/player_triangle_collision_runtime';
import {
    resolveFormSwitchDecision,
    resolveFormTransitionResetDirective,
    resolveFreezeResetDirective,
    resolveRespawnResetDirective
} from './state/player_form_state_guards';
import { resetBallReboundRuntimeState } from './player_ball_rebound_runtime';
import type { PlayerInputSnapshot } from './player_input';
import type { PlayerLifecycleRuntimeContext } from './player_runtime_types';
import type { PlayerFormId } from './player_types';

export const freezePlayerForRespawn = (context: PlayerLifecycleRuntimeContext): void => {
    const freezeDirective = resolveFreezeResetDirective();
    context.mutable.frozenForRespawn = freezeDirective.shouldFreezeRespawnState;
    context.view.hideTransientMarkers();

    if (freezeDirective.shouldResetTriangleFlight) {
        resetTriangleFlightState(context.state.triangleFlight);
    }
    resetTriangleCollisionState(context.state.triangleCollision);
    if (freezeDirective.shouldClearAirborneWindDrift) {
        context.mutable.airborneWindDriftX = 0;
    }
    context.mutable.presentationPrevGrounded = false;
    context.mutable.presentationPrevVerticalSpeed = 0;
    context.mutable.presentationApexEmitted = false;
    context.mutable.presentationFallEmitted = false;
    context.mutable.presentationPrevTriangleFlightActive = false;
    context.mutable.presentationPrevSquareAttached = false;

    resetBallReboundRuntimeState(context.ballReboundRuntime);
    context.physicsBody.setVelocity(0, 0);
    context.physicsBody.setAcceleration(0, 0);
    context.physicsBody.setAllowGravity(false);
    context.physicsBody.checkCollision.none = false;
    context.applyCurrentFormCollisionBody();
    context.resetVisualPose();
};

export const respawnPlayerAt = (
    context: PlayerLifecycleRuntimeContext,
    x: number,
    y: number
): void => {
    const respawnDirective = resolveRespawnResetDirective(PLAYER_START_FORM);
    context.state.currentForm = respawnDirective.nextForm;
    resetPlayerMarkerState(context.state.marker);

    if (respawnDirective.resetTriangleShell) {
        resetTriangleShellState(context.state.triangleShell, 1);
    }
    resetTriangleCollisionState(context.state.triangleCollision);
    if (respawnDirective.resetSquareShell) {
        resetSquareShellState(context.state.squareShell);
    }
    if (respawnDirective.resetTriangleFlight) {
        resetTriangleFlightState(context.state.triangleFlight);
    }

    if (respawnDirective.resetJumpCutConsumed) {
        context.mutable.jumpCutConsumed = false;
    }
    if (respawnDirective.resetBoostCooldown) {
        context.mutable.boostCooldownMs = 0;
    }
    if (respawnDirective.resetBoostActive) {
        context.mutable.boostActive = false;
        context.mutable.boostModeActive = false;
    }
    if (respawnDirective.resetPendingBoostRequest) {
        context.mutable.pendingBoostRequest = false;
    }
    if (respawnDirective.resetWasGrounded) {
        context.mutable.wasGrounded = false;
    }
    if (respawnDirective.resetLastMoveDirection) {
        context.mutable.lastMoveDirection = 1;
    }
    if (respawnDirective.resetReboundWindow) {
        context.mutable.reboundWindowMs = 0;
    }
    if (respawnDirective.resetReboundJumpVelocity) {
        context.mutable.reboundJumpVelocity = PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY;
    }
    if (respawnDirective.resetLastAirborneDownwardSpeed) {
        context.mutable.lastAirborneDownwardSpeed = 0;
    }

    resetBallReboundRuntimeState(context.ballReboundRuntime);
    if (respawnDirective.resetAirborneWindDrift) {
        context.mutable.airborneWindDriftX = 0;
    }
    context.mutable.presentationPrevGrounded = false;
    context.mutable.presentationPrevVerticalSpeed = 0;
    context.mutable.presentationApexEmitted = false;
    context.mutable.presentationFallEmitted = false;
    context.mutable.presentationPrevTriangleFlightActive = false;
    context.mutable.presentationPrevSquareAttached = false;

    if (respawnDirective.clearJumpBuffer) {
        clearJumpBuffer(context.timers);
    }
    if (respawnDirective.clearSquareAttachEntryBuffer) {
        clearSquareAttachEntryBuffer(context.timers);
    }
    if (respawnDirective.clearCoyoteTime) {
        clearCoyoteTime(context.timers);
    }
    if (respawnDirective.resetTransformLock) {
        context.timers.transformLockMs = 0;
    }
    if (respawnDirective.resetDeathPause) {
        context.timers.deathPauseMs = 0;
    }

    context.physicsBody.setAllowGravity(true);
    context.physicsBody.checkCollision.none = false;
    context.physicsBody.setVelocity(0, 0);
    context.physicsBody.setAcceleration(0, 0);
    context.physicsBody.reset(x, y);

    context.mutable.frozenForRespawn = !respawnDirective.unfreezeRespawnState;
    context.applyCurrentFormCollisionBody();
    context.resetVisualPose();
    context.applyCurrentFormVisual();
    context.syncVisualPosition();
};

export const handlePlayerFormSwitch = (
    context: PlayerLifecycleRuntimeContext,
    input: PlayerInputSnapshot
): void => {
    const switchDecision = resolveFormSwitchDecision({
        currentForm: context.state.currentForm,
        transformLockMs: context.timers.transformLockMs,
        wantsNextForm: input.nextFormPressed,
        wantsPrevForm: input.prevFormPressed,
        nextForm: getNextPlayerForm(context.state.currentForm),
        prevForm: getPrevPlayerForm(context.state.currentForm)
    });

    if (!switchDecision.shouldSwitch) {
        return;
    }

    commitPlayerFormSwitch(context, switchDecision.targetForm, switchDecision.shouldApplyTransformLock);
};

export const commitPlayerFormSwitch = (
    context: PlayerLifecycleRuntimeContext,
    targetForm: PlayerFormId,
    shouldApplyTransformLock: boolean = true
): void => {
    const previousForm = context.state.currentForm;
    context.state.currentForm = targetForm;
    context.notifyFormSwitchIn(previousForm, targetForm);

    if (shouldApplyTransformLock) {
        context.timers.transformLockMs = PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS;
    }

    const transitionReset = resolveFormTransitionResetDirective(previousForm, targetForm);
    clampPlayerMarkerStateToForm(context.state.marker, targetForm);
    if (transitionReset.resetTriangleShell) {
        resetTriangleShellState(context.state.triangleShell, context.mutable.lastMoveDirection);
    }
    resetTriangleCollisionState(context.state.triangleCollision);
    if (transitionReset.resetTriangleFlight) {
        resetTriangleFlightState(context.state.triangleFlight);
    } else if (transitionReset.stopTriangleFlight) {
        stopTriangleFlight(context.state.triangleFlight);
    }
    if (transitionReset.resetSquareShell) {
        resetSquareShellState(context.state.squareShell);
    }
    if (transitionReset.clearSquareAttach) {
        clearSquareAttach(context.state.squareShell);
    }

    resetBallReboundRuntimeState(context.ballReboundRuntime);
    context.mutable.presentationApexEmitted = false;
    context.mutable.presentationFallEmitted = false;
    context.mutable.presentationPrevTriangleFlightActive = false;
    context.mutable.presentationPrevSquareAttached = false;
    context.physicsBody.setAllowGravity(true);
    context.physicsBody.checkCollision.none = false;
    context.applyCurrentFormCollisionBody();
    context.applyCurrentFormVisual();
    context.syncVisualPosition();
};
