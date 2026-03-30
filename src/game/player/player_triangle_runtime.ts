import type { Physics } from 'phaser';
import { PLAYER_TRIANGLE_DASH_SPEED } from './player_constants';
import type { PlayerInputSnapshot } from './player_input';
import {
    cancelTriangleChargesRestore,
    hasTriangleDashCharges,
    tickTriangleChargesRestore,
    tryConsumeTriangleDashCharge,
    tryStartTriangleChargesRestore
} from './player_triangle_charges';
import { applyTriangleSpecialJump, type TriangleSpecialJumpLaunch } from './player_triangle_jump';
import { resolveMarkerIntent } from './marker/player_marker_math';
import {
    tickTriangleDashActive,
    tickTriangleDashCooldown,
    tryStartTriangleDash,
    updateTriangleDashSelectedLeadingCorner
} from './player_triangle_dash';
import { tickTriangleShellOrientation } from './player_triangle_shell';
import { resolveTriangleDashStartDecision } from './state/player_form_state_guards';
import type { PlayerShellState } from './player_types';

interface TickTriangleChargesParams {
    state: PlayerShellState;
    input: PlayerInputSnapshot;
    grounded: boolean;
    deltaMs: number;
    isTriangleForm: boolean;
}

export const tickTriangleChargesRuntime = (params: TickTriangleChargesParams): void => {
    const { state, input, grounded, deltaMs, isTriangleForm } = params;
    const triangleCharges = state.triangleCharges;

    if (isTriangleForm) {
        if (input.regenPressed) {
            tryStartTriangleChargesRestore(triangleCharges, grounded);
        }

        if (!grounded) {
            cancelTriangleChargesRestore(triangleCharges);
        } else {
            tickTriangleChargesRestore(triangleCharges, deltaMs);
        }
        return;
    }

    cancelTriangleChargesRestore(triangleCharges);
};

interface PrepareTriangleDashParams {
    state: PlayerShellState;
    input: PlayerInputSnapshot;
    grounded: boolean;
    isTriangleForm: boolean;
}

export const prepareTriangleDashRuntime = (params: PrepareTriangleDashParams): void => {
    const { state, input, grounded, isTriangleForm } = params;
    if (!isTriangleForm || state.triangleDash.isActive) {
        return;
    }

    const markerIntent = resolveMarkerIntent(
        state.marker.currentOffsetX,
        state.marker.currentOffsetY
    );

    updateTriangleDashSelectedLeadingCorner(
        state.triangleDash,
        state.triangleShell,
        markerIntent.x,
        markerIntent.y,
        markerIntent.active,
        grounded
    );
};

interface StartTriangleDashParams {
    state: PlayerShellState;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    isTriangleForm: boolean;
    grounded: boolean;
    onDashStarted: () => void;
}

export const tryStartTriangleDashRuntime = (params: StartTriangleDashParams): boolean => {
    const { state, physicsBody, input, isTriangleForm, grounded, onDashStarted } = params;
    const triangleDash = state.triangleDash;

    const triangleDashStartDecision = resolveTriangleDashStartDecision({
        currentForm: state.currentForm,
        actionPressed: input.actionPressed,
        isDashActive: isTriangleForm && triangleDash.isActive,
        dashCooldownMs: triangleDash.cooldownMs,
        hasDashCharges: hasTriangleDashCharges(state.triangleCharges)
    });

    if (!triangleDashStartDecision.canStart || state.currentForm !== 'triangle') {
        return false;
    }

    if (!hasTriangleDashCharges(state.triangleCharges)) {
        return false;
    }

    const dashLaunch = tryStartTriangleDash(
        triangleDash,
        state.triangleShell,
        grounded
    );

    if (dashLaunch === null) {
        return false;
    }

    tryConsumeTriangleDashCharge(state.triangleCharges);
    onDashStarted();
    state.triangleShell.orientationRad = dashLaunch.lockedOrientationRad;
    physicsBody.setAllowGravity(false);
    physicsBody.setVelocity(dashLaunch.velocityX, dashLaunch.velocityY);
    return true;
};

export const applyTriangleDashMovement = (
    state: PlayerShellState,
    physicsBody: Physics.Arcade.Body
): void => {
    physicsBody.setVelocity(
        state.triangleDash.directionX * PLAYER_TRIANGLE_DASH_SPEED,
        state.triangleDash.directionY * PLAYER_TRIANGLE_DASH_SPEED
    );
    state.triangleShell.orientationRad = state.triangleDash.lockedOrientationRad;
};

interface TickTriangleDashActiveParams {
    state: PlayerShellState;
    physicsBody: Physics.Arcade.Body;
    deltaMs: number;
    dashStartedThisFrame: boolean;
}

export const tickTriangleDashActiveRuntime = (params: TickTriangleDashActiveParams): void => {
    const { state, physicsBody, deltaMs, dashStartedThisFrame } = params;
    if (!state.triangleDash.isActive || dashStartedThisFrame) {
        return;
    }

    tickTriangleDashActive(state.triangleDash, deltaMs);
    if (!state.triangleDash.isActive) {
        physicsBody.setAllowGravity(true);
    }
};

export const tickTriangleDashCooldownRuntime = (state: PlayerShellState, deltaMs: number): void => {
    tickTriangleDashCooldown(state.triangleDash, deltaMs);
};

interface TickTriangleOrientationParams {
    state: PlayerShellState;
    input: PlayerInputSnapshot;
    grounded: boolean;
    justLanded: boolean;
    horizontalDir: -1 | 0 | 1;
    horizontalVelocityX: number;
    deltaSec: number;
    isTriangleForm: boolean;
    isTriangleDashActive: boolean;
}

export const tickTriangleOrientationRuntime = (params: TickTriangleOrientationParams): void => {
    const {
        state,
        input,
        grounded,
        justLanded,
        horizontalDir,
        horizontalVelocityX,
        deltaSec,
        isTriangleForm,
        isTriangleDashActive
    } = params;

    if (!isTriangleForm || isTriangleDashActive) {
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

    if (grounded) {
        const markerIntent = resolveMarkerIntent(
            state.marker.currentOffsetX,
            state.marker.currentOffsetY
        );
        updateTriangleDashSelectedLeadingCorner(
            state.triangleDash,
            state.triangleShell,
            markerIntent.x,
            markerIntent.y,
            markerIntent.active,
            grounded
        );
    }
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
