export type BallReboundSurfaceType = 'wall' | 'ceiling';

export interface BallReboundPauseState {
    active: boolean;
    remainingMs: number;
    surface: BallReboundSurfaceType;
    wallNormalX: -1 | 1;
    capturedVelocityX: number;
    capturedVelocityY: number;
    boosted: boolean;
}

export function createBallReboundPauseState(): BallReboundPauseState {
    return {
        active: false,
        remainingMs: 0,
        surface: 'ceiling',
        wallNormalX: 1,
        capturedVelocityX: 0,
        capturedVelocityY: 0,
        boosted: false
    };
}

export function resetBallReboundPauseState(state: BallReboundPauseState): void {
    state.active = false;
    state.remainingMs = 0;
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
}

export function tickBallReboundPause(state: BallReboundPauseState, deltaMs: number): void {
    if (!state.active) {
        return;
    }

    state.remainingMs = Math.max(0, state.remainingMs - deltaMs);
}
