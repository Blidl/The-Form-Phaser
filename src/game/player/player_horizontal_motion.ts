import { Math as PhaserMath } from 'phaser';
import {
    PLAYER_AIR_WIND_MIN_DRIFT_RATIO,
    PLAYER_AIR_WIND_RESPONSE,
    PLAYER_BALL_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC,
    PLAYER_BALL_BOOST_HOLD_ACCEL,
    PLAYER_BALL_BOOST_HOLD_AIR_CONTROL_FACTOR,
    PLAYER_BALL_BOOST_HOLD_AIR_MOVE_SPEED,
    PLAYER_BALL_BOOST_HOLD_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC,
    PLAYER_BALL_BOOST_HOLD_MOVE_SPEED,
    PLAYER_BALL_BOOST_START_IMPULSE_DECAY_MS,
    PLAYER_BALL_BOOST_START_IMPULSE_SPEED,
    PLAYER_SQUARE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC,
    PLAYER_TRIANGLE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC
} from './player_constants';
import { resolvePlayerFormMoveProfile } from './player_form_movement_profile';
import type { PlayerFormId } from './player_types';

export const resolveBoostDirection = (horizontalDir: number, lastMoveDirection: -1 | 1): -1 | 1 => {
    if (horizontalDir < 0) {
        return -1;
    }

    if (horizontalDir > 0) {
        return 1;
    }

    return lastMoveDirection;
};

export const moveToward = (current: number, target: number, maxDelta: number): number => {
    if (current < target) {
        return Math.min(current + maxDelta, target);
    }

    if (current > target) {
        return Math.max(current - maxDelta, target);
    }

    return target;
};

export const resolveMoveResponse = (
    form: PlayerFormId,
    grounded: boolean,
    horizontalDir: number,
    hasBoostHold: boolean
): number => {
    if (hasBoostHold && horizontalDir !== 0) {
        return PLAYER_BALL_BOOST_HOLD_ACCEL;
    }

    const moveProfile = resolvePlayerFormMoveProfile(form, grounded);
    return horizontalDir === 0 ? moveProfile.decel : moveProfile.accel;
};

export const resolveTargetVelocityX = (
    currentVelocityX: number,
    grounded: boolean,
    horizontalDir: number,
    moveSpeed: number,
    externalInfluenceX: number
): number => {
    if (!grounded && horizontalDir === 0) {
        return currentVelocityX;
    }

    return (horizontalDir * moveSpeed) + (grounded ? externalInfluenceX : 0);
};

export const applyAirborneWindDrift = (
    baseVelocityX: number,
    windInfluenceX: number,
    deltaSec: number,
    airborneWindDriftX: number
): { nextVelocityX: number; nextAirborneWindDriftX: number } => {
    const windStep = PLAYER_AIR_WIND_RESPONSE * deltaSec;
    const nextAirborneWindDriftX = moveToward(airborneWindDriftX, windInfluenceX, windStep);

    if (Math.abs(nextAirborneWindDriftX) <= 0.001) {
        return {
            nextVelocityX: baseVelocityX,
            nextAirborneWindDriftX
        };
    }

    let velocityWithDrift = baseVelocityX + nextAirborneWindDriftX;
    const minDriftMagnitude = Math.abs(nextAirborneWindDriftX) * PLAYER_AIR_WIND_MIN_DRIFT_RATIO;
    const windDirection = nextAirborneWindDriftX > 0 ? 1 : -1;
    const signedMinDrift = minDriftMagnitude * windDirection;

    if (windDirection > 0 && velocityWithDrift < signedMinDrift) {
        velocityWithDrift = signedMinDrift;
    } else if (windDirection < 0 && velocityWithDrift > signedMinDrift) {
        velocityWithDrift = signedMinDrift;
    }

    return {
        nextVelocityX: velocityWithDrift,
        nextAirborneWindDriftX
    };
};

export const applyAirborneNoInputInertiaDamping = (
    velocityX: number,
    deltaSec: number,
    form: PlayerFormId,
    hasBoostHold: boolean
): number => {
    const dampingPerSec = resolveAirNoInputInertiaDampingPerSec(form, hasBoostHold);
    const dampingFactor = Math.max(0, 1 - (dampingPerSec * deltaSec));
    return velocityX * dampingFactor;
};

export const resolveMoveSpeed = (
    form: PlayerFormId,
    grounded: boolean,
    hasBoostHold: boolean,
    boostImpulseMs: number
): number => {
    if (!hasBoostHold) {
        return resolvePlayerFormMoveProfile(form, grounded).maxSpeed;
    }

    return resolveBallBoostCurrentMoveSpeed(grounded, boostImpulseMs);
};

export const resolveBallBoostAirControlFactor = (
    isBallForm: boolean,
    grounded: boolean,
    hasBoostHold: boolean
): number => {
    if (!isBallForm || grounded || !hasBoostHold) {
        return 1;
    }

    return PLAYER_BALL_BOOST_HOLD_AIR_CONTROL_FACTOR;
};

const resolveBallBoostCurrentMoveSpeed = (grounded: boolean, boostImpulseMs: number): number => {
    const holdSpeed = grounded ? PLAYER_BALL_BOOST_HOLD_MOVE_SPEED : PLAYER_BALL_BOOST_HOLD_AIR_MOVE_SPEED;
    if (boostImpulseMs <= 0 || PLAYER_BALL_BOOST_START_IMPULSE_DECAY_MS <= 0) {
        return holdSpeed;
    }

    const alpha = PhaserMath.Clamp(boostImpulseMs / PLAYER_BALL_BOOST_START_IMPULSE_DECAY_MS, 0, 1);
    const progress = 1 - alpha;
    const smoothProgress = progress * progress * (3 - (2 * progress));
    return PhaserMath.Linear(PLAYER_BALL_BOOST_START_IMPULSE_SPEED, holdSpeed, smoothProgress);
};

const resolveAirNoInputInertiaDampingPerSec = (form: PlayerFormId, hasBoostHold: boolean): number => {
    if (form === 'ball' && hasBoostHold) {
        return PLAYER_BALL_BOOST_HOLD_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
    }

    if (form === 'square') {
        return PLAYER_SQUARE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
    }

    if (form === 'triangle') {
        return PLAYER_TRIANGLE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
    }

    return PLAYER_BALL_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
};
