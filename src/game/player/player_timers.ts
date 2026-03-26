import {
    PLAYER_TIMER_DEFAULT_COYOTE_MS,
    PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS,
    PLAYER_TIMER_DEFAULT_JUMP_BUFFER_MS,
    PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS
} from './player_constants';

export interface PlayerTimers {
    coyoteTimeMs: number;
    jumpBufferMs: number;
    transformLockMs: number;
    deathPauseMs: number;
}

export const createPlayerTimers = (): PlayerTimers => {
    return {
        coyoteTimeMs: PLAYER_TIMER_DEFAULT_COYOTE_MS,
        jumpBufferMs: PLAYER_TIMER_DEFAULT_JUMP_BUFFER_MS,
        transformLockMs: PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS,
        deathPauseMs: PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS
    };
};

export const updatePlayerTimers = (timers: PlayerTimers, deltaMs: number): void => {
    timers.coyoteTimeMs = Math.max(0, timers.coyoteTimeMs - deltaMs);
    timers.jumpBufferMs = Math.max(0, timers.jumpBufferMs - deltaMs);
    timers.transformLockMs = Math.max(0, timers.transformLockMs - deltaMs);
    timers.deathPauseMs = Math.max(0, timers.deathPauseMs - deltaMs);
};
