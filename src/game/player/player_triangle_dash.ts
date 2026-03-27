import type { PlayerTriangleDashState, PlayerTriangleShellState } from './player_types';
import {
    PLAYER_TRIANGLE_DASH_COOLDOWN_MS,
    PLAYER_TRIANGLE_DASH_DURATION_MS,
    PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON,
    PLAYER_TRIANGLE_DASH_SPEED,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH
} from './player_constants';

export interface TriangleDashLaunch {
    velocityX: number;
    velocityY: number;
    leadingCornerIndex: 0 | 1 | 2;
    lockedOrientationRad: number;
}

export const createTriangleDashState = (): PlayerTriangleDashState => {
    return {
        isActive: false,
        remainingMs: 0,
        cooldownMs: 0,
        directionX: 0,
        directionY: 0,
        leadingCornerIndex: 1,
        lockedOrientationRad: 0
    };
};

export const resetTriangleDashState = (triangleDash: PlayerTriangleDashState): void => {
    triangleDash.isActive = false;
    triangleDash.remainingMs = 0;
    triangleDash.cooldownMs = 0;
    triangleDash.directionX = 0;
    triangleDash.directionY = 0;
    triangleDash.leadingCornerIndex = 1;
    triangleDash.lockedOrientationRad = 0;
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
    fallbackFacingDirection: -1 | 1,
    grounded: boolean
): TriangleDashLaunch | null => {
    if (triangleDash.isActive || triangleDash.cooldownMs > 0) {
        return null;
    }

    const lockedOrientationRad = triangleShell.orientationRad;
    const corners = getRotatedCorners(lockedOrientationRad);
    const forceBias = resolveForceBias(horizontalMoveDir, fallbackFacingDirection);
    const leadingCornerIndex = resolveLeadingCornerIndex(corners, forceBias, grounded);
    const direction = resolveDashDirectionFromCorner(corners[leadingCornerIndex], forceBias);

    triangleDash.isActive = true;
    triangleDash.remainingMs = PLAYER_TRIANGLE_DASH_DURATION_MS;
    triangleDash.cooldownMs = PLAYER_TRIANGLE_DASH_COOLDOWN_MS;
    triangleDash.directionX = direction.x;
    triangleDash.directionY = direction.y;
    triangleDash.leadingCornerIndex = leadingCornerIndex;
    triangleDash.lockedOrientationRad = lockedOrientationRad;

    return {
        velocityX: direction.x * PLAYER_TRIANGLE_DASH_SPEED,
        velocityY: direction.y * PLAYER_TRIANGLE_DASH_SPEED,
        leadingCornerIndex,
        lockedOrientationRad
    };
};

export const stopTriangleDash = (triangleDash: PlayerTriangleDashState): void => {
    triangleDash.isActive = false;
    triangleDash.remainingMs = 0;
};

type CornerIndex = 0 | 1 | 2;
type CornerPoint = { x: number; y: number };

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_LOCAL_CORNERS: ReadonlyArray<CornerPoint> = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;

const getRotatedCorners = (orientationRad: number): CornerPoint[] => {
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);
    return TRIANGLE_LOCAL_CORNERS.map((corner) => {
        return {
            x: (corner.x * cos) - (corner.y * sin),
            y: (corner.x * sin) + (corner.y * cos)
        };
    });
};

const resolveForceBias = (
    horizontalMoveDir: number,
    fallbackFacingDirection: -1 | 1
): -1 | 1 => {
    const inputDirection = horizontalMoveDir === 0
        ? fallbackFacingDirection
        : (horizontalMoveDir > 0 ? 1 : -1);

    return inputDirection;
};

const resolveLeadingCornerIndex = (
    corners: CornerPoint[],
    forceBias: -1 | 1,
    grounded: boolean
): CornerIndex => {
    const allCorners: CornerIndex[] = [0, 1, 2];
    if (!grounded) {
        return pickCornerByBias(allCorners, corners, forceBias);
    }

    const supportCorner = resolveGroundSupportCorner(corners, forceBias);
    const nonGroundedCorners = allCorners.filter((index) => index !== supportCorner) as CornerIndex[];
    return pickCornerByBias(nonGroundedCorners, corners, forceBias);
};

const resolveGroundSupportCorner = (
    corners: CornerPoint[],
    forceBias: -1 | 1
): CornerIndex => {
    const maxY = Math.max(corners[0]?.y ?? -Infinity, corners[1]?.y ?? -Infinity, corners[2]?.y ?? -Infinity);
    const touchingCandidates: CornerIndex[] = [0, 1, 2].filter((index) => {
        const cornerY = corners[index]?.y ?? -Infinity;
        return Math.abs(maxY - cornerY) <= PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON;
    }) as CornerIndex[];

    if (touchingCandidates.length === 1) {
        return touchingCandidates[0];
    }

    if (touchingCandidates.length > 1) {
        const oppositeBias: -1 | 1 = forceBias > 0 ? -1 : 1;
        return pickCornerByBias(touchingCandidates, corners, oppositeBias);
    }

    return 0;
};

const pickCornerByBias = (
    candidates: CornerIndex[],
    corners: CornerPoint[],
    forceBias: -1 | 1
): CornerIndex => {
    let selected = candidates[0] ?? 1;
    let selectedX = corners[selected]?.x ?? 0;

    candidates.forEach((candidate) => {
        const candidateX = corners[candidate]?.x ?? 0;
        const better = forceBias > 0
            ? candidateX > selectedX
            : candidateX < selectedX;
        if (better) {
            selected = candidate;
            selectedX = candidateX;
        }
    });

    return selected;
};

const resolveDashDirectionFromCorner = (
    corner: CornerPoint | undefined,
    forceBias: -1 | 1
): { x: number; y: number } => {
    if (!corner) {
        return { x: forceBias, y: 0 };
    }

    const length = Math.hypot(corner.x, corner.y);
    if (length <= 0.0001) {
        return { x: forceBias, y: 0 };
    }

    return {
        x: corner.x / length,
        y: corner.y / length
    };
};
