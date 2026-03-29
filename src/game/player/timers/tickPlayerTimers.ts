import type { PlayerTimerState } from './playerTimerTypes';

export function tickPlayerTimers(timerState: PlayerTimerState, deltaMs: number): void {
    const safeDeltaMs = Math.max(0, deltaMs);

    timerState.jumpBufferMs = Math.max(0, timerState.jumpBufferMs - safeDeltaMs);
    timerState.coyoteTimeMs = Math.max(0, timerState.coyoteTimeMs - safeDeltaMs);
    timerState.transformLockMs = Math.max(0, timerState.transformLockMs - safeDeltaMs);
    timerState.deathPauseMs = Math.max(0, timerState.deathPauseMs - safeDeltaMs);
    timerState.reboundBufferMs = Math.max(0, timerState.reboundBufferMs - safeDeltaMs);
    timerState.boostCooldownMs = Math.max(0, timerState.boostCooldownMs - safeDeltaMs);
    timerState.chainWindowMs = Math.max(0, timerState.chainWindowMs - safeDeltaMs);
}
