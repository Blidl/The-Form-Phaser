import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import type { PlayerInputFrame } from '../../player/input/playerInputTypes';
import { isBallBodyGrounded } from './isBallBodyGrounded';

export function applyBallGroundMovement(
    body: Physics.Arcade.Body,
    inputFrame: PlayerInputFrame,
    ballConfig: BallConfig
): void {
    if (!isBallBodyGrounded(body)) {
        return;
    }

    const { moveLeftPressed, moveRightPressed } = inputFrame;
    if (moveLeftPressed && !moveRightPressed) {
        body.setVelocityX(-ballConfig.groundMoveSpeed);
        return;
    }

    if (moveRightPressed && !moveLeftPressed) {
        body.setVelocityX(ballConfig.groundMoveSpeed);
        return;
    }

    body.setVelocityX(ballConfig.groundIdleVelocityX);
}
