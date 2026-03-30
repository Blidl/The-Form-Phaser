import type { Physics } from 'phaser';
import type { PlayerSquareShellState } from './player_types';
import { PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS } from './player_constants';
import { resetSquareRolloverState } from './player_square_rollover';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';

export const tryEnterSquareAttach = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    attachPose: PlayerSquareAttachPoseQuery | null,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): boolean => {
    if (attachPose === null || attachPose.supportInterval === null || squareShell.isAttached) {
        return false;
    }

    return commitSquareAttachPose(
        squareShell,
        physicsBody,
        attachPose,
        contactNormalX,
        contactNormalY
    );
};

export const tickSquareAttachState = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    deltaMs: number,
    actionHeld: boolean,
    attachPose: PlayerSquareAttachPoseQuery | null,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): void => {
    if (!squareShell.isAttached) {
        return;
    }

    if (!actionHeld) {
        clearSquareAttach(squareShell);
        return;
    }

    if (attachPose !== null && attachPose.supportInterval !== null) {
        commitSquareAttachPose(
            squareShell,
            physicsBody,
            attachPose,
            contactNormalX,
            contactNormalY
        );
        return;
    }

    squareShell.attachContactGraceMs = Math.max(0, squareShell.attachContactGraceMs - deltaMs);
    if (squareShell.attachContactGraceMs <= 0) {
        clearSquareAttach(squareShell);
    }
};

export const clearSquareAttach = (squareShell: PlayerSquareShellState): void => {
    squareShell.isAttached = false;
    squareShell.attachNormalX = 0;
    squareShell.attachNormalY = -1;
    squareShell.attachContactGraceMs = 0;
    squareShell.trailAnchorActive = false;
    squareShell.trailAnchorSupportBody = null;
    resetSquareRolloverState(squareShell.rolloverState);
};

export const commitSquareAttachPose = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    attachPose: PlayerSquareAttachPoseQuery | null,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): boolean => {
    if (attachPose === null || attachPose.supportInterval === null) {
        return false;
    }

    squareShell.isAttached = true;
    squareShell.hasContact = true;
    squareShell.attachNormalX = contactNormalX;
    squareShell.attachNormalY = contactNormalY;
    squareShell.contactNormalX = contactNormalX;
    squareShell.contactNormalY = contactNormalY;
    squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
    physicsBody.reset(attachPose.snappedCenterX, attachPose.snappedCenterY);
    return true;
};
