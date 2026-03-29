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
    lastMoveDirection: -1 | 1;
    isBallForm: boolean;
    grounded: boolean;
    hasBoostHold: boolean;
}

export function resolveBallGroundJumpBoostLaunch(params: BallGroundJumpBoostParams): BallGroundJumpBoostLaunch {
    const {
        baseJumpVelocity,
        currentVelocityX,
        horizontalDir,
        lastMoveDirection,
        isBallForm,
        grounded,
        hasBoostHold
    } = params;

    if (!isBallForm || !grounded || !hasBoostHold) {
        return {
            velocityX: currentVelocityX,
            velocityY: baseJumpVelocity
        };
    }

    const direction = resolveLaunchDirectionX(horizontalDir, currentVelocityX, lastMoveDirection);
    const launchSpeedX = Math.max(Math.abs(currentVelocityX), PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED);

    return {
        velocityX: direction * launchSpeedX,
        velocityY: baseJumpVelocity * PLAYER_BALL_BOOST_JUMP_VELOCITY_MULTIPLIER
    };
}

function resolveLaunchDirectionX(
    horizontalDir: -1 | 0 | 1,
    currentVelocityX: number,
    lastMoveDirection: -1 | 1
): -1 | 1 {
    if (horizontalDir !== 0) {
        return horizontalDir;
    }

    if (currentVelocityX > 0.0001) {
        return 1;
    }

    if (currentVelocityX < -0.0001) {
        return -1;
    }

    return lastMoveDirection;
}
