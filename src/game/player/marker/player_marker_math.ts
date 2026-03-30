import {
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_MARKER_MAX_OFFSET_PX,
    PLAYER_MARKER_RADIUS,
    PLAYER_PLACEHOLDER_RADIUS
} from '../player_constants';
import type { PlayerFormId } from '../player_types';
import { resolveTriangleCentroidOffset } from '../geometry/player_geometry_queries';

const EPSILON = 0.0001;
const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_LOCAL_VERTICES = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;
const TRIANGLE_CENTROID_OFFSET = resolveTriangleCentroidOffset();
const TRIANGLE_CENTROID_LOCAL_VERTICES = TRIANGLE_LOCAL_VERTICES.map((vertex) => {
    return {
        x: vertex.x - TRIANGLE_CENTROID_OFFSET.x,
        y: vertex.y - TRIANGLE_CENTROID_OFFSET.y
    };
}) as readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];

export const clampMarkerOffsetToForm = (
    form: PlayerFormId,
    offsetX: number,
    offsetY: number
): { x: number; y: number } => {
    if (form === 'ball') {
        return clampMarkerOffsetToCircle(offsetX, offsetY, Math.max(0, PLAYER_PLACEHOLDER_MARKER_RADIUS));
    }

    if (form === 'square') {
        const readableHalfExtent = Math.min(
            PLAYER_MARKER_MAX_OFFSET_PX,
            Math.max(0, (PLAYER_FORM_SQUARE_SIZE * 0.5) - PLAYER_MARKER_RADIUS - 4)
        );
        return {
            x: clamp(offsetX, -readableHalfExtent, readableHalfExtent),
            y: clamp(offsetY, -readableHalfExtent, readableHalfExtent)
        };
    }

    return clampMarkerOffsetToTriangle(offsetX, offsetY);
};

export const resolveMarkerIntent = (
    offsetX: number,
    offsetY: number
): { x: number; y: number; active: boolean } => {
    const length = Math.hypot(offsetX, offsetY);
    if (length <= 1.5) {
        return { x: 0, y: 0, active: false };
    }

    return {
        x: offsetX / length,
        y: offsetY / length,
        active: true
    };
};

const PLAYER_PLACEHOLDER_MARKER_RADIUS = Math.min(
    PLAYER_MARKER_MAX_OFFSET_PX,
    Math.max(0, PLAYER_PLACEHOLDER_RADIUS - PLAYER_MARKER_RADIUS - 4)
);

const clampMarkerOffsetToCircle = (
    offsetX: number,
    offsetY: number,
    radius: number
): { x: number; y: number } => {
    const length = Math.hypot(offsetX, offsetY);
    if (length <= radius || length <= EPSILON) {
        return { x: offsetX, y: offsetY };
    }

    const scale = radius / length;
    return {
        x: offsetX * scale,
        y: offsetY * scale
    };
};

const clampMarkerOffsetToTriangle = (offsetX: number, offsetY: number): { x: number; y: number } => {
    const insetVertices = insetConvexPolygon(TRIANGLE_CENTROID_LOCAL_VERTICES, PLAYER_MARKER_RADIUS + 1);

    if (pointInTriangle(offsetX, offsetY, insetVertices[0], insetVertices[1], insetVertices[2])) {
        return { x: offsetX, y: offsetY };
    }

    return closestPointOnTriangle(offsetX, offsetY, insetVertices[0], insetVertices[1], insetVertices[2]);
};

const insetConvexPolygon = (
    vertices: ReadonlyArray<{ x: number; y: number }>,
    insetDistance: number
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] => {
    const inset = Math.max(0, insetDistance);
    const nextVertices = vertices.map((current, index) => {
        const previous = vertices[(index - 1 + vertices.length) % vertices.length] ?? current;
        const next = vertices[(index + 1) % vertices.length] ?? current;
        const previousInsetLine = createInsetLine(previous, current, inset);
        const nextInsetLine = createInsetLine(current, next, inset);

        return intersectInsetLines(previousInsetLine, nextInsetLine, current);
    });

    return nextVertices as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
};

const createInsetLine = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    insetDistance: number
): { point: { x: number; y: number }; direction: { x: number; y: number } } => {
    const edgeX = end.x - start.x;
    const edgeY = end.y - start.y;
    const edgeLength = Math.hypot(edgeX, edgeY);
    if (edgeLength <= EPSILON) {
        return {
            point: { x: start.x, y: start.y },
            direction: { x: 1, y: 0 }
        };
    }

    const inwardNormalX = -edgeY / edgeLength;
    const inwardNormalY = edgeX / edgeLength;

    return {
        point: {
            x: start.x + (inwardNormalX * insetDistance),
            y: start.y + (inwardNormalY * insetDistance)
        },
        direction: {
            x: edgeX / edgeLength,
            y: edgeY / edgeLength
        }
    };
};

const intersectInsetLines = (
    first: { point: { x: number; y: number }; direction: { x: number; y: number } },
    second: { point: { x: number; y: number }; direction: { x: number; y: number } },
    fallback: { x: number; y: number }
): { x: number; y: number } => {
    const determinant = cross(first.direction.x, first.direction.y, second.direction.x, second.direction.y);
    if (Math.abs(determinant) <= EPSILON) {
        return fallback;
    }

    const deltaX = second.point.x - first.point.x;
    const deltaY = second.point.y - first.point.y;
    const t = cross(deltaX, deltaY, second.direction.x, second.direction.y) / determinant;

    return {
        x: first.point.x + (first.direction.x * t),
        y: first.point.y + (first.direction.y * t)
    };
};

const pointInTriangle = (
    px: number,
    py: number,
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
): boolean => {
    const denominator = ((b.y - c.y) * (a.x - c.x)) + ((c.x - b.x) * (a.y - c.y));
    if (Math.abs(denominator) <= EPSILON) {
        return false;
    }

    const w1 = (((b.y - c.y) * (px - c.x)) + ((c.x - b.x) * (py - c.y))) / denominator;
    const w2 = (((c.y - a.y) * (px - c.x)) + ((a.x - c.x) * (py - c.y))) / denominator;
    const w3 = 1 - w1 - w2;

    return w1 >= 0 && w2 >= 0 && w3 >= 0;
};

const closestPointOnTriangle = (
    px: number,
    py: number,
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
): { x: number; y: number } => {
    const ab = closestPointOnSegment(px, py, a, b);
    const bc = closestPointOnSegment(px, py, b, c);
    const ca = closestPointOnSegment(px, py, c, a);
    const candidates = [ab, bc, ca];

    let closest = candidates[0];
    let closestDistanceSq = distanceSq(px, py, closest.x, closest.y);

    for (let index = 1; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const candidateDistanceSq = distanceSq(px, py, candidate.x, candidate.y);
        if (candidateDistanceSq < closestDistanceSq) {
            closest = candidate;
            closestDistanceSq = candidateDistanceSq;
        }
    }

    return closest;
};

const closestPointOnSegment = (
    px: number,
    py: number,
    start: { x: number; y: number },
    end: { x: number; y: number }
): { x: number; y: number } => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = (dx * dx) + (dy * dy);
    if (lengthSq <= EPSILON) {
        return { x: start.x, y: start.y };
    }

    const t = clamp((((px - start.x) * dx) + ((py - start.y) * dy)) / lengthSq, 0, 1);
    return {
        x: start.x + (dx * t),
        y: start.y + (dy * t)
    };
};

const distanceSq = (ax: number, ay: number, bx: number, by: number): number => {
    const dx = ax - bx;
    const dy = ay - by;
    return (dx * dx) + (dy * dy);
};

const cross = (ax: number, ay: number, bx: number, by: number): number => {
    return (ax * by) - (ay * bx);
};

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
};
