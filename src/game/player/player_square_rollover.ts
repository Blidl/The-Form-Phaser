import type { Physics } from 'phaser';
import {
    PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX,
    PLAYER_SQUARE_ROLLOVER_DURATION_MS,
    PLAYER_SQUARE_ROLLOVER_PREVIEW_TIME_MS,
    PLAYER_SQUARE_ROLLOVER_RETURN_TIME_MS
} from './player_constants';
import { commitSquareAttachPose } from './player_square_attach';
import { resolveTrailCompatibleAttachPose } from './player_square_attach_candidates';
import {
    appendSquareTrailSegmentFromWorldPoints,
    findNearestSquareTrailPoint
} from './player_square_trail';
import { squareSupportLocalToWorld, squareSupportWorldToLocal } from './player_square_support_space';
import type {
    PlayerSquareRolloverState,
    PlayerSquareShellState,
    PlayerSquareTrailSupportOwner
} from './player_types';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';

interface SquareRolloverMoveVector {
    x: -1 | 0 | 1;
    y: -1 | 0 | 1;
}

interface SquareAttachZoneState {
    isAttached: boolean;
}

interface SquareRolloverStartCandidate {
    sourceNormalX: -1 | 0 | 1;
    sourceNormalY: -1 | 0 | 1;
    sourcePose: PlayerSquareAttachPoseQuery;
    targetPose: PlayerSquareAttachPoseQuery;
    moveVectorX: -1 | 0 | 1;
    moveVectorY: -1 | 0 | 1;
    pivotWorldX: number;
    pivotWorldY: number;
    pivotSupportOwner: PlayerSquareTrailSupportOwner;
    targetNormalX: -1 | 0 | 1;
    targetNormalY: -1 | 0 | 1;
    turnAngleRad: number;
    inputScore: number;
}

interface TryStartSquareRolloverParams {
    squareShell: PlayerSquareShellState;
    physicsBody: Physics.Arcade.Body;
    actionHeld: boolean;
    horizontalDir: -1 | 0 | 1;
    verticalDir: -1 | 0 | 1;
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery;
}

interface TickSquareRolloverParams {
    squareShell: PlayerSquareShellState;
    physicsBody: Physics.Arcade.Body;
    deltaMs: number;
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery;
    isRolloverPoseClear: (
        centerX: number,
        centerY: number,
        orientationRad: number,
        ignoreBodyA: Physics.Arcade.Body | Physics.Arcade.StaticBody | null,
        ignoreBodyB: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
    ) => boolean;
    onSuccessCommit: (query: PlayerSquareAttachPoseQuery) => void;
    onRollbackComplete: () => void;
}

const AXIS_ZONE_EPSILON = 0.5;

export const createSquareRolloverState = (): PlayerSquareRolloverState => {
    return {
        phase: 'inactive',
        elapsedMs: 0,
        pivotLocalX: 0,
        pivotLocalY: 0,
        pivotSupportBody: null,
        pivotSupportOriginX: 0,
        pivotSupportOriginY: 0,
        deltaAngleRad: 0,
        startOrientationRad: 0,
        endOrientationRad: 0,
        pivotSquareLocalX: 0,
        pivotSquareLocalY: 0,
        sourceNormalX: 0,
        sourceNormalY: -1,
        targetNormalX: 0,
        targetNormalY: -1,
        targetPoseValid: false
    };
};

export const resetSquareRolloverState = (state: PlayerSquareRolloverState): void => {
    state.phase = 'inactive';
    state.elapsedMs = 0;
    state.pivotLocalX = 0;
    state.pivotLocalY = 0;
    state.pivotSupportBody = null;
    state.pivotSupportOriginX = 0;
    state.pivotSupportOriginY = 0;
    state.deltaAngleRad = 0;
    state.startOrientationRad = 0;
    state.endOrientationRad = 0;
    state.pivotSquareLocalX = 0;
    state.pivotSquareLocalY = 0;
    state.sourceNormalX = 0;
    state.sourceNormalY = -1;
    state.targetNormalX = 0;
    state.targetNormalY = -1;
    state.targetPoseValid = false;
};

export const isSquareRolloverActive = (squareShell: PlayerSquareShellState): boolean => {
    return squareShell.rolloverState.phase !== 'inactive';
};

export const tryStartSquareRollover = (params: TryStartSquareRolloverParams): boolean => {
    const { squareShell, physicsBody, actionHeld, horizontalDir, verticalDir, queryAttachPose } = params;
    const rollover = squareShell.rolloverState;
    if (!squareShell.isAttached || !actionHeld || rollover.phase !== 'inactive') {
        return false;
    }
    const currentCenterX = physicsBody.x + (physicsBody.width * 0.5);
    const currentCenterY = physicsBody.y + (physicsBody.height * 0.5);

    const startCandidate = resolvePreferredRolloverStartCandidate(
        squareShell,
        currentCenterX,
        currentCenterY,
        horizontalDir,
        verticalDir,
        queryAttachPose
    );
    if (startCandidate === null) {
        return false;
    }

    const pivotLocal = squareSupportWorldToLocal(
        startCandidate.pivotWorldX,
        startCandidate.pivotWorldY,
        startCandidate.pivotSupportOwner
    );
    const pivotSquareLocal = worldOffsetToSquareLocal(
        startCandidate.pivotWorldX - currentCenterX,
        startCandidate.pivotWorldY - currentCenterY,
        squareShell.orientationRad
    );

    rollover.phase = 'forward';
    rollover.elapsedMs = 0;
    rollover.pivotLocalX = pivotLocal.x;
    rollover.pivotLocalY = pivotLocal.y;
    rollover.pivotSupportBody = startCandidate.pivotSupportOwner.body;
    rollover.pivotSupportOriginX = startCandidate.pivotSupportOwner.originX;
    rollover.pivotSupportOriginY = startCandidate.pivotSupportOwner.originY;
    rollover.deltaAngleRad = startCandidate.turnAngleRad;
    rollover.startOrientationRad = squareShell.orientationRad;
    rollover.endOrientationRad = squareShell.orientationRad + startCandidate.turnAngleRad;
    rollover.pivotSquareLocalX = pivotSquareLocal.x;
    rollover.pivotSquareLocalY = pivotSquareLocal.y;
    rollover.sourceNormalX = startCandidate.sourceNormalX;
    rollover.sourceNormalY = startCandidate.sourceNormalY;
    rollover.targetNormalX = startCandidate.targetNormalX;
    rollover.targetNormalY = startCandidate.targetNormalY;
    rollover.targetPoseValid = startCandidate.targetPose.supportInterval !== null && startCandidate.targetPose.isPoseClear;

    squareShell.contactNormalX = startCandidate.sourceNormalX;
    squareShell.contactNormalY = startCandidate.sourceNormalY;
    squareShell.attachNormalX = startCandidate.sourceNormalX;
    squareShell.attachNormalY = startCandidate.sourceNormalY;
    squareShell.attachSupportBody = startCandidate.sourcePose.supportInterval?.ownerBody ?? null;
    return true;
};

export const tickSquareRollover = (params: TickSquareRolloverParams): void => {
    const { squareShell, physicsBody, deltaMs, queryAttachPose, isRolloverPoseClear, onSuccessCommit, onRollbackComplete } = params;
    const rollover = squareShell.rolloverState;
    if (rollover.phase === 'inactive') {
        physicsBody.checkCollision.none = false;
        return;
    }

    physicsBody.checkCollision.none = true;
    physicsBody.setVelocity(0, 0);
    physicsBody.setAcceleration(0, 0);

    if (rollover.phase === 'forward') {
        rollover.elapsedMs += deltaMs;
        const forwardPose = sampleForwardPose(rollover, rollover.elapsedMs);
        applyRolloverPose(squareShell, physicsBody, forwardPose.x, forwardPose.y, forwardPose.orientationRad);
        const forwardValidationPose = queryAttachPose(
            forwardPose.x,
            forwardPose.y,
            forwardPose.arcProgress < 0.5 ? rollover.sourceNormalX : rollover.targetNormalX,
            forwardPose.arcProgress < 0.5 ? rollover.sourceNormalY : rollover.targetNormalY
        );
        if (!isRolloverPoseClear(
            forwardPose.x,
            forwardPose.y,
            forwardPose.orientationRad,
            rollover.pivotSupportBody,
            forwardValidationPose.supportInterval?.ownerBody ?? null
        )) {
            rollover.phase = 'rollback';
            rollover.elapsedMs = 0;
            return;
        }
        if (!forwardPose.isComplete) {
            return;
        }

        const targetCandidate = resolveRolloverAttachCommitCandidate(
            squareShell,
            queryAttachPose,
            forwardPose.x,
            forwardPose.y,
            rollover.targetNormalX,
            rollover.targetNormalY
        );
        if (targetCandidate !== null) {
            sealRolloverTrailCorner(squareShell, rollover, targetCandidate);
            squareShell.orientationRad = rollover.endOrientationRad;
            squareShell.groundedOrientationRad = rollover.endOrientationRad;
            commitSquareAttachPose(
                squareShell,
                physicsBody,
                targetCandidate.pose,
                targetCandidate.normalX,
                targetCandidate.normalY
            );
            physicsBody.checkCollision.none = false;
            resetSquareRolloverState(rollover);
            onSuccessCommit(targetCandidate.pose);
            return;
        }

        rollover.phase = 'rollback';
        rollover.elapsedMs = 0;
        return;
    }

    rollover.elapsedMs += deltaMs;
    const rollbackPose = sampleRollbackPose(rollover, rollover.elapsedMs);
    applyRolloverPose(squareShell, physicsBody, rollbackPose.x, rollbackPose.y, rollbackPose.orientationRad);
    if (!rollbackPose.isComplete) {
        return;
    }

    squareShell.attachNormalX = rollover.sourceNormalX;
    squareShell.attachNormalY = rollover.sourceNormalY;
    squareShell.contactNormalX = rollover.sourceNormalX;
    squareShell.contactNormalY = rollover.sourceNormalY;
    squareShell.groundedOrientationRad = rollover.startOrientationRad;
    physicsBody.checkCollision.none = false;
    resetSquareRolloverState(rollover);
    onRollbackComplete();
};

const sampleForwardPose = (
    rollover: PlayerSquareRolloverState,
    elapsedMs: number
): { x: number; y: number; orientationRad: number; isComplete: boolean; arcProgress: number } => {
    if (elapsedMs <= PLAYER_SQUARE_ROLLOVER_PREVIEW_TIME_MS) {
        const center = resolveSquareCenterAroundPivot(rollover, rollover.startOrientationRad);
        return {
            x: center.x,
            y: center.y,
            orientationRad: rollover.startOrientationRad,
            isComplete: false,
            arcProgress: 0
        };
    }

    const arcElapsedMs = Math.min(
        PLAYER_SQUARE_ROLLOVER_DURATION_MS,
        elapsedMs - PLAYER_SQUARE_ROLLOVER_PREVIEW_TIME_MS
    );
    const arcT = PLAYER_SQUARE_ROLLOVER_DURATION_MS <= 0
        ? 1
        : Math.min(1, arcElapsedMs / PLAYER_SQUARE_ROLLOVER_DURATION_MS);
    const orientationRad = lerpAngle(rollover.startOrientationRad, rollover.endOrientationRad, arcT);
    const center = resolveSquareCenterAroundPivot(rollover, orientationRad);

    return {
        x: center.x,
        y: center.y,
        orientationRad,
        isComplete: arcT >= 1,
        arcProgress: arcT
    };
};

const sampleRollbackPose = (
    rollover: PlayerSquareRolloverState,
    elapsedMs: number
): { x: number; y: number; orientationRad: number; isComplete: boolean } => {
    const rollbackT = PLAYER_SQUARE_ROLLOVER_RETURN_TIME_MS <= 0
        ? 1
        : Math.min(1, elapsedMs / PLAYER_SQUARE_ROLLOVER_RETURN_TIME_MS);
    const orientationRad = lerpAngle(rollover.endOrientationRad, rollover.startOrientationRad, rollbackT);
    const center = resolveSquareCenterAroundPivot(rollover, orientationRad);

    return {
        x: center.x,
        y: center.y,
        orientationRad,
        isComplete: rollbackT >= 1
    };
};

const resolvePreferredRolloverStartCandidate = (
    squareShell: PlayerSquareShellState,
    centerX: number,
    centerY: number,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1,
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery
): SquareRolloverStartCandidate | null => {
    if (horizontalDir === 0 && verticalDir === 0) {
        return null;
    }

    const sourcePoses = resolveRolloverSourcePoses(squareShell, centerX, centerY, queryAttachPose);
    let bestCandidate: SquareRolloverStartCandidate | null = null;

    for (const sourcePose of sourcePoses) {
        const moveVectors = resolveAllSurfaceMoveVectors(sourcePose.normalX, sourcePose.normalY);
        for (const moveVector of moveVectors) {
            const startCandidate = resolveRolloverStartCandidate(
                sourcePose.pose,
                sourcePose.normalX,
                sourcePose.normalY,
                moveVector,
                queryAttachPose
            );
            if (startCandidate === null) {
                continue;
            }

            const inputScore = resolveRolloverInputScore(
                startCandidate.moveVectorX,
                startCandidate.moveVectorY,
                startCandidate.turnAngleRad,
                horizontalDir,
                verticalDir,
                sourcePose.isCurrentAttach
            );
            if (inputScore <= 0) {
                continue;
            }

            const scoredCandidate: SquareRolloverStartCandidate = {
                ...startCandidate,
                sourceNormalX: sourcePose.normalX,
                sourceNormalY: sourcePose.normalY,
                sourcePose: sourcePose.pose,
                targetPose: startCandidate.targetPose,
                inputScore
            };
            const candidateIsBetter = bestCandidate === null
                || scoredCandidate.inputScore > bestCandidate.inputScore
                || (
                    scoredCandidate.inputScore === bestCandidate.inputScore
                    && isRolloverTargetPoseReady(scoredCandidate.targetPose)
                    && !isRolloverTargetPoseReady(bestCandidate.targetPose)
                );
            if (candidateIsBetter) {
                bestCandidate = scoredCandidate;
            }
        }
    }

    return bestCandidate;
};

const resolveRolloverStartCandidate = (
    currentPose: PlayerSquareAttachPoseQuery,
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1,
    moveVector: SquareRolloverMoveVector,
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery
): SquareRolloverStartCandidate | null => {
    const supportInterval = currentPose.supportInterval;
    if (supportInterval === null) {
        return null;
    }

    const faceZones = resolveAttachFaceZones(currentPose, attachNormalX, attachNormalY);
    const leadingZone = moveVector.x < 0 || moveVector.y < 0 ? faceZones.leadingNegative : faceZones.leadingPositive;
    const trailingZone = moveVector.x < 0 || moveVector.y < 0 ? faceZones.leadingPositive : faceZones.leadingNegative;
    if (leadingZone.isAttached || !trailingZone.isAttached) {
        return null;
    }

    const pivotAxisValue = moveVector.x < 0 || moveVector.y < 0 ? supportInterval.min : supportInterval.max;
    const pivotWorld = resolvePivotWorldPoint(currentPose, attachNormalX, attachNormalY, pivotAxisValue);
    const turnAngleRad = resolveTurnAngleRad(attachNormalX, attachNormalY, moveVector);
    const targetPose = queryAttachPose(
        currentPose.snappedCenterX,
        currentPose.snappedCenterY,
        (-moveVector.x) as -1 | 0 | 1,
        (-moveVector.y) as -1 | 0 | 1
    );

    return {
        sourceNormalX: attachNormalX,
        sourceNormalY: attachNormalY,
        sourcePose: currentPose,
        targetPose,
        moveVectorX: moveVector.x,
        moveVectorY: moveVector.y,
        pivotWorldX: pivotWorld.x,
        pivotWorldY: pivotWorld.y,
        pivotSupportOwner: currentPose.surfacePoint.supportOwner,
        targetNormalX: (-moveVector.x) as -1 | 0 | 1,
        targetNormalY: (-moveVector.y) as -1 | 0 | 1,
        turnAngleRad,
        inputScore: 0
    };
};

const resolveRolloverSourcePoses = (
    squareShell: PlayerSquareShellState,
    centerX: number,
    centerY: number,
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery
): Array<{ normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery; isCurrentAttach: boolean }> => {
    const orderedNormals: Array<{ normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; isCurrentAttach: boolean }> = [
        {
            normalX: squareShell.attachNormalX,
            normalY: squareShell.attachNormalY,
            isCurrentAttach: true
        },
        { normalX: 0, normalY: -1, isCurrentAttach: false },
        { normalX: 1, normalY: 0, isCurrentAttach: false },
        { normalX: -1, normalY: 0, isCurrentAttach: false },
        { normalX: 0, normalY: 1, isCurrentAttach: false }
    ];
    const sourcePoses: Array<{ normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery; isCurrentAttach: boolean }> = [];

    for (const candidateNormal of orderedNormals) {
        if (sourcePoses.some((entry) => entry.normalX === candidateNormal.normalX && entry.normalY === candidateNormal.normalY)) {
            continue;
        }

        const pose = resolveTrailCompatibleAttachPose(
            squareShell,
            queryAttachPose(centerX, centerY, candidateNormal.normalX, candidateNormal.normalY),
            candidateNormal.normalX,
            candidateNormal.normalY
        );
        if (pose === null || pose.supportInterval === null || !pose.isPoseClear) {
            continue;
        }

        sourcePoses.push({
            normalX: candidateNormal.normalX,
            normalY: candidateNormal.normalY,
            pose,
            isCurrentAttach: candidateNormal.isCurrentAttach
        });
    }

    return sourcePoses;
};

const resolveAllSurfaceMoveVectors = (
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1
): SquareRolloverMoveVector[] => {
    if (attachNormalY !== 0) {
        return [
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ];
    }

    return [
        { x: 0, y: -1 },
        { x: 0, y: 1 }
    ];
};

const resolveRolloverInputScore = (
    moveVectorX: -1 | 0 | 1,
    moveVectorY: -1 | 0 | 1,
    turnAngleRad: number,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1,
    isCurrentAttach: boolean
): number => {
    const targetContinuation = resolveTargetContinuationVector(
        moveVectorX,
        moveVectorY,
        turnAngleRad
    );
    const matchesSourceApproach = horizontalDir === moveVectorX && verticalDir === moveVectorY;
    const matchesTargetContinuation = horizontalDir === targetContinuation.x && verticalDir === targetContinuation.y;
    if (!matchesSourceApproach && !matchesTargetContinuation) {
        return 0;
    }

    let score = 0;
    if (matchesTargetContinuation) {
        score += 4;
    }
    if (matchesSourceApproach) {
        score += 2;
    }
    if (isCurrentAttach) {
        score += 1;
    }

    return score;
};

const isRolloverTargetPoseReady = (pose: PlayerSquareAttachPoseQuery): boolean => {
    return pose.supportInterval !== null && pose.isPoseClear;
};

const resolveTargetContinuationVector = (
    moveVectorX: -1 | 0 | 1,
    moveVectorY: -1 | 0 | 1,
    turnAngleRad: number
): { x: -1 | 0 | 1; y: -1 | 0 | 1 } => {
    const turnSign = turnAngleRad < 0 ? -1 : 1;
    if (turnSign > 0) {
        return {
            x: (-moveVectorY) as -1 | 0 | 1,
            y: moveVectorX
        };
    }

    return {
        x: moveVectorY,
        y: (-moveVectorX) as -1 | 0 | 1
    };
};

const resolveAttachFaceZones = (
    currentPose: PlayerSquareAttachPoseQuery,
    _attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1
): { leadingNegative: SquareAttachZoneState; leadingPositive: SquareAttachZoneState } => {
    if (attachNormalY === -1) {
        return buildHorizontalFaceZones(currentPose);
    }

    if (attachNormalY === 1) {
        return buildHorizontalFaceZones(currentPose);
    }

    return buildVerticalFaceZones(currentPose);
};

const buildHorizontalFaceZones = (
    currentPose: PlayerSquareAttachPoseQuery
): { leadingNegative: SquareAttachZoneState; leadingPositive: SquareAttachZoneState } => {
    const centerX = currentPose.rect.centerX;
    return {
        leadingNegative: {
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, currentPose.rect.left, centerX)
        },
        leadingPositive: {
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, centerX, currentPose.rect.right)
        }
    };
};

const buildVerticalFaceZones = (
    currentPose: PlayerSquareAttachPoseQuery
): { leadingNegative: SquareAttachZoneState; leadingPositive: SquareAttachZoneState } => {
    const centerY = currentPose.rect.centerY;
    return {
        leadingNegative: {
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, currentPose.rect.top, centerY)
        },
        leadingPositive: {
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, centerY, currentPose.rect.bottom)
        }
    };
};

const doesSupportIntervalOverlapZone = (
    supportInterval: PlayerSquareAttachPoseQuery['supportInterval'],
    zoneMin: number,
    zoneMax: number
): boolean => {
    if (supportInterval === null) {
        return false;
    }

    const overlapMin = Math.max(supportInterval.min, zoneMin);
    const overlapMax = Math.min(supportInterval.max, zoneMax);
    return (overlapMax - overlapMin) > AXIS_ZONE_EPSILON;
};

const resolvePivotWorldPoint = (
    currentPose: PlayerSquareAttachPoseQuery,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    pivotAxisValue: number
): { x: number; y: number } => {
    if (normalY === -1) {
        return { x: pivotAxisValue, y: currentPose.rect.bottom };
    }

    if (normalY === 1) {
        return { x: pivotAxisValue, y: currentPose.rect.top };
    }

    if (normalX === 1) {
        return { x: currentPose.rect.left, y: pivotAxisValue };
    }

    return { x: currentPose.rect.right, y: pivotAxisValue };
};

const resolveTurnAngleRad = (
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1,
    moveVector: SquareRolloverMoveVector
): number => {
    if (attachNormalY !== 0) {
        return (moveVector.x * -attachNormalY) * (Math.PI * 0.5);
    }

    return (attachNormalX * moveVector.y) * (Math.PI * 0.5);
};

const resolveRolloverAttachCommitCandidate = (
    squareShell: PlayerSquareShellState,
    queryAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery,
    centerX: number,
    centerY: number,
    preferredNormalX: -1 | 0 | 1,
    preferredNormalY: -1 | 0 | 1
): { normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery } | null => {
    const orderedNormals: Array<{ normalX: -1 | 0 | 1; normalY: -1 | 0 | 1 }> = [];
    const pushNormal = (normalX: -1 | 0 | 1, normalY: -1 | 0 | 1): void => {
        if (orderedNormals.some((entry) => entry.normalX === normalX && entry.normalY === normalY)) {
            return;
        }
        orderedNormals.push({ normalX, normalY });
    };
    pushNormal(preferredNormalX, preferredNormalY);
    pushNormal(0, -1);
    pushNormal(1, 0);
    pushNormal(-1, 0);
    pushNormal(0, 1);

    for (const candidate of orderedNormals) {
        const pose = queryAttachPose(centerX, centerY, candidate.normalX, candidate.normalY);
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
            return {
                normalX: candidate.normalX,
                normalY: candidate.normalY,
                pose: trailCompatiblePose
            };
        }
    }

    return null;
};


const sealRolloverTrailCorner = (
    squareShell: PlayerSquareShellState,
    rollover: PlayerSquareRolloverState,
    targetCandidate: { normalX: -1 | 0 | 1; normalY: -1 | 0 | 1; pose: PlayerSquareAttachPoseQuery }
): void => {
    const pivotWorld = resolveRolloverWorldPivot(rollover);
    const sourceSupportOwner: PlayerSquareTrailSupportOwner = {
        body: rollover.pivotSupportBody,
        originX: rollover.pivotSupportOriginX,
        originY: rollover.pivotSupportOriginY
    };
    const sourceTrailPoint = findNearestSquareTrailPoint(
        squareShell,
        pivotWorld.x,
        pivotWorld.y,
        rollover.sourceNormalX,
        rollover.sourceNormalY,
        sourceSupportOwner
    );
    if (sourceTrailPoint !== null) {
        const sourceGap = Math.hypot(pivotWorld.x - sourceTrailPoint.x, pivotWorld.y - sourceTrailPoint.y);
        if (sourceGap <= PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX) {
            appendSquareTrailSegmentFromWorldPoints(
                squareShell,
                sourceTrailPoint.x,
                sourceTrailPoint.y,
                pivotWorld.x,
                pivotWorld.y,
                sourceSupportOwner,
                rollover.sourceNormalX,
                rollover.sourceNormalY
            );
        }
    }

    const targetGap = Math.hypot(
        targetCandidate.pose.surfacePoint.x - pivotWorld.x,
        targetCandidate.pose.surfacePoint.y - pivotWorld.y
    );
    if (targetGap <= PLAYER_SQUARE_ATTACH_ACQUIRE_RANGE_PX) {
        appendSquareTrailSegmentFromWorldPoints(
            squareShell,
            pivotWorld.x,
            pivotWorld.y,
            targetCandidate.pose.surfacePoint.x,
            targetCandidate.pose.surfacePoint.y,
            targetCandidate.pose.surfacePoint.supportOwner,
            targetCandidate.normalX,
            targetCandidate.normalY
        );
    }
};

const resolveRolloverWorldPivot = (
    rollover: PlayerSquareRolloverState
): { x: number; y: number } => {
    return squareSupportLocalToWorld(
        rollover.pivotLocalX,
        rollover.pivotLocalY,
        {
            body: rollover.pivotSupportBody,
            originX: rollover.pivotSupportOriginX,
            originY: rollover.pivotSupportOriginY
        }
    );
};

const resolveSquareCenterAroundPivot = (
    rollover: PlayerSquareRolloverState,
    orientationRad: number
): { x: number; y: number } => {
    const pivotWorld = resolveRolloverWorldPivot(rollover);
    const pivotOffsetWorld = squareLocalToWorldOffset(
        rollover.pivotSquareLocalX,
        rollover.pivotSquareLocalY,
        orientationRad
    );

    return {
        x: pivotWorld.x - pivotOffsetWorld.x,
        y: pivotWorld.y - pivotOffsetWorld.y
    };
};

const worldOffsetToSquareLocal = (
    offsetX: number,
    offsetY: number,
    orientationRad: number
): { x: number; y: number } => {
    const cos = Math.cos(orientationRad);
    const sin = Math.sin(orientationRad);
    return {
        x: (offsetX * cos) + (offsetY * sin),
        y: (-offsetX * sin) + (offsetY * cos)
    };
};

const squareLocalToWorldOffset = (
    localX: number,
    localY: number,
    orientationRad: number
): { x: number; y: number } => {
    const cos = Math.cos(orientationRad);
    const sin = Math.sin(orientationRad);
    return {
        x: (localX * cos) - (localY * sin),
        y: (localX * sin) + (localY * cos)
    };
};

const applyRolloverPose = (
    squareShell: PlayerSquareShellState,
    physicsBody: Physics.Arcade.Body,
    centerX: number,
    centerY: number,
    orientationRad: number
): void => {
    squareShell.orientationRad = orientationRad;
    physicsBody.reset(centerX, centerY);
};

const wrapAngle = (angle: number): number => {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
};

const lerpAngle = (from: number, to: number, t: number): number => {
    return from + (wrapAngle(to - from) * t);
};
