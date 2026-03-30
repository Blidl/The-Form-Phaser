import type { Physics } from 'phaser';
import { Math as PhaserMath } from 'phaser';
import {
    PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS,
    PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
    PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED
} from './player_constants';
import type { PlayerInputSnapshot } from './player_input';
import { clearJumpBuffer, clearSquareAttachEntryBuffer, hasSquareAttachEntryBuffer, type PlayerTimers } from './player_timers';
import { tickSquareShellOrientation } from './player_square_shell';
import { tickSquareAttachState, tryEnterSquareAttach } from './player_square_attach';
import { beginSquareTrailAnchor, tickSquareTrailDetachedLifecycle, tickSquareTrailPaint } from './player_square_trail';
import { resolveSquareAttachSurfaceVelocity } from './player_square_surface_move';
import { isSquareRolloverActive, tickSquareRollover, tryStartSquareRollover } from './player_square_rollover';
import { resolveArcadeAxisContactSnapshot, resolveSquareContactNormal } from './geometry/player_geometry_queries';
import type { PlayerSquareAttachPoseQuery, PlayerSquareTrailSurfacePoint } from './geometry/player_geometry_types';
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
    querySquareAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery;
}

interface SquareAttachCandidateSample {
    centerX: number;
    centerY: number;
    preferredNormalX?: -1 | 0 | 1;
    preferredNormalY?: -1 | 0 | 1;
    restrictToPreferredNormal?: boolean;
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
        resolveSquareTrailSurfacePoint,
        querySquareAttachPose
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
    const attachCandidate = resolveBestSquareAttachCandidate(
        physicsBody,
        state.squareShell,
        squareContact.normalX,
        squareContact.normalY,
        squareContact.hasContact,
        input.actionHeld,
        input,
        horizontalDir,
        verticalDir as -1 | 0 | 1,
        deltaSec,
        querySquareAttachPose
    );

    const squareAttachStartDecision = resolveSquareAttachStartDecision({
        currentForm: state.currentForm,
        actionHeld: input.actionHeld,
        hasEntryBuffer: hasSquareAttachEntryBuffer(timers),
        isAttached: state.squareShell.isAttached,
        hasContact: attachCandidate !== null
    });

    if (squareAttachStartDecision.canStart) {
        const attachStarted = tryEnterSquareAttach(
            state.squareShell,
            physicsBody,
            attachCandidate?.pose ?? null,
            attachCandidate?.normalX ?? squareContact.normalX,
            attachCandidate?.normalY ?? squareContact.normalY
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

    if (!isSquareRolloverActive(state.squareShell)) {
        tryStartSquareRollover({
            squareShell: state.squareShell,
            physicsBody,
            actionHeld: input.actionHeld,
            horizontalDir,
            verticalDir: verticalDir as -1 | 0 | 1,
            queryAttachPose: querySquareAttachPose
        });
    }

    if (!isSquareRolloverActive(state.squareShell)) {
        tickSquareAttachState(
            state.squareShell,
            physicsBody,
            deltaMs,
            squareAttachHoldDecision.shouldKeepAttachHold,
            attachCandidate?.pose ?? null,
            attachCandidate?.normalX ?? squareContact.normalX,
            attachCandidate?.normalY ?? squareContact.normalY
        );
    }

    tickSquareRollover({
        squareShell: state.squareShell,
        physicsBody,
        deltaMs,
        queryAttachPose: querySquareAttachPose,
        onSuccessCommit: (targetPose) => {
            state.squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
            beginSquareTrailAnchor(
                state.squareShell,
                targetPose.surfacePoint.x,
                targetPose.surfacePoint.y,
                targetPose.surfacePoint.supportOwner
            );
        },
        onRollbackComplete: () => {
            state.squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
        }
    });

    if (!isSquareRolloverActive(state.squareShell)) {
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
    }
};

export const applySquareAttachedMovement = (
    physicsBody: Physics.Arcade.Body,
    state: PlayerShellState,
    input: PlayerInputSnapshot
): void => {
    if (isSquareRolloverActive(state.squareShell)) {
        physicsBody.setVelocity(0, 0);
        physicsBody.setAcceleration(0, 0);
        return;
    }

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

const resolveBestSquareAttachCandidate = (
    physicsBody: Physics.Arcade.Body,
    squareShell: PlayerShellState['squareShell'],
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    hasContact: boolean,
    actionHeld: boolean,
    input: PlayerInputSnapshot,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1,
    deltaSec: number,
    querySquareAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery
): { normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery } | null => {
    const currentCenterX = physicsBody.x + (physicsBody.width * 0.5);
    const currentCenterY = physicsBody.y + (physicsBody.height * 0.5);
    const candidateSamples = resolveAttachCandidateSamples(
        squareShell,
        currentCenterX,
        currentCenterY,
        actionHeld,
        input,
        horizontalDir,
        verticalDir,
        deltaSec
    );

    for (const sample of candidateSamples) {
        const orderedNormals = resolveAttachCandidateNormals(
            squareShell,
            contactNormalX,
            contactNormalY,
            hasContact,
            sample.preferredNormalX,
            sample.preferredNormalY,
            sample.restrictToPreferredNormal === true
        );

        for (const candidate of orderedNormals) {
            const pose = querySquareAttachPose(
                sample.centerX,
                sample.centerY,
                candidate.normalX,
                candidate.normalY
            );
            if (pose.supportInterval !== null && pose.isPoseClear) {
                return {
                    normalX: candidate.normalX,
                    normalY: candidate.normalY,
                    pose
                };
            }
        }
    }

    return null;
};

const resolveAttachCandidateSamples = (
    squareShell: PlayerShellState['squareShell'],
    currentCenterX: number,
    currentCenterY: number,
    actionHeld: boolean,
    input: PlayerInputSnapshot,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1,
    deltaSec: number
): SquareAttachCandidateSample[] => {
    const samples: SquareAttachCandidateSample[] = [];
    if (squareShell.isAttached && actionHeld) {
        const transitionNormal = resolveAttachTransitionNormal(
            squareShell.attachNormalX,
            squareShell.attachNormalY,
            horizontalDir,
            verticalDir
        );
        const attachVelocity = resolveSquareAttachSurfaceVelocity(
            squareShell.attachNormalX,
            squareShell.attachNormalY,
            input,
            PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
            PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED
        );
        const projectedCenterX = currentCenterX + (attachVelocity.velocityX * deltaSec);
        const projectedCenterY = currentCenterY + (attachVelocity.velocityY * deltaSec);
        if (transitionNormal !== null) {
            samples.push({
                centerX: projectedCenterX,
                centerY: projectedCenterY,
                preferredNormalX: transitionNormal.normalX,
                preferredNormalY: transitionNormal.normalY,
                restrictToPreferredNormal: true
            });
        }
    }

    samples.push({
        centerX: currentCenterX,
        centerY: currentCenterY
    });

    return samples;
};

const resolveAttachTransitionNormal = (
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1
): { normalX: -1 | 0 | 1; normalY: -1 | 0 | 1 } | null => {
    if (attachNormalY !== 0 && horizontalDir !== 0) {
        return {
            normalX: (-horizontalDir) as -1 | 0 | 1,
            normalY: 0
        };
    }

    if (attachNormalX !== 0 && verticalDir !== 0) {
        return {
            normalX: 0,
            normalY: (-verticalDir) as -1 | 0 | 1
        };
    }

    return null;
};

const resolveAttachCandidateNormals = (
    squareShell: PlayerShellState['squareShell'],
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1,
    hasContact: boolean,
    preferredNormalX?: -1 | 0 | 1,
    preferredNormalY?: -1 | 0 | 1,
    restrictToPreferredNormal: boolean = false
): Array<{ normalX: -1 | 0 | 1; normalY: -1 | 0 | 1 }> => {
    const ordered: Array<{ normalX: -1 | 0 | 1; normalY: -1 | 0 | 1 }> = [];
    const pushUnique = (normalX: -1 | 0 | 1, normalY: -1 | 0 | 1): void => {
        if (ordered.some((candidate) => candidate.normalX === normalX && candidate.normalY === normalY)) {
            return;
        }
        ordered.push({ normalX, normalY });
    };

    if (preferredNormalX !== undefined && preferredNormalY !== undefined) {
        pushUnique(preferredNormalX, preferredNormalY);
        if (restrictToPreferredNormal) {
            return ordered;
        }
    }

    if (squareShell.isAttached && hasContact && (contactNormalX !== squareShell.attachNormalX || contactNormalY !== squareShell.attachNormalY)) {
        pushUnique(contactNormalX, contactNormalY);
    }

    if (squareShell.isAttached) {
        pushUnique(squareShell.attachNormalX, squareShell.attachNormalY);
    }

    if (hasContact) {
        pushUnique(contactNormalX, contactNormalY);
    }

    pushUnique(0, -1);
    pushUnique(1, 0);
    pushUnique(-1, 0);
    pushUnique(0, 1);

    return ordered;
};
