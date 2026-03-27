import type { PlayerFormId, PlayerTriangleShellState } from './player_types';
import {
    PLAYER_BALL_HAZARD_RADIUS,
    PLAYER_SQUARE_HAZARD_SIZE
} from './player_constants';
import {
    PLAYER_TRIANGLE_HAZARD_LOCAL_VERTICES,
    resolveTriangleHazardAnchorOffset
} from './player_triangle_collision_proxy';

export interface HazardShapePoint {
    x: number;
    y: number;
}

export interface PlayerBallHazardHitShape {
    kind: 'circle';
    centerX: number;
    centerY: number;
    radius: number;
}

export interface PlayerSquareHazardHitShape {
    kind: 'box';
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

export interface PlayerTriangleHazardHitShape {
    kind: 'triangle';
    anchorX: number;
    anchorY: number;
    points: [HazardShapePoint, HazardShapePoint, HazardShapePoint];
}

export type PlayerHazardHitShape =
    | PlayerBallHazardHitShape
    | PlayerSquareHazardHitShape
    | PlayerTriangleHazardHitShape;

export const resolvePlayerHazardHitShape = (
    form: PlayerFormId,
    playerX: number,
    playerY: number,
    triangleShell: PlayerTriangleShellState
): PlayerHazardHitShape => {
    if (form === 'ball') {
        return {
            kind: 'circle',
            centerX: playerX,
            centerY: playerY,
            radius: PLAYER_BALL_HAZARD_RADIUS
        };
    }

    if (form === 'square') {
        return {
            kind: 'box',
            centerX: playerX,
            centerY: playerY,
            width: PLAYER_SQUARE_HAZARD_SIZE,
            height: PLAYER_SQUARE_HAZARD_SIZE
        };
    }

    const anchorOffset = resolveTriangleHazardAnchorOffset(triangleShell.visualOffsetY);
    const anchorX = playerX + anchorOffset.x;
    const anchorY = playerY + anchorOffset.y;
    const orientationRad = triangleShell.orientationRad;
    const cos = Math.cos(orientationRad);
    const sin = Math.sin(orientationRad);

    const worldPoints = PLAYER_TRIANGLE_HAZARD_LOCAL_VERTICES.map((vertex) => {
        return {
            x: anchorX + ((vertex.x * cos) - (vertex.y * sin)),
            y: anchorY + ((vertex.x * sin) + (vertex.y * cos))
        };
    }) as [HazardShapePoint, HazardShapePoint, HazardShapePoint];

    return {
        kind: 'triangle',
        anchorX,
        anchorY,
        points: worldPoints
    };
};
