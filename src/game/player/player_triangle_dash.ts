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
        forcePointIntentX: 0,
        forcePointIntentY: -1,
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
    triangleDash.forcePointIntentX = 0;
    triangleDash.forcePointIntentY = -1;
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
    forcePointX: -1 | 0 | 1,
    forcePointY: -1 | 0 | 1,
    grounded: boolean
): void => {
    const lockedOrientationRad = grounded
        ? triangleShell.groundedOrientationRad
        : triangleShell.orientationRad;
    const corners = getRotatedCorners(lockedOrientationRad);
    updateForcePointIntent(triangleDash, forcePointX, forcePointY);

    if (grounded) {
        triangleDash.selectedLeadingCornerIndex = resolveGroundedLeadingCornerIndex(
            corners,
            triangleDash.forcePointIntentX,
            triangleDash.forcePointIntentY
        );
        return;
    }

    if (hasForcePointInput(forcePointX, forcePointY)) {
        triangleDash.selectedLeadingCornerIndex = resolveLeadingCornerIndexByForcePoint(
            TRIANGLE_CORNER_INDICES,
            corners,
            triangleDash.forcePointIntentX,
            triangleDash.forcePointIntentY
        );
        return;
    }

    if (isSelectedCornerValid(triangleDash.selectedLeadingCornerIndex, corners, grounded)) {
        return;
    }

    triangleDash.selectedLeadingCornerIndex = resolveLeadingCornerIndexByForcePoint(
        TRIANGLE_CORNER_INDICES,
        corners,
        triangleDash.forcePointIntentX,
        triangleDash.forcePointIntentY
    );
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

const resolveGroundContactCorners = (corners: CornerPoint[]): TriangleCornerIndex[] => {
    const maxY = Math.max(corners[0]?.y ?? -Infinity, corners[1]?.y ?? -Infinity, corners[2]?.y ?? -Infinity);
    return [0, 1, 2].filter((index) => {
        const cornerY = corners[index]?.y ?? -Infinity;
        return Math.abs(maxY - cornerY) <= PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON;
    }) as TriangleCornerIndex[];
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
        leadingCornerIndex = resolveGroundedLeadingCornerIndex(
            corners,
            triangleDash.forcePointIntentX,
            triangleDash.forcePointIntentY
        );
        triangleDash.selectedLeadingCornerIndex = leadingCornerIndex;
        return {
            leadingCornerIndex,
            lockedOrientationRad
        };
    }

    if (!isSelectedCornerValid(leadingCornerIndex, corners, grounded)) {
        leadingCornerIndex = resolveLeadingCornerIndexByForcePoint(
            TRIANGLE_CORNER_INDICES,
            corners,
            triangleDash.forcePointIntentX,
            triangleDash.forcePointIntentY
        );
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

    return cornerIndex === resolveGroundedLeadingCornerIndex(corners, 0, -1);
};

const resolveGroundedLeadingCornerIndex = (
    corners: CornerPoint[],
    forcePointX: -1 | 0 | 1,
    forcePointY: -1 | 0 | 1
): TriangleCornerIndex => {
    const groundedContactCorners = resolveGroundContactCorners(corners);
    const nonGroundedCorners = TRIANGLE_CORNER_INDICES.filter((index) => !groundedContactCorners.includes(index)) as TriangleCornerIndex[];

    if (groundedContactCorners.length === 2 && nonGroundedCorners.length === 1) {
        return nonGroundedCorners[0];
    }

    if (nonGroundedCorners.length > 0) {
        return resolveLeadingCornerIndexByForcePoint(nonGroundedCorners, corners, forcePointX, forcePointY);
    }

    return pickMostUpwardCorner(TRIANGLE_CORNER_INDICES, corners);
};

const resolveLeadingCornerIndexByForcePoint = (
    candidates: TriangleCornerIndex[],
    corners: CornerPoint[],
    forcePointX: -1 | 0 | 1,
    forcePointY: -1 | 0 | 1
): TriangleCornerIndex => {
    if (!hasForcePointInput(forcePointX, forcePointY)) {
        return pickMostUpwardCorner(candidates, corners);
    }

    let selected = candidates[0] ?? 1;
    let selectedScore = dot(corners[selected], forcePointX, forcePointY);
    let selectedY = corners[selected]?.y ?? 0;

    candidates.forEach((candidate) => {
        const candidateScore = dot(corners[candidate], forcePointX, forcePointY);
        const candidateY = corners[candidate]?.y ?? 0;
        const isBetterScore = candidateScore > selectedScore;
        const isEqualScoreMoreUpward = candidateScore === selectedScore && candidateY < selectedY;

        if (isBetterScore || isEqualScoreMoreUpward) {
            selected = candidate;
            selectedScore = candidateScore;
            selectedY = candidateY;
        }
    });

    return selected;
};

const dot = (
    corner: CornerPoint | undefined,
    forcePointX: -1 | 0 | 1,
    forcePointY: -1 | 0 | 1
): number => {
    const cornerX = corner?.x ?? 0;
    const cornerY = corner?.y ?? 0;
    return (cornerX * forcePointX) + (cornerY * forcePointY);
};

const hasForcePointInput = (
    forcePointX: -1 | 0 | 1,
    forcePointY: -1 | 0 | 1
): boolean => {
    return forcePointX !== 0 || forcePointY !== 0;
};

const updateForcePointIntent = (
    triangleDash: PlayerTriangleDashState,
    forcePointX: -1 | 0 | 1,
    forcePointY: -1 | 0 | 1
): void => {
    if (!hasForcePointInput(forcePointX, forcePointY)) {
        return;
    }

    triangleDash.forcePointIntentX = forcePointX;
    triangleDash.forcePointIntentY = forcePointY;
    if (forcePointX < 0) {
        triangleDash.forceBiasX = -1;
    } else if (forcePointX > 0) {
        triangleDash.forceBiasX = 1;
    }
};
