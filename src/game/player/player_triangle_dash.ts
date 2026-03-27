import type { PlayerTriangleDashState, PlayerTriangleShellState } from './player_types';
import {
    PLAYER_TRIANGLE_DASH_COOLDOWN_MS,
    PLAYER_TRIANGLE_DASH_DURATION_MS,
    PLAYER_TRIANGLE_DASH_MAX_DOWNWARD_Y,
    PLAYER_TRIANGLE_DASH_SPEED
} from './player_constants';

export interface TriangleDashLaunch {
    velocityX: number;
    velocityY: number;
}

export const createTriangleDashState = (): PlayerTriangleDashState => {
    return {
        isActive: false,
        remainingMs: 0,
        cooldownMs: 0,
        directionX: 0,
        directionY: 0
    };
};

export const resetTriangleDashState = (triangleDash: PlayerTriangleDashState): void => {
    triangleDash.isActive = false;
    triangleDash.remainingMs = 0;
    triangleDash.cooldownMs = 0;
    triangleDash.directionX = 0;
    triangleDash.directionY = 0;
};

export const tickTriangleDashCooldown = (triangleDash: PlayerTriangleDashState, deltaMs: number): void => {
    triangleDash.cooldownMs = Math.max(0, triangleDash.cooldownMs - deltaMs);
};

export const tickTriangleDashActive = (triangleDash: PlayerTriangleDashState, deltaMs: number): void => {
    if (!triangleDash.isActive) {
        return;
    }

    triangleDash.remainingMs = Math.max(0, triangleDash.remainingMs - deltaMs);
    if (triangleDash.remainingMs === 0) {
        triangleDash.isActive = false;
    }
};

export const tryStartTriangleDash = (
    triangleDash: PlayerTriangleDashState,
    triangleShell: PlayerTriangleShellState,
    horizontalMoveDir: number,
    fallbackFacingDirection: -1 | 1
): TriangleDashLaunch | null => {
    if (triangleDash.isActive || triangleDash.cooldownMs > 0) {
        return null;
    }

    const direction = resolveDashDirection(triangleShell, horizontalMoveDir, fallbackFacingDirection);
    triangleDash.isActive = true;
    triangleDash.remainingMs = PLAYER_TRIANGLE_DASH_DURATION_MS;
    triangleDash.cooldownMs = PLAYER_TRIANGLE_DASH_COOLDOWN_MS;
    triangleDash.directionX = direction.x;
    triangleDash.directionY = direction.y;

    return {
        velocityX: direction.x * PLAYER_TRIANGLE_DASH_SPEED,
        velocityY: direction.y * PLAYER_TRIANGLE_DASH_SPEED
    };
};

export const stopTriangleDash = (triangleDash: PlayerTriangleDashState): void => {
    triangleDash.isActive = false;
    triangleDash.remainingMs = 0;
};

const resolveDashDirection = (
    triangleShell: PlayerTriangleShellState,
    horizontalMoveDir: number,
    fallbackFacingDirection: -1 | 1
): { x: number; y: number } => {
    const inputDirection = horizontalMoveDir === 0
        ? fallbackFacingDirection
        : (horizontalMoveDir > 0 ? 1 : -1);
    const baseAngle = triangleShell.orientationRad + (inputDirection > 0 ? 0 : Math.PI);
    const rawX = Math.cos(baseAngle);
    const rawY = Math.sin(baseAngle);
    const clampedY = Math.min(rawY, PLAYER_TRIANGLE_DASH_MAX_DOWNWARD_Y);
    const length = Math.hypot(rawX, clampedY);
    if (length <= 0.0001) {
        return { x: inputDirection, y: 0 };
    }

    return {
        x: rawX / length,
        y: clampedY / length
    };
};
