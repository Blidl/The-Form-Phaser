import type { PlayerSquareTrailSupportOwner } from './player_types';

export const getSquareSupportCurrentPosition = (
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    if (supportOwner.body === null) {
        return { x: supportOwner.originX, y: supportOwner.originY };
    }

    return {
        x: supportOwner.body.x,
        y: supportOwner.body.y
    };
};

export const squareSupportWorldToLocal = (
    worldX: number,
    worldY: number,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    const supportPosition = getSquareSupportCurrentPosition(supportOwner);
    return {
        x: worldX - supportPosition.x + supportOwner.originX,
        y: worldY - supportPosition.y + supportOwner.originY
    };
};

export const squareSupportLocalToWorld = (
    localX: number,
    localY: number,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    const supportPosition = getSquareSupportCurrentPosition(supportOwner);
    return {
        x: localX + supportPosition.x - supportOwner.originX,
        y: localY + supportPosition.y - supportOwner.originY
    };
};
