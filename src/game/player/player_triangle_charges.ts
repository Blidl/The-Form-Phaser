import { PLAYER_TRIANGLE_DASH_MAX_CHARGES } from './player_constants';
import type { PlayerTriangleChargesState } from './player_types';

export const createTriangleChargesState = (): PlayerTriangleChargesState => {
    return {
        currentCharges: PLAYER_TRIANGLE_DASH_MAX_CHARGES,
        maxCharges: PLAYER_TRIANGLE_DASH_MAX_CHARGES
    };
};

export const resetTriangleChargesState = (triangleCharges: PlayerTriangleChargesState): void => {
    triangleCharges.currentCharges = triangleCharges.maxCharges;
};

export const hasTriangleDashCharges = (triangleCharges: PlayerTriangleChargesState): boolean => {
    return triangleCharges.currentCharges > 0;
};

export const tryConsumeTriangleDashCharge = (triangleCharges: PlayerTriangleChargesState): boolean => {
    if (triangleCharges.currentCharges <= 0) {
        return false;
    }

    triangleCharges.currentCharges -= 1;
    return true;
};
