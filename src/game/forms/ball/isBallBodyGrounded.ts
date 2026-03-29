import type { Physics } from 'phaser';

export function isBallBodyGrounded(body: Physics.Arcade.Body): boolean {
    return body.blocked.down || body.touching.down;
}
