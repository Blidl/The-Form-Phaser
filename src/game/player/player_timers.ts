import {
    PLAYER_TIMER_DEFAULT_COYOTE_MS,
    PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS,
    PLAYER_TIMER_DEFAULT_JUMP_BUFFER_MS,
    PLAYER_SQUARE_ATTACH_ENTRY_BUFFER_MS,
    PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS
} from './player_constants';

export interface PlayerTimers {
    coyoteTimeMs: number;
    jumpBufferMs: number;
    squareAttachEntryBufferMs: number;
    transformLockMs: number;
    deathPauseMs: number;
}

export const createPlayerTimers = (): PlayerTimers => {
    return {
        coyoteTimeMs: 0,
        jumpBufferMs: 0,
        squareAttachEntryBufferMs: 0,
        transformLockMs: 0,
        deathPauseMs: 0
    };
};

export const tickPlayerTimers = (timers: PlayerTimers, deltaMs: number): void => {
    timers.coyoteTimeMs = Math.max(0, timers.coyoteTimeMs - deltaMs);
    timers.jumpBufferMs = Math.max(0, timers.jumpBufferMs - deltaMs);
    timers.squareAttachEntryBufferMs = Math.max(0, timers.squareAttachEntryBufferMs - deltaMs);
    timers.transformLockMs = Math.max(0, timers.transformLockMs - deltaMs);
    timers.deathPauseMs = Math.max(0, timers.deathPauseMs - deltaMs);
};

export const refreshCoyoteTime = (timers: PlayerTimers): void => {
    timers.coyoteTimeMs = PLAYER_TIMER_DEFAULT_COYOTE_MS;
};

export const pushJumpBuffer = (timers: PlayerTimers): void => {
    timers.jumpBufferMs = PLAYER_TIMER_DEFAULT_JUMP_BUFFER_MS;
};

export const clearJumpBuffer = (timers: PlayerTimers): void => {
    timers.jumpBufferMs = 0;
};

export const pushSquareAttachEntryBuffer = (timers: PlayerTimers): void => {
    timers.squareAttachEntryBufferMs = PLAYER_SQUARE_ATTACH_ENTRY_BUFFER_MS;
};

export const clearSquareAttachEntryBuffer = (timers: PlayerTimers): void => {
    timers.squareAttachEntryBufferMs = 0;
};

export const clearCoyoteTime = (timers: PlayerTimers): void => {
    timers.coyoteTimeMs = 0;
};

export const hasCoyoteTime = (timers: PlayerTimers): boolean => {
    return timers.coyoteTimeMs > 0;
};

export const hasJumpBuffer = (timers: PlayerTimers): boolean => {
    return timers.jumpBufferMs > 0;
};

export const hasSquareAttachEntryBuffer = (timers: PlayerTimers): boolean => {
    return timers.squareAttachEntryBufferMs > 0;
};

export const getTimerDefaults = () => {
    return {
        transformLockMs: PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS,
        deathPauseMs: PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS
    };
};
