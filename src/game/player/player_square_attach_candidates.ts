import { PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX } from './player_constants';
import {
    findNearestSquareTrailPoint,
    isSquareSurfacePointOnTrail
} from './player_square_trail';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';
import type { PlayerShellState } from './player_types';

export const isAttachPoseOnTrail = (
    squareShell: PlayerShellState['squareShell'],
    pose: PlayerSquareAttachPoseQuery,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): boolean => {
    return isSquareSurfacePointOnTrail(
        squareShell,
        pose.surfacePoint.x,
        pose.surfacePoint.y,
        normalX,
        normalY,
        pose.surfacePoint.supportOwner
    );
};

export const resolveTrailCompatibleAttachPose = (
    squareShell: PlayerShellState['squareShell'],
    pose: PlayerSquareAttachPoseQuery,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): PlayerSquareAttachPoseQuery | null => {
    if (pose.supportInterval === null || !pose.isPoseClear) {
        return null;
    }

    if (isAttachPoseOnTrail(squareShell, pose, normalX, normalY)) {
        return pose;
    }

    if (squareShell.trailResourceCurrent > 0) {
        return pose;
    }

    const nearestTrailPoint = findNearestSquareTrailPoint(
        squareShell,
        pose.surfacePoint.x,
        pose.surfacePoint.y,
        normalX,
        normalY,
        pose.surfacePoint.supportOwner
    );
    if (nearestTrailPoint === null) {
        return null;
    }

    const deltaX = nearestTrailPoint.x - pose.surfacePoint.x;
    const deltaY = nearestTrailPoint.y - pose.surfacePoint.y;
    const snapDistance = Math.hypot(deltaX, deltaY);
    if (snapDistance > PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX) {
        return null;
    }

    return {
        ...pose,
        snappedCenterX: pose.snappedCenterX + deltaX,
        snappedCenterY: pose.snappedCenterY + deltaY,
        centerX: pose.centerX + deltaX,
        centerY: pose.centerY + deltaY,
        rect: {
            ...pose.rect,
            left: pose.rect.left + deltaX,
            right: pose.rect.right + deltaX,
            top: pose.rect.top + deltaY,
            bottom: pose.rect.bottom + deltaY,
            centerX: pose.rect.centerX + deltaX,
            centerY: pose.rect.centerY + deltaY
        },
        surfacePoint: {
            ...pose.surfacePoint,
            x: nearestTrailPoint.x,
            y: nearestTrailPoint.y
        }
    };
};
