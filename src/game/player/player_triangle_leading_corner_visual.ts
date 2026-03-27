import {
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH
} from './player_constants';
import type { TriangleCornerIndex } from './player_types';

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;

const TRIANGLE_LOCAL_CORNERS: ReadonlyArray<{ x: number; y: number }> = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;

export const resolveTriangleLeadingCornerMarkerOffset = (
    cornerIndex: TriangleCornerIndex,
    orientationRad: number,
    outwardOffset: number
): { x: number; y: number } => {
    const localCorner = TRIANGLE_LOCAL_CORNERS[cornerIndex] ?? TRIANGLE_LOCAL_CORNERS[1];
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);
    const rotatedX = (localCorner.x * cos) - (localCorner.y * sin);
    const rotatedY = (localCorner.x * sin) + (localCorner.y * cos);
    const cornerLength = Math.hypot(rotatedX, rotatedY);

    if (cornerLength <= 0.0001 || outwardOffset <= 0) {
        return {
            x: rotatedX,
            y: rotatedY
        };
    }

    const outwardScale = outwardOffset / cornerLength;
    return {
        x: rotatedX + (rotatedX * outwardScale),
        y: rotatedY + (rotatedY * outwardScale)
    };
};
