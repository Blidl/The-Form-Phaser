import type { PlayerSquareShellState } from './player_types';
import {
    PLAYER_SQUARE_EDGE_DOWN_POSE_RAD,
    PLAYER_SQUARE_GROUNDED_ORIENTATIONS_RAD,
    PLAYER_SQUARE_GROUNDED_SETTLE_LERP_SPEED
} from './player_constants';

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
        attachContactGraceMs: 0
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
};

export const tickSquareShellOrientation = (
    squareShell: PlayerSquareShellState,
    deltaSec: number,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    hasContact: boolean
): void => {
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
    let nearest = PLAYER_SQUARE_GROUNDED_ORIENTATIONS_RAD[0];
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
