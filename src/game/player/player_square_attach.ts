import type { PlayerSquareShellState } from './player_types';
import { PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS } from './player_constants';

export const tryEnterSquareAttach = (
    squareShell: PlayerSquareShellState,
    hasContact: boolean,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): boolean => {
    if (!hasContact || squareShell.isAttached) {
        return false;
    }

    squareShell.isAttached = true;
    squareShell.attachNormalX = contactNormalX;
    squareShell.attachNormalY = contactNormalY;
    squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
    return true;
};

export const tickSquareAttachState = (
    squareShell: PlayerSquareShellState,
    deltaMs: number,
    actionHeld: boolean,
    hasContact: boolean,
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

    if (hasContact) {
        if (isSameNormal(squareShell, contactNormalX, contactNormalY)) {
            squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
            return;
        }

        clearSquareAttach(squareShell);
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
};

const isSameNormal = (
    squareShell: PlayerSquareShellState,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): boolean => {
    return squareShell.attachNormalX === contactNormalX && squareShell.attachNormalY === contactNormalY;
};
