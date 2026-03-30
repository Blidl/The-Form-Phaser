import type { Physics } from 'phaser';
import { PLAYER_AIR_WIND_INFLUENCE_MULTIPLIER } from './player_constants';
import {
    applyAirborneNoInputInertiaDamping,
    applyAirborneWindDrift,
    moveToward,
    resolveBallBoostAirControlFactor,
    resolveMoveResponse,
    resolveMoveSpeed,
    resolveTargetVelocityX
} from './player_horizontal_motion';
import type { PlayerShellState } from './player_types';

export interface PlayerMotionMutableState {
    boostImpulseMs: number;
    boostActive: boolean;
    airborneWindDriftX: number;
}

interface ResolveMotionFlagsParams {
    state: PlayerShellState;
    isSquareForm: boolean;
}

export const resolvePlayerMotionFlags = (params: ResolveMotionFlagsParams): {
    invalidTriangleDashOutsideTriangle: boolean;
    isSquareAttached: boolean;
} => {
    const { state, isSquareForm } = params;
    const invalidTriangleDashOutsideTriangle = state.currentForm !== 'triangle' && state.triangleDash.isActive;
    const invalidSquareAttachOutsideSquare = !isSquareForm && state.squareShell.isAttached;

    return {
        invalidTriangleDashOutsideTriangle,
        isSquareAttached: isSquareForm && !invalidSquareAttachOutsideSquare && state.squareShell.isAttached
    };
};

interface ResolveEffectiveInfluenceParams {
    grounded: boolean;
    externalHorizontalInfluenceX: number;
}

export const resolveEffectiveExternalInfluenceX = (params: ResolveEffectiveInfluenceParams): number => {
    const { grounded, externalHorizontalInfluenceX } = params;
    return grounded
        ? externalHorizontalInfluenceX
        : externalHorizontalInfluenceX * PLAYER_AIR_WIND_INFLUENCE_MULTIPLIER;
};

interface ApplyCommonHorizontalMotionParams {
    mutable: PlayerMotionMutableState;
    physicsBody: Physics.Arcade.Body;
    state: PlayerShellState;
    grounded: boolean;
    isBallForm: boolean;
    hasBoostHold: boolean;
    horizontalDir: -1 | 0 | 1;
    deltaSec: number;
    effectiveExternalInfluenceX: number;
    preservedReboundVelocityX: number | null;
}

export const applyCommonHorizontalMotion = (params: ApplyCommonHorizontalMotionParams): void => {
    const {
        mutable,
        physicsBody,
        state,
        grounded,
        isBallForm,
        hasBoostHold,
        horizontalDir,
        deltaSec,
        effectiveExternalInfluenceX,
        preservedReboundVelocityX
    } = params;

    const currentVelocityX = physicsBody.velocity.x;
    let nextVelocityX = currentVelocityX;

    if (preservedReboundVelocityX !== null) {
        nextVelocityX = preservedReboundVelocityX;
    } else {
        const ballBoostAirControlFactor = resolveBallBoostAirControlFactor(
            isBallForm,
            grounded,
            hasBoostHold
        );
        const moveSpeed = resolveMoveSpeed(state.currentForm, grounded, hasBoostHold, mutable.boostImpulseMs);
        const moveResponse = resolveMoveResponse(state.currentForm, grounded, horizontalDir, hasBoostHold);
        const targetVelocityX = resolveTargetVelocityX(
            currentVelocityX,
            grounded,
            horizontalDir,
            moveSpeed * ballBoostAirControlFactor,
            effectiveExternalInfluenceX
        );
        const maxStepX = moveResponse * ballBoostAirControlFactor * deltaSec;
        nextVelocityX = resolveNextVelocityXWithAirborneBallBoostInertia({
            currentVelocityX,
            targetVelocityX,
            maxStepX,
            grounded,
            isBallForm,
            hasBoostHold,
            horizontalDir
        });

        if (grounded) {
            mutable.airborneWindDriftX = 0;
        } else {
            if (horizontalDir === 0) {
                nextVelocityX = applyAirborneNoInputInertiaDamping(
                    nextVelocityX,
                    deltaSec,
                    state.currentForm,
                    hasBoostHold
                );
            }
            const airborneWindDrift = applyAirborneWindDrift(
                nextVelocityX,
                effectiveExternalInfluenceX,
                deltaSec,
                mutable.airborneWindDriftX
            );
            nextVelocityX = airborneWindDrift.nextVelocityX;
            mutable.airborneWindDriftX = airborneWindDrift.nextAirborneWindDriftX;
        }
    }

    physicsBody.setVelocityX(nextVelocityX);
};

interface ResolveNextVelocityXWithAirborneBallBoostInertiaParams {
    currentVelocityX: number;
    targetVelocityX: number;
    maxStepX: number;
    grounded: boolean;
    isBallForm: boolean;
    hasBoostHold: boolean;
    horizontalDir: -1 | 0 | 1;
}

const resolveNextVelocityXWithAirborneBallBoostInertia = (
    params: ResolveNextVelocityXWithAirborneBallBoostInertiaParams
): number => {
    const {
        currentVelocityX,
        targetVelocityX,
        maxStepX,
        grounded,
        isBallForm,
        hasBoostHold,
        horizontalDir
    } = params;

    if (!grounded && isBallForm && hasBoostHold && horizontalDir !== 0) {
        const currentDir = Math.sign(currentVelocityX);
        const targetDir = Math.sign(targetVelocityX);
        const isPreservingSameDirectionInertia = currentDir !== 0
            && currentDir === targetDir
            && Math.abs(currentVelocityX) > Math.abs(targetVelocityX);

        if (isPreservingSameDirectionInertia) {
            return currentVelocityX;
        }
    }

    return moveToward(currentVelocityX, targetVelocityX, maxStepX);
};

export const applyPauseOrLaunchMovement = (
    physicsBody: Physics.Arcade.Body,
    isBallReboundPauseHolding: boolean,
    didLaunchBallReboundThisFrame: boolean
): boolean => {
    if (isBallReboundPauseHolding) {
        physicsBody.setVelocity(0, 0);
        physicsBody.setAcceleration(0, 0);
        return true;
    }

    if (didLaunchBallReboundThisFrame) {
        physicsBody.setAcceleration(0, 0);
        return true;
    }

    return false;
};
