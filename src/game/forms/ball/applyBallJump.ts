import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import type { PlayerInputFrame } from '../../player/input/playerInputTypes';
import { isBallBodyGrounded } from './isBallBodyGrounded';

export function applyBallJump(
    body: Physics.Arcade.Body,
    inputFrame: PlayerInputFrame,
    ballConfig: BallConfig
): void {
    if (!inputFrame.jumpJustPressed) {
        return;
    }

    if (!isBallBodyGrounded(body)) {
        return;
    }

    body.setVelocityY(-ballConfig.jumpVelocity);
}
