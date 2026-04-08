import type { PlayerInputSnapshot } from './player_input';

interface SquareAttachSurfaceVelocity {
    holdVelocityX: number;
    holdVelocityY: number;
    velocityX: number;
    velocityY: number;
}

export const resolveSquareAttachSurfaceVelocity = (
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1,
    input: PlayerInputSnapshot,
    holdStickSpeed: number,
    surfaceMoveSpeed: number
): SquareAttachSurfaceVelocity => {
    const holdVelocityX = -attachNormalX * holdStickSpeed;
    const holdVelocityY = -attachNormalY * holdStickSpeed;
    const horizontalDir = (input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0);
    const verticalDir = (input.moveDown ? 1 : 0) - (input.moveUp ? 1 : 0);

    let velocityX = holdVelocityX;
    let velocityY = holdVelocityY;

    if (attachNormalY !== 0) {
        velocityX += horizontalDir * surfaceMoveSpeed;
    } else if (verticalDir !== 0) {
        velocityY += verticalDir * surfaceMoveSpeed;
    }

    return {
        holdVelocityX,
        holdVelocityY,
        velocityX,
        velocityY
    };
};
