import type { Physics } from 'phaser';

export type BallReboundSurface = 'wall-left' | 'wall-right' | 'floor' | 'ceiling';

export function getBallReboundSurface(body: Physics.Arcade.Body): BallReboundSurface | null {
    const hasFloorContact = body.blocked.down || body.touching.down;
    if (hasFloorContact) {
        return 'floor';
    }

    const hasCeilingContact = body.blocked.up || body.touching.up;
    if (hasCeilingContact) {
        return 'ceiling';
    }

    const hasLeftWallContact = body.blocked.left || body.touching.left;
    if (hasLeftWallContact) {
        return 'wall-left';
    }

    const hasRightWallContact = body.blocked.right || body.touching.right;
    if (hasRightWallContact) {
        return 'wall-right';
    }

    return null;
}
