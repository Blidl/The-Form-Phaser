import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import { isBallBodyGrounded } from './isBallBodyGrounded';
import { getBallWallContactSide } from './getBallWallContactSide';

export function applyBallWallAssist(body: Physics.Arcade.Body, ballConfig: BallConfig): void {
    if (isBallBodyGrounded(body)) {
        return;
    }

    const wallContactSide = getBallWallContactSide(body);
    if (wallContactSide === null) {
        return;
    }

    if (body.velocity.y > ballConfig.wallAssistVerticalClamp) {
        body.setVelocityY(ballConfig.wallAssistVerticalClamp);
    }

    if (ballConfig.wallAssistHorizontalNudge <= 0) {
        return;
    }

    if (wallContactSide === 'left' && body.velocity.x < ballConfig.wallAssistHorizontalNudge) {
        body.setVelocityX(ballConfig.wallAssistHorizontalNudge);
        return;
    }

    if (wallContactSide === 'right' && body.velocity.x > -ballConfig.wallAssistHorizontalNudge) {
        body.setVelocityX(-ballConfig.wallAssistHorizontalNudge);
    }
}
