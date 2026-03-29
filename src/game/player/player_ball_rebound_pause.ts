export type BallReboundSurfaceType = 'wall' | 'ceiling';

export interface BallReboundPauseState {
    active: boolean;
    remainingMs: number;
    surface: BallReboundSurfaceType;
    wallNormalX: -1 | 1;
    capturedVelocityX: number;
    capturedVelocityY: number;
    boosted: boolean;
    steerDirectionX: number;
    steerDirectionY: number;
    steerStrengthMultiplier: number;
    hasSteerDirection: boolean;
}

export function createBallReboundPauseState(): BallReboundPauseState {
    return {
        active: false,
        remainingMs: 0,
        surface: 'ceiling',
        wallNormalX: 1,
        capturedVelocityX: 0,
        capturedVelocityY: 0,
        boosted: false,
        steerDirectionX: 0,
        steerDirectionY: 0,
        steerStrengthMultiplier: 1,
        hasSteerDirection: false
    };
}

export function resetBallReboundPauseState(state: BallReboundPauseState): void {
    state.active = false;
    state.remainingMs = 0;
    state.steerStrengthMultiplier = 1;
    state.hasSteerDirection = false;
}

export function startBallReboundPause(
    state: BallReboundPauseState,
    durationMs: number,
    surface: BallReboundSurfaceType,
    wallNormalX: -1 | 1,
    capturedVelocityX: number,
    capturedVelocityY: number,
    boosted: boolean
): void {
    state.active = true;
    state.remainingMs = Math.max(0, durationMs);
    state.surface = surface;
    state.wallNormalX = wallNormalX;
    state.capturedVelocityX = capturedVelocityX;
    state.capturedVelocityY = capturedVelocityY;
    state.boosted = boosted;
    state.steerDirectionX = 0;
    state.steerDirectionY = 0;
    state.steerStrengthMultiplier = 1;
    state.hasSteerDirection = false;
}

export function tickBallReboundPause(state: BallReboundPauseState, deltaMs: number): void {
    if (!state.active) {
        return;
    }

    state.remainingMs = Math.max(0, state.remainingMs - deltaMs);
}
