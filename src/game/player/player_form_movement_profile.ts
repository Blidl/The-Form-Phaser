import {
    PLAYER_BALL_AIR_MOVE_ACCEL,
    PLAYER_BALL_AIR_MOVE_DECEL,
    PLAYER_BALL_AIR_MOVE_SPEED,
    PLAYER_BALL_GROUND_MOVE_ACCEL,
    PLAYER_BALL_GROUND_MOVE_DECEL,
    PLAYER_BALL_GROUND_MOVE_SPEED,
    PLAYER_SQUARE_AIR_MOVE_ACCEL,
    PLAYER_SQUARE_AIR_MOVE_DECEL,
    PLAYER_SQUARE_AIR_MOVE_SPEED,
    PLAYER_SQUARE_GROUND_MOVE_ACCEL,
    PLAYER_SQUARE_GROUND_MOVE_DECEL,
    PLAYER_SQUARE_GROUND_MOVE_SPEED,
    PLAYER_TRIANGLE_AIR_MOVE_ACCEL,
    PLAYER_TRIANGLE_AIR_MOVE_DECEL,
    PLAYER_TRIANGLE_AIR_MOVE_SPEED,
    PLAYER_TRIANGLE_GROUND_MOVE_ACCEL,
    PLAYER_TRIANGLE_GROUND_MOVE_DECEL,
    PLAYER_TRIANGLE_GROUND_MOVE_SPEED
} from './player_constants';
import type { PlayerFormId } from './player_types';

export interface PlayerFormMoveProfile {
    maxSpeed: number;
    accel: number;
    decel: number;
}

export function resolvePlayerFormMoveProfile(form: PlayerFormId, grounded: boolean): PlayerFormMoveProfile {
    if (grounded) {
        if (form === 'triangle') {
            return {
                maxSpeed: PLAYER_TRIANGLE_GROUND_MOVE_SPEED,
                accel: PLAYER_TRIANGLE_GROUND_MOVE_ACCEL,
                decel: PLAYER_TRIANGLE_GROUND_MOVE_DECEL
            };
        }

        if (form === 'square') {
            return {
                maxSpeed: PLAYER_SQUARE_GROUND_MOVE_SPEED,
                accel: PLAYER_SQUARE_GROUND_MOVE_ACCEL,
                decel: PLAYER_SQUARE_GROUND_MOVE_DECEL
            };
        }

        return {
            maxSpeed: PLAYER_BALL_GROUND_MOVE_SPEED,
            accel: PLAYER_BALL_GROUND_MOVE_ACCEL,
            decel: PLAYER_BALL_GROUND_MOVE_DECEL
        };
    }

    if (form === 'triangle') {
        return {
            maxSpeed: PLAYER_TRIANGLE_AIR_MOVE_SPEED,
            accel: PLAYER_TRIANGLE_AIR_MOVE_ACCEL,
            decel: PLAYER_TRIANGLE_AIR_MOVE_DECEL
        };
    }

    if (form === 'square') {
        return {
            maxSpeed: PLAYER_SQUARE_AIR_MOVE_SPEED,
            accel: PLAYER_SQUARE_AIR_MOVE_ACCEL,
            decel: PLAYER_SQUARE_AIR_MOVE_DECEL
        };
    }

    return {
        maxSpeed: PLAYER_BALL_AIR_MOVE_SPEED,
        accel: PLAYER_BALL_AIR_MOVE_ACCEL,
        decel: PLAYER_BALL_AIR_MOVE_DECEL
    };
}
