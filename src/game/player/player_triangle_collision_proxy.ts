import {
    PLAYER_TRIANGLE_HAZARD_HEIGHT,
    PLAYER_TRIANGLE_HAZARD_WIDTH
} from './player_constants';

export interface TriangleLocalVertex {
    x: number;
    y: number;
}

const TRIANGLE_HALF_WIDTH = PLAYER_TRIANGLE_HAZARD_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_TRIANGLE_HAZARD_HEIGHT * 0.5;

export const PLAYER_TRIANGLE_HAZARD_LOCAL_VERTICES: readonly TriangleLocalVertex[] = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;

export const resolveTriangleHazardAnchorOffset = (
    triangleVisualOffsetY: number
): TriangleLocalVertex => {
    return {
        x: 0,
        y: triangleVisualOffsetY
    };
};
