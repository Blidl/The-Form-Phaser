import type { PlayerTriangleShellState } from './player_types';
import {
    PLAYER_TRIANGLE_JUMP_VELOCITY
} from './player_constants';

export interface TriangleSpecialJumpLaunch {
    velocityY: number;
}

export const applyTriangleSpecialJump = (
    triangleShell: PlayerTriangleShellState,
    horizontalMoveDir: number,
    fallbackFacingDirection: -1 | 1
): TriangleSpecialJumpLaunch => {
    triangleShell.airborneSpinDirection = resolveJumpDirection(horizontalMoveDir, fallbackFacingDirection);

    return {
        velocityY: PLAYER_TRIANGLE_JUMP_VELOCITY
    };
};

const resolveJumpDirection = (
    horizontalMoveDir: number,
    fallbackFacingDirection: -1 | 1
): -1 | 1 => {
    if (horizontalMoveDir < 0) {
        return -1;
    }

    if (horizontalMoveDir > 0) {
        return 1;
    }

    return fallbackFacingDirection;
};
