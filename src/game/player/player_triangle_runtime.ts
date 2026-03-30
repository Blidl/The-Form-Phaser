import type { Physics } from 'phaser';
import type { PlayerInputSnapshot } from './player_input';
import {
    applyTriangleFlightVelocity,
    hasTriangleFlightSectionsRemaining,
    hasTriangleFlightUsableResource,
    stopTriangleFlight,
    tickTriangleFlightOrientation,
    tickTriangleFlightRestore,
    tickTriangleFlightState,
    tryStartTriangleFlight,
    updateTriangleFlightIntent
} from './player_triangle_flight';
import { tickTriangleShellOrientation } from './player_triangle_shell';
import { resolveTriangleFlightStartDecision } from './state/player_form_state_guards';
import { applyTriangleSpecialJump, type TriangleSpecialJumpLaunch } from './player_triangle_jump';
import type { PlayerShellState } from './player_types';

interface TickTriangleFlightResourceParams {
    state: PlayerShellState;
    grounded: boolean;
    deltaSec: number;
    isTriangleForm: boolean;
}

export const tickTriangleFlightResourceRuntime = (params: TickTriangleFlightResourceParams): void => {
    const { state, grounded, deltaSec, isTriangleForm } = params;
    if (!isTriangleForm) {
        stopTriangleFlight(state.triangleFlight);
        return;
    }

    if (!grounded) {
        return;
    }

    tickTriangleFlightRestore(state.triangleFlight, deltaSec);
};

interface PrepareTriangleFlightParams {
    state: PlayerShellState;
    input: PlayerInputSnapshot;
    isTriangleForm: boolean;
}

export const prepareTriangleFlightRuntime = (params: PrepareTriangleFlightParams): void => {
    const { state, input, isTriangleForm } = params;
    if (!isTriangleForm) {
        return;
    }

    updateTriangleFlightIntent(
        state.triangleFlight,
        state.triangleShell,
        input.forcePointX,
        input.forcePointY,
        input.forcePointActive
    );
};

interface StartTriangleFlightParams {
    state: PlayerShellState;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    grounded: boolean;
    isTriangleForm: boolean;
    onFlightStarted: () => void;
}

export const tryStartTriangleFlightRuntime = (params: StartTriangleFlightParams): boolean => {
    const { state, physicsBody, input, grounded, isTriangleForm, onFlightStarted } = params;
    const triangleFlightStartDecision = resolveTriangleFlightStartDecision({
        currentForm: state.currentForm,
        actionPressed: input.actionPressed,
        isFlightActive: isTriangleForm && state.triangleFlight.isActive,
        grounded,
        hasFullFlightResource: hasTriangleFlightSectionsRemaining(state.triangleFlight),
        hasAnyFlightResource: hasTriangleFlightUsableResource(state.triangleFlight)
    });

    if (!triangleFlightStartDecision.canStart || state.currentForm !== 'triangle' || !input.forcePointActive) {
        return false;
    }

    if (!tryStartTriangleFlight(state.triangleFlight)) {
        return false;
    }

    onFlightStarted();
    state.triangleShell.airborneAngularVelocityRadPerSec = 0;
    const velocity = applyTriangleFlightVelocity(state.triangleFlight);
    physicsBody.setAllowGravity(false);
    physicsBody.setVelocity(velocity.velocityX, velocity.velocityY);
    return true;
};

export const applyTriangleFlightMovement = (
    state: PlayerShellState,
    physicsBody: Physics.Arcade.Body
): void => {
    const velocity = applyTriangleFlightVelocity(state.triangleFlight);
    physicsBody.setVelocity(velocity.velocityX, velocity.velocityY);
};

interface TickTriangleFlightActiveParams {
    state: PlayerShellState;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    deltaSec: number;
}

export const tickTriangleFlightActiveRuntime = (params: TickTriangleFlightActiveParams): void => {
    const { state, physicsBody, input, deltaSec } = params;
    if (!state.triangleFlight.isActive) {
        return;
    }

    if (!input.actionHeld || !input.forcePointActive) {
        stopTriangleFlight(state.triangleFlight);
        physicsBody.setAllowGravity(true);
        return;
    }

    tickTriangleFlightState(state.triangleFlight, deltaSec);
    if (!state.triangleFlight.isActive) {
        physicsBody.setAllowGravity(true);
    }
};

interface TickTriangleOrientationParams {
    state: PlayerShellState;
    grounded: boolean;
    justLanded: boolean;
    horizontalDir: -1 | 0 | 1;
    horizontalVelocityX: number;
    deltaSec: number;
    isTriangleForm: boolean;
    isTriangleFlightActive: boolean;
}

export const tickTriangleOrientationRuntime = (params: TickTriangleOrientationParams): void => {
    const {
        state,
        grounded,
        justLanded,
        horizontalDir,
        horizontalVelocityX,
        deltaSec,
        isTriangleForm,
        isTriangleFlightActive
    } = params;

    if (!isTriangleForm) {
        return;
    }

    if (isTriangleFlightActive) {
        state.triangleShell.airborneAngularVelocityRadPerSec = 0;
        tickTriangleFlightOrientation(state.triangleFlight, state.triangleShell, deltaSec);
        return;
    }

    tickTriangleShellOrientation(
        state.triangleShell,
        grounded,
        state.triangleCollision.hasGroundContact,
        justLanded,
        state.triangleCollision.groundSupportEdgeIndex,
        horizontalDir,
        horizontalVelocityX,
        deltaSec
    );
};

export const applyTriangleJumpRuntime = (
    state: PlayerShellState,
    horizontalDir: number,
    lastMoveDirection: -1 | 1
): TriangleSpecialJumpLaunch => {
    return applyTriangleSpecialJump(
        state.triangleShell,
        horizontalDir,
        lastMoveDirection
    );
};
