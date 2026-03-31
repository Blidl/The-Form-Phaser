import type { Physics } from 'phaser';
import {
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_SQUARE_ATTACH_JUMP_HEIGHT_PX,
    PLAYER_SQUARE_ATTACH_JUMP_OUT_DURATION_MS,
    PLAYER_SQUARE_ATTACH_JUMP_OUT_SPEED_PX_PER_SEC,
    PLAYER_SQUARE_ATTACH_JUMP_REACQUIRE_RANGE_PX,
    PLAYER_SQUARE_ATTACH_JUMP_RELEASE_DETACH,
    PLAYER_SQUARE_ATTACH_JUMP_RETURN_TIME_MS
} from './player_constants';
import { commitSquareAttachPose } from './player_square_attach';
import { resolveTrailCompatibleAttachPose } from './player_square_attach_candidates';
import { squareSupportLocalToWorld } from './player_square_support_space';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';
import type { PlayerSquareAttachJumpState, PlayerSquareShellState, PlayerSquareTrailSupportOwner } from './player_types';

const HALF_SIZE = PLAYER_FORM_SQUARE_SIZE * 0.5;

interface TickSquareAttachJumpParams {
    squareShell: PlayerSquareShellState;
    physicsBody: Physics.Arcade.Body;
    deltaMs: number;
    actionHeld: boolean;
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery;
    onReturnCommit: (query: PlayerSquareAttachPoseQuery) => void;
}

export const createSquareAttachJumpState = (): PlayerSquareAttachJumpState => {
    return {
        phase: 'inactive',
        elapsedMs: 0,
        anchorLocalX: 0,
        anchorLocalY: 0,
        anchorSupportBody: null,
        anchorSupportOriginX: 0,
        anchorSupportOriginY: 0,
        normalX: 0,
        normalY: -1,
        launchCenterX: 0,
        launchCenterY: 0,
        peakCenterX: 0,
        peakCenterY: 0,
        orientationRad: 0
    };
};

export const resetSquareAttachJumpState = (state: PlayerSquareAttachJumpState): void => {
    state.phase = 'inactive';
    state.elapsedMs = 0;
    state.anchorLocalX = 0;
    state.anchorLocalY = 0;
    state.anchorSupportBody = null;
    state.anchorSupportOriginX = 0;
    state.anchorSupportOriginY = 0;
    state.normalX = 0;
    state.normalY = -1;
    state.launchCenterX = 0;
    state.launchCenterY = 0;
    state.peakCenterX = 0;
    state.peakCenterY = 0;
    state.orientationRad = 0;
};

export const isSquareAttachJumpActive = (squareShell: PlayerSquareShellState): boolean => {
    return squareShell.attachJumpState.phase !== 'inactive';
};

export const tryStartSquareAttachJump = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body
): boolean => {
    const hasJumpAnchor = squareShell.trailLatchActive || squareShell.trailAnchorActive;
    if (!squareShell.isAttached || squareShell.attachJumpState.phase !== 'inactive' || !hasJumpAnchor) {
        return false;
    }

    const currentCenterX = physicsBody.x + (physicsBody.width * 0.5);
    const currentCenterY = physicsBody.y + (physicsBody.height * 0.5);
    const jumpDistancePx = Math.max(
        PLAYER_SQUARE_ATTACH_JUMP_HEIGHT_PX,
        PLAYER_SQUARE_ATTACH_JUMP_OUT_SPEED_PX_PER_SEC * (PLAYER_SQUARE_ATTACH_JUMP_OUT_DURATION_MS / 1000)
    );
    const state = squareShell.attachJumpState;

    state.phase = 'outbound';
    state.elapsedMs = 0;
    state.anchorLocalX = squareShell.trailLatchActive ? squareShell.trailLatchLocalX : squareShell.trailAnchorLocalX;
    state.anchorLocalY = squareShell.trailLatchActive ? squareShell.trailLatchLocalY : squareShell.trailAnchorLocalY;
    state.anchorSupportBody = squareShell.trailLatchActive ? squareShell.trailLatchSupportBody : squareShell.trailAnchorSupportBody;
    state.anchorSupportOriginX = squareShell.trailLatchActive ? squareShell.trailLatchSupportOriginX : squareShell.trailAnchorSupportOriginX;
    state.anchorSupportOriginY = squareShell.trailLatchActive ? squareShell.trailLatchSupportOriginY : squareShell.trailAnchorSupportOriginY;
    state.normalX = squareShell.trailLatchActive ? squareShell.trailLatchNormalX : squareShell.attachNormalX;
    state.normalY = squareShell.trailLatchActive ? squareShell.trailLatchNormalY : squareShell.attachNormalY;
    state.launchCenterX = currentCenterX;
    state.launchCenterY = currentCenterY;
    state.peakCenterX = currentCenterX + (state.normalX * jumpDistancePx);
    state.peakCenterY = currentCenterY + (state.normalY * jumpDistancePx);
    state.orientationRad = squareShell.orientationRad;

    squareShell.isAttached = false;
    squareShell.isOnTrail = false;
    squareShell.isTrailRegenerating = false;
    squareShell.isTrailLockedAtBoundary = false;
    squareShell.attachContactGraceMs = 0;
    squareShell.hasContact = false;
    physicsBody.setVelocity(0, 0);
    physicsBody.setAcceleration(0, 0);
    return true;
};

export const tickSquareAttachJump = (params: TickSquareAttachJumpParams): void => {
    const { squareShell, physicsBody, deltaMs, actionHeld, queryAttachPose, onReturnCommit } = params;
    const state = squareShell.attachJumpState;
    if (state.phase === 'inactive') {
        physicsBody.checkCollision.none = false;
        return;
    }

    if (!actionHeld && PLAYER_SQUARE_ATTACH_JUMP_RELEASE_DETACH) {
        physicsBody.checkCollision.none = false;
        resetSquareAttachJumpState(state);
        return;
    }

    physicsBody.checkCollision.none = true;
    physicsBody.setVelocity(0, 0);
    physicsBody.setAcceleration(0, 0);

    if (state.phase === 'outbound') {
        state.elapsedMs += deltaMs;
        const progress = Math.min(1, state.elapsedMs / PLAYER_SQUARE_ATTACH_JUMP_OUT_DURATION_MS);
        const easedProgress = 1 - ((1 - progress) * (1 - progress));
        const centerX = lerp(state.launchCenterX, state.peakCenterX, easedProgress);
        const centerY = lerp(state.launchCenterY, state.peakCenterY, easedProgress);
        physicsBody.reset(centerX, centerY);
        squareShell.orientationRad = state.orientationRad;

        if (progress >= 1) {
            state.phase = 'return';
            state.elapsedMs = 0;
        }
        return;
    }

    state.elapsedMs += deltaMs;
    const returnProgress = Math.min(1, state.elapsedMs / PLAYER_SQUARE_ATTACH_JUMP_RETURN_TIME_MS);
    const targetPose = resolveAttachJumpTargetPose(squareShell, queryAttachPose, state);
    const targetCenterX = targetPose?.snappedCenterX ?? resolveAttachJumpAnchorCenter(state).x;
    const targetCenterY = targetPose?.snappedCenterY ?? resolveAttachJumpAnchorCenter(state).y;
    const easedReturnProgress = returnProgress * returnProgress * (3 - (2 * returnProgress));
    const centerX = lerp(state.peakCenterX, targetCenterX, easedReturnProgress);
    const centerY = lerp(state.peakCenterY, targetCenterY, easedReturnProgress);

    physicsBody.reset(centerX, centerY);
    squareShell.orientationRad = state.orientationRad;

    if (returnProgress < 1) {
        return;
    }

    if (targetPose !== null) {
        commitSquareAttachPose(
            squareShell,
            physicsBody,
            targetPose,
            state.normalX,
            state.normalY
        );
        onReturnCommit(targetPose);
    }

    physicsBody.checkCollision.none = false;
    resetSquareAttachJumpState(state);
};

const resolveAttachJumpTargetPose = (
    squareShell: PlayerSquareShellState,
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery,
    state: PlayerSquareAttachJumpState
): PlayerSquareAttachPoseQuery | null => {
    const anchorCenter = resolveAttachJumpAnchorCenter(state);
    const anchoredReturnPose = resolveStoredAnchorReturnPose(
        queryAttachPose,
        state,
        anchorCenter
    );
    if (anchoredReturnPose !== null) {
        return anchoredReturnPose;
    }

    const anchorPose = resolveTrailCompatibleAttachPose(
        squareShell,
        queryAttachPose(
            anchorCenter.x,
            anchorCenter.y,
            state.normalX,
            state.normalY
        ),
        state.normalX,
        state.normalY
    );
    if (anchorPose !== null) {
        return anchorPose;
    }

    const fallbackPose = resolveTrailCompatibleAttachPose(
        squareShell,
        queryAttachPose(
            state.peakCenterX,
            state.peakCenterY,
            state.normalX,
            state.normalY
        ),
        state.normalX,
        state.normalY
    );
    if (fallbackPose === null) {
        return null;
    }

    const anchorSurfaceX = anchorCenter.x - (state.normalX * HALF_SIZE);
    const anchorSurfaceY = anchorCenter.y - (state.normalY * HALF_SIZE);
    const deltaX = fallbackPose.surfacePoint.x - anchorSurfaceX;
    const deltaY = fallbackPose.surfacePoint.y - anchorSurfaceY;
    if (Math.hypot(deltaX, deltaY) > PLAYER_SQUARE_ATTACH_JUMP_REACQUIRE_RANGE_PX) {
        return null;
    }

    return fallbackPose;
};

const resolveStoredAnchorReturnPose = (
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery,
    state: PlayerSquareAttachJumpState,
    anchorCenter: { x: number; y: number }
): PlayerSquareAttachPoseQuery | null => {
    const anchorWorld = resolveAttachJumpAnchorWorld(state);
    const anchorPose = queryAttachPose(
        anchorCenter.x,
        anchorCenter.y,
        state.normalX,
        state.normalY
    );
    if (anchorPose.supportInterval === null || !anchorPose.isPoseClear) {
        return null;
    }

    return {
        ...anchorPose,
        centerX: anchorCenter.x,
        centerY: anchorCenter.y,
        snappedCenterX: anchorCenter.x,
        snappedCenterY: anchorCenter.y,
        rect: {
            left: anchorCenter.x - HALF_SIZE,
            top: anchorCenter.y - HALF_SIZE,
            right: anchorCenter.x + HALF_SIZE,
            bottom: anchorCenter.y + HALF_SIZE,
            width: HALF_SIZE * 2,
            height: HALF_SIZE * 2,
            centerX: anchorCenter.x,
            centerY: anchorCenter.y
        },
        surfacePoint: {
            ...anchorPose.surfacePoint,
            x: anchorWorld.x,
            y: anchorWorld.y,
            supportOwner: {
                body: state.anchorSupportBody,
                originX: state.anchorSupportOriginX,
                originY: state.anchorSupportOriginY
            }
        }
    };
};

const resolveAttachJumpAnchorCenter = (
    state: PlayerSquareAttachJumpState
): { x: number; y: number } => {
    const anchorWorld = resolveAttachJumpAnchorWorld(state);

    return {
        x: anchorWorld.x + (state.normalX * HALF_SIZE),
        y: anchorWorld.y + (state.normalY * HALF_SIZE)
    };
};

const resolveAttachJumpAnchorWorld = (
    state: PlayerSquareAttachJumpState
): { x: number; y: number } => {
    const supportOwner: PlayerSquareTrailSupportOwner = {
        body: state.anchorSupportBody,
        originX: state.anchorSupportOriginX,
        originY: state.anchorSupportOriginY
    };
    return squareSupportLocalToWorld(
        state.anchorLocalX,
        state.anchorLocalY,
        supportOwner
    );
};

const lerp = (from: number, to: number, t: number): number => {
    return from + ((to - from) * t);
};
