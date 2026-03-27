import type { PlayerTriangleDashState, PlayerTriangleShellState, TriangleCornerIndex } from './player_types';
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
    leadingCornerIndex: TriangleCornerIndex;
    lockedOrientationRad: number;
}

export interface TriangleDashLeadingCornerPreview {
    leadingCornerIndex: TriangleCornerIndex;
    lockedOrientationRad: number;
}

export const createTriangleDashState = (): PlayerTriangleDashState => {
    return {
        isActive: false,
        remainingMs: 0,
        cooldownMs: 0,
        directionX: 0,
        directionY: 0,
        forceBiasX: 1,
        selectedLeadingCornerIndex: 1,
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
    triangleDash.forceBiasX = 1;
    triangleDash.selectedLeadingCornerIndex = 1;
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
    grounded: boolean
): TriangleDashLaunch | null => {
    if (triangleDash.isActive || triangleDash.cooldownMs > 0) {
        return null;
    }

    const preview = getTriangleDashSelectedLeadingCornerPreview(
        triangleDash,
        triangleShell,
        grounded
    );
    const corners = getRotatedCorners(preview.lockedOrientationRad);
    const leadingCornerIndex = preview.leadingCornerIndex;
    const direction = resolveDashDirectionFromCorner(corners[leadingCornerIndex], triangleDash.forceBiasX);

    triangleDash.isActive = true;
    triangleDash.remainingMs = PLAYER_TRIANGLE_DASH_DURATION_MS;
    triangleDash.cooldownMs = PLAYER_TRIANGLE_DASH_COOLDOWN_MS;
    triangleDash.directionX = direction.x;
    triangleDash.directionY = direction.y;
    triangleDash.selectedLeadingCornerIndex = leadingCornerIndex;
    triangleDash.leadingCornerIndex = leadingCornerIndex;
    triangleDash.lockedOrientationRad = preview.lockedOrientationRad;

    return {
        velocityX: direction.x * PLAYER_TRIANGLE_DASH_SPEED,
        velocityY: direction.y * PLAYER_TRIANGLE_DASH_SPEED,
        leadingCornerIndex,
        lockedOrientationRad: preview.lockedOrientationRad
    };
};

export const resolveTriangleDashLeadingCornerPreview = (
    triangleDash: PlayerTriangleDashState,
    triangleShell: PlayerTriangleShellState,
    grounded: boolean
): TriangleDashLeadingCornerPreview => {
    return getTriangleDashSelectedLeadingCornerPreview(triangleDash, triangleShell, grounded);
};

export const updateTriangleDashSelectedLeadingCorner = (
    triangleDash: PlayerTriangleDashState,
    triangleShell: PlayerTriangleShellState,
    horizontalMoveDir: number,
    fallbackFacingDirection: -1 | 1,
    grounded: boolean
): void => {
    const lockedOrientationRad = grounded
        ? triangleShell.groundedOrientationRad
        : triangleShell.orientationRad;
    const corners = getRotatedCorners(lockedOrientationRad);

    if (grounded) {
        triangleDash.selectedLeadingCornerIndex = resolveGroundedLeadingCornerIndex(corners);
        return;
    }

    const hasSelectionInput = horizontalMoveDir !== 0;

    if (hasSelectionInput) {
        const forceBias = resolveForceBias(horizontalMoveDir, fallbackFacingDirection);
        triangleDash.forceBiasX = forceBias;
        triangleDash.selectedLeadingCornerIndex = resolveLeadingCornerIndex(corners, forceBias);
        return;
    }

    if (isSelectedCornerValid(triangleDash.selectedLeadingCornerIndex, corners, grounded)) {
        return;
    }

    const recoveryBias = resolveForceBias(0, fallbackFacingDirection);
    triangleDash.forceBiasX = recoveryBias;
    triangleDash.selectedLeadingCornerIndex = resolveLeadingCornerIndex(corners, recoveryBias);
};

export const stopTriangleDash = (triangleDash: PlayerTriangleDashState): void => {
    triangleDash.isActive = false;
    triangleDash.remainingMs = 0;
};

type CornerPoint = { x: number; y: number };

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_LOCAL_CORNERS: ReadonlyArray<CornerPoint> = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;
const TRIANGLE_CORNER_INDICES: TriangleCornerIndex[] = [0, 1, 2];

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
    forceBias: -1 | 1
): TriangleCornerIndex => {
    return pickCornerByBias(TRIANGLE_CORNER_INDICES, corners, forceBias);
};

const resolveGroundContactCorners = (corners: CornerPoint[]): TriangleCornerIndex[] => {
    const maxY = Math.max(corners[0]?.y ?? -Infinity, corners[1]?.y ?? -Infinity, corners[2]?.y ?? -Infinity);
    return [0, 1, 2].filter((index) => {
        const cornerY = corners[index]?.y ?? -Infinity;
        return Math.abs(maxY - cornerY) <= PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON;
    }) as TriangleCornerIndex[];
};

const pickCornerByBias = (
    candidates: TriangleCornerIndex[],
    corners: CornerPoint[],
    forceBias: -1 | 1
): TriangleCornerIndex => {
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

const pickMostUpwardCorner = (
    candidates: TriangleCornerIndex[],
    corners: CornerPoint[]
): TriangleCornerIndex => {
    let selected = candidates[0] ?? 1;
    let selectedY = corners[selected]?.y ?? 0;
    let selectedAbsX = Math.abs(corners[selected]?.x ?? 0);

    candidates.forEach((candidate) => {
        const candidatePoint = corners[candidate];
        const candidateY = candidatePoint?.y ?? 0;
        const candidateAbsX = Math.abs(candidatePoint?.x ?? 0);
        const isMoreUpward = candidateY < selectedY;
        const isSameHeightMoreCentered = candidateY === selectedY && candidateAbsX < selectedAbsX;

        if (isMoreUpward || isSameHeightMoreCentered) {
            selected = candidate;
            selectedY = candidateY;
            selectedAbsX = candidateAbsX;
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

const getTriangleDashSelectedLeadingCornerPreview = (
    triangleDash: PlayerTriangleDashState,
    triangleShell: PlayerTriangleShellState,
    grounded: boolean
): TriangleDashLeadingCornerPreview => {
    const lockedOrientationRad = grounded
        ? triangleShell.groundedOrientationRad
        : triangleShell.orientationRad;
    const corners = getRotatedCorners(lockedOrientationRad);
    let leadingCornerIndex = triangleDash.selectedLeadingCornerIndex;

    if (grounded) {
        leadingCornerIndex = resolveGroundedLeadingCornerIndex(corners);
        triangleDash.selectedLeadingCornerIndex = leadingCornerIndex;
        return {
            leadingCornerIndex,
            lockedOrientationRad
        };
    }

    if (!isSelectedCornerValid(leadingCornerIndex, corners, grounded)) {
        leadingCornerIndex = resolveLeadingCornerIndex(corners, triangleDash.forceBiasX);
        triangleDash.selectedLeadingCornerIndex = leadingCornerIndex;
    }

    return {
        leadingCornerIndex,
        lockedOrientationRad
    };
};

const isSelectedCornerValid = (
    cornerIndex: TriangleCornerIndex,
    corners: CornerPoint[],
    grounded: boolean
): boolean => {
    if (!grounded) {
        return true;
    }

    return cornerIndex === resolveGroundedLeadingCornerIndex(corners);
};

const resolveGroundedLeadingCornerIndex = (
    corners: CornerPoint[]
): TriangleCornerIndex => {
    const groundedContactCorners = resolveGroundContactCorners(corners);
    const nonGroundedCorners = TRIANGLE_CORNER_INDICES.filter((index) => !groundedContactCorners.includes(index)) as TriangleCornerIndex[];

    if (groundedContactCorners.length === 2 && nonGroundedCorners.length === 1) {
        return nonGroundedCorners[0];
    }

    if (nonGroundedCorners.length > 0) {
        return pickMostUpwardCorner(nonGroundedCorners, corners);
    }

    return pickMostUpwardCorner(TRIANGLE_CORNER_INDICES, corners);
};
