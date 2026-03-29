export interface BallReboundTrajectoryState {
    active: boolean;
    preservedVelocityX: number;
}

export function createBallReboundTrajectoryState(): BallReboundTrajectoryState {
    return {
        active: false,
        preservedVelocityX: 0
    };
}

export function resetBallReboundTrajectoryState(state: BallReboundTrajectoryState): void {
    state.active = false;
    state.preservedVelocityX = 0;
}

export function startBallReboundTrajectory(state: BallReboundTrajectoryState, velocityX: number): void {
    state.active = true;
    state.preservedVelocityX = velocityX;
}

export function resolveBallReboundPreservedVelocityX(
    state: BallReboundTrajectoryState,
    isBallForm: boolean,
    grounded: boolean,
    horizontalDir: number
): number | null {
    if (!state.active) {
        return null;
    }

    if (!isBallForm || grounded || horizontalDir !== 0) {
        resetBallReboundTrajectoryState(state);
        return null;
    }

    return state.preservedVelocityX;
}
