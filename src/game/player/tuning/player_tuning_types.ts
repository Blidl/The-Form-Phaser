export interface PlayerMovementTuningRaw {
    groundMaxSpeed: number;
    groundAccel: number;
    groundDecel: number;
    airMaxSpeed: number;
    airAccel: number;
    airDecel: number;
}

export interface PlayerJumpProfileTuningRaw {
    launchVelocity: number;
    jumpCutMultiplier: number;
    riseGravityScale: number;
    apexGravityScale: number;
    apexVelocityThreshold: number;
}

export interface PlayerCommonTuningRaw {
    coyoteTimeMs: number;
    jumpBufferMs: number;
    transformLockMs: number;
    deathPauseMs: number;
    cameraFollowLerp: number;
    gravityY: number;
    windResponse: number;
    windMinDriftRatio: number;
    markerMoveSpeed: number;
    markerReturnSpeed: number;
    markerMaxOffset: number;
    markerSmoothingTimeSec: number;
}

export interface PlayerBallBoostTuningRaw {
    startImpulseSpeed: number;
    startImpulseDecayMs: number;
    holdGroundMoveSpeed: number;
    holdAirMoveSpeed: number;
    holdAccel: number;
    jumpMinHorizontalSpeed: number;
    jumpVelocityMultiplier: number;
    holdAirControlFactor: number;
}

export interface PlayerBallReboundTuningRaw {
    inputWindowMs: number;
    hitPauseMs: number;
    level1JumpVelocity: number;
    level2JumpVelocity: number;
    wallCoyoteMs: number;
    pauseBeforeLaunchMs: number;
    surfaceInputLockMs: number;
    wallMinIntoSurfaceSpeed: number;
    wallFallbackUpwardBias: number;
    wallMinExitSpeed: number;
    ceilingMinExitSpeed: number;
    ceilingMinDownwardSpeed: number;
}

export interface PlayerTriangleFlightTuningRaw {
    flightSpeed: number;
    flightDistancePx: number;
    flightRestoreSpeed: number;
    flightTurnSpeedRadPerSec: number;
}

export interface PlayerSquareAttachTuningRaw {
    acquireRangePx: number;
    attachBufferMs: number;
    contactGraceMs: number;
    surfaceMoveSpeed: number;
}

export interface PlayerSquareTrailTuningRaw {
    resourceMax: number;
    spendPerPx: number;
    manualRegenSpeed: number;
}

export interface PlayerSquareAttachJumpTuningRaw {
    heightPx: number;
    outSpeed: number;
    returnTimeMs: number;
    tetherStretchPx: number;
    reacquireRangePx: number;
}

export interface PlayerSquareRolloverTuningRaw {
    previewTimeMs: number;
    durationMs: number;
    returnTimeMs: number;
    cornerDetectionRangePx: number;
    surfaceValidationRangePx: number;
}

export interface PlayerFormAnimationTuningRaw {
    jumpSquashScaleX: number;
    jumpSquashScaleY: number;
    jumpSquashDurationMs: number;
    jumpStretchScaleX: number;
    jumpStretchScaleY: number;
    jumpStretchDurationMs: number;
    jumpRecoverDurationMs: number;
    landImpactSpeedForMax: number;
    landSquashScaleX: number;
    landSquashScaleY: number;
    landSquashDurationMs: number;
    landRecoverDurationMs: number;
    airScaleX: number;
    airScaleY: number;
    airSpeedForMax: number;
    airSmoothingTimeSec: number;
    switchRecoverDurationMs: number;
}

export interface PlayerTuningRawSnapshot {
    common: PlayerCommonTuningRaw;
    ball: {
        movement: PlayerMovementTuningRaw;
        jump: PlayerJumpProfileTuningRaw;
        animation: PlayerFormAnimationTuningRaw;
        boost: PlayerBallBoostTuningRaw;
        rebound: PlayerBallReboundTuningRaw;
    };
    triangle: {
        movement: PlayerMovementTuningRaw;
        jump: PlayerJumpProfileTuningRaw;
        animation: PlayerFormAnimationTuningRaw;
        flight: PlayerTriangleFlightTuningRaw;
    };
    square: {
        movement: PlayerMovementTuningRaw;
        jump: PlayerJumpProfileTuningRaw;
        animation: PlayerFormAnimationTuningRaw;
        attach: PlayerSquareAttachTuningRaw;
        trail: PlayerSquareTrailTuningRaw;
        attachJump: PlayerSquareAttachJumpTuningRaw;
        rollover: PlayerSquareRolloverTuningRaw;
    };
}

export interface PlayerTuningSnapshot {
    version: 1;
    raw: PlayerTuningRawSnapshot;
}

export type PlayerTuningTabId = 'common' | 'ball' | 'triangle' | 'square';

export const clonePlayerTuningSnapshot = (snapshot: PlayerTuningSnapshot): PlayerTuningSnapshot => {
    return {
        version: 1,
        raw: {
            common: { ...snapshot.raw.common },
            ball: {
                movement: { ...snapshot.raw.ball.movement },
                jump: { ...snapshot.raw.ball.jump },
                animation: { ...snapshot.raw.ball.animation },
                boost: { ...snapshot.raw.ball.boost },
                rebound: { ...snapshot.raw.ball.rebound }
            },
            triangle: {
                movement: { ...snapshot.raw.triangle.movement },
                jump: { ...snapshot.raw.triangle.jump },
                animation: { ...snapshot.raw.triangle.animation },
                flight: { ...snapshot.raw.triangle.flight }
            },
            square: {
                movement: { ...snapshot.raw.square.movement },
                jump: { ...snapshot.raw.square.jump },
                animation: { ...snapshot.raw.square.animation },
                attach: { ...snapshot.raw.square.attach },
                trail: { ...snapshot.raw.square.trail },
                attachJump: { ...snapshot.raw.square.attachJump },
                rollover: { ...snapshot.raw.square.rollover }
            }
        }
    };
};
