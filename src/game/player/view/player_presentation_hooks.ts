import type { PlayerFormId } from '../player_types';

export interface PlayerPresentationFrameHooks {
    jumpIntent: boolean;
    jumpCommit: boolean;
    jumpCommitImpulseX: number | null;
    jumpCommitImpulseY: number | null;
    apexEnter: boolean;
    fallEnter: boolean;
    landImpactSpeed: number | null;
    formSwitchIn: PlayerFormId | null;
    ballReboundLaunch: boolean;
    ballReboundLaunchImpulseX: number | null;
    ballReboundLaunchImpulseY: number | null;
    ballBoostGroundStart: boolean;
    ballBoostGroundStartImpulseX: number | null;
    ballBoostGroundStartImpulseY: number | null;
    ballBoostGroundSustain: boolean;
    ballBoostGroundSustainDirX: number | null;
    ballBoostGroundSustainDirY: number | null;
    triangleFlightStart: boolean;
    triangleFlightEnd: boolean;
    squareAttachEnter: boolean;
    squareAttachExit: boolean;
    squareAttachJumpCommit: boolean;
    squareAttachJumpCommitImpulseX: number | null;
    squareAttachJumpCommitImpulseY: number | null;
}

export const createEmptyPlayerPresentationFrameHooks = (): PlayerPresentationFrameHooks => {
    return {
        jumpIntent: false,
        jumpCommit: false,
        jumpCommitImpulseX: null,
        jumpCommitImpulseY: null,
        apexEnter: false,
        fallEnter: false,
        landImpactSpeed: null,
        formSwitchIn: null,
        ballReboundLaunch: false,
        ballReboundLaunchImpulseX: null,
        ballReboundLaunchImpulseY: null,
        ballBoostGroundStart: false,
        ballBoostGroundStartImpulseX: null,
        ballBoostGroundStartImpulseY: null,
        ballBoostGroundSustain: false,
        ballBoostGroundSustainDirX: null,
        ballBoostGroundSustainDirY: null,
        triangleFlightStart: false,
        triangleFlightEnd: false,
        squareAttachEnter: false,
        squareAttachExit: false,
        squareAttachJumpCommit: false,
        squareAttachJumpCommitImpulseX: null,
        squareAttachJumpCommitImpulseY: null
    };
};
