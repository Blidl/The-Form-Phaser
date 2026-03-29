export interface CanChainBallAbilityContext {
    normalEligibility: boolean;
    chainWindowMs: number;
}

export function canChainBallAbility(context: CanChainBallAbilityContext): boolean {
    return context.normalEligibility || context.chainWindowMs > 0;
}
