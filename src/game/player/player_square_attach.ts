import type { Physics } from 'phaser';
import type { PlayerSquareShellState } from './player_types';
import { PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS } from './player_constants';
import { resetSquareRolloverState } from './player_square_rollover';
import { clearSquareTrailLatch } from './player_square_trail_latch';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';

type SquareAttachPathClearFn = (
    fromCenterX: number,
    fromCenterY: number,
    toCenterX: number,
    toCenterY: number,
    supportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
) => boolean;

export const tryEnterSquareAttach = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    attachPose: PlayerSquareAttachPoseQuery | null,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    isPathClear: SquareAttachPathClearFn
): boolean => {
    if (attachPose === null || attachPose.supportInterval === null || squareShell.isAttached) {
        return false;
    }

    return commitSquareAttachPose(
        squareShell,
        physicsBody,
        attachPose,
        contactNormalX,
        contactNormalY,
        isPathClear
    );
};

export const tickSquareAttachState = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    deltaMs: number,
    actionHeld: boolean,
    attachPose: PlayerSquareAttachPoseQuery | null,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    isPathClear: SquareAttachPathClearFn
): void => {
    if (!squareShell.isAttached) {
        return;
    }

    if (!actionHeld) {
        clearSquareAttach(squareShell);
        return;
    }

    if (attachPose !== null && attachPose.supportInterval !== null) {
        const committed = commitSquareAttachPose(
            squareShell,
            physicsBody,
            attachPose,
            contactNormalX,
            contactNormalY,
            isPathClear
        );
        if (committed) {
            return;
        }
        squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
        return;
    }

    squareShell.attachContactGraceMs = Math.max(0, squareShell.attachContactGraceMs - deltaMs);
    if (squareShell.attachContactGraceMs <= 0) {
        clearSquareAttach(squareShell);
    }
};

export const clearSquareAttach = (squareShell: PlayerSquareShellState): void => {
    squareShell.isAttached = false;
    squareShell.isOnTrail = false;
    squareShell.isTrailRegenerating = false;
    squareShell.isTrailLockedAtBoundary = false;
    squareShell.attachNormalX = 0;
    squareShell.attachNormalY = -1;
    squareShell.attachSupportBody = null;
    squareShell.attachContactGraceMs = 0;
    squareShell.trailAnchorActive = false;
    squareShell.trailAnchorSupportBody = null;
    clearSquareTrailLatch(squareShell);
    squareShell.attachJumpState.phase = 'inactive';
    squareShell.attachJumpState.elapsedMs = 0;
    squareShell.attachJumpState.anchorLocalX = 0;
    squareShell.attachJumpState.anchorLocalY = 0;
    squareShell.attachJumpState.anchorSupportBody = null;
    squareShell.attachJumpState.anchorSupportOriginX = 0;
    squareShell.attachJumpState.anchorSupportOriginY = 0;
    squareShell.attachJumpState.normalX = 0;
    squareShell.attachJumpState.normalY = -1;
    squareShell.attachJumpState.launchCenterX = 0;
    squareShell.attachJumpState.launchCenterY = 0;
    squareShell.attachJumpState.peakCenterX = 0;
    squareShell.attachJumpState.peakCenterY = 0;
    squareShell.attachJumpState.orientationRad = 0;
    resetSquareRolloverState(squareShell.rolloverState);
};

export const commitSquareAttachPose = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    attachPose: PlayerSquareAttachPoseQuery | null,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    isPathClear?: SquareAttachPathClearFn
): boolean => {
    if (attachPose === null || attachPose.supportInterval === null) {
        return false;
    }

    const currentCenterX = physicsBody.x + (physicsBody.width * 0.5);
    const currentCenterY = physicsBody.y + (physicsBody.height * 0.5);
    if (
        isPathClear !== undefined
        && !isPathClear(
            currentCenterX,
            currentCenterY,
            attachPose.snappedCenterX,
            attachPose.snappedCenterY,
            attachPose.supportInterval.ownerBody
        )
    ) {
        return false;
    }

    squareShell.isAttached = true;
    squareShell.hasContact = true;
    squareShell.attachNormalX = contactNormalX;
    squareShell.attachNormalY = contactNormalY;
    squareShell.attachSupportBody = attachPose.supportInterval.ownerBody;
    squareShell.contactNormalX = contactNormalX;
    squareShell.contactNormalY = contactNormalY;
    squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
    physicsBody.reset(attachPose.snappedCenterX, attachPose.snappedCenterY);
    return true;
};
