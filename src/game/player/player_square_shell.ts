import type { PlayerSquareShellState } from './player_types';
import {
    PLAYER_SQUARE_EDGE_DOWN_POSE_RAD,
    PLAYER_SQUARE_GROUNDED_ORIENTATIONS_RAD,
    PLAYER_SQUARE_GROUNDED_SETTLE_LERP_SPEED,
    PLAYER_SQUARE_TRAIL_RESOURCE_MAX
} from './player_constants';
import { createSquareRolloverState, resetSquareRolloverState } from './player_square_rollover';

export const createSquareShellState = (): PlayerSquareShellState => {
    return {
        orientationRad: PLAYER_SQUARE_EDGE_DOWN_POSE_RAD,
        groundedOrientationRad: PLAYER_SQUARE_EDGE_DOWN_POSE_RAD,
        contactNormalX: 0,
        contactNormalY: -1,
        hasContact: false,
        isAttached: false,
        attachNormalX: 0,
        attachNormalY: -1,
        attachContactGraceMs: 0,
        trailSegments: [],
        trailResourceCurrent: PLAYER_SQUARE_TRAIL_RESOURCE_MAX,
        trailResourceMax: PLAYER_SQUARE_TRAIL_RESOURCE_MAX,
        trailAnchorActive: false,
        trailAnchorX: 0,
        trailAnchorY: 0,
        trailAnchorLocalX: 0,
        trailAnchorLocalY: 0,
        trailAnchorSupportBody: null,
        trailAnchorSupportOriginX: 0,
        trailAnchorSupportOriginY: 0,
        trailAnchorNormalX: 0,
        trailAnchorNormalY: -1,
        rolloverState: createSquareRolloverState()
    };
};

export const resetSquareShellState = (
    squareShell: PlayerSquareShellState
): void => {
    squareShell.orientationRad = PLAYER_SQUARE_EDGE_DOWN_POSE_RAD;
    squareShell.groundedOrientationRad = PLAYER_SQUARE_EDGE_DOWN_POSE_RAD;
    squareShell.contactNormalX = 0;
    squareShell.contactNormalY = -1;
    squareShell.hasContact = false;
    squareShell.isAttached = false;
    squareShell.attachNormalX = 0;
    squareShell.attachNormalY = -1;
    squareShell.attachContactGraceMs = 0;
    squareShell.trailSegments.length = 0;
    squareShell.trailResourceMax = PLAYER_SQUARE_TRAIL_RESOURCE_MAX;
    squareShell.trailResourceCurrent = squareShell.trailResourceMax;
    squareShell.trailAnchorActive = false;
    squareShell.trailAnchorX = 0;
    squareShell.trailAnchorY = 0;
    squareShell.trailAnchorLocalX = 0;
    squareShell.trailAnchorLocalY = 0;
    squareShell.trailAnchorSupportBody = null;
    squareShell.trailAnchorSupportOriginX = 0;
    squareShell.trailAnchorSupportOriginY = 0;
    squareShell.trailAnchorNormalX = 0;
    squareShell.trailAnchorNormalY = -1;
    resetSquareRolloverState(squareShell.rolloverState);
};

export const tickSquareShellOrientation = (
    squareShell: PlayerSquareShellState,
    deltaSec: number,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    hasContact: boolean
): void => {
    if (squareShell.rolloverState.phase !== 'inactive') {
        squareShell.hasContact = hasContact;
        if (hasContact) {
            squareShell.contactNormalX = contactNormalX;
            squareShell.contactNormalY = contactNormalY;
        }
        return;
    }

    const contactStarted = hasContact && !squareShell.hasContact;
    squareShell.hasContact = hasContact;

    if (hasContact) {
        if (contactStarted) {
            squareShell.groundedOrientationRad = findNearestGroundedOrientation(squareShell.orientationRad);
        }

        squareShell.contactNormalX = contactNormalX;
        squareShell.contactNormalY = contactNormalY;
        const settleT = Math.min(1, PLAYER_SQUARE_GROUNDED_SETTLE_LERP_SPEED * deltaSec);
        squareShell.orientationRad = lerpAngle(
            squareShell.orientationRad,
            squareShell.groundedOrientationRad,
            settleT
        );
        return;
    }
};

const findNearestGroundedOrientation = (angle: number): number => {
    let nearest: number = PLAYER_SQUARE_GROUNDED_ORIENTATIONS_RAD[0];
    let nearestDistance = Infinity;

    PLAYER_SQUARE_GROUNDED_ORIENTATIONS_RAD.forEach((candidate) => {
        const delta = Math.atan2(Math.sin(candidate - angle), Math.cos(candidate - angle));
        const distance = Math.abs(delta);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = candidate;
        }
    });

    return nearest;
};

const lerpAngle = (from: number, to: number, t: number): number => {
    const wrappedDelta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + (wrappedDelta * t);
};
