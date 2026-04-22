import type { PlayerFormId } from '../player_types';

export interface PlayerPresentationFrameHooks {
    jumpIntent: boolean;
    jumpCommit: boolean;
    apexEnter: boolean;
    fallEnter: boolean;
    landImpactSpeed: number | null;
    formSwitchIn: PlayerFormId | null;
    ballReboundLaunch: boolean;
    triangleFlightStart: boolean;
    triangleFlightEnd: boolean;
    squareAttachEnter: boolean;
    squareAttachExit: boolean;
    squareAttachJumpCommit: boolean;
}

export const createEmptyPlayerPresentationFrameHooks = (): PlayerPresentationFrameHooks => {
    return {
        jumpIntent: false,
        jumpCommit: false,
        apexEnter: false,
        fallEnter: false,
        landImpactSpeed: null,
        formSwitchIn: null,
        ballReboundLaunch: false,
        triangleFlightStart: false,
        triangleFlightEnd: false,
        squareAttachEnter: false,
        squareAttachExit: false,
        squareAttachJumpCommit: false
    };
};
