import type { BallConfig } from '../../../config/forms/ballConfig';
import type { PlayerInputFrame } from '../../player/input/playerInputTypes';
import { applyBallAirMovement } from './applyBallAirMovement';
import { applyBallGroundMovement } from './applyBallGroundMovement';
import { applyBallJump } from './applyBallJump';
import { applyBallWallAssist } from './applyBallWallAssist';

export interface BallPassiveUpdateContext {
    body: Physics.Arcade.Body;
    inputFrame: PlayerInputFrame;
    ballConfig: BallConfig;
}

export function ballPassiveUpdate(context: BallPassiveUpdateContext): void {
    const { body, inputFrame, ballConfig } = context;

    applyBallGroundMovement(body, inputFrame, ballConfig);
    applyBallAirMovement(body, inputFrame, ballConfig);
    applyBallJump(body, inputFrame, ballConfig);
    applyBallWallAssist(body, ballConfig);
}
