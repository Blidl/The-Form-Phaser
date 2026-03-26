import type { PlayerTriangleShellState } from './player_types';
import {
    PLAYER_TRIANGLE_AIRBORNE_SPIN_BASE_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_MAX_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_SPEED_FROM_VELOCITY,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
    PLAYER_TRIANGLE_GROUNDED_SETTLE_LERP_SPEED
} from './player_constants';

export const createTriangleShellState = (initialSpinDirection: -1 | 1): PlayerTriangleShellState => {
    return {
        orientationRad: PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
        airborneSpinDirection: initialSpinDirection
    };
};

export const resetTriangleShellState = (
    triangleShell: PlayerTriangleShellState,
    spinDirection: -1 | 1
): void => {
    triangleShell.orientationRad = PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD;
    triangleShell.airborneSpinDirection = spinDirection;
};

export const tickTriangleShellOrientation = (
    triangleShell: PlayerTriangleShellState,
    grounded: boolean,
    justLanded: boolean,
    horizontalMoveDir: number,
    horizontalVelocityX: number,
    deltaSec: number
): void => {
    if (grounded) {
        const settleT = Math.min(1, PLAYER_TRIANGLE_GROUNDED_SETTLE_LERP_SPEED * deltaSec);
        triangleShell.orientationRad = lerpAngle(
            triangleShell.orientationRad,
            PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
            settleT
        );

        if (justLanded) {
            triangleShell.airborneSpinDirection = horizontalMoveDir !== 0
                ? (horizontalMoveDir > 0 ? 1 : -1)
                : triangleShell.airborneSpinDirection;
        }

        return;
    }

    if (horizontalMoveDir !== 0) {
        triangleShell.airborneSpinDirection = horizontalMoveDir > 0 ? 1 : -1;
    } else if (Math.abs(horizontalVelocityX) > 1) {
        triangleShell.airborneSpinDirection = horizontalVelocityX > 0 ? 1 : -1;
    }

    const spinSpeedFromVelocity = Math.abs(horizontalVelocityX) * PLAYER_TRIANGLE_AIRBORNE_SPIN_SPEED_FROM_VELOCITY;
    const spinRadPerSec = Math.min(
        PLAYER_TRIANGLE_AIRBORNE_SPIN_MAX_RAD_PER_SEC,
        PLAYER_TRIANGLE_AIRBORNE_SPIN_BASE_RAD_PER_SEC + spinSpeedFromVelocity
    );
    triangleShell.orientationRad = normalizeAngle(
        triangleShell.orientationRad + (triangleShell.airborneSpinDirection * spinRadPerSec * deltaSec)
    );
};

const lerpAngle = (from: number, to: number, t: number): number => {
    const wrappedDelta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + (wrappedDelta * t);
};

const normalizeAngle = (angle: number): number => {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
};
