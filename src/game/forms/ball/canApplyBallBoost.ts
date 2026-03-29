import type { PlayerInputFrame } from '../../player/input/playerInputTypes';

export interface CanApplyBallBoostContext {
    inputFrame: PlayerInputFrame;
    boostCooldownMs: number;
    reboundConsumedThisFrame: boolean;
}

export function canApplyBallBoost(context: CanApplyBallBoostContext): boolean {
    if (context.reboundConsumedThisFrame) {
        return false;
    }

    if (!context.inputFrame.abilityPressed) {
        return false;
    }

    return context.boostCooldownMs <= 0;
}
