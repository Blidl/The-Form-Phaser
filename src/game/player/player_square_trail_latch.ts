import { PLAYER_FORM_SQUARE_SIZE } from './player_constants';
import { squareSupportLocalToWorld, squareSupportWorldToLocal } from './player_square_support_space';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';
import type { PlayerSquareShellState, PlayerSquareTrailSupportOwner } from './player_types';

const HALF_SIZE = PLAYER_FORM_SQUARE_SIZE * 0.5;

export const clearSquareTrailLatch = (
    squareShell: PlayerSquareShellState
): void => {
    squareShell.trailLatchActive = false;
    squareShell.trailLatchLocalX = 0;
    squareShell.trailLatchLocalY = 0;
    squareShell.trailLatchSupportBody = null;
    squareShell.trailLatchSupportOriginX = 0;
    squareShell.trailLatchSupportOriginY = 0;
    squareShell.trailLatchNormalX = 0;
    squareShell.trailLatchNormalY = -1;
};

export const updateSquareTrailLatchFromPose = (
    squareShell: PlayerSquareShellState,
    pose: PlayerSquareAttachPoseQuery,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): void => {
    const supportOwner = pose.surfacePoint.supportOwner;
    const localPoint = squareSupportWorldToLocal(
        pose.surfacePoint.x,
        pose.surfacePoint.y,
        supportOwner
    );

    squareShell.trailLatchActive = true;
    squareShell.trailLatchLocalX = localPoint.x;
    squareShell.trailLatchLocalY = localPoint.y;
    squareShell.trailLatchSupportBody = supportOwner.body;
    squareShell.trailLatchSupportOriginX = supportOwner.originX;
    squareShell.trailLatchSupportOriginY = supportOwner.originY;
    squareShell.trailLatchNormalX = normalX;
    squareShell.trailLatchNormalY = normalY;
};

export const resolveSquareTrailLatchPose = (
    squareShell: PlayerSquareShellState,
    querySquareAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): PlayerSquareAttachPoseQuery | null => {
    if (
        !squareShell.trailLatchActive
        || squareShell.trailLatchNormalX !== normalX
        || squareShell.trailLatchNormalY !== normalY
    ) {
        return null;
    }

    const supportOwner: PlayerSquareTrailSupportOwner = {
        body: squareShell.trailLatchSupportBody,
        originX: squareShell.trailLatchSupportOriginX,
        originY: squareShell.trailLatchSupportOriginY
    };
    const latchWorld = squareSupportLocalToWorld(
        squareShell.trailLatchLocalX,
        squareShell.trailLatchLocalY,
        supportOwner
    );
    const centerX = latchWorld.x + (normalX * HALF_SIZE);
    const centerY = latchWorld.y + (normalY * HALF_SIZE);
    const pose = querySquareAttachPose(centerX, centerY, normalX, normalY);
    if (pose.supportInterval === null || !pose.isPoseClear) {
        return null;
    }

    return {
        ...pose,
        centerX,
        centerY,
        snappedCenterX: centerX,
        snappedCenterY: centerY,
        rect: {
            ...pose.rect,
            left: centerX - HALF_SIZE,
            right: centerX + HALF_SIZE,
            top: centerY - HALF_SIZE,
            bottom: centerY + HALF_SIZE,
            centerX,
            centerY
        },
        surfacePoint: {
            ...pose.surfacePoint,
            x: latchWorld.x,
            y: latchWorld.y,
            supportOwner
        }
    };
};
