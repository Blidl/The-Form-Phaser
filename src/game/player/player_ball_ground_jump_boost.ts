import {
    PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED,
    PLAYER_BALL_BOOST_JUMP_VELOCITY_MULTIPLIER
} from './player_constants';

export interface BallGroundJumpBoostLaunch {
    velocityX: number;
    velocityY: number;
}

interface BallGroundJumpBoostParams {
    baseJumpVelocity: number;
    currentVelocityX: number;
    horizontalDir: -1 | 0 | 1;
    isBallForm: boolean;
    grounded: boolean;
    hasBoostHold: boolean;
}

export function resolveBallGroundJumpBoostLaunch(params: BallGroundJumpBoostParams): BallGroundJumpBoostLaunch {
    const {
        baseJumpVelocity,
        currentVelocityX,
        horizontalDir,
        isBallForm,
        grounded,
        hasBoostHold
    } = params;

    if (!isBallForm || !grounded || !hasBoostHold || horizontalDir === 0) {
        return {
            velocityX: currentVelocityX,
            velocityY: baseJumpVelocity
        };
    }

    const launchSpeedX = Math.max(Math.abs(currentVelocityX), PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED);

    return {
        velocityX: horizontalDir * launchSpeedX,
        velocityY: baseJumpVelocity * PLAYER_BALL_BOOST_JUMP_VELOCITY_MULTIPLIER
    };
}
