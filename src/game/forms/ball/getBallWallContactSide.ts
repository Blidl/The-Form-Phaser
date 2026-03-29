import type { Physics } from 'phaser';

export type BallWallContactSide = 'left' | 'right';

export function getBallWallContactSide(body: Physics.Arcade.Body): BallWallContactSide | null {
    const hasLeftWallContact = body.blocked.left || body.touching.left;
    const hasRightWallContact = body.blocked.right || body.touching.right;

    if (hasLeftWallContact === hasRightWallContact) {
        return null;
    }

    return hasLeftWallContact ? 'left' : 'right';
}
