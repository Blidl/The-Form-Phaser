import type { Physics } from 'phaser';
import type { BallConfig } from '../../../config/forms/ballConfig';
import type { PlayerInputFrame } from '../../player/input/playerInputTypes';
import { canApplyBallBoost } from './canApplyBallBoost';

export interface ApplyBallBoostContext {
    body: Physics.Arcade.Body;
    inputFrame: PlayerInputFrame;
    ballConfig: BallConfig;
    boostCooldownMs: number;
    reboundConsumedThisFrame: boolean;
}

export function applyBallBoost(context: ApplyBallBoostContext): boolean {
    if (!canApplyBallBoost(context)) {
        return false;
    }

    const { body, inputFrame, ballConfig } = context;
    let boostVelocityX = 0;

    if (inputFrame.moveLeftPressed && !inputFrame.moveRightPressed) {
        boostVelocityX = -ballConfig.boostVelocityX;
    } else if (inputFrame.moveRightPressed && !inputFrame.moveLeftPressed) {
        boostVelocityX = ballConfig.boostVelocityX;
    }

    body.setVelocity(boostVelocityX, -ballConfig.boostVelocityY);
    return true;
}
