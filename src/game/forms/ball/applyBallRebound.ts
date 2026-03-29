import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import { canConsumeBallRebound } from './canConsumeBallRebound';
import { getBallReboundSurface } from './getBallReboundSurface';

export function applyBallRebound(
    body: Physics.Arcade.Body,
    ballConfig: BallConfig,
    reboundBufferMs: number
): boolean {
    if (!canConsumeBallRebound(body, ballConfig, reboundBufferMs)) {
        return false;
    }

    const reboundSurface = getBallReboundSurface(body);
    if (reboundSurface === null) {
        return false;
    }

    if (reboundSurface === 'floor') {
        body.setVelocityY(-ballConfig.reboundVelocityY);
        return true;
    }

    if (reboundSurface === 'ceiling') {
        body.setVelocityY(ballConfig.reboundVelocityY);
        return true;
    }

    if (reboundSurface === 'wall-left') {
        body.setVelocityX(ballConfig.reboundVelocityX);
        return true;
    }

    body.setVelocityX(-ballConfig.reboundVelocityX);
    return true;
}
