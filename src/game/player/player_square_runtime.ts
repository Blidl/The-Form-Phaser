import type { Physics } from 'phaser';
import { Math as PhaserMath } from 'phaser';
import {
    PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS,
    PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
    PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED,
    PLAYER_SQUARE_TRAIL_MANUAL_REGEN_SPEED_PX_PER_SEC
} from './player_constants';
import type { PlayerInputSnapshot } from './player_input';
import { clearJumpBuffer, clearSquareAttachEntryBuffer, hasSquareAttachEntryBuffer, type PlayerTimers } from './player_timers';
import { tickSquareShellOrientation } from './player_square_shell';
import { tickSquareAttachState, tryEnterSquareAttach } from './player_square_attach';
import { isSquareAttachJumpActive, tickSquareAttachJump } from './player_square_attach_jump';
import {
    beginSquareTrailAnchor,
    findNearestSquareTrailPoint,
    tickSquareTrailDetachedLifecycle,
    tickSquareTrailManualRegen,
    tickSquareTrailPaint
} from './player_square_trail';
import {
    isAttachPoseOnTrail,
    resolveTrailCompatibleAttachPose
} from './player_square_attach_candidates';
import {
    clearSquareTrailLatch,
    resolveSquareTrailLatchPose,
    updateSquareTrailLatchFromPose
} from './player_square_trail_latch';
import { resolveSquareAttachSurfaceVelocity } from './player_square_surface_move';
import { isSquareRolloverActive, tickSquareRollover, tryStartSquareRollover } from './player_square_rollover';
import { resolveArcadeAxisContactSnapshot, resolveSquareContactNormal } from './geometry/player_geometry_queries';
import type { PlayerSquareAttachPoseQuery, PlayerSquareTrailSurfacePoint } from './geometry/player_geometry_types';
import { resolveSquareAttachHoldDecision, resolveSquareAttachStartDecision } from './state/player_form_state_guards';
import type { PlayerShellState } from './player_types';
import { getPlatformSurfaceAttachPriority } from '../world/world_surface_tags';

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
    const currentAttachPose = state.squareShell.isAttached
        ? resolveSquareSurfacePoseWithTrailAnchorFallback(
            state.squareShell,
            physicsBody,
            querySquareAttachPose,
            physicsBody.x + (physicsBody.width * 0.5),
            physicsBody.y + (physicsBody.height * 0.5),
            state.squareShell.attachNormalX,
            state.squareShell.attachNormalY
        )
        : null;
    const currentContactPose = !state.squareShell.isAttached && squareContact.hasContact
        ? resolveSquareSurfacePoseWithTrailAnchorFallback(
            state.squareShell,
            physicsBody,
            querySquareAttachPose,
            physicsBody.x + (physicsBody.width * 0.5),
            physicsBody.y + (physicsBody.height * 0.5),
            squareContact.normalX,
            squareContact.normalY
        )
        : null;
    const currentSurfacePose = currentAttachPose ?? currentContactPose;
    const currentSurfaceNormalX = state.squareShell.isAttached
        ? state.squareShell.attachNormalX
        : squareContact.normalX;
    const currentSurfaceNormalY = state.squareShell.isAttached
        ? state.squareShell.attachNormalY
        : squareContact.normalY;
    const attachJumpActive = isSquareAttachJumpActive(state.squareShell);
    const squareAttachStartDecision = resolveSquareAttachStartDecision({
        currentForm: state.currentForm,
        actionHeld: input.actionHeld && !attachJumpActive,
        hasEntryBuffer: hasSquareAttachEntryBuffer(timers),
        isAttached: state.squareShell.isAttached,
        hasContact: attachCandidate !== null
    });
    state.squareShell.isOnTrail = currentSurfacePose !== null
        && isAttachPoseOnTrail(
            state.squareShell,
            currentSurfacePose,
            currentSurfaceNormalX,
            currentSurfaceNormalY
        );
    state.squareShell.isTrailRegenerating = shouldRunSquareTrailManualRegen(
        state.squareShell,
        input,
        horizontalDir,
        verticalDir as -1 | 0 | 1,
        currentSurfaceNormalX,
        currentSurfaceNormalY,
        currentSurfacePose !== null,
        squareContact.hasContact,
        physicsBody.velocity.x,
        physicsBody.velocity.y,
        squareAttachStartDecision.canStart
    );
    if (attachJumpActive) {
        state.squareShell.isOnTrail = false;
        state.squareShell.isTrailRegenerating = false;
        state.squareShell.isTrailLockedAtBoundary = false;
        tickSquareAttachJump({
            squareShell: state.squareShell,
            physicsBody,
            deltaMs,
            actionHeld: input.actionHeld,
            queryAttachPose: querySquareAttachPose,
            onReturnCommit: (targetPose) => {
                state.squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
                if (isAttachPoseOnTrail(state.squareShell, targetPose, state.squareShell.attachNormalX, state.squareShell.attachNormalY)) {
                    updateSquareTrailLatchFromPose(
                        state.squareShell,
                        targetPose,
                        state.squareShell.attachNormalX,
                        state.squareShell.attachNormalY
                    );
                }
                beginSquareTrailAnchor(
                    state.squareShell,
                    targetPose.surfacePoint.x,
                    targetPose.surfacePoint.y,
                    targetPose.surfacePoint.supportOwner
                );
            }
        });
        return;
    }
    state.squareShell.isTrailLockedAtBoundary = shouldLockSquareToTrailBoundary(
        state.squareShell,
        input.actionHeld,
        currentAttachPose,
        attachCandidate
    );

    if (squareAttachStartDecision.canStart) {
        const attachStarted = tryEnterSquareAttach(
            state.squareShell,
            physicsBody,
            attachCandidate?.pose ?? null,
            attachCandidate?.normalX ?? squareContact.normalX,
            attachCandidate?.normalY ?? squareContact.normalY
        );

        if (attachStarted) {
            const committedSurfacePoint = attachCandidate?.pose.surfacePoint
                ?? resolveSquareTrailSurfacePoint(
                    state.squareShell.attachNormalX,
                    state.squareShell.attachNormalY
                );
            if (attachCandidate !== null && isAttachPoseOnTrail(
                state.squareShell,
                attachCandidate.pose,
                state.squareShell.attachNormalX,
                state.squareShell.attachNormalY
            )) {
                updateSquareTrailLatchFromPose(
                    state.squareShell,
                    attachCandidate.pose,
                    state.squareShell.attachNormalX,
                    state.squareShell.attachNormalY
                );
            } else {
                clearSquareTrailLatch(state.squareShell);
            }
            beginSquareTrailAnchor(
                state.squareShell,
                committedSurfacePoint.x,
                committedSurfacePoint.y,
                committedSurfacePoint.supportOwner
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
            actionHeld: input.actionHeld && !state.squareShell.isTrailRegenerating,
            horizontalDir,
            verticalDir: verticalDir as -1 | 0 | 1,
            queryAttachPose: querySquareAttachPose
        });
    }

    if (!isSquareRolloverActive(state.squareShell)) {
        const effectiveAttachPose = attachCandidate?.pose
            ?? resolveBoundaryLockedAttachPose(
                state.squareShell,
                currentAttachPose
            )
            ?? currentAttachPose;
        const effectiveNormalX = attachCandidate?.normalX ?? state.squareShell.attachNormalX ?? squareContact.normalX;
        const effectiveNormalY = attachCandidate?.normalY ?? state.squareShell.attachNormalY ?? squareContact.normalY;
        tickSquareAttachState(
            state.squareShell,
            physicsBody,
            deltaMs,
            squareAttachHoldDecision.shouldKeepAttachHold,
            effectiveAttachPose,
            effectiveNormalX,
            effectiveNormalY
        );
        if (state.squareShell.isAttached && effectiveAttachPose !== null) {
            if (isAttachPoseOnTrail(state.squareShell, effectiveAttachPose, effectiveNormalX, effectiveNormalY)) {
                updateSquareTrailLatchFromPose(
                    state.squareShell,
                    effectiveAttachPose,
                    effectiveNormalX,
                    effectiveNormalY
                );
            } else {
                clearSquareTrailLatch(state.squareShell);
            }
        }
    }

    tickSquareRollover({
        squareShell: state.squareShell,
        physicsBody,
        deltaMs,
        queryAttachPose: querySquareAttachPose,
        onSuccessCommit: (targetPose) => {
            state.squareShell.attachContactGraceMs = PLAYER_SQUARE_ATTACH_CONTACT_GRACE_MS;
            if (isAttachPoseOnTrail(state.squareShell, targetPose, state.squareShell.attachNormalX, state.squareShell.attachNormalY)) {
                updateSquareTrailLatchFromPose(
                    state.squareShell,
                    targetPose,
                    state.squareShell.attachNormalX,
                    state.squareShell.attachNormalY
                );
            } else {
                clearSquareTrailLatch(state.squareShell);
            }
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

    if (state.squareShell.isTrailRegenerating) {
        const refundedAmount = tickSquareTrailManualRegen(
            state.squareShell,
            deltaMs,
            PLAYER_SQUARE_TRAIL_MANUAL_REGEN_SPEED_PX_PER_SEC
        );
        if (refundedAmount > 0) {
            state.squareShell.trailResourceCurrent = PhaserMath.Clamp(
                state.squareShell.trailResourceCurrent + refundedAmount,
                0,
                state.squareShell.trailResourceMax
            );
        }
    }

    if (!isSquareRolloverActive(state.squareShell) && !state.squareShell.isTrailRegenerating) {
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
    if (isSquareAttachJumpActive(state.squareShell)) {
        physicsBody.setVelocity(0, 0);
        physicsBody.setAcceleration(0, 0);
        return;
    }

    if (isSquareRolloverActive(state.squareShell)) {
        physicsBody.setVelocity(0, 0);
        physicsBody.setAcceleration(0, 0);
        return;
    }

    if (state.squareShell.isTrailRegenerating) {
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
    if (state.squareShell.isTrailLockedAtBoundary) {
        physicsBody.setVelocity(
            -state.squareShell.attachNormalX * PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
            -state.squareShell.attachNormalY * PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED
        );
        physicsBody.setAcceleration(0, 0);
        return;
    }

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
    let bestCandidate: { normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery } | null = null;
    let bestPriority = -Infinity;
    let bestSampleIndex = Infinity;
    let bestNormalIndex = Infinity;

    for (let sampleIndex = 0; sampleIndex < candidateSamples.length; sampleIndex += 1) {
        const sample = candidateSamples[sampleIndex];
        const orderedNormals = resolveAttachCandidateNormals(
            squareShell,
            contactNormalX,
            contactNormalY,
            hasContact,
            sample.preferredNormalX,
            sample.preferredNormalY,
            sample.restrictToPreferredNormal === true
        );

        for (let normalIndex = 0; normalIndex < orderedNormals.length; normalIndex += 1) {
            const candidate = orderedNormals[normalIndex];
            const pose = querySquareAttachPose(
                sample.centerX,
                sample.centerY,
                candidate.normalX,
                candidate.normalY
            );
            const trailCompatiblePose = resolveTrailCompatibleAttachPose(
                squareShell,
                pose,
                candidate.normalX,
                candidate.normalY
            );
            if (
                trailCompatiblePose !== null
                && trailCompatiblePose.supportInterval !== null
                && trailCompatiblePose.isPoseClear
            ) {
                const attachPriority = getPlatformSurfaceAttachPriority(
                    trailCompatiblePose.supportInterval.ownerBody.gameObject
                );
                const shouldReplace = attachPriority > bestPriority
                    || (attachPriority === bestPriority && sampleIndex < bestSampleIndex)
                    || (attachPriority === bestPriority && sampleIndex === bestSampleIndex && normalIndex < bestNormalIndex);
                if (shouldReplace) {
                    bestPriority = attachPriority;
                    bestSampleIndex = sampleIndex;
                    bestNormalIndex = normalIndex;
                    bestCandidate = {
                        normalX: candidate.normalX,
                        normalY: candidate.normalY,
                        pose: trailCompatiblePose
                    };
                }
            }
        }
    }

    return bestCandidate;
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

const shouldRunSquareTrailManualRegen = (
    squareShell: PlayerShellState['squareShell'],
    input: PlayerInputSnapshot,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1,
    surfaceNormalX: -1 | 0 | 1,
    surfaceNormalY: -1 | 0 | 1,
    hasSurfacePose: boolean,
    hasSurfaceContact: boolean,
    velocityX: number,
    velocityY: number,
    canStartAttachThisFrame: boolean
): boolean => {
    const isStandingOnFloor = hasSurfaceContact
        && hasSurfacePose
        && surfaceNormalX === 0
        && surfaceNormalY === -1;
    const isStableAtRest = Math.abs(velocityX) <= 8 && Math.abs(velocityY) <= 8;

    return isStandingOnFloor
        && !canStartAttachThisFrame
        && isStableAtRest
        && input.actionHeld
        && horizontalDir === 0
        && verticalDir === 1
        && squareShell.trailResourceCurrent < squareShell.trailResourceMax
        && squareShell.trailSegments.length > 0;
};

const shouldLockSquareToTrailBoundary = (
    squareShell: PlayerShellState['squareShell'],
    actionHeld: boolean,
    currentAttachPose: PlayerSquareAttachPoseQuery | null,
    attachCandidate: { normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery } | null
): boolean => {
    return squareShell.isAttached
        && actionHeld
        && !squareShell.isTrailRegenerating
        && squareShell.trailResourceCurrent <= 0
        && attachCandidate === null
        && currentAttachPose !== null
        && squareShell.isOnTrail;
};

const resolveBoundaryLockedAttachPose = (
    squareShell: PlayerShellState['squareShell'],
    currentAttachPose: PlayerSquareAttachPoseQuery | null
): PlayerSquareAttachPoseQuery | null => {
    if (!squareShell.isTrailLockedAtBoundary || currentAttachPose === null) {
        return null;
    }

    const nearestTrailPoint = findNearestSquareTrailPoint(
        squareShell,
        currentAttachPose.surfacePoint.x,
        currentAttachPose.surfacePoint.y,
        squareShell.attachNormalX,
        squareShell.attachNormalY,
        currentAttachPose.surfacePoint.supportOwner
    );
    if (nearestTrailPoint === null) {
        return null;
    }

    const deltaX = nearestTrailPoint.x - currentAttachPose.surfacePoint.x;
    const deltaY = nearestTrailPoint.y - currentAttachPose.surfacePoint.y;

    return {
        ...currentAttachPose,
        snappedCenterX: currentAttachPose.snappedCenterX + deltaX,
        snappedCenterY: currentAttachPose.snappedCenterY + deltaY,
        centerX: currentAttachPose.centerX + deltaX,
        centerY: currentAttachPose.centerY + deltaY,
        rect: {
            ...currentAttachPose.rect,
            left: currentAttachPose.rect.left + deltaX,
            right: currentAttachPose.rect.right + deltaX,
            top: currentAttachPose.rect.top + deltaY,
            bottom: currentAttachPose.rect.bottom + deltaY,
            centerX: currentAttachPose.rect.centerX + deltaX,
            centerY: currentAttachPose.rect.centerY + deltaY
        },
        surfacePoint: {
            ...currentAttachPose.surfacePoint,
            x: nearestTrailPoint.x,
            y: nearestTrailPoint.y
        }
    };
};

const resolveSquareSurfacePoseWithTrailAnchorFallback = (
    squareShell: PlayerShellState['squareShell'],
    physicsBody: Physics.Arcade.Body,
    querySquareAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery,
    centerX: number,
    centerY: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): PlayerSquareAttachPoseQuery | null => {
    const trailCompatiblePose = resolveTrailCompatibleAttachPose(
        squareShell,
        querySquareAttachPose(centerX, centerY, normalX, normalY),
        normalX,
        normalY
    );
    if (trailCompatiblePose !== null) {
        return trailCompatiblePose;
    }

    return resolveSquareTrailLatchPose(
        squareShell,
        querySquareAttachPose,
        normalX,
        normalY
    );
};
