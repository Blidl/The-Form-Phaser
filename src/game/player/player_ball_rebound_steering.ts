import { PLAYER_BALL_WALL_REBOUND_STEER_PERPENDICULAR_STRENGTH_MULTIPLIER } from './player_constants';

export interface BallReboundSteerInput {
    horizontalDir: -1 | 0 | 1;
    verticalDir: -1 | 0 | 1;
}

export interface BallReboundSteerVector {
    x: number;
    y: number;
    strengthMultiplier: number;
}

const COS_30 = 0.8660254037844386;
const SIN_30 = 0.5;
const SIN_60 = 0.8660254037844386;
const COS_60 = 0.5;

export function resolveWallReboundSteerVector(
    input: BallReboundSteerInput,
    wallNormalX: -1 | 1
): BallReboundSteerVector | null {
    const horizontalDir = input.horizontalDir;
    const verticalDir = input.verticalDir;
    const isAwayInput = horizontalDir === wallNormalX;
    const hasHorizontalInput = horizontalDir !== 0;
    const hasVerticalInput = verticalDir !== 0;

    if (isAwayInput && !hasVerticalInput) {
        return {
            x: wallNormalX,
            y: 0,
            strengthMultiplier: PLAYER_BALL_WALL_REBOUND_STEER_PERPENDICULAR_STRENGTH_MULTIPLIER
        };
    }

    if (hasHorizontalInput && hasVerticalInput) {
        return normalizeVector(wallNormalX * COS_30, verticalDir * SIN_30);
    }

    if (!hasHorizontalInput && hasVerticalInput) {
        return normalizeVector(wallNormalX * SIN_60, verticalDir * COS_60);
    }

    return null;
}

function normalizeVector(x: number, y: number): BallReboundSteerVector {
    const length = Math.hypot(x, y);
    if (length <= 0.0001) {
        return { x: 0, y: 0, strengthMultiplier: 1 };
    }

    return {
        x: x / length,
        y: y / length,
        strengthMultiplier: 1
    };
}
