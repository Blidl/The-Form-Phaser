import {
    PLAYER_BALL_ANIM_LAND_IMPACT_SPEED_FOR_MAX,
    PLAYER_SQUARE_ANIM_LAND_IMPACT_SPEED_FOR_MAX,
    PLAYER_TRIANGLE_ANIM_LAND_IMPACT_SPEED_FOR_MAX
} from '../player_constants';
import type { PlayerFormId } from '../player_types';

export interface PlayerFormAnimationPhasePulse {
    scaleX: number;
    scaleY: number;
    durationMs: number;
}

export interface PlayerFormAnimationProfile {
    jumpIntent: PlayerFormAnimationPhasePulse;
    jumpCommit: PlayerFormAnimationPhasePulse;
    apexEnter: PlayerFormAnimationPhasePulse;
    fallEnter: PlayerFormAnimationPhasePulse;
    landImpactMax: PlayerFormAnimationPhasePulse;
    landRecover: PlayerFormAnimationPhasePulse;
    formSwitchIn: PlayerFormAnimationPhasePulse;
    ballReboundLaunch?: PlayerFormAnimationPhasePulse;
    triangleFlightStart?: PlayerFormAnimationPhasePulse;
    triangleFlightEnd?: PlayerFormAnimationPhasePulse;
    squareAttachEnter?: PlayerFormAnimationPhasePulse;
    squareAttachExit?: PlayerFormAnimationPhasePulse;
    squareAttachJumpCommit?: PlayerFormAnimationPhasePulse;
    landImpactSpeedForMax: number;
    airScaleX: number;
    airScaleY: number;
    airSpeedForMax: number;
    airSmoothingTimeSec: number;
}

const BALL_PROFILE: PlayerFormAnimationProfile = {
    jumpIntent: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    jumpCommit: { scaleX: 0.84, scaleY: 1.20, durationMs: 83 },
    apexEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 33 },
    fallEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    landImpactMax: { scaleX: 1.28, scaleY: 0.74, durationMs: 83 },
    landRecover: { scaleX: 1.00, scaleY: 1.00, durationMs: 133 },
    formSwitchIn: { scaleX: 1.00, scaleY: 1.00, durationMs: 117 },
    ballReboundLaunch: { scaleX: 0.80, scaleY: 1.24, durationMs: 83 },
    landImpactSpeedForMax: PLAYER_BALL_ANIM_LAND_IMPACT_SPEED_FOR_MAX,
    airScaleX: 0.95,
    airScaleY: 1.08,
    airSpeedForMax: 620,
    airSmoothingTimeSec: 0.06
};

const TRIANGLE_PROFILE: PlayerFormAnimationProfile = {
    jumpIntent: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    jumpCommit: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    apexEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    fallEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    landImpactMax: { scaleX: 1.08, scaleY: 0.92, durationMs: 50 },
    landRecover: { scaleX: 1.00, scaleY: 1.00, durationMs: 67 },
    formSwitchIn: { scaleX: 1.00, scaleY: 1.00, durationMs: 117 },
    triangleFlightStart: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    triangleFlightEnd: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    landImpactSpeedForMax: PLAYER_TRIANGLE_ANIM_LAND_IMPACT_SPEED_FOR_MAX,
    airScaleX: 1.00,
    airScaleY: 1.00,
    airSpeedForMax: 500,
    airSmoothingTimeSec: 0.05
};

const SQUARE_PROFILE: PlayerFormAnimationProfile = {
    jumpIntent: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    jumpCommit: { scaleX: 0.86, scaleY: 1.16, durationMs: 95 },
    apexEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    fallEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    landImpactMax: { scaleX: 1.18, scaleY: 0.82, durationMs: 83 },
    landRecover: { scaleX: 1.00, scaleY: 1.00, durationMs: 133 },
    formSwitchIn: { scaleX: 1.00, scaleY: 1.00, durationMs: 133 },
    squareAttachEnter: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    squareAttachExit: { scaleX: 1.00, scaleY: 1.00, durationMs: 0 },
    squareAttachJumpCommit: { scaleX: 0.84, scaleY: 1.18, durationMs: 100 },
    landImpactSpeedForMax: PLAYER_SQUARE_ANIM_LAND_IMPACT_SPEED_FOR_MAX,
    airScaleX: 1.00,
    airScaleY: 1.00,
    airSpeedForMax: 500,
    airSmoothingTimeSec: 0.06
};

export const resolvePlayerFormAnimationProfile = (formId: PlayerFormId): PlayerFormAnimationProfile => {
    if (formId === 'triangle') {
        return TRIANGLE_PROFILE;
    }
    if (formId === 'square') {
        return SQUARE_PROFILE;
    }
    return BALL_PROFILE;
};
