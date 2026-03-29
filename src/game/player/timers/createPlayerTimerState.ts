import type { PlayerTimerState } from './playerTimerTypes';

export function createPlayerTimerState(): PlayerTimerState {
    return {
        jumpBufferMs: 0,
        coyoteTimeMs: 0,
        transformLockMs: 0,
        deathPauseMs: 0,
        reboundBufferMs: 0,
        boostCooldownMs: 0,
        chainWindowMs: 0
    };
}
