import type { PlayerTriangleDashState, PlayerTriangleShellState, TriangleCornerIndex } from './player_types';
import {
    PLAYER_TRIANGLE_DASH_COOLDOWN_MS,
    PLAYER_TRIANGLE_DASH_DURATION_MS,
    PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON,
    PLAYER_TRIANGLE_DASH_SPEED
} from './player_constants';
import { resolveTriangleWorldPoints } from './geometry/player_geometry_queries';

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
        stopTriangleDash(triangleDash);
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
    const direction = resolveDashDirectionFromCorner(
        corners[leadingCornerIndex],
        triangleDash.forceBiasX,
        grounded
    );

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
    forcePointActive: boolean,
    grounded: boolean
): void => {
    const lockedOrientationRad = grounded
        ? triangleShell.groundedOrientationRad
        : triangleShell.orientationRad;
    const corners = getRotatedCorners(lockedOrientationRad);
    updateForcePointIntent(triangleDash, forcePointX, forcePointY, forcePointActive);
    const candidates = TRIANGLE_CORNER_INDICES;

    if (grounded) {
        triangleDash.selectedLeadingCornerIndex = pickMostUpwardCorner(candidates, corners);
        return;
    }

    if (!forcePointActive && candidates.includes(triangleDash.selectedLeadingCornerIndex)) {
        return;
    }

    triangleDash.selectedLeadingCornerIndex = resolveLeadingCornerIndexByForcePoint(
        candidates,
        corners,
        triangleDash.forcePointIntentX,
        triangleDash.forcePointIntentY
    );
};

export const stopTriangleDash = (triangleDash: PlayerTriangleDashState): void => {
    triangleDash.isActive = false;
    triangleDash.remainingMs = 0;
    triangleDash.directionX = 0;
    triangleDash.directionY = 0;
};

type CornerPoint = { x: number; y: number };

const TRIANGLE_CORNER_INDICES: TriangleCornerIndex[] = [0, 1, 2];

const getRotatedCorners = (orientationRad: number): CornerPoint[] => {
    return resolveTriangleWorldPoints(0, 0, orientationRad).map((corner) => {
        return {
            x: corner.x,
            y: corner.y
        };
    });
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
    forceBias: -1 | 1,
    grounded: boolean
): { x: number; y: number } => {
    if (!corner) {
        return grounded
            ? normalizeDashDirection(forceBias, -PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON, forceBias)
            : { x: forceBias, y: 0 };
    }

    const length = Math.hypot(corner.x, corner.y);
    if (length <= 0.0001) {
        return grounded
            ? normalizeDashDirection(forceBias, -PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON, forceBias)
            : { x: forceBias, y: 0 };
    }

    const direction = {
        x: corner.x / length,
        y: corner.y / length
    };

    if (!grounded) {
        return direction;
    }

    const groundedMinUpwardY = -Math.max(0, Math.min(1, PLAYER_TRIANGLE_DASH_GROUND_CONTACT_EPSILON));
    if (direction.y <= groundedMinUpwardY) {
        return direction;
    }

    const preferredXSign = Math.abs(direction.x) > 0.0001
        ? (direction.x > 0 ? 1 : -1)
        : forceBias;
    return normalizeDashDirection(direction.x, groundedMinUpwardY, preferredXSign);
};

const normalizeDashDirection = (
    x: number,
    y: number,
    fallbackXSign: -1 | 1
): { x: number; y: number } => {
    const rawLength = Math.hypot(x, y);
    if (rawLength <= 0.0001) {
        return { x: fallbackXSign, y: 0 };
    }

    const nx = x / rawLength;
    const ny = y / rawLength;
    if (Math.abs(ny) >= 0.9999) {
        return { x: 0, y: ny > 0 ? 1 : -1 };
    }

    return { x: nx, y: ny };
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
    const candidates = TRIANGLE_CORNER_INDICES;

    if (grounded) {
        const topVertex = pickMostUpwardCorner(candidates, corners);
        triangleDash.selectedLeadingCornerIndex = topVertex;
        return {
            leadingCornerIndex: topVertex,
            lockedOrientationRad
        };
    }

    let leadingCornerIndex = triangleDash.selectedLeadingCornerIndex;

    if (!candidates.includes(leadingCornerIndex)) {
        leadingCornerIndex = resolveLeadingCornerIndexByForcePoint(
            candidates,
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
    forcePointY: -1 | 0 | 1,
    forcePointActive: boolean
): void => {
    if (!forcePointActive) {
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
