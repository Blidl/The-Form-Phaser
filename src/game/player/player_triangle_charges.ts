import {
    PLAYER_TRIANGLE_CHARGES_RESTORE_DELAY_MS,
    PLAYER_TRIANGLE_DASH_MAX_CHARGES
} from './player_constants';
import type { PlayerTriangleChargesState } from './player_types';

export const createTriangleChargesState = (): PlayerTriangleChargesState => {
    return {
        currentCharges: PLAYER_TRIANGLE_DASH_MAX_CHARGES,
        maxCharges: PLAYER_TRIANGLE_DASH_MAX_CHARGES,
        restorePendingMs: 0
    };
};

export const resetTriangleChargesState = (triangleCharges: PlayerTriangleChargesState): void => {
    triangleCharges.currentCharges = triangleCharges.maxCharges;
    triangleCharges.restorePendingMs = 0;
};

export const hasTriangleDashCharges = (triangleCharges: PlayerTriangleChargesState): boolean => {
    return triangleCharges.currentCharges > 0;
};

export const tryConsumeTriangleDashCharge = (triangleCharges: PlayerTriangleChargesState): boolean => {
    if (triangleCharges.currentCharges <= 0) {
        return false;
    }

    triangleCharges.currentCharges -= 1;
    triangleCharges.restorePendingMs = 0;
    return true;
};

export const tryStartTriangleChargesRestore = (
    triangleCharges: PlayerTriangleChargesState,
    grounded: boolean
): boolean => {
    if (!grounded || triangleCharges.currentCharges >= triangleCharges.maxCharges || triangleCharges.restorePendingMs > 0) {
        return false;
    }

    triangleCharges.restorePendingMs = PLAYER_TRIANGLE_CHARGES_RESTORE_DELAY_MS;
    return true;
};

export const tickTriangleChargesRestore = (triangleCharges: PlayerTriangleChargesState, deltaMs: number): void => {
    if (triangleCharges.restorePendingMs <= 0) {
        return;
    }

    triangleCharges.restorePendingMs = Math.max(0, triangleCharges.restorePendingMs - deltaMs);
    if (triangleCharges.restorePendingMs === 0) {
        triangleCharges.currentCharges = triangleCharges.maxCharges;
    }
};

export const cancelTriangleChargesRestore = (triangleCharges: PlayerTriangleChargesState): void => {
    triangleCharges.restorePendingMs = 0;
};
