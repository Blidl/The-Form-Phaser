import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import type { PlayerInputFrame } from '../../player/input/playerInputTypes';
import { isBallBodyGrounded } from './isBallBodyGrounded';

export function applyBallAirMovement(
    body: Physics.Arcade.Body,
    inputFrame: PlayerInputFrame,
    ballConfig: BallConfig
): void {
    if (isBallBodyGrounded(body)) {
        return;
    }

    const { moveLeftPressed, moveRightPressed } = inputFrame;
    if (moveLeftPressed && !moveRightPressed) {
        body.setVelocityX(-ballConfig.airMoveSpeed);
        return;
    }

    if (moveRightPressed && !moveLeftPressed) {
        body.setVelocityX(ballConfig.airMoveSpeed);
        return;
    }

    if (ballConfig.airIdleVelocityXMode === 'preserve') {
        return;
    }
}
