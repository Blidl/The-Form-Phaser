import type { PlayerTriangleShellState, TriangleEdgeIndex } from './player_types';
import {
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_TRIANGLE_AIRBORNE_CONTROLLED_SPIN_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_MAX_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_PASSIVE_SPIN_RAD_PER_SEC,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_ACCEL_RAD_PER_SEC_SQ,
    PLAYER_TRIANGLE_AIRBORNE_SPIN_DECEL_RAD_PER_SEC_SQ,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD
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
    hasGroundContact: boolean,
    justLanded: boolean,
    groundSupportEdgeIndex: TriangleEdgeIndex | null,
    horizontalMoveDir: number,
    horizontalVelocityX: number,
    deltaSec: number
): void => {
    if (grounded) {
        if (justLanded && groundSupportEdgeIndex !== null) {
            triangleShell.groundedOrientationRad = resolveGroundedOrientationFromSupportEdge(groundSupportEdgeIndex);
        } else if (justLanded) {
            triangleShell.groundedOrientationRad = resolveNearestGroundedOrientation(triangleShell.orientationRad);
            triangleShell.airborneSpinDirection = horizontalMoveDir !== 0
                ? (horizontalMoveDir > 0 ? 1 : -1)
                : triangleShell.airborneSpinDirection;
        }

        triangleShell.orientationRad = triangleShell.groundedOrientationRad;
        triangleShell.visualOffsetY = 0;
        triangleShell.airborneAngularVelocityRadPerSec = 0;

        return;
    }

    if (hasGroundContact && groundSupportEdgeIndex === null) {
        const nearestGroundedOrientation = resolveNearestGroundedOrientation(triangleShell.orientationRad);
        const groundedDelta = Math.atan2(
            Math.sin(nearestGroundedOrientation - triangleShell.orientationRad),
            Math.cos(nearestGroundedOrientation - triangleShell.orientationRad)
        );
        const settleDirection = Math.abs(groundedDelta) <= 0.0001 ? 0 : (groundedDelta > 0 ? 1 : -1);
        const maxSettleStep = PLAYER_TRIANGLE_AIRBORNE_CONTROLLED_SPIN_RAD_PER_SEC * deltaSec;

        triangleShell.airborneAngularVelocityRadPerSec = 0;
        if (settleDirection !== 0) {
            triangleShell.airborneSpinDirection = settleDirection;
        }
        triangleShell.orientationRad = normalizeAngle(
            moveToward(
                triangleShell.orientationRad,
                triangleShell.orientationRad + groundedDelta,
                maxSettleStep
            )
        );
        triangleShell.visualOffsetY = 0;
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

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_LOCAL_VERTICES = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;

export const resolveGroundedOrientationFromSupportEdge = (edgeIndex: TriangleEdgeIndex): number => {
    const start = TRIANGLE_LOCAL_VERTICES[edgeIndex];
    const end = TRIANGLE_LOCAL_VERTICES[(edgeIndex + 1) % TRIANGLE_LOCAL_VERTICES.length];
    const edgeAngle = Math.atan2(end.y - start.y, end.x - start.x);
    const candidates = [
        normalizeAngle(-edgeAngle),
        normalizeAngle(Math.PI - edgeAngle)
    ];
    const oppositeVertex = TRIANGLE_LOCAL_VERTICES[(edgeIndex + 2) % TRIANGLE_LOCAL_VERTICES.length];

    return candidates.find((candidate) => {
        const rotatedStartY = rotatePointY(start.x, start.y, candidate);
        const rotatedOppositeY = rotatePointY(oppositeVertex.x, oppositeVertex.y, candidate);
        return rotatedOppositeY < rotatedStartY;
    }) ?? candidates[0];
};

const resolveNearestGroundedOrientation = (angle: number): number => {
    const candidates: TriangleEdgeIndex[] = [0, 1, 2];
    let nearest = resolveGroundedOrientationFromSupportEdge(2);
    let nearestDistance = Infinity;

    candidates.forEach((edgeIndex) => {
        const candidate = resolveGroundedOrientationFromSupportEdge(edgeIndex);
        const delta = Math.atan2(Math.sin(candidate - angle), Math.cos(candidate - angle));
        const distance = Math.abs(delta);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = candidate;
        }
    });

    return nearest;
};

const rotatePointY = (x: number, y: number, angle: number): number => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    return (x * sin) + (y * cos);
};
