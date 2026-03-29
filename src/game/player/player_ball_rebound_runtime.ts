import { GameObjects, Physics } from 'phaser';
import {
    PLAYER_AIR_MOVE_SPEED,
    PLAYER_BALL_REBOUND_BOOST_STRENGTH_MULTIPLIER,
    PLAYER_BALL_CEILING_REBOUND_MIN_DOWNWARD_SPEED,
    PLAYER_BALL_CEILING_REBOUND_MIN_EXIT_SPEED,
    PLAYER_BALL_REBOUND_PAUSE_BEFORE_LAUNCH_MS,
    PLAYER_BALL_REBOUND_SURFACE_INPUT_LOCK_MS,
    PLAYER_BALL_WALL_REBOUND_COYOTE_MS,
    PLAYER_BALL_WALL_REBOUND_FALLBACK_UPWARD_BIAS,
    PLAYER_BALL_WALL_REBOUND_MIN_EXIT_SPEED,
    PLAYER_BALL_WALL_REBOUND_MIN_INTO_WALL_SPEED
} from './player_constants';
import {
    applyMinimumCeilingReboundDownwardSpeed,
    applyMinimumReboundSpeed,
    resolveBallWallContactReboundDirection
} from './player_ball_rebound';
import {
    createBallReboundTrajectoryState,
    resetBallReboundTrajectoryState,
    resolveBallReboundPreservedVelocityX,
    startBallReboundTrajectory,
    type BallReboundTrajectoryState
} from './player_ball_rebound_trajectory';
import {
    createBallReboundPauseState,
    resetBallReboundPauseState,
    startBallReboundPause,
    tickBallReboundPause,
    type BallReboundPauseState,
    type BallReboundSurfaceType
} from './player_ball_rebound_pause';
import {
    resolveWallReboundSteerVector,
    type BallReboundSteerInput,
    type BallReboundSteerVector
} from './player_ball_rebound_steering';

export interface BallReboundRuntimeState {
    wallReboundCoyoteMs: number;
    wallReboundNormalX: -1 | 1;
    trajectoryState: BallReboundTrajectoryState;
    pauseState: BallReboundPauseState;
    surfaceInputLockMs: number;
    surfaceInputBlockedHorizontalDir: -1 | 0 | 1;
    surfaceInputRequiresRelease: boolean;
}

export type BallReboundPausePhase = 'inactive' | 'holding' | 'launched';

interface BallSurfaceReboundCandidate {
    surface: BallReboundSurfaceType;
    wallNormalX: -1 | 1;
    steerVector: BallReboundSteerVector | null;
}

export function createBallReboundRuntimeState(): BallReboundRuntimeState {
    return {
        wallReboundCoyoteMs: 0,
        wallReboundNormalX: -1,
        trajectoryState: createBallReboundTrajectoryState(),
        pauseState: createBallReboundPauseState(),
        surfaceInputLockMs: 0,
        surfaceInputBlockedHorizontalDir: 0,
        surfaceInputRequiresRelease: false
    };
}

export function resetBallReboundRuntimeState(state: BallReboundRuntimeState): void {
    state.wallReboundCoyoteMs = 0;
    state.wallReboundNormalX = -1;
    resetBallReboundTrajectoryState(state.trajectoryState);
    resetBallReboundPauseState(state.pauseState);
    state.surfaceInputLockMs = 0;
    state.surfaceInputBlockedHorizontalDir = 0;
    state.surfaceInputRequiresRelease = false;
}

export function clearBallReboundTrajectoryOnHorizontalInput(state: BallReboundRuntimeState): void {
    resetBallReboundTrajectoryState(state.trajectoryState);
}

export function tickBallReboundSurfaceInputLock(
    state: BallReboundRuntimeState,
    isBallForm: boolean,
    grounded: boolean,
    deltaMs: number
): void {
    if (!isBallForm || grounded) {
        state.surfaceInputLockMs = 0;
        state.surfaceInputBlockedHorizontalDir = 0;
        state.surfaceInputRequiresRelease = false;
        return;
    }

    state.surfaceInputLockMs = Math.max(0, state.surfaceInputLockMs - deltaMs);
    if (state.surfaceInputLockMs <= 0 && !state.surfaceInputRequiresRelease) {
        state.surfaceInputBlockedHorizontalDir = 0;
    }
}

export function applyBallReboundSurfaceInputLock(
    state: BallReboundRuntimeState,
    horizontalDir: -1 | 0 | 1
): -1 | 0 | 1 {
    const blockedDir = state.surfaceInputBlockedHorizontalDir;
    if (blockedDir === 0) {
        return horizontalDir;
    }

    const isHoldingBlockedDirection = horizontalDir === blockedDir;
    if (state.surfaceInputRequiresRelease) {
        if (isHoldingBlockedDirection) {
            return 0;
        }

        state.surfaceInputRequiresRelease = false;
        if (state.surfaceInputLockMs <= 0) {
            state.surfaceInputBlockedHorizontalDir = 0;
        }
        return horizontalDir;
    }

    if (state.surfaceInputLockMs <= 0) {
        state.surfaceInputBlockedHorizontalDir = 0;
        return horizontalDir;
    }

    if (isHoldingBlockedDirection) {
        return 0;
    }

    return horizontalDir;
}

export function resolveBallReboundPreservedVelocityXForRuntime(
    state: BallReboundRuntimeState,
    isBallForm: boolean,
    grounded: boolean,
    horizontalDir: number
): number | null {
    return resolveBallReboundPreservedVelocityX(state.trajectoryState, isBallForm, grounded, horizontalDir);
}

export function tickBallWallReboundContactCoyote(
    state: BallReboundRuntimeState,
    body: Physics.Arcade.Body,
    selfObject: GameObjects.GameObject,
    isBallForm: boolean,
    grounded: boolean,
    deltaMs: number
): void {
    if (!isBallForm || grounded) {
        state.wallReboundCoyoteMs = 0;
        return;
    }

    const contactDirection = resolveBallWallContactReboundDirection(
        body,
        selfObject,
        state.wallReboundNormalX
    );
    if (contactDirection !== null) {
        state.wallReboundNormalX = contactDirection;
        state.wallReboundCoyoteMs = PLAYER_BALL_WALL_REBOUND_COYOTE_MS;
        return;
    }

    state.wallReboundCoyoteMs = Math.max(0, state.wallReboundCoyoteMs - deltaMs);
}

export function tickBallReboundPauseRuntime(
    state: BallReboundRuntimeState,
    body: Physics.Arcade.Body,
    isBallForm: boolean,
    grounded: boolean,
    deltaMs: number,
    steerInput: BallReboundSteerInput
): BallReboundPausePhase {
    if (!state.pauseState.active) {
        return 'inactive';
    }

    if (!isBallForm || grounded) {
        resetBallReboundPauseState(state.pauseState);
        return 'inactive';
    }

    tickBallReboundPause(state.pauseState, deltaMs);
    if (state.pauseState.remainingMs > 0) {
        if (state.pauseState.surface === 'wall') {
            const steerVector = resolveWallReboundSteerVector(steerInput, state.pauseState.wallNormalX);
            if (steerVector !== null) {
                state.pauseState.steerDirectionX = steerVector.x;
                state.pauseState.steerDirectionY = steerVector.y;
                state.pauseState.steerStrengthMultiplier = steerVector.strengthMultiplier;
                state.pauseState.hasSteerDirection = true;
            } else {
                state.pauseState.steerStrengthMultiplier = 1;
                state.pauseState.hasSteerDirection = false;
            }
        }
        return 'holding';
    }

    body.setVelocity(
        state.pauseState.capturedVelocityX,
        state.pauseState.capturedVelocityY
    );
    const candidate: BallSurfaceReboundCandidate = {
        surface: state.pauseState.surface,
        wallNormalX: state.pauseState.wallNormalX,
        steerVector: state.pauseState.hasSteerDirection
            ? {
                x: state.pauseState.steerDirectionX,
                y: state.pauseState.steerDirectionY,
                strengthMultiplier: state.pauseState.steerStrengthMultiplier
            }
            : null
    };
    const launched = applyBallSurfaceReboundImmediate(
        state,
        body,
        candidate,
        state.pauseState.boosted,
        {
            x: state.pauseState.capturedVelocityX,
            y: state.pauseState.capturedVelocityY
        }
    );
    resetBallReboundPauseState(state.pauseState);
    return launched ? 'launched' : 'inactive';
}

export function tryStartBallSurfaceReboundRuntime(
    state: BallReboundRuntimeState,
    body: Physics.Arcade.Body,
    boosted: boolean,
    sourceVelocityX: number = body.velocity.x,
    sourceVelocityY: number = body.velocity.y,
    steerInput: BallReboundSteerInput = { horizontalDir: 0, verticalDir: 0 }
): boolean {
    const sourceVelocity = { x: sourceVelocityX, y: sourceVelocityY };
    const candidate = resolveBallSurfaceReboundCandidate(state, body, steerInput);
    if (candidate === null) {
        return false;
    }

    if (PLAYER_BALL_REBOUND_PAUSE_BEFORE_LAUNCH_MS <= 0) {
        return applyBallSurfaceReboundImmediate(state, body, candidate, boosted, sourceVelocity);
    }

    startBallReboundPause(
        state.pauseState,
        PLAYER_BALL_REBOUND_PAUSE_BEFORE_LAUNCH_MS,
        candidate.surface,
        candidate.wallNormalX,
        sourceVelocity.x,
        sourceVelocity.y,
        boosted
    );
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    resetBallReboundTrajectoryState(state.trajectoryState);
    if (candidate.surface === 'wall') {
        state.wallReboundCoyoteMs = 0;
    }
    return true;
}

function resolveBallSurfaceReboundCandidate(
    state: BallReboundRuntimeState,
    body: Physics.Arcade.Body,
    steerInput: BallReboundSteerInput
): BallSurfaceReboundCandidate | null {
    const directWallNormalX = resolveDirectWallNormalX(body);
    if (directWallNormalX !== null || state.wallReboundCoyoteMs > 0) {
        const wallNormalX = directWallNormalX ?? state.wallReboundNormalX;
        return {
            surface: 'wall',
            wallNormalX,
            steerVector: resolveWallReboundSteerVector(steerInput, wallNormalX)
        };
    }

    const hasCeilingContact = body.blocked.up || body.touching.up;
    if (!hasCeilingContact) {
        return null;
    }

    return {
        surface: 'ceiling',
        wallNormalX: state.wallReboundNormalX,
        steerVector: null
    };
}

function resolveDirectWallNormalX(body: Physics.Arcade.Body): -1 | 1 | null {
    const hasLeftContact = body.blocked.left || body.touching.left;
    const hasRightContact = body.blocked.right || body.touching.right;

    if (hasLeftContact && !hasRightContact) {
        return 1;
    }

    if (hasRightContact && !hasLeftContact) {
        return -1;
    }

    return null;
}

function applyBallSurfaceReboundImmediate(
    state: BallReboundRuntimeState,
    body: Physics.Arcade.Body,
    candidate: BallSurfaceReboundCandidate,
    boosted: boolean,
    sourceVelocity: { x: number; y: number }
): boolean {
    const directionSourceVelocity = resolveReboundDirectionSourceVelocity(sourceVelocity.x, sourceVelocity.y, boosted);
    const strengthMultiplier = resolveReboundStrengthMultiplier(boosted);

    if (candidate.surface === 'wall') {
        return tryStartBallWallRebound(
            state,
            body,
            candidate.wallNormalX,
            candidate.steerVector,
            directionSourceVelocity,
            strengthMultiplier
        );
    }

    const minimumExitSpeed = PLAYER_BALL_CEILING_REBOUND_MIN_EXIT_SPEED;
    const minimumDownwardSpeed = PLAYER_BALL_CEILING_REBOUND_MIN_DOWNWARD_SPEED;
    if (tryApplyReflectionFromSourceVelocity(body, directionSourceVelocity.x, directionSourceVelocity.y, 0, 1)) {
        applyMinimumReboundSpeed(body, minimumExitSpeed, 0, 1);
    } else {
        body.setVelocity(0, minimumExitSpeed);
    }
    applyMinimumCeilingReboundDownwardSpeed(body, minimumDownwardSpeed);
    applyMinimumReboundSpeed(body, minimumExitSpeed, 0, 1);
    applyReboundStrengthMultiplier(body, strengthMultiplier);

    startBallReboundTrajectory(state.trajectoryState, body.velocity.x);
    return true;
}

function tryStartBallWallRebound(
    state: BallReboundRuntimeState,
    body: Physics.Arcade.Body,
    wallNormalX: -1 | 1,
    steerVector: BallReboundSteerVector | null,
    directionSourceVelocity: { x: number; y: number },
    strengthMultiplier: number
): boolean {
    const minimumExitSpeed = PLAYER_BALL_WALL_REBOUND_MIN_EXIT_SPEED;
    const incomingSpeedIntoWall = Math.max(0, -(directionSourceVelocity.x * wallNormalX));
    const fallbackDirectionY = -PLAYER_BALL_WALL_REBOUND_FALLBACK_UPWARD_BIAS;

    if (incomingSpeedIntoWall >= PLAYER_BALL_WALL_REBOUND_MIN_INTO_WALL_SPEED) {
        if (!tryApplyReflectionFromSourceVelocity(
            body,
            directionSourceVelocity.x,
            directionSourceVelocity.y,
            wallNormalX,
            0
        )) {
            return false;
        }
        applyMinimumReboundSpeed(body, minimumExitSpeed, wallNormalX, 0);
    } else {
        const fallbackDirectionMagnitude = Math.hypot(wallNormalX, fallbackDirectionY);
        if (fallbackDirectionMagnitude <= 0.0001) {
            return false;
        }

        const speed = Math.max(
            Math.hypot(directionSourceVelocity.x, directionSourceVelocity.y),
            minimumExitSpeed
        );
        body.setVelocity(
            (wallNormalX / fallbackDirectionMagnitude) * speed,
            (fallbackDirectionY / fallbackDirectionMagnitude) * speed
        );
    }
    applyMinimumReboundSpeed(
        body,
        minimumExitSpeed,
        wallNormalX,
        fallbackDirectionY
    );
    if (steerVector !== null) {
        applyWallReboundSteerDirection(body, steerVector);
    }
    applyReboundStrengthMultiplier(body, strengthMultiplier);

    startBallReboundTrajectory(state.trajectoryState, body.velocity.x);
    startBallReboundSurfaceInputLock(state, (-wallNormalX) as -1 | 1);
    state.wallReboundCoyoteMs = 0;
    return true;
}

function startBallReboundSurfaceInputLock(
    state: BallReboundRuntimeState,
    blockedHorizontalDir: -1 | 1
): void {
    if (PLAYER_BALL_REBOUND_SURFACE_INPUT_LOCK_MS <= 0) {
        state.surfaceInputLockMs = 0;
        state.surfaceInputBlockedHorizontalDir = 0;
        return;
    }

    state.surfaceInputLockMs = PLAYER_BALL_REBOUND_SURFACE_INPUT_LOCK_MS;
    state.surfaceInputBlockedHorizontalDir = blockedHorizontalDir;
    state.surfaceInputRequiresRelease = true;
}

function resolveReboundStrengthMultiplier(boosted: boolean): number {
    return boosted ? PLAYER_BALL_REBOUND_BOOST_STRENGTH_MULTIPLIER : 1;
}

function resolveReboundDirectionSourceVelocity(
    velocityX: number,
    velocityY: number,
    boosted: boolean
): { x: number; y: number } {
    if (!boosted) {
        return { x: velocityX, y: velocityY };
    }

    const clampedX = Math.sign(velocityX) * Math.min(Math.abs(velocityX), PLAYER_AIR_MOVE_SPEED);
    return {
        x: clampedX,
        y: velocityY
    };
}

function tryApplyReflectionFromSourceVelocity(
    body: Physics.Arcade.Body,
    sourceVelocityX: number,
    sourceVelocityY: number,
    normalX: number,
    normalY: number
): boolean {
    const velocityDotNormal = (sourceVelocityX * normalX) + (sourceVelocityY * normalY);
    if (velocityDotNormal >= -0.0001) {
        return false;
    }

    const reflectionScale = 2 * velocityDotNormal;
    body.setVelocity(
        sourceVelocityX - (reflectionScale * normalX),
        sourceVelocityY - (reflectionScale * normalY)
    );
    return true;
}

function applyReboundStrengthMultiplier(body: Physics.Arcade.Body, multiplier: number): void {
    if (multiplier <= 1) {
        return;
    }

    body.setVelocity(body.velocity.x * multiplier, body.velocity.y * multiplier);
}

function applyWallReboundSteerDirection(
    body: Physics.Arcade.Body,
    steerVector: BallReboundSteerVector
): void {
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed <= 0.0001) {
        return;
    }

    const directionLength = Math.hypot(steerVector.x, steerVector.y);
    if (directionLength <= 0.0001) {
        return;
    }

    const strengthMultiplier = Math.max(0.0001, steerVector.strengthMultiplier);
    body.setVelocity(
        (steerVector.x / directionLength) * speed * strengthMultiplier,
        (steerVector.y / directionLength) * speed * strengthMultiplier
    );
}
