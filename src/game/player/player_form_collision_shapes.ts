import type { PlayerFormId, PlayerTriangleShellState } from './player_types';
import {
    PLAYER_BALL_HAZARD_RADIUS,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_SQUARE_BODY_SIZE,
    PLAYER_SQUARE_HAZARD_SIZE,
    PLAYER_TRIANGLE_BODY_PROXY_HEIGHT,
    PLAYER_TRIANGLE_BODY_PROXY_WIDTH
} from './player_constants';

export interface PlayerAnchorOffset {
    x: number;
    y: number;
}

export interface PlayerFormAnchor {
    x: number;
    y: number;
}

export interface PlayerCircleBodyConfig {
    kind: 'circle';
    radius: number;
    centerOffset: PlayerAnchorOffset;
}

export interface PlayerBoxBodyConfig {
    kind: 'box';
    width: number;
    height: number;
    centerOffset: PlayerAnchorOffset;
}

export type PlayerLocomotionBodyConfig = PlayerCircleBodyConfig | PlayerBoxBodyConfig;

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

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_PROXY_TO_VISUAL_ANCHOR_OFFSET_Y = (PLAYER_TRIANGLE_BODY_PROXY_HEIGHT - PLAYER_FORM_TRIANGLE_HEIGHT) * 0.5;
const TRIANGLE_LOCAL_VERTICES = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;

export const resolvePlayerAnchorOffset = (
    form: PlayerFormId,
    triangleShell: PlayerTriangleShellState
): PlayerAnchorOffset => {
    if (form !== 'triangle') {
        return { x: 0, y: 0 };
    }

    return {
        x: 0,
        y: triangleShell.visualOffsetY + TRIANGLE_PROXY_TO_VISUAL_ANCHOR_OFFSET_Y
    };
};

export const resolvePlayerFormAnchor = (
    form: PlayerFormId,
    playerX: number,
    playerY: number,
    triangleShell: PlayerTriangleShellState
): PlayerFormAnchor => {
    const anchorOffset = resolvePlayerAnchorOffset(form, triangleShell);
    return {
        x: playerX + anchorOffset.x,
        y: playerY + anchorOffset.y
    };
};

export const resolvePlayerLocomotionBodyConfig = (
    form: PlayerFormId,
    triangleShell: PlayerTriangleShellState
): PlayerLocomotionBodyConfig => {
    // Triangle locomotion body uses a stable baseline proxy and does not track visual settle offsets.
    void triangleShell;

    if (form === 'ball') {
        return {
            kind: 'circle',
            radius: PLAYER_PLACEHOLDER_RADIUS,
            centerOffset: { x: 0, y: 0 }
        };
    }

    if (form === 'square') {
        return {
            kind: 'box',
            width: PLAYER_SQUARE_BODY_SIZE,
            height: PLAYER_SQUARE_BODY_SIZE,
            centerOffset: { x: 0, y: 0 }
        };
    }

    return {
        kind: 'box',
        width: PLAYER_TRIANGLE_BODY_PROXY_WIDTH,
        height: PLAYER_TRIANGLE_BODY_PROXY_HEIGHT,
        centerOffset: { x: 0, y: 0 }
    };
};

export const resolvePlayerHazardHitShape = (
    form: PlayerFormId,
    playerX: number,
    playerY: number,
    triangleShell: PlayerTriangleShellState
): PlayerHazardHitShape => {
    const formAnchor = resolvePlayerFormAnchor(form, playerX, playerY, triangleShell);

    if (form === 'ball') {
        return {
            kind: 'circle',
            centerX: formAnchor.x,
            centerY: formAnchor.y,
            radius: PLAYER_BALL_HAZARD_RADIUS
        };
    }

    if (form === 'square') {
        return {
            kind: 'box',
            centerX: formAnchor.x,
            centerY: formAnchor.y,
            width: PLAYER_SQUARE_HAZARD_SIZE,
            height: PLAYER_SQUARE_HAZARD_SIZE
        };
    }

    const orientationRad = triangleShell.orientationRad;
    const cos = Math.cos(orientationRad);
    const sin = Math.sin(orientationRad);
    const points = TRIANGLE_LOCAL_VERTICES.map((vertex) => {
        return {
            x: formAnchor.x + ((vertex.x * cos) - (vertex.y * sin)),
            y: formAnchor.y + ((vertex.x * sin) + (vertex.y * cos))
        };
    }) as [HazardShapePoint, HazardShapePoint, HazardShapePoint];

    return {
        kind: 'triangle',
        anchorX: formAnchor.x,
        anchorY: formAnchor.y,
        points
    };
};
