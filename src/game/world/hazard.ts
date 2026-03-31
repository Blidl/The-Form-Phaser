import { GameObjects, Physics, Scene } from 'phaser';
import type { PlayerHazardHitShape } from '../player/player_form_collision_shapes';

export interface HazardConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface HazardObject {
    trigger: GameObjects.Rectangle;
    destroy: () => void;
}

interface HazardRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export const createHazard = (scene: Scene, config: HazardConfig): HazardObject => {
    const trigger = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor ?? 0xef5350, 0.75)
        .setStrokeStyle(2, config.strokeColor ?? 0xb71c1c)
        .setDepth(4300);

    scene.physics.add.existing(trigger, true);
    const triggerBody = trigger.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

    return {
        trigger,
        destroy: (): void => {
            trigger.destroy();
        }
    };
};

export const doesHazardOverlapPlayerShape = (
    hazard: HazardObject,
    shape: PlayerHazardHitShape
): boolean => {
    const hazardBody = hazard.trigger.body as Physics.Arcade.StaticBody;
    const hazardRect: HazardRect = {
        left: hazardBody.x,
        top: hazardBody.y,
        right: hazardBody.x + hazardBody.width,
        bottom: hazardBody.y + hazardBody.height
    };

    if (shape.kind === 'circle') {
        return circleIntersectsRect(shape.centerX, shape.centerY, shape.radius, hazardRect);
    }

    if (shape.kind === 'box') {
        const halfWidth = shape.width * 0.5;
        const halfHeight = shape.height * 0.5;
        return aabbIntersectsRect(
            shape.centerX - halfWidth,
            shape.centerY - halfHeight,
            shape.centerX + halfWidth,
            shape.centerY + halfHeight,
            hazardRect
        );
    }

    return triangleIntersectsRect(shape.points, hazardRect);
};

const circleIntersectsRect = (
    centerX: number,
    centerY: number,
    radius: number,
    rect: HazardRect
): boolean => {
    const closestX = clamp(centerX, rect.left, rect.right);
    const closestY = clamp(centerY, rect.top, rect.bottom);
    const dx = centerX - closestX;
    const dy = centerY - closestY;
    return ((dx * dx) + (dy * dy)) <= (radius * radius);
};

const aabbIntersectsRect = (
    left: number,
    top: number,
    right: number,
    bottom: number,
    rect: HazardRect
): boolean => {
    return !(right < rect.left || left > rect.right || bottom < rect.top || top > rect.bottom);
};

const triangleIntersectsRect = (
    points: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    rect: HazardRect
): boolean => {
    if (points.some((point) => isPointInRect(point.x, point.y, rect))) {
        return true;
    }

    const rectCorners = [
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.top },
        { x: rect.right, y: rect.bottom },
        { x: rect.left, y: rect.bottom }
    ];
    if (rectCorners.some((corner) => isPointInTriangle(corner.x, corner.y, points))) {
        return true;
    }

    const triangleEdges = [
        [points[0], points[1]],
        [points[1], points[2]],
        [points[2], points[0]]
    ] as const;
    const rectEdges = [
        [rectCorners[0], rectCorners[1]],
        [rectCorners[1], rectCorners[2]],
        [rectCorners[2], rectCorners[3]],
        [rectCorners[3], rectCorners[0]]
    ] as const;

    return triangleEdges.some((triangleEdge) => {
        return rectEdges.some((rectEdge) => {
            return segmentsIntersect(
                triangleEdge[0].x,
                triangleEdge[0].y,
                triangleEdge[1].x,
                triangleEdge[1].y,
                rectEdge[0].x,
                rectEdge[0].y,
                rectEdge[1].x,
                rectEdge[1].y
            );
        });
    });
};

const isPointInRect = (x: number, y: number, rect: HazardRect): boolean => {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
};

const isPointInTriangle = (
    x: number,
    y: number,
    triangle: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
): boolean => {
    const [a, b, c] = triangle;
    const denominator = ((b.y - c.y) * (a.x - c.x)) + ((c.x - b.x) * (a.y - c.y));
    if (Math.abs(denominator) <= 1e-7) {
        return false;
    }

    const alpha = (((b.y - c.y) * (x - c.x)) + ((c.x - b.x) * (y - c.y))) / denominator;
    const beta = (((c.y - a.y) * (x - c.x)) + ((a.x - c.x) * (y - c.y))) / denominator;
    const gamma = 1 - alpha - beta;
    const epsilon = 1e-6;

    return alpha >= -epsilon && beta >= -epsilon && gamma >= -epsilon;
};

const segmentsIntersect = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number
): boolean => {
    const abx = bx - ax;
    const aby = by - ay;
    const acx = cx - ax;
    const acy = cy - ay;
    const adx = dx - ax;
    const ady = dy - ay;
    const cdx = dx - cx;
    const cdy = dy - cy;
    const cax = ax - cx;
    const cay = ay - cy;
    const cbx = bx - cx;
    const cby = by - cy;
    const cross1 = cross(abx, aby, acx, acy);
    const cross2 = cross(abx, aby, adx, ady);
    const cross3 = cross(cdx, cdy, cax, cay);
    const cross4 = cross(cdx, cdy, cbx, cby);
    const epsilon = 1e-7;

    if (Math.abs(cross1) <= epsilon && onSegment(ax, ay, bx, by, cx, cy)) {
        return true;
    }

    if (Math.abs(cross2) <= epsilon && onSegment(ax, ay, bx, by, dx, dy)) {
        return true;
    }

    if (Math.abs(cross3) <= epsilon && onSegment(cx, cy, dx, dy, ax, ay)) {
        return true;
    }

    if (Math.abs(cross4) <= epsilon && onSegment(cx, cy, dx, dy, bx, by)) {
        return true;
    }

    return (cross1 > 0) !== (cross2 > 0) && (cross3 > 0) !== (cross4 > 0);
};

const onSegment = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number
): boolean => {
    return px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);
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
