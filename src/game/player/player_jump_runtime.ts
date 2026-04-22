import type { Physics } from 'phaser';
import {
    PLAYER_BALL_JUMP_CUT_MULTIPLIER,
    PLAYER_SQUARE_JUMP_CUT_MULTIPLIER,
    PLAYER_TRIANGLE_JUMP_CUT_MULTIPLIER,
    PLAYER_SQUARE_JUMP_LAUNCH_VELOCITY
} from './player_constants';
import type { PlayerInputSnapshot } from './player_input';
import { clearCoyoteTime, clearJumpBuffer, hasCoyoteTime, hasJumpBuffer, type PlayerTimers } from './player_timers';
import { applyBallJumpRuntime, tryStartBallAirRebound, type PlayerBallMutableState } from './player_ball_runtime';
import { tryStartSquareAttachJump } from './player_square_attach_jump';
import { applyTriangleJumpRuntime } from './player_triangle_runtime';
import type { BallReboundRuntimeState } from './player_ball_rebound_runtime';
import type { PlayerShellState } from './player_types';
export interface PlayerJumpMutableState extends PlayerBallMutableState {
    lastMoveDirection: -1 | 1;
}

interface HandleJumpFlowParams {
    mutable: PlayerJumpMutableState;
    state: PlayerShellState;
    timers: PlayerTimers;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    isBallForm: boolean;
    isTriangleFlightActive: boolean;
    isSquareAttached: boolean;
    isBallReboundPauseHolding: boolean;
    grounded: boolean;
    hasBoostHold: boolean;
    horizontalDir: -1 | 0 | 1;
    rawHorizontalDir: -1 | 0 | 1;
    rawVerticalDir: -1 | 0 | 1;
    preMoveVelocityX: number;
    preMoveVelocityY: number;
    ballReboundRuntime: BallReboundRuntimeState;
    onJumpCommitted?: (impulseX: number, impulseY: number) => void;
    onSquareAttachJumpCommitted?: (impulseX: number, impulseY: number) => void;
}

export const handlePlayerJumpFlow = (params: HandleJumpFlowParams): void => {
    const {
        mutable,
        state,
        timers,
        physicsBody,
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
    } = params;

    const hasCoyoteJump = hasCoyoteTime(timers);
    const canJump = grounded || hasCoyoteJump;
    const canStartSquareAttachJump = state.currentForm === 'square'
        && state.squareShell.isAttached
        && params.input.actionHeld
        && hasJumpBuffer(timers);

    if (canStartSquareAttachJump && tryStartSquareAttachJump(state.squareShell, physicsBody)) {
        const attachJumpImpulseX = state.squareShell.attachJumpState.normalX;
        const attachJumpImpulseY = state.squareShell.attachJumpState.normalY;
        mutable.jumpCutConsumed = false;
        clearJumpBuffer(timers);
        clearCoyoteTime(timers);
        params.onSquareAttachJumpCommitted?.(attachJumpImpulseX, attachJumpImpulseY);
        params.onJumpCommitted?.(attachJumpImpulseX, attachJumpImpulseY);
        return;
    }

    const canProcessJump = !isTriangleFlightActive && !isSquareAttached && !isBallReboundPauseHolding && hasJumpBuffer(timers);

    if (canProcessJump) {
        tryStartBallAirRebound({
            mutable,
            timers,
            runtime: ballReboundRuntime,
            physicsBody,
            isBallForm,
            grounded,
            hasBoostHold,
            preMoveVelocityX,
            preMoveVelocityY,
            rawHorizontalDir,
            rawVerticalDir
        });
    }

    if (!(canProcessJump && canJump && hasJumpBuffer(timers))) {
        return;
    }

    if (state.currentForm === 'triangle') {
        const triangleJumpLaunch = applyTriangleJumpRuntime(
            state,
            horizontalDir,
            mutable.lastMoveDirection
        );
        physicsBody.setVelocityY(triangleJumpLaunch.velocityY);
        mutable.jumpCutConsumed = false;
        mutable.reboundWindowMs = 0;
        clearJumpBuffer(timers);
        clearCoyoteTime(timers);
        mutable.lastAirborneDownwardSpeed = 0;
        params.onJumpCommitted?.(0, triangleJumpLaunch.velocityY);
        return;
    }

    if (isBallForm) {
        const ballJumpLaunch = applyBallJumpRuntime({
            mutable,
            physicsBody,
            timers,
            horizontalDir,
            isBallForm,
            grounded,
            hasBoostHold
        });
        params.onJumpCommitted?.(ballJumpLaunch.velocityX, ballJumpLaunch.velocityY);
        return;
    }

    physicsBody.setVelocityY(PLAYER_SQUARE_JUMP_LAUNCH_VELOCITY);
    mutable.jumpCutConsumed = false;
    mutable.reboundWindowMs = 0;
    clearJumpBuffer(timers);
    clearCoyoteTime(timers);
    mutable.lastAirborneDownwardSpeed = 0;
    params.onJumpCommitted?.(physicsBody.velocity.x, physicsBody.velocity.y);
};

interface ApplyJumpCutParams {
    mutable: PlayerJumpMutableState;
    state: PlayerShellState;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    isTriangleFlightActive: boolean;
    isSquareAttached: boolean;
}

export const applyJumpCutRuntime = (params: ApplyJumpCutParams): void => {
    const { mutable, state, physicsBody, input, isTriangleFlightActive, isSquareAttached } = params;

    if (isTriangleFlightActive || isSquareAttached || input.jumpHeld || mutable.jumpCutConsumed || physicsBody.velocity.y >= 0) {
        return;
    }

    const jumpCutMultiplier = state.currentForm === 'triangle'
        ? PLAYER_TRIANGLE_JUMP_CUT_MULTIPLIER
        : state.currentForm === 'square'
            ? PLAYER_SQUARE_JUMP_CUT_MULTIPLIER
            : PLAYER_BALL_JUMP_CUT_MULTIPLIER;
    physicsBody.setVelocityY(physicsBody.velocity.y * jumpCutMultiplier);
    mutable.jumpCutConsumed = true;
};
