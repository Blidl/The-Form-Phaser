import type { PlayerTriangleFlightState, PlayerTriangleShellState, TriangleCornerIndex } from './player_types';
import {
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_TRIANGLE_FLIGHT_MAX_SECTIONS,
    PLAYER_TRIANGLE_FLIGHT_RESTORE_SPEED_PX_PER_SEC,
    PLAYER_TRIANGLE_FLIGHT_SECTION_DISTANCE_PX,
    PLAYER_TRIANGLE_FLIGHT_SPEED,
    PLAYER_TRIANGLE_FLIGHT_TURN_SPEED_RAD_PER_SEC
} from './player_constants';
import { resolveTriangleCentroidOffset, resolveTriangleWorldPoints } from './geometry/player_geometry_queries';

const EPSILON = 0.0001;
const TRIANGLE_CORNER_INDICES: TriangleCornerIndex[] = [0, 1, 2];
const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_CENTROID_OFFSET = resolveTriangleCentroidOffset();
const MAX_FLIGHT_RESOURCE_DISTANCE_PX = PLAYER_TRIANGLE_FLIGHT_SECTION_DISTANCE_PX * PLAYER_TRIANGLE_FLIGHT_MAX_SECTIONS;
const TRIANGLE_LOCAL_CORNERS = [
    { x: -TRIANGLE_HALF_WIDTH - TRIANGLE_CENTROID_OFFSET.x, y: TRIANGLE_HALF_HEIGHT - TRIANGLE_CENTROID_OFFSET.y },
    { x: -TRIANGLE_CENTROID_OFFSET.x, y: -TRIANGLE_HALF_HEIGHT - TRIANGLE_CENTROID_OFFSET.y },
    { x: TRIANGLE_HALF_WIDTH - TRIANGLE_CENTROID_OFFSET.x, y: TRIANGLE_HALF_HEIGHT - TRIANGLE_CENTROID_OFFSET.y }
] as const;

export const createTriangleFlightState = (): PlayerTriangleFlightState => {
    return {
        isActive: false,
        directionX: 0,
        directionY: -1,
        forceBiasX: 1,
        forcePointIntentX: 0,
        forcePointIntentY: -1,
        selectedLeadingCornerIndex: 1,
        leadingCornerIndex: 1,
        activeSectionRemainingDistancePx: MAX_FLIGHT_RESOURCE_DISTANCE_PX,
        spentSectionCount: 0,
        maxSectionCount: PLAYER_TRIANGLE_FLIGHT_MAX_SECTIONS
    };
};

export const resetTriangleFlightState = (triangleFlight: PlayerTriangleFlightState): void => {
    triangleFlight.isActive = false;
    triangleFlight.directionX = 0;
    triangleFlight.directionY = -1;
    triangleFlight.forceBiasX = 1;
    triangleFlight.forcePointIntentX = 0;
    triangleFlight.forcePointIntentY = -1;
    triangleFlight.selectedLeadingCornerIndex = 1;
    triangleFlight.leadingCornerIndex = 1;
    triangleFlight.activeSectionRemainingDistancePx = MAX_FLIGHT_RESOURCE_DISTANCE_PX;
    triangleFlight.spentSectionCount = 0;
    triangleFlight.maxSectionCount = PLAYER_TRIANGLE_FLIGHT_MAX_SECTIONS;
};

export const stopTriangleFlight = (triangleFlight: PlayerTriangleFlightState): void => {
    triangleFlight.isActive = false;
    triangleFlight.directionX = 0;
    triangleFlight.directionY = 0;
};

export const restoreTriangleFlightSections = (triangleFlight: PlayerTriangleFlightState): void => {
    triangleFlight.isActive = false;
    triangleFlight.spentSectionCount = triangleFlight.activeSectionRemainingDistancePx >= MAX_FLIGHT_RESOURCE_DISTANCE_PX - EPSILON ? 0 : 1;
};

export const refillTriangleFlightResource = (triangleFlight: PlayerTriangleFlightState): void => {
    triangleFlight.activeSectionRemainingDistancePx = MAX_FLIGHT_RESOURCE_DISTANCE_PX;
    triangleFlight.spentSectionCount = 0;
};

export const hasTriangleFlightSectionsRemaining = (triangleFlight: PlayerTriangleFlightState): boolean => {
    return triangleFlight.activeSectionRemainingDistancePx >= MAX_FLIGHT_RESOURCE_DISTANCE_PX - EPSILON;
};

export const hasTriangleFlightUsableResource = (triangleFlight: PlayerTriangleFlightState): boolean => {
    return triangleFlight.activeSectionRemainingDistancePx > EPSILON;
};

export const tryStartTriangleFlight = (triangleFlight: PlayerTriangleFlightState): boolean => {
    if (triangleFlight.isActive || !hasTriangleFlightUsableResource(triangleFlight)) {
        return false;
    }

    triangleFlight.isActive = true;
    const direction = resolveFlightDirection(triangleFlight);
    triangleFlight.directionX = direction.x;
    triangleFlight.directionY = direction.y;
    triangleFlight.leadingCornerIndex = triangleFlight.selectedLeadingCornerIndex;
    return true;
};

export const tickTriangleFlightState = (
    triangleFlight: PlayerTriangleFlightState,
    deltaSec: number
): void => {
    if (!triangleFlight.isActive) {
        return;
    }

    const consumedDistancePx = Math.max(0, PLAYER_TRIANGLE_FLIGHT_SPEED * deltaSec);
    triangleFlight.activeSectionRemainingDistancePx = Math.max(
        0,
        triangleFlight.activeSectionRemainingDistancePx - consumedDistancePx
    );
    if (triangleFlight.activeSectionRemainingDistancePx > EPSILON) {
        return;
    }

    triangleFlight.activeSectionRemainingDistancePx = 0;
    triangleFlight.spentSectionCount = triangleFlight.maxSectionCount;
    stopTriangleFlight(triangleFlight);
};

export const tickTriangleFlightRestore = (
    triangleFlight: PlayerTriangleFlightState,
    deltaSec: number
): void => {
    if (triangleFlight.isActive) {
        return;
    }

    if (triangleFlight.activeSectionRemainingDistancePx >= MAX_FLIGHT_RESOURCE_DISTANCE_PX - EPSILON) {
        triangleFlight.activeSectionRemainingDistancePx = MAX_FLIGHT_RESOURCE_DISTANCE_PX;
        triangleFlight.spentSectionCount = 0;
        return;
    }

    triangleFlight.activeSectionRemainingDistancePx = Math.min(
        MAX_FLIGHT_RESOURCE_DISTANCE_PX,
        triangleFlight.activeSectionRemainingDistancePx + (PLAYER_TRIANGLE_FLIGHT_RESTORE_SPEED_PX_PER_SEC * deltaSec)
    );
    triangleFlight.spentSectionCount = triangleFlight.activeSectionRemainingDistancePx >= MAX_FLIGHT_RESOURCE_DISTANCE_PX - EPSILON
        ? 0
        : triangleFlight.maxSectionCount;
};

export const updateTriangleFlightIntent = (
    triangleFlight: PlayerTriangleFlightState,
    triangleShell: PlayerTriangleShellState,
    forcePointX: number,
    forcePointY: number,
    forcePointActive: boolean
): void => {
    updateForcePointIntent(triangleFlight, forcePointX, forcePointY, forcePointActive);
    const corners = resolveTriangleWorldPoints(0, 0, triangleShell.orientationRad);
    triangleFlight.selectedLeadingCornerIndex = resolveLeadingCornerIndexByForcePoint(
        corners.map((corner) => ({ x: corner.x, y: corner.y })),
        triangleFlight.forcePointIntentX,
        triangleFlight.forcePointIntentY
    );

    if (!triangleFlight.isActive) {
        return;
    }

    triangleFlight.leadingCornerIndex = triangleFlight.selectedLeadingCornerIndex;
    const direction = resolveFlightDirection(triangleFlight);
    triangleFlight.directionX = direction.x;
    triangleFlight.directionY = direction.y;
};

export const tickTriangleFlightOrientation = (
    triangleFlight: PlayerTriangleFlightState,
    triangleShell: PlayerTriangleShellState,
    deltaSec: number
): void => {
    if (!triangleFlight.isActive) {
        return;
    }

    triangleShell.airborneAngularVelocityRadPerSec = 0;
    const targetOrientationRad = resolveFlightTargetOrientation(
        triangleFlight.leadingCornerIndex,
        triangleFlight.forcePointIntentX,
        triangleFlight.forcePointIntentY
    );
    const maxStep = PLAYER_TRIANGLE_FLIGHT_TURN_SPEED_RAD_PER_SEC * deltaSec;
    triangleShell.orientationRad = moveTowardAngle(
        triangleShell.orientationRad,
        targetOrientationRad,
        maxStep
    );
};

export const applyTriangleFlightVelocity = (
    triangleFlight: PlayerTriangleFlightState
): { velocityX: number; velocityY: number } => {
    const direction = resolveFlightDirection(triangleFlight);
    triangleFlight.directionX = direction.x;
    triangleFlight.directionY = direction.y;

    return {
        velocityX: direction.x * PLAYER_TRIANGLE_FLIGHT_SPEED,
        velocityY: direction.y * PLAYER_TRIANGLE_FLIGHT_SPEED
    };
};

export const resolveTriangleFlightResource = (
    triangleFlight: PlayerTriangleFlightState
): { current: number; max: number; ratio: number } => {
    const max = MAX_FLIGHT_RESOURCE_DISTANCE_PX;
    const current = Math.max(0, Math.min(max, triangleFlight.activeSectionRemainingDistancePx));

    return {
        current,
        max,
        ratio: max <= 0 ? 0 : Math.max(0, Math.min(1, current / max))
    };
};

const resolveFlightDirection = (
    triangleFlight: PlayerTriangleFlightState
): { x: number; y: number } => {
    if (hasForcePointInput(triangleFlight.forcePointIntentX, triangleFlight.forcePointIntentY)) {
        return normalizeVector(triangleFlight.forcePointIntentX, triangleFlight.forcePointIntentY, triangleFlight.forceBiasX);
    }

    return normalizeVector(triangleFlight.forceBiasX, -1, triangleFlight.forceBiasX);
};

const resolveFlightTargetOrientation = (
    leadingCornerIndex: TriangleCornerIndex,
    forcePointIntentX: number,
    forcePointIntentY: number
): number => {
    const direction = normalizeVector(forcePointIntentX, forcePointIntentY, 1);
    const localCorner = TRIANGLE_LOCAL_CORNERS[leadingCornerIndex] ?? TRIANGLE_LOCAL_CORNERS[1];
    const cornerAngle = Math.atan2(localCorner.y, localCorner.x);
    const targetAngle = Math.atan2(direction.y, direction.x);
    return normalizeAngle(targetAngle - cornerAngle);
};

const resolveLeadingCornerIndexByForcePoint = (
    corners: ReadonlyArray<{ x: number; y: number }>,
    forcePointX: number,
    forcePointY: number
): TriangleCornerIndex => {
    if (!hasForcePointInput(forcePointX, forcePointY)) {
        return 1;
    }

    let selected = TRIANGLE_CORNER_INDICES[0];
    let selectedScore = dot(corners[selected], forcePointX, forcePointY);

    TRIANGLE_CORNER_INDICES.forEach((candidate) => {
        const candidateScore = dot(corners[candidate], forcePointX, forcePointY);
        if (candidateScore > selectedScore) {
            selected = candidate;
            selectedScore = candidateScore;
        }
    });

    return selected;
};

const updateForcePointIntent = (
    triangleFlight: PlayerTriangleFlightState,
    forcePointX: number,
    forcePointY: number,
    forcePointActive: boolean
): void => {
    if (!forcePointActive) {
        return;
    }

    triangleFlight.forcePointIntentX = forcePointX;
    triangleFlight.forcePointIntentY = forcePointY;
    if (forcePointX < 0) {
        triangleFlight.forceBiasX = -1;
    } else if (forcePointX > 0) {
        triangleFlight.forceBiasX = 1;
    }
};

const hasForcePointInput = (forcePointX: number, forcePointY: number): boolean => {
    return Math.hypot(forcePointX, forcePointY) > 0.001;
};

const dot = (
    corner: { x: number; y: number } | undefined,
    forcePointX: number,
    forcePointY: number
): number => {
    const cornerX = corner?.x ?? 0;
    const cornerY = corner?.y ?? 0;
    return (cornerX * forcePointX) + (cornerY * forcePointY);
};

const normalizeVector = (x: number, y: number, fallbackXSign: -1 | 1): { x: number; y: number } => {
    const length = Math.hypot(x, y);
    if (length <= EPSILON) {
        return { x: fallbackXSign, y: 0 };
    }

    return {
        x: x / length,
        y: y / length
    };
};

const moveTowardAngle = (current: number, target: number, maxDelta: number): number => {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    if (Math.abs(delta) <= maxDelta) {
        return normalizeAngle(target);
    }

    return normalizeAngle(current + (Math.sign(delta) * maxDelta));
};

const normalizeAngle = (angle: number): number => {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
};
