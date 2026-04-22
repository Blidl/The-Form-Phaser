import type { PlayerTuningSnapshot } from './player_tuning_types';

export const createPlayerTuningDefaultsSnapshot = (): PlayerTuningSnapshot => {
    return {
        version: 1,
        raw: {
            common: {
                coyoteTimeMs: 110,
                jumpBufferMs: 120,
                transformLockMs: 150,
                deathPauseMs: 250,
                cameraFollowLerp: 0.18,
                gravityY: 1800,
                windResponse: 5200,
                windMinDriftRatio: 0.2,
                markerMoveSpeed: 240,
                markerReturnSpeed: 180,
                markerMaxOffset: 14,
                markerSmoothingTimeSec: 0.08
            },
            ball: {
                movement: {
                    groundMaxSpeed: 300,
                    groundAccel: 1900,
                    groundDecel: 1200,
                    airMaxSpeed: 250,
                    airAccel: 2600,
                    airDecel: 520
                },
                jump: {
                    launchVelocity: -620,
                    jumpCutMultiplier: 0.45,
                    riseGravityScale: 0.72,
                    apexGravityScale: 0.5,
                    apexVelocityThreshold: 90
                },
                animation: {
                    jumpSquashScaleX: 1.12,
                    jumpSquashScaleY: 0.88,
                    jumpSquashDurationMs: 70,
                    jumpStretchScaleX: 0.9,
                    jumpStretchScaleY: 1.12,
                    jumpStretchDurationMs: 90,
                    jumpRecoverDurationMs: 130,
                    landImpactSpeedForMax: 900,
                    landSquashScaleX: 1.18,
                    landSquashScaleY: 0.82,
                    landSquashDurationMs: 70,
                    landRecoverDurationMs: 140,
                    airScaleX: 0.94,
                    airScaleY: 1.06,
                    airSpeedForMax: 700,
                    airSmoothingTimeSec: 0.08,
                    switchRecoverDurationMs: 150
                },
                boost: {
                    startImpulseSpeed: 860,
                    startImpulseDecayMs: 420,
                    holdGroundMoveSpeed: 420,
                    holdAirMoveSpeed: 320,
                    holdAccel: 12000,
                    jumpMinHorizontalSpeed: 720,
                    jumpVelocityMultiplier: 1.06,
                    holdAirControlFactor: 0.08
                },
                rebound: {
                    inputWindowMs: 70,
                    hitPauseMs: 90,
                    level1JumpVelocity: -700,
                    level2JumpVelocity: -900,
                    wallCoyoteMs: 90,
                    pauseBeforeLaunchMs: 90,
                    surfaceInputLockMs: 420,
                    wallMinIntoSurfaceSpeed: 160,
                    wallFallbackUpwardBias: 0.24,
                    wallMinExitSpeed: 900,
                    ceilingMinExitSpeed: 900,
                    ceilingMinDownwardSpeed: 700
                }
            },
            triangle: {
                movement: {
                    groundMaxSpeed: 270,
                    groundAccel: 2300,
                    groundDecel: 1500,
                    airMaxSpeed: 235,
                    airAccel: 2900,
                    airDecel: 620
                },
                jump: {
                    launchVelocity: -670,
                    jumpCutMultiplier: 0.48,
                    riseGravityScale: 0.72,
                    apexGravityScale: 0.5,
                    apexVelocityThreshold: 90
                },
                animation: {
                    jumpSquashScaleX: 1.0576,
                    jumpSquashScaleY: 0.928,
                    jumpSquashDurationMs: 65,
                    jumpStretchScaleX: 0.9136,
                    jumpStretchScaleY: 1.1008,
                    jumpStretchDurationMs: 85,
                    jumpRecoverDurationMs: 120,
                    landImpactSpeedForMax: 980,
                    landSquashScaleX: 1.0936,
                    landSquashScaleY: 0.9064,
                    landSquashDurationMs: 65,
                    landRecoverDurationMs: 130,
                    airScaleX: 0.932,
                    airScaleY: 1.068,
                    airSpeedForMax: 820,
                    airSmoothingTimeSec: 0.07,
                    switchRecoverDurationMs: 128
                },
                flight: {
                    flightSpeed: 620,
                    flightDistancePx: 320,
                    flightRestoreSpeed: 1440,
                    flightTurnSpeedRadPerSec: Math.PI * 5.5
                }
            },
            square: {
                movement: {
                    groundMaxSpeed: 235,
                    groundAccel: 1700,
                    groundDecel: 1100,
                    airMaxSpeed: 210,
                    airAccel: 2100,
                    airDecel: 700
                },
                jump: {
                    launchVelocity: -620,
                    jumpCutMultiplier: 0.45,
                    riseGravityScale: 0.72,
                    apexGravityScale: 0.5,
                    apexVelocityThreshold: 90
                },
                animation: {
                    jumpSquashScaleX: 1.0434,
                    jumpSquashScaleY: 0.9442,
                    jumpSquashDurationMs: 70,
                    jumpStretchScaleX: 0.9566,
                    jumpStretchScaleY: 1.0496,
                    jumpStretchDurationMs: 90,
                    jumpRecoverDurationMs: 130,
                    landImpactSpeedForMax: 860,
                    landSquashScaleX: 1.062,
                    landSquashScaleY: 0.938,
                    landSquashDurationMs: 75,
                    landRecoverDurationMs: 150,
                    airScaleX: 0.9768,
                    airScaleY: 1.0232,
                    airSpeedForMax: 650,
                    airSmoothingTimeSec: 0.09,
                    switchRecoverDurationMs: 173
                },
                attach: {
                    acquireRangePx: 10,
                    attachBufferMs: 120,
                    contactGraceMs: 45,
                    surfaceMoveSpeed: 220
                },
                trail: {
                    resourceMax: 100,
                    spendPerPx: 0.2,
                    manualRegenSpeed: 180
                },
                attachJump: {
                    heightPx: 54,
                    outSpeed: 540,
                    returnTimeMs: 190,
                    tetherStretchPx: 72,
                    reacquireRangePx: 18
                },
                rollover: {
                    previewTimeMs: 45,
                    durationMs: 170,
                    returnTimeMs: 190,
                    cornerDetectionRangePx: 18,
                    surfaceValidationRangePx: 6
                }
            }
        }
    };
};
