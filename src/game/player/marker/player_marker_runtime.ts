import {
    PLAYER_MARKER_MOVE_SPEED_PX_PER_SEC,
    PLAYER_MARKER_RETURN_SPEED_PX_PER_SEC,
    PLAYER_MARKER_SMOOTHING_TIME_SEC
} from '../player_constants';
import type { PlayerInputSnapshot } from '../player_input';
import type { PlayerFormId } from '../player_types';
import type { PlayerMarkerState } from './player_marker_types';
import { clampMarkerOffsetToForm } from './player_marker_math';

export const createPlayerMarkerState = (): PlayerMarkerState => {
    return {
        currentOffsetX: 0,
        currentOffsetY: 0,
        targetOffsetX: 0,
        targetOffsetY: 0
    };
};

export const resetPlayerMarkerState = (marker: PlayerMarkerState): void => {
    marker.currentOffsetX = 0;
    marker.currentOffsetY = 0;
    marker.targetOffsetX = 0;
    marker.targetOffsetY = 0;
};

export const clampPlayerMarkerStateToForm = (
    marker: PlayerMarkerState,
    form: PlayerFormId
): void => {
    const current = clampMarkerOffsetToForm(form, marker.currentOffsetX, marker.currentOffsetY);
    const target = clampMarkerOffsetToForm(form, marker.targetOffsetX, marker.targetOffsetY);
    marker.currentOffsetX = current.x;
    marker.currentOffsetY = current.y;
    marker.targetOffsetX = target.x;
    marker.targetOffsetY = target.y;
};

export const tickPlayerMarkerState = (
    marker: PlayerMarkerState,
    form: PlayerFormId,
    input: PlayerInputSnapshot,
    deltaSec: number
): void => {
    const intentX = input.forcePointX;
    const intentY = input.forcePointY;
    const hasIntent = input.forcePointActive;
    const moveSpeed = hasIntent ? PLAYER_MARKER_MOVE_SPEED_PX_PER_SEC : PLAYER_MARKER_RETURN_SPEED_PX_PER_SEC;
    const nextTargetX = hasIntent
        ? marker.targetOffsetX + (intentX * moveSpeed * deltaSec)
        : moveToward(marker.targetOffsetX, 0, moveSpeed * deltaSec);
    const nextTargetY = hasIntent
        ? marker.targetOffsetY + (intentY * moveSpeed * deltaSec)
        : moveToward(marker.targetOffsetY, 0, moveSpeed * deltaSec);
    const clampedTarget = clampMarkerOffsetToForm(form, nextTargetX, nextTargetY);

    marker.targetOffsetX = clampedTarget.x;
    marker.targetOffsetY = clampedTarget.y;

    const smoothingT = resolveSmoothingT(deltaSec, PLAYER_MARKER_SMOOTHING_TIME_SEC);
    const nextCurrentX = marker.currentOffsetX + ((marker.targetOffsetX - marker.currentOffsetX) * smoothingT);
    const nextCurrentY = marker.currentOffsetY + ((marker.targetOffsetY - marker.currentOffsetY) * smoothingT);
    const clampedCurrent = clampMarkerOffsetToForm(form, nextCurrentX, nextCurrentY);

    marker.currentOffsetX = clampedCurrent.x;
    marker.currentOffsetY = clampedCurrent.y;
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

const resolveSmoothingT = (deltaSec: number, smoothingTimeSec: number): number => {
    if (smoothingTimeSec <= 0.0001) {
        return 1;
    }

    return 1 - Math.exp(-deltaSec / smoothingTimeSec);
};
