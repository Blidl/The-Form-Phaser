import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import { getBallReboundSurface } from './getBallReboundSurface';

export function canConsumeBallRebound(
    body: Physics.Arcade.Body,
    ballConfig: BallConfig,
    reboundBufferMs: number
): boolean {
    if (reboundBufferMs <= 0) {
        return false;
    }

    const reboundSurface = getBallReboundSurface(body);
    if (reboundSurface === null) {
        return false;
    }

    const minIncomingSpeed = ballConfig.reboundMinIncomingSpeed;

    if (reboundSurface === 'floor') {
        return body.velocity.y >= minIncomingSpeed;
    }

    if (reboundSurface === 'ceiling') {
        return body.velocity.y <= -minIncomingSpeed;
    }

    if (reboundSurface === 'wall-left') {
        return body.velocity.x <= -minIncomingSpeed;
    }

    return body.velocity.x >= minIncomingSpeed;
}
