import type { PlayerTriangleShellState } from './player_types';
import {
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_TRIANGLE_AIRBORNE_CONTROLLED_SPIN_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_MAX_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_PASSIVE_SPIN_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_ACCEL_RAD_PER_SEC_SQ,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_DECEL_RAD_PER_SEC_SQ,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
    PLAYER_TRIANGLE_GROUNDED_ORIENTATIONS_RAD,
    PLAYER_TRIANGLE_GROUNDED_SETTLE_LERP_SPEED
} from './player_constants';

export const createTriangleShellState = (initialSpinDirection: -1 | 1): PlayerTriangleShellState => {
    return {
        orientationRad: PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
        groundedOrientationRad: PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
        visualOffsetY: 0,
        airborneSpinDirection: initialSpinDirection,
        airborneAngularVelocityRadPerSec: 0
    };
};

export const resetTriangleShellState = (
    triangleShell: PlayerTriangleShellState,
    spinDirection: -1 | 1
): void => {
    triangleShell.orientationRad = PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD;
    triangleShell.groundedOrientationRad = PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD;
    triangleShell.visualOffsetY = 0;
    triangleShell.airborneSpinDirection = spinDirection;
    triangleShell.airborneAngularVelocityRadPerSec = 0;
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
        if (justLanded) {
            triangleShell.groundedOrientationRad = findNearestGroundedOrientation(triangleShell.orientationRad);
            triangleShell.airborneSpinDirection = horizontalMoveDir !== 0
                ? (horizontalMoveDir > 0 ? 1 : -1)
                : triangleShell.airborneSpinDirection;
        }

        const settleT = Math.min(1, PLAYER_TRIANGLE_GROUNDED_SETTLE_LERP_SPEED * deltaSec);
        triangleShell.orientationRad = lerpAngle(
            triangleShell.orientationRad,
            triangleShell.groundedOrientationRad,
            settleT
        );
        const groundedOffsetY = resolveGroundedVisualOffsetY(triangleShell.groundedOrientationRad);
        triangleShell.visualOffsetY = triangleShell.visualOffsetY + ((groundedOffsetY - triangleShell.visualOffsetY) * settleT);
        triangleShell.airborneAngularVelocityRadPerSec = 0;

        return;
    }

    if (horizontalMoveDir !== 0) {
        triangleShell.airborneSpinDirection = horizontalMoveDir > 0 ? 1 : -1;
    } else if (Math.abs(horizontalVelocityX) > 14) {
        triangleShell.airborneSpinDirection = horizontalVelocityX > 0 ? 1 : -1;
    }

    const targetSpinRadPerSec = horizontalMoveDir === 0
        ? triangleShell.airborneSpinDirection * PLAYER_TRIANGLE_AIRBORNE_PASSIVE_SPIN_RAD_PER_SEC
        : triangleShell.airborneSpinDirection * PLAYER_TRIANGLE_AIRBORNE_CONTROLLED_SPIN_RAD_PER_SEC;
    const spinResponse = horizontalMoveDir === 0
        ? PLAYER_TRIANGLE_AIRBORNE_SPIN_DECEL_RAD_PER_SEC_SQ
        : PLAYER_TRIANGLE_AIRBORNE_SPIN_ACCEL_RAD_PER_SEC_SQ;
    const maxSpinStep = spinResponse * deltaSec;

    triangleShell.airborneAngularVelocityRadPerSec = moveToward(
        triangleShell.airborneAngularVelocityRadPerSec,
        targetSpinRadPerSec,
        maxSpinStep
    );
    const spinRadPerSec = clamp(
        triangleShell.airborneAngularVelocityRadPerSec,
        -PLAYER_TRIANGLE_AIRBORNE_SPIN_MAX_RAD_PER_SEC,
        PLAYER_TRIANGLE_AIRBORNE_SPIN_MAX_RAD_PER_SEC
    );
    triangleShell.orientationRad = normalizeAngle(
        triangleShell.orientationRad + (spinRadPerSec * deltaSec)
    );
};

const lerpAngle = (from: number, to: number, t: number): number => {
    const wrappedDelta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + (wrappedDelta * t);
};

const normalizeAngle = (angle: number): number => {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
};

const moveToward = (current: number, target: number, maxDelta: number): number => {
    if (current < target) {
        return Math.min(current + maxDelta, target);
    }

    if (current > target) {
        return Math.max(current - maxDelta, target);
    }

    return target;
};

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
};

const findNearestGroundedOrientation = (angle: number): number => {
    let nearest = PLAYER_TRIANGLE_GROUNDED_ORIENTATIONS_RAD[0];
    let nearestDistance = Infinity;

    PLAYER_TRIANGLE_GROUNDED_ORIENTATIONS_RAD.forEach((candidate) => {
        const delta = Math.atan2(Math.sin(candidate - angle), Math.cos(candidate - angle));
        const distance = Math.abs(delta);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = candidate;
        }
    });

    return nearest;
};

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_LOCAL_VERTICES = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;

function getTriangleBottomExtent(angleRad: number): number {
    const sin = Math.sin(angleRad);
    const cos = Math.cos(angleRad);
    let bottomExtent = -Infinity;

    TRIANGLE_LOCAL_VERTICES.forEach((vertex) => {
        const rotatedY = (vertex.x * sin) + (vertex.y * cos);
        if (rotatedY > bottomExtent) {
            bottomExtent = rotatedY;
        }
    });

    return bottomExtent;
}

const BASE_GROUNDED_BOTTOM_EXTENT = getTriangleBottomExtent(PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD);
const TRIANGLE_GROUNDED_VISUAL_OFFSETS = PLAYER_TRIANGLE_GROUNDED_ORIENTATIONS_RAD.map((orientation) => {
    return BASE_GROUNDED_BOTTOM_EXTENT - getTriangleBottomExtent(orientation);
});

const resolveGroundedVisualOffsetY = (orientationRad: number): number => {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    PLAYER_TRIANGLE_GROUNDED_ORIENTATIONS_RAD.forEach((candidate, index) => {
        const delta = Math.atan2(Math.sin(candidate - orientationRad), Math.cos(candidate - orientationRad));
        const distance = Math.abs(delta);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    return TRIANGLE_GROUNDED_VISUAL_OFFSETS[nearestIndex] ?? 0;
};
