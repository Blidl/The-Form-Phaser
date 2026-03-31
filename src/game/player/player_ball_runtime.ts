import type { GameObjects, Physics } from 'phaser';
import {
    PLAYER_BALL_BOOST_COOLDOWN_MS,
    PLAYER_BALL_BOOST_START_IMPULSE_DECAY_MS,
    PLAYER_BALL_BOOST_START_IMPULSE_SPEED,
    PLAYER_BALL_REBOUND_FULL_APPROACH_SPEED,
    PLAYER_BALL_REBOUND_LANDING_WINDOW_MS,
    PLAYER_BALL_REBOUND_MAX_JUMP_VELOCITY,
    PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED,
    PLAYER_BALL_JUMP_LAUNCH_VELOCITY,
    PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY
} from './player_constants';
import type { PlayerInputSnapshot } from './player_input';
import { clearCoyoteTime, clearJumpBuffer, hasCoyoteTime, type PlayerTimers } from './player_timers';
import {
    applyBallReboundSurfaceInputLock,
    resetBallReboundRuntimeState,
    resolveBallReboundPreservedVelocityXForRuntime,
    tickBallReboundPauseRuntime,
    tickBallReboundSurfaceInputLock,
    tickBallWallReboundContactCoyote,
    tryStartBallSurfaceReboundRuntime,
    type BallReboundRuntimeState
} from './player_ball_rebound_runtime';
import { resolveBallGroundJumpBoostLaunch } from './player_ball_ground_jump_boost';
import { resolveBoostDirection } from './player_horizontal_motion';

export interface PlayerBallMutableState {
    jumpCutConsumed: boolean;
    boostCooldownMs: number;
    boostImpulseMs: number;
    boostActive: boolean;
    boostModeActive: boolean;
    pendingBoostRequest: boolean;
    lastMoveDirection: -1 | 1;
    reboundWindowMs: number;
    reboundJumpVelocity: number;
    lastAirborneDownwardSpeed: number;
}

export interface BallReboundTickResult {
    horizontalDir: -1 | 0 | 1;
    isPauseHolding: boolean;
    didLaunchThisFrame: boolean;
    preservedVelocityX: number | null;
}

export const syncBallBoostState = (
    mutable: PlayerBallMutableState,
    isBallForm: boolean,
    input: PlayerInputSnapshot
): void => {
    if (isBallForm && !input.actionHeld) {
        mutable.boostActive = false;
        mutable.boostImpulseMs = 0;
        mutable.pendingBoostRequest = false;
    } else if (!isBallForm) {
        mutable.boostActive = false;
        mutable.boostImpulseMs = 0;
        mutable.pendingBoostRequest = false;
    }

    mutable.boostModeActive = isBallForm && input.actionHeld;
};

export const updateBallGroundedState = (
    mutable: PlayerBallMutableState,
    runtime: BallReboundRuntimeState,
    physicsBody: Physics.Arcade.Body,
    grounded: boolean,
    justLanded: boolean
): void => {
    if (grounded) {
        mutable.jumpCutConsumed = false;
        resetBallReboundRuntimeState(runtime);
    } else if (physicsBody.velocity.y > 0) {
        mutable.lastAirborneDownwardSpeed = Math.max(mutable.lastAirborneDownwardSpeed, physicsBody.velocity.y);
    }

    if (!justLanded) {
        return;
    }

    const reboundVelocity = resolveReboundJumpVelocity(mutable.lastAirborneDownwardSpeed);
    if (reboundVelocity !== null) {
        mutable.reboundJumpVelocity = reboundVelocity;
        mutable.reboundWindowMs = PLAYER_BALL_REBOUND_LANDING_WINDOW_MS;
    } else {
        mutable.reboundWindowMs = 0;
    }

    mutable.lastAirborneDownwardSpeed = 0;
};

export const tryApplyBallBoost = (
    mutable: PlayerBallMutableState,
    physicsBody: Physics.Arcade.Body,
    grounded: boolean,
    horizontalDir: number,
    ignoreCooldown: boolean = false
): void => {
    if (!grounded || (!ignoreCooldown && mutable.boostCooldownMs > 0)) {
        return;
    }

    if (horizontalDir === 0) {
        return;
    }

    const boostDirection = resolveBoostDirection(horizontalDir, mutable.lastMoveDirection);
    physicsBody.setVelocityX(boostDirection * PLAYER_BALL_BOOST_START_IMPULSE_SPEED);
    mutable.boostCooldownMs = PLAYER_BALL_BOOST_COOLDOWN_MS;
    mutable.boostImpulseMs = PLAYER_BALL_BOOST_START_IMPULSE_DECAY_MS;
    mutable.boostActive = true;
};

interface TickBallReboundParams {
    mutable: PlayerBallMutableState;
    runtime: BallReboundRuntimeState;
    physicsBody: Physics.Arcade.Body;
    physicsSprite: GameObjects.GameObject;
    isBallForm: boolean;
    grounded: boolean;
    deltaMs: number;
    rawHorizontalDir: -1 | 0 | 1;
    rawVerticalDir: -1 | 0 | 1;
}

export const tickBallReboundRuntimeFlow = (params: TickBallReboundParams): BallReboundTickResult => {
    const {
        mutable,
        runtime,
        physicsBody,
        physicsSprite,
        isBallForm,
        grounded,
        deltaMs,
        rawHorizontalDir,
        rawVerticalDir
    } = params;

    tickBallWallReboundContactCoyote(
        runtime,
        physicsBody,
        physicsSprite,
        isBallForm,
        grounded,
        deltaMs
    );

    const reboundPausePhase = tickBallReboundPauseRuntime(
        runtime,
        physicsBody,
        isBallForm,
        grounded,
        deltaMs,
        {
            horizontalDir: rawHorizontalDir,
            verticalDir: rawVerticalDir
        }
    );

    tickBallReboundSurfaceInputLock(runtime, isBallForm, grounded, deltaMs);
    const horizontalDir = applyBallReboundSurfaceInputLock(runtime, rawHorizontalDir);

    if (horizontalDir !== 0) {
        mutable.lastMoveDirection = horizontalDir > 0 ? 1 : -1;
    }

    return {
        horizontalDir,
        isPauseHolding: reboundPausePhase === 'holding',
        didLaunchThisFrame: reboundPausePhase === 'launched',
        preservedVelocityX: resolveBallReboundPreservedVelocityXForRuntime(
            runtime,
            isBallForm,
            grounded,
            horizontalDir
        )
    };
};

interface TryStartBallAirReboundParams {
    mutable: PlayerBallMutableState;
    timers: PlayerTimers;
    runtime: BallReboundRuntimeState;
    physicsBody: Physics.Arcade.Body;
    isBallForm: boolean;
    grounded: boolean;
    hasBoostHold: boolean;
    preMoveVelocityX: number;
    preMoveVelocityY: number;
    rawHorizontalDir: -1 | 0 | 1;
    rawVerticalDir: -1 | 0 | 1;
}

export const tryStartBallAirRebound = (params: TryStartBallAirReboundParams): boolean => {
    const {
        mutable,
        timers,
        runtime,
        physicsBody,
        isBallForm,
        grounded,
        hasBoostHold,
        preMoveVelocityX,
        preMoveVelocityY,
        rawHorizontalDir,
        rawVerticalDir
    } = params;

    const hasCoyoteJump = hasCoyoteTime(timers);
    if (!isBallForm || grounded || hasCoyoteJump) {
        return false;
    }

    const started = tryStartBallSurfaceReboundRuntime(
        runtime,
        physicsBody,
        hasBoostHold,
        preMoveVelocityX,
        preMoveVelocityY,
        {
            horizontalDir: rawHorizontalDir,
            verticalDir: rawVerticalDir
        }
    );

    if (!started) {
        return false;
    }

    clearJumpBuffer(timers);
    clearCoyoteTime(timers);
    mutable.lastAirborneDownwardSpeed = 0;
    mutable.jumpCutConsumed = true;
    mutable.reboundWindowMs = 0;
    return true;
};

interface ApplyBallJumpParams {
    mutable: PlayerBallMutableState;
    physicsBody: Physics.Arcade.Body;
    timers: PlayerTimers;
    horizontalDir: -1 | 0 | 1;
    isBallForm: boolean;
    grounded: boolean;
    hasBoostHold: boolean;
}

export const applyBallJumpRuntime = (params: ApplyBallJumpParams): void => {
    const { mutable, physicsBody, timers, horizontalDir, isBallForm, grounded, hasBoostHold } = params;
    const hasCoyoteJump = hasCoyoteTime(timers);
    const hasReboundJump = grounded && mutable.reboundWindowMs > 0;
    const baseJumpVelocity = hasReboundJump ? mutable.reboundJumpVelocity : PLAYER_BALL_JUMP_LAUNCH_VELOCITY;
    const canUseGroundBoostLaunch = grounded || hasCoyoteJump;

    const ballJumpLaunch = resolveBallGroundJumpBoostLaunch({
        baseJumpVelocity,
        currentVelocityX: physicsBody.velocity.x,
        horizontalDir,
        isBallForm,
        grounded: canUseGroundBoostLaunch,
        hasBoostHold
    });

    physicsBody.setVelocity(ballJumpLaunch.velocityX, ballJumpLaunch.velocityY);
    mutable.jumpCutConsumed = hasReboundJump;
    mutable.reboundWindowMs = 0;
    clearJumpBuffer(timers);
    clearCoyoteTime(timers);
    mutable.lastAirborneDownwardSpeed = 0;
};

export const queueOrApplyBallActionBoost = (
    mutable: PlayerBallMutableState,
    physicsBody: Physics.Arcade.Body,
    input: PlayerInputSnapshot,
    isBallForm: boolean,
    grounded: boolean,
    horizontalDir: -1 | 0 | 1
): void => {
    if (!input.actionPressed || !isBallForm) {
        return;
    }

    if (grounded) {
        tryApplyBallBoost(mutable, physicsBody, grounded, horizontalDir);
        return;
    }

    mutable.pendingBoostRequest = true;
};

export const tryConsumeQueuedGroundBoost = (
    mutable: PlayerBallMutableState,
    physicsBody: Physics.Arcade.Body,
    input: PlayerInputSnapshot,
    isBallForm: boolean,
    justLanded: boolean,
    grounded: boolean,
    horizontalDir: -1 | 0 | 1
): void => {
    if (!isBallForm || !justLanded || !mutable.pendingBoostRequest || !input.actionHeld) {
        return;
    }

    tryApplyBallBoost(mutable, physicsBody, grounded, horizontalDir, true);
    if (mutable.boostActive) {
        mutable.pendingBoostRequest = false;
    }
};

const resolveReboundJumpVelocity = (approachSpeed: number): number | null => {
    if (approachSpeed < PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED) {
        return null;
    }

    const range = PLAYER_BALL_REBOUND_FULL_APPROACH_SPEED - PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED;
    const clampedAlpha = range <= 0
        ? 1
        : Math.max(0, Math.min(1, (approachSpeed - PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED) / range));

    return PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY
        + ((PLAYER_BALL_REBOUND_MAX_JUMP_VELOCITY - PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY) * clampedAlpha);
};
