import type { Physics } from 'phaser';
import {
    PLAYER_GRAVITY_Y,
    PLAYER_JUMP_APEX_GRAVITY_SCALE,
    PLAYER_JUMP_APEX_VELOCITY_THRESHOLD,
    PLAYER_JUMP_RISE_GRAVITY_SCALE
} from './player_constants';
import type { PlayerShellState } from './player_types';
import type { PlayerInputSnapshot } from './player_input';

interface ApplyPlayerVerticalProfileParams {
    state: PlayerShellState;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    grounded: boolean;
    isTriangleFlightActive: boolean;
    isSquareAttached: boolean;
    isBallReboundPauseHolding: boolean;
}

export const applyPlayerVerticalProfile = (params: ApplyPlayerVerticalProfileParams): void => {
    const {
        physicsBody,
        input,
        grounded,
        isTriangleFlightActive,
        isSquareAttached,
        isBallReboundPauseHolding
    } = params;

    if (isTriangleFlightActive || isSquareAttached || isBallReboundPauseHolding) {
        physicsBody.setGravityY(PLAYER_GRAVITY_Y);
        return;
    }

    if (grounded || physicsBody.velocity.y >= 0) {
        physicsBody.setGravityY(PLAYER_GRAVITY_Y);
        return;
    }

    const riseSpeed = Math.abs(physicsBody.velocity.y);
    if (!input.jumpHeld) {
        physicsBody.setGravityY(PLAYER_GRAVITY_Y);
        return;
    }

    const gravityScale = riseSpeed <= PLAYER_JUMP_APEX_VELOCITY_THRESHOLD
        ? PLAYER_JUMP_APEX_GRAVITY_SCALE
        : PLAYER_JUMP_RISE_GRAVITY_SCALE;
    physicsBody.setGravityY(PLAYER_GRAVITY_Y * gravityScale);
};
