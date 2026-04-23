import {
    PLAYER_MARKER_MOVE_SPEED_PX_PER_SEC,
    PLAYER_MARKER_RETURN_SPEED_PX_PER_SEC,
    PLAYER_MARKER_SMOOTHING_TIME_SEC
} from '../player_constants';
import type { PlayerInputSnapshot } from '../player_input';
import type { PlayerFormId, PlayerShellState } from '../player_types';
import type { PlayerMarkerState } from './player_marker_types';
import { clampMarkerOffsetToForm, resolveGroundedTriangleMarkerOffset } from './player_marker_math';

export const createPlayerMarkerState = (): PlayerMarkerState => {
    return {
        currentOffsetX: 0,
        currentOffsetY: 0,
        targetOffsetX: 0,
        targetOffsetY: 0,
        lastNonZeroDirectionX: 0,
        lastNonZeroDirectionY: 0,
        hasLastNonZeroDirection: false
    };
};

export const resetPlayerMarkerState = (marker: PlayerMarkerState): void => {
    marker.currentOffsetX = 0;
    marker.currentOffsetY = 0;
    marker.targetOffsetX = 0;
    marker.targetOffsetY = 0;
    marker.lastNonZeroDirectionX = 0;
    marker.lastNonZeroDirectionY = 0;
    marker.hasLastNonZeroDirection = false;
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
    state: PlayerShellState,
    input: PlayerInputSnapshot,
    deltaSec: number
): void => {
    const form = state.currentForm;
    const markerIntent = resolvePersistentMarkerIntent(marker, input);
    const groundedTriangleTarget = resolveGroundedTriangleMarkerTarget(state, markerIntent.intentX, markerIntent.intentY, markerIntent.hasIntent);
    const squareTarget = resolveSquareMarkerTarget(form, markerIntent.intentX, markerIntent.intentY, markerIntent.hasIntent);
    const moveSpeed = markerIntent.hasIntent ? PLAYER_MARKER_MOVE_SPEED_PX_PER_SEC : PLAYER_MARKER_RETURN_SPEED_PX_PER_SEC;
    const nextTargetX = groundedTriangleTarget !== null
        ? moveToward(marker.targetOffsetX, groundedTriangleTarget.x, moveSpeed * deltaSec)
        : squareTarget !== null
            ? moveToward(marker.targetOffsetX, squareTarget.x, moveSpeed * deltaSec)
        : markerIntent.hasIntent
            ? marker.targetOffsetX + (markerIntent.intentX * moveSpeed * deltaSec)
            : moveToward(marker.targetOffsetX, 0, moveSpeed * deltaSec);
    const nextTargetY = groundedTriangleTarget !== null
        ? moveToward(marker.targetOffsetY, groundedTriangleTarget.y, moveSpeed * deltaSec)
        : squareTarget !== null
            ? moveToward(marker.targetOffsetY, squareTarget.y, moveSpeed * deltaSec)
        : markerIntent.hasIntent
            ? marker.targetOffsetY + (markerIntent.intentY * moveSpeed * deltaSec)
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

const resolveGroundedTriangleMarkerTarget = (
    state: PlayerShellState,
    intentX: -1 | 0 | 1,
    intentY: -1 | 0 | 1,
    hasIntent: boolean
): { x: number; y: number } | null => {
    if (state.currentForm !== 'triangle') {
        return null;
    }

    const supportEdgeIndex = state.triangleCollision.groundSupportEdgeIndex;
    if (!state.triangleCollision.hasGroundContact || supportEdgeIndex === null) {
        return null;
    }

    if (!hasIntent) {
        return { x: 0, y: 0 };
    }

    return resolveGroundedTriangleMarkerOffset(
        intentX,
        intentY,
        state.triangleShell.orientationRad
    );
};

const resolveSquareMarkerTarget = (
    form: PlayerFormId,
    intentX: -1 | 0 | 1,
    intentY: -1 | 0 | 1,
    hasIntent: boolean
): { x: number; y: number } | null => {
    if (form !== 'square' || !hasIntent) {
        return null;
    }

    if (intentX !== 0 && intentY === 0) {
        return clampMarkerOffsetToForm('square', intentX * 1000, 0);
    }

    if (intentX === 0 && intentY !== 0) {
        return clampMarkerOffsetToForm('square', 0, intentY * 1000);
    }

    return clampMarkerOffsetToForm('square', intentX * 1000, intentY * 1000);
};

const resolvePersistentMarkerIntent = (
    marker: PlayerMarkerState,
    input: PlayerInputSnapshot
): { intentX: -1 | 0 | 1; intentY: -1 | 0 | 1; hasIntent: boolean } => {
    if (input.forcePointActive) {
        marker.lastNonZeroDirectionX = input.forcePointX;
        marker.lastNonZeroDirectionY = input.forcePointY;
        marker.hasLastNonZeroDirection = true;
        return {
            intentX: input.forcePointX,
            intentY: input.forcePointY,
            hasIntent: true
        };
    }

    if (marker.hasLastNonZeroDirection) {
        return {
            intentX: marker.lastNonZeroDirectionX,
            intentY: marker.lastNonZeroDirectionY,
            hasIntent: true
        };
    }

    return {
        intentX: 0,
        intentY: 0,
        hasIntent: false
    };
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
