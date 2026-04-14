import type { GameObjects, Physics } from 'phaser';
import {
    createPlayerRectSnapshot,
    doesConvexPolygonOverlapRect,
    resolveWorldPointBounds
} from '../../player/geometry/player_geometry_queries';
import type { PlayerRectSnapshot } from '../../player/geometry/player_geometry_types';

export type TestWorldActorContactMode = 'arcade' | 'triangle_polygon';

export interface TestWorldArcadeBodyContactShapeSnapshot {
    kind: 'arcade_body';
    mode: 'arcade';
    bodyObject: GameObjects.GameObject;
    body: Physics.Arcade.Body | Physics.Arcade.StaticBody;
    bounds: PlayerRectSnapshot;
}

export interface TestWorldPolygonContactShapeSnapshot {
    kind: 'polygon_snapshot';
    mode: 'triangle_polygon';
    points: ReadonlyArray<{ x: number; y: number }>;
    bounds: PlayerRectSnapshot;
}

export type TestWorldActorContactShapeSnapshot =
    | TestWorldArcadeBodyContactShapeSnapshot
    | TestWorldPolygonContactShapeSnapshot;

export interface TestWorldActorWorldContactSnapshot {
    mode: TestWorldActorContactMode;
    grounded: boolean;
    blockedLeft: boolean;
    blockedRight: boolean;
}

const HORIZONTAL_SEPARATION_BIAS_PX = 24;

export const createArcadeBodyContactShapeSnapshot = (
    bodyObject: GameObjects.GameObject,
    body: Physics.Arcade.Body | Physics.Arcade.StaticBody
): TestWorldArcadeBodyContactShapeSnapshot => {
    return createArcadeBodyBoundsContactShapeSnapshot(bodyObject, body, body.x, body.y);
};

export const createArcadeBodyBoundsContactShapeSnapshot = (
    bodyObject: GameObjects.GameObject,
    body: Physics.Arcade.Body | Physics.Arcade.StaticBody,
    bodyX: number,
    bodyY: number
): TestWorldArcadeBodyContactShapeSnapshot => {
    return {
        kind: 'arcade_body',
        mode: 'arcade',
        bodyObject,
        body,
        bounds: createPlayerRectSnapshot(bodyX, bodyY, body.width, body.height)
    };
};

export const createPolygonContactShapeSnapshot = (
    points: ReadonlyArray<{ x: number; y: number }>
): TestWorldPolygonContactShapeSnapshot => {
    return {
        kind: 'polygon_snapshot',
        mode: 'triangle_polygon',
        points,
        bounds: resolveWorldPointBounds(points)
    };
};

export const doesActorContactShapeOverlap = (
    firstShape: TestWorldActorContactShapeSnapshot,
    secondShape: TestWorldActorContactShapeSnapshot
): boolean => {
    if (!doRectSnapshotsOverlap(firstShape.bounds, secondShape.bounds)) {
        return false;
    }

    if (firstShape.kind === 'arcade_body' && secondShape.kind === 'arcade_body') {
        return true;
    }

    if (firstShape.kind === 'polygon_snapshot' && secondShape.kind === 'arcade_body') {
        return doesConvexPolygonOverlapRect(firstShape.points, secondShape.bounds);
    }

    if (firstShape.kind === 'arcade_body' && secondShape.kind === 'polygon_snapshot') {
        return doesConvexPolygonOverlapRect(secondShape.points, firstShape.bounds);
    }

    if (firstShape.kind === 'polygon_snapshot' && secondShape.kind === 'polygon_snapshot') {
        return doConvexPolygonsOverlap(firstShape.points, secondShape.points);
    }

    return false;
};

export const resolvePolygonRectSeparationDelta = (
    polygonShape: TestWorldPolygonContactShapeSnapshot,
    rectShape: TestWorldArcadeBodyContactShapeSnapshot
): { x: number; y: number } | null => {
    if (!doRectSnapshotsOverlap(polygonShape.bounds, rectShape.bounds)) {
        return null;
    }

    const moveRectRight = polygonShape.bounds.right - rectShape.bounds.left;
    const moveRectLeft = rectShape.bounds.right - polygonShape.bounds.left;
    const moveRectDown = polygonShape.bounds.bottom - rectShape.bounds.top;
    const moveRectUp = rectShape.bounds.bottom - polygonShape.bounds.top;

    const separationX = rectShape.bounds.centerX >= polygonShape.bounds.centerX
        ? moveRectRight
        : -moveRectLeft;
    const separationY = rectShape.bounds.centerY >= polygonShape.bounds.centerY
        ? moveRectDown
        : -moveRectUp;

    const absSeparationX = Math.abs(separationX);
    const absSeparationY = Math.abs(separationY);
    if (absSeparationX <= 0 || absSeparationY <= 0) {
        return null;
    }

    // TEMPORARY: favor side-to-side pushing for Triangle-vs-actor bounds so NPCs
    // behave closer to the old Arcade contact path and do not pop upward off slopes.
    if (absSeparationX <= absSeparationY + HORIZONTAL_SEPARATION_BIAS_PX) {
        return {
            x: separationX,
            y: 0
        };
    }

    return {
        x: 0,
        y: separationY
    };
};

export const resolvePolygonHorizontalContactX = (
    polygonShape: TestWorldPolygonContactShapeSnapshot,
    sampleY: number,
    side: 'left' | 'right'
): number | null => {
    const intersections: number[] = [];
    const clampedSampleY = Math.max(
        polygonShape.bounds.top + 0.001,
        Math.min(sampleY, polygonShape.bounds.bottom - 0.001)
    );

    for (let index = 0; index < polygonShape.points.length; index += 1) {
        const pointA = polygonShape.points[index];
        const pointB = polygonShape.points[(index + 1) % polygonShape.points.length];
        const minY = Math.min(pointA.y, pointB.y);
        const maxY = Math.max(pointA.y, pointB.y);
        if (clampedSampleY < minY || clampedSampleY >= maxY) {
            continue;
        }

        const deltaY = pointB.y - pointA.y;
        if (Math.abs(deltaY) <= 0.0001) {
            continue;
        }

        const t = (clampedSampleY - pointA.y) / deltaY;
        intersections.push(pointA.x + ((pointB.x - pointA.x) * t));
    }

    if (intersections.length === 0) {
        return null;
    }

    return side === 'left'
        ? Math.min(...intersections)
        : Math.max(...intersections);
};

const doRectSnapshotsOverlap = (
    firstRect: Pick<PlayerRectSnapshot, 'left' | 'top' | 'right' | 'bottom'>,
    secondRect: Pick<PlayerRectSnapshot, 'left' | 'top' | 'right' | 'bottom'>
): boolean => {
    return firstRect.right > secondRect.left
        && secondRect.right > firstRect.left
        && firstRect.bottom > secondRect.top
        && secondRect.bottom > firstRect.top;
};

const doConvexPolygonsOverlap = (
    firstPolygon: ReadonlyArray<{ x: number; y: number }>,
    secondPolygon: ReadonlyArray<{ x: number; y: number }>
): boolean => {
    const axes = [
        ...resolvePolygonAxes(firstPolygon),
        ...resolvePolygonAxes(secondPolygon)
    ];

    return axes.every((axis) => {
        const firstProjection = projectPointsOntoAxis(firstPolygon, axis);
        const secondProjection = projectPointsOntoAxis(secondPolygon, axis);
        return firstProjection.max > secondProjection.min && secondProjection.max > firstProjection.min;
    });
};

const resolvePolygonAxes = (
    polygonPoints: ReadonlyArray<{ x: number; y: number }>
): Array<{ x: number; y: number }> => {
    const axes: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < polygonPoints.length; index += 1) {
        const pointA = polygonPoints[index];
        const pointB = polygonPoints[(index + 1) % polygonPoints.length];
        const edgeX = pointB.x - pointA.x;
        const edgeY = pointB.y - pointA.y;
        const edgeLength = Math.hypot(edgeX, edgeY);
        if (edgeLength <= 0.0001) {
            continue;
        }

        axes.push({
            x: -edgeY / edgeLength,
            y: edgeX / edgeLength
        });
    }

    return axes;
};

const projectPointsOntoAxis = (
    points: ReadonlyArray<{ x: number; y: number }>,
    axis: { x: number; y: number }
): { min: number; max: number } => {
    let min = ((points[0]?.x ?? 0) * axis.x) + ((points[0]?.y ?? 0) * axis.y);
    let max = min;

    for (let index = 1; index < points.length; index += 1) {
        const projection = (points[index].x * axis.x) + (points[index].y * axis.y);
        min = Math.min(min, projection);
        max = Math.max(max, projection);
    }

    return { min, max };
};
