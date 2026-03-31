import type { Physics } from 'phaser';
import {
    PLAYER_BALL_JUMP_APEX_GRAVITY_SCALE,
    PLAYER_BALL_JUMP_APEX_VELOCITY_THRESHOLD,
    PLAYER_BALL_JUMP_RISE_GRAVITY_SCALE,
    PLAYER_GRAVITY_Y,
    PLAYER_SQUARE_JUMP_APEX_GRAVITY_SCALE,
    PLAYER_SQUARE_JUMP_APEX_VELOCITY_THRESHOLD,
    PLAYER_SQUARE_JUMP_RISE_GRAVITY_SCALE,
    PLAYER_TRIANGLE_JUMP_APEX_GRAVITY_SCALE,
    PLAYER_TRIANGLE_JUMP_APEX_VELOCITY_THRESHOLD,
    PLAYER_TRIANGLE_JUMP_RISE_GRAVITY_SCALE
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
        state,
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

    const jumpProfile = resolveJumpVerticalProfile(state.currentForm);
    const gravityScale = riseSpeed <= jumpProfile.apexVelocityThreshold
        ? jumpProfile.apexGravityScale
        : jumpProfile.riseGravityScale;
    physicsBody.setGravityY(PLAYER_GRAVITY_Y * gravityScale);
};

const resolveJumpVerticalProfile = (form: PlayerShellState['currentForm']) => {
    if (form === 'triangle') {
        return {
            riseGravityScale: PLAYER_TRIANGLE_JUMP_RISE_GRAVITY_SCALE,
            apexGravityScale: PLAYER_TRIANGLE_JUMP_APEX_GRAVITY_SCALE,
            apexVelocityThreshold: PLAYER_TRIANGLE_JUMP_APEX_VELOCITY_THRESHOLD
        };
    }

    if (form === 'square') {
        return {
            riseGravityScale: PLAYER_SQUARE_JUMP_RISE_GRAVITY_SCALE,
            apexGravityScale: PLAYER_SQUARE_JUMP_APEX_GRAVITY_SCALE,
            apexVelocityThreshold: PLAYER_SQUARE_JUMP_APEX_VELOCITY_THRESHOLD
        };
    }

    return {
        riseGravityScale: PLAYER_BALL_JUMP_RISE_GRAVITY_SCALE,
        apexGravityScale: PLAYER_BALL_JUMP_APEX_GRAVITY_SCALE,
        apexVelocityThreshold: PLAYER_BALL_JUMP_APEX_VELOCITY_THRESHOLD
    };
};
