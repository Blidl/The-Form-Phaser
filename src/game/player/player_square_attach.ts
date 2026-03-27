import type { PlayerSquareShellState } from './player_types';

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
    return true;
};

export const tickSquareAttachState = (
    squareShell: PlayerSquareShellState,
    actionHeld: boolean,
    hasContact: boolean,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): void => {
    if (!squareShell.isAttached) {
        return;
    }

    if (!actionHeld || !hasContact || !isSameNormal(squareShell, contactNormalX, contactNormalY)) {
        clearSquareAttach(squareShell);
        return;
    }
};

export const clearSquareAttach = (squareShell: PlayerSquareShellState): void => {
    squareShell.isAttached = false;
    squareShell.attachNormalX = 0;
    squareShell.attachNormalY = -1;
};

const isSameNormal = (
    squareShell: PlayerSquareShellState,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): boolean => {
    return squareShell.attachNormalX === contactNormalX && squareShell.attachNormalY === contactNormalY;
};
