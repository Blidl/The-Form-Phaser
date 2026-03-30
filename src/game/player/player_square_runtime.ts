import type { Physics } from 'phaser';
import { Math as PhaserMath } from 'phaser';
import { PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED, PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED } from './player_constants';
import type { PlayerInputSnapshot } from './player_input';
import { clearJumpBuffer, clearSquareAttachEntryBuffer, hasSquareAttachEntryBuffer, type PlayerTimers } from './player_timers';
import { tickSquareShellOrientation } from './player_square_shell';
import { tickSquareAttachState, tryEnterSquareAttach } from './player_square_attach';
import { beginSquareTrailAnchor, tickSquareTrailDetachedLifecycle, tickSquareTrailPaint } from './player_square_trail';
import { resolveSquareAttachSurfaceVelocity } from './player_square_surface_move';
import { resolveArcadeAxisContactSnapshot, resolveSquareContactNormal } from './geometry/player_geometry_queries';
import type { PlayerSquareTrailSurfacePoint } from './geometry/player_geometry_types';
import { resolveSquareAttachHoldDecision, resolveSquareAttachStartDecision } from './state/player_form_state_guards';
import type { PlayerShellState } from './player_types';

interface TickSquareRuntimeParams {
    state: PlayerShellState;
    timers: PlayerTimers;
    physicsBody: Physics.Arcade.Body;
    input: PlayerInputSnapshot;
    deltaMs: number;
    deltaSec: number;
    horizontalDir: -1 | 0 | 1;
    resolveSquareTrailSurfacePoint: (normalX: -1 | 0 | 1, normalY: -1 | 0 | 1) => PlayerSquareTrailSurfacePoint;
}

export const tickSquareRuntime = (params: TickSquareRuntimeParams): void => {
    const {
        state,
        timers,
        physicsBody,
        input,
        deltaMs,
        deltaSec,
        horizontalDir,
        resolveSquareTrailSurfacePoint
    } = params;

    const attachedNormalX = state.squareShell.isAttached
        ? state.squareShell.attachNormalX
        : undefined;
    const attachedNormalY = state.squareShell.isAttached
        ? state.squareShell.attachNormalY
        : undefined;
    const verticalDir = (input.moveDown ? 1 : 0) - (input.moveUp ? 1 : 0);
    const contactSnapshot = resolveArcadeAxisContactSnapshot(
        physicsBody.blocked,
        physicsBody.touching
    );
    const squareContact = resolveSquareContactNormal(
        contactSnapshot,
        attachedNormalX,
        attachedNormalY,
        horizontalDir,
        verticalDir as -1 | 0 | 1
    );

    tickSquareShellOrientation(
        state.squareShell,
        deltaSec,
        squareContact.normalX,
        squareContact.normalY,
        squareContact.hasContact
    );

    const squareAttachStartDecision = resolveSquareAttachStartDecision({
        currentForm: state.currentForm,
        actionHeld: input.actionHeld,
        hasEntryBuffer: hasSquareAttachEntryBuffer(timers),
        isAttached: state.squareShell.isAttached,
        hasContact: squareContact.hasContact
    });

    if (squareAttachStartDecision.canStart) {
        const attachStarted = tryEnterSquareAttach(
            state.squareShell,
            squareContact.hasContact,
            squareContact.normalX,
            squareContact.normalY
        );

        if (attachStarted) {
            const surfacePoint = resolveSquareTrailSurfacePoint(
                state.squareShell.attachNormalX,
                state.squareShell.attachNormalY
            );
            beginSquareTrailAnchor(
                state.squareShell,
                surfacePoint.x,
                surfacePoint.y,
                surfacePoint.supportOwner
            );
            clearJumpBuffer(timers);
            clearSquareAttachEntryBuffer(timers);
        }
    }

    const squareAttachHoldDecision = resolveSquareAttachHoldDecision({
        currentForm: state.currentForm,
        isAttached: state.squareShell.isAttached,
        actionHeld: input.actionHeld
    });

    tickSquareAttachState(
        state.squareShell,
        deltaMs,
        squareAttachHoldDecision.shouldKeepAttachHold,
        squareContact.hasContact,
        squareContact.normalX,
        squareContact.normalY
    );

    const trailSurfacePoint = resolveSquareTrailSurfacePoint(
        state.squareShell.attachNormalX,
        state.squareShell.attachNormalY
    );
    tickSquareTrailPaint(
        state.squareShell,
        trailSurfacePoint.x,
        trailSurfacePoint.y,
        trailSurfacePoint.supportOwner,
        state.squareShell.hasContact
    );
};

export const applySquareAttachedMovement = (
    physicsBody: Physics.Arcade.Body,
    state: PlayerShellState,
    input: PlayerInputSnapshot
): void => {
    const attachVelocity = resolveSquareAttachSurfaceVelocity(
        state.squareShell.attachNormalX,
        state.squareShell.attachNormalY,
        input,
        PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
        PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED
    );
    physicsBody.setVelocity(attachVelocity.velocityX, attachVelocity.velocityY);
    physicsBody.setAcceleration(0, 0);
};

export const applySquareDetachedTrailRefund = (state: PlayerShellState, deltaMs: number): void => {
    const detachedTrailRefund = tickSquareTrailDetachedLifecycle(state.squareShell, deltaMs);
    if (detachedTrailRefund <= 0) {
        return;
    }

    state.squareShell.trailResourceCurrent = PhaserMath.Clamp(
        state.squareShell.trailResourceCurrent + detachedTrailRefund,
        0,
        state.squareShell.trailResourceMax
    );
};
