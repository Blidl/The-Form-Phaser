import type { Physics } from 'phaser';
import {
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_SQUARE_ROLLOVER_DURATION_MS,
    PLAYER_SQUARE_ROLLOVER_PREVIEW_TIME_MS,
    PLAYER_SQUARE_ROLLOVER_RETURN_TIME_MS
} from './player_constants';
import { squareSupportLocalToWorld, squareSupportWorldToLocal } from './player_square_support_space';
import type {
    PlayerSquareRolloverState,
    PlayerSquareShellState,
    PlayerSquareTrailSupportOwner
} from './player_types';
import type { PlayerSquareAttachPoseQuery } from './geometry/player_geometry_types';

type SquareCornerId = 'TL' | 'TR' | 'BL' | 'BR';

interface SquareRolloverMoveVector {
    x: -1 | 0 | 1;
    y: -1 | 0 | 1;
}

interface SquareAttachZoneState {
    cornerId: SquareCornerId;
    min: number;
    max: number;
    isAttached: boolean;
}

interface SquareRolloverStartCandidate {
    pivotWorldX: number;
    pivotWorldY: number;
    pivotSupportOwner: PlayerSquareTrailSupportOwner;
    targetNormalX: -1 | 0 | 1;
    targetNormalY: -1 | 0 | 1;
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
    onSuccessCommit: (query: PlayerSquareAttachPoseQuery) => void;
    onRollbackComplete: () => void;
}

const HALF_SIZE = PLAYER_FORM_SQUARE_SIZE * 0.5;
const ARC_RADIUS = Math.SQRT2 * HALF_SIZE;
const AXIS_ZONE_EPSILON = 0.5;

export const createSquareRolloverState = (): PlayerSquareRolloverState => {
    return {
        phase: 'inactive',
        elapsedMs: 0,
        entryOffsetX: 0,
        entryOffsetY: 0,
        alignedStartOffsetX: 0,
        alignedStartOffsetY: 0,
        endOffsetX: 0,
        endOffsetY: 0,
        pivotLocalX: 0,
        pivotLocalY: 0,
        pivotSupportBody: null,
        pivotSupportOriginX: 0,
        pivotSupportOriginY: 0,
        radius: ARC_RADIUS,
        startAngleRad: 0,
        deltaAngleRad: 0,
        startOrientationRad: 0,
        endOrientationRad: 0,
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
    state.entryOffsetX = 0;
    state.entryOffsetY = 0;
    state.alignedStartOffsetX = 0;
    state.alignedStartOffsetY = 0;
    state.endOffsetX = 0;
    state.endOffsetY = 0;
    state.pivotLocalX = 0;
    state.pivotLocalY = 0;
    state.pivotSupportBody = null;
    state.pivotSupportOriginX = 0;
    state.pivotSupportOriginY = 0;
    state.radius = ARC_RADIUS;
    state.startAngleRad = 0;
    state.deltaAngleRad = 0;
    state.startOrientationRad = 0;
    state.endOrientationRad = 0;
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

    const moveVector = resolveSurfaceMoveVector(
        squareShell.attachNormalX,
        squareShell.attachNormalY,
        horizontalDir,
        verticalDir
    );
    if (moveVector === null) {
        return false;
    }

    const currentCenterX = physicsBody.x + (physicsBody.width * 0.5);
    const currentCenterY = physicsBody.y + (physicsBody.height * 0.5);
    const currentPose = queryAttachPose(
        currentCenterX,
        currentCenterY,
        squareShell.attachNormalX,
        squareShell.attachNormalY
    );
    if (currentPose.supportInterval === null) {
        return false;
    }

    const startCandidate = resolveRolloverStartCandidate(
        currentPose,
        squareShell.attachNormalX,
        squareShell.attachNormalY,
        moveVector
    );
    if (startCandidate === null) {
        return false;
    }

    const alignedStartCenter = {
        x: startCandidate.pivotWorldX + ((squareShell.attachNormalX + startCandidate.targetNormalX) * HALF_SIZE),
        y: startCandidate.pivotWorldY + ((squareShell.attachNormalY + startCandidate.targetNormalY) * HALF_SIZE)
    };
    const endCenter = {
        x: startCandidate.pivotWorldX + ((startCandidate.targetNormalX - squareShell.attachNormalX) * HALF_SIZE),
        y: startCandidate.pivotWorldY + ((startCandidate.targetNormalY - squareShell.attachNormalY) * HALF_SIZE)
    };
    const targetPose = queryAttachPose(
        endCenter.x,
        endCenter.y,
        startCandidate.targetNormalX,
        startCandidate.targetNormalY
    );
    if (targetPose.supportInterval === null) {
        return false;
    }

    const pivotLocal = squareSupportWorldToLocal(
        startCandidate.pivotWorldX,
        startCandidate.pivotWorldY,
        startCandidate.pivotSupportOwner
    );

    rollover.phase = 'forward';
    rollover.elapsedMs = 0;
    rollover.entryOffsetX = currentCenterX - startCandidate.pivotWorldX;
    rollover.entryOffsetY = currentCenterY - startCandidate.pivotWorldY;
    rollover.alignedStartOffsetX = alignedStartCenter.x - startCandidate.pivotWorldX;
    rollover.alignedStartOffsetY = alignedStartCenter.y - startCandidate.pivotWorldY;
    rollover.endOffsetX = endCenter.x - startCandidate.pivotWorldX;
    rollover.endOffsetY = endCenter.y - startCandidate.pivotWorldY;
    rollover.pivotLocalX = pivotLocal.x;
    rollover.pivotLocalY = pivotLocal.y;
    rollover.pivotSupportBody = startCandidate.pivotSupportOwner.body;
    rollover.pivotSupportOriginX = startCandidate.pivotSupportOwner.originX;
    rollover.pivotSupportOriginY = startCandidate.pivotSupportOwner.originY;
    rollover.radius = ARC_RADIUS;
    rollover.startAngleRad = Math.atan2(
        rollover.alignedStartOffsetY,
        rollover.alignedStartOffsetX
    );
    rollover.deltaAngleRad = wrapAngle(
        Math.atan2(rollover.endOffsetY, rollover.endOffsetX) - rollover.startAngleRad
    );
    rollover.startOrientationRad = squareShell.orientationRad;
    rollover.endOrientationRad = squareShell.orientationRad + rollover.deltaAngleRad;
    rollover.sourceNormalX = squareShell.attachNormalX;
    rollover.sourceNormalY = squareShell.attachNormalY;
    rollover.targetNormalX = startCandidate.targetNormalX;
    rollover.targetNormalY = startCandidate.targetNormalY;
    rollover.targetPoseValid = targetPose.isPoseClear;

    squareShell.contactNormalX = squareShell.attachNormalX;
    squareShell.contactNormalY = squareShell.attachNormalY;
    return true;
};

export const tickSquareRollover = (params: TickSquareRolloverParams): void => {
    const { squareShell, physicsBody, deltaMs, queryAttachPose, onSuccessCommit, onRollbackComplete } = params;
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
        if (!forwardValidationPose.isPoseClear) {
            rollover.phase = 'rollback';
            rollover.elapsedMs = 0;
            return;
        }
        if (!forwardPose.isComplete) {
            return;
        }

        if (rollover.targetPoseValid) {
            const endCenter = resolveRolloverWorldOffsetPoint(rollover, rollover.endOffsetX, rollover.endOffsetY);
            const targetPose = queryAttachPose(
                endCenter.x,
                endCenter.y,
                rollover.targetNormalX,
                rollover.targetNormalY
            );
            applyRolloverPose(
                squareShell,
                physicsBody,
                endCenter.x,
                endCenter.y,
                rollover.endOrientationRad
            );
            if (targetPose.supportInterval !== null && targetPose.isPoseClear) {
                squareShell.attachNormalX = rollover.targetNormalX;
                squareShell.attachNormalY = rollover.targetNormalY;
                squareShell.contactNormalX = rollover.targetNormalX;
                squareShell.contactNormalY = rollover.targetNormalY;
                squareShell.groundedOrientationRad = rollover.endOrientationRad;
                physicsBody.checkCollision.none = false;
                resetSquareRolloverState(rollover);
                onSuccessCommit(targetPose);
                return;
            }
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
        const previewT = PLAYER_SQUARE_ROLLOVER_PREVIEW_TIME_MS <= 0
            ? 1
            : Math.min(1, elapsedMs / PLAYER_SQUARE_ROLLOVER_PREVIEW_TIME_MS);
        const previewPoint = resolveRolloverInterpolatedPoint(
            rollover,
            rollover.entryOffsetX,
            rollover.entryOffsetY,
            rollover.alignedStartOffsetX,
            rollover.alignedStartOffsetY,
            previewT
        );
        return {
            x: previewPoint.x,
            y: previewPoint.y,
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
    const angle = rollover.startAngleRad + (rollover.deltaAngleRad * arcT);
    const pivotWorld = resolveRolloverWorldPivot(rollover);

    return {
        x: pivotWorld.x + (Math.cos(angle) * rollover.radius),
        y: pivotWorld.y + (Math.sin(angle) * rollover.radius),
        orientationRad: lerpAngle(rollover.startOrientationRad, rollover.endOrientationRad, arcT),
        isComplete: arcT >= 1,
        arcProgress: arcT
    };
};

const sampleRollbackPose = (
    rollover: PlayerSquareRolloverState,
    elapsedMs: number
): { x: number; y: number; orientationRad: number; isComplete: boolean } => {
    const previewDistance = Math.hypot(
        rollover.alignedStartOffsetX - rollover.entryOffsetX,
        rollover.alignedStartOffsetY - rollover.entryOffsetY
    );
    const arcLength = rollover.radius * Math.abs(rollover.deltaAngleRad);
    const totalDistance = previewDistance + arcLength;
    const rollbackDistance = totalDistance <= 0
        ? totalDistance
        : Math.min(totalDistance, (elapsedMs / PLAYER_SQUARE_ROLLOVER_RETURN_TIME_MS) * totalDistance);
    const remainingArcDistance = Math.max(0, arcLength - rollbackDistance);

    if (rollbackDistance <= arcLength) {
        const arcT = arcLength <= 0 ? 0 : remainingArcDistance / arcLength;
        const angle = rollover.startAngleRad + (rollover.deltaAngleRad * arcT);
        const pivotWorld = resolveRolloverWorldPivot(rollover);
        return {
            x: pivotWorld.x + (Math.cos(angle) * rollover.radius),
            y: pivotWorld.y + (Math.sin(angle) * rollover.radius),
            orientationRad: lerpAngle(rollover.startOrientationRad, rollover.endOrientationRad, arcT),
            isComplete: false
        };
    }

    const previewProgress = previewDistance <= 0
        ? 1
        : Math.min(1, (rollbackDistance - arcLength) / previewDistance);
    const previewPoint = resolveRolloverInterpolatedPoint(
        rollover,
        rollover.alignedStartOffsetX,
        rollover.alignedStartOffsetY,
        rollover.entryOffsetX,
        rollover.entryOffsetY,
        previewProgress
    );

    return {
        x: previewPoint.x,
        y: previewPoint.y,
        orientationRad: rollover.startOrientationRad,
        isComplete: previewProgress >= 1
    };
};

const resolveSurfaceMoveVector = (
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1,
    horizontalDir: -1 | 0 | 1,
    verticalDir: -1 | 0 | 1
): SquareRolloverMoveVector | null => {
    if (attachNormalY !== 0 && horizontalDir !== 0) {
        return { x: horizontalDir, y: 0 };
    }

    if (attachNormalX !== 0 && verticalDir !== 0) {
        return { x: 0, y: verticalDir };
    }

    return null;
};

const resolveRolloverStartCandidate = (
    currentPose: PlayerSquareAttachPoseQuery,
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1,
    moveVector: SquareRolloverMoveVector
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

    return {
        pivotWorldX: pivotWorld.x,
        pivotWorldY: pivotWorld.y,
        pivotSupportOwner: currentPose.surfacePoint.supportOwner,
        targetNormalX: (-moveVector.x) as -1 | 0 | 1,
        targetNormalY: (-moveVector.y) as -1 | 0 | 1
    };
};

const resolveAttachFaceZones = (
    currentPose: PlayerSquareAttachPoseQuery,
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1
): { leadingNegative: SquareAttachZoneState; leadingPositive: SquareAttachZoneState } => {
    if (attachNormalY === -1) {
        return buildHorizontalFaceZones(currentPose, 'BL', 'BR');
    }

    if (attachNormalY === 1) {
        return buildHorizontalFaceZones(currentPose, 'TL', 'TR');
    }

    if (attachNormalX === 1) {
        return buildVerticalFaceZones(currentPose, 'TL', 'BL');
    }

    return buildVerticalFaceZones(currentPose, 'TR', 'BR');
};

const buildHorizontalFaceZones = (
    currentPose: PlayerSquareAttachPoseQuery,
    leftCornerId: SquareCornerId,
    rightCornerId: SquareCornerId
): { leadingNegative: SquareAttachZoneState; leadingPositive: SquareAttachZoneState } => {
    const centerX = currentPose.rect.centerX;
    return {
        leadingNegative: {
            cornerId: leftCornerId,
            min: currentPose.rect.left,
            max: centerX,
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, currentPose.rect.left, centerX)
        },
        leadingPositive: {
            cornerId: rightCornerId,
            min: centerX,
            max: currentPose.rect.right,
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, centerX, currentPose.rect.right)
        }
    };
};

const buildVerticalFaceZones = (
    currentPose: PlayerSquareAttachPoseQuery,
    topCornerId: SquareCornerId,
    bottomCornerId: SquareCornerId
): { leadingNegative: SquareAttachZoneState; leadingPositive: SquareAttachZoneState } => {
    const centerY = currentPose.rect.centerY;
    return {
        leadingNegative: {
            cornerId: topCornerId,
            min: currentPose.rect.top,
            max: centerY,
            isAttached: doesSupportIntervalOverlapZone(currentPose.supportInterval, currentPose.rect.top, centerY)
        },
        leadingPositive: {
            cornerId: bottomCornerId,
            min: centerY,
            max: currentPose.rect.bottom,
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

const resolveRolloverWorldOffsetPoint = (
    rollover: PlayerSquareRolloverState,
    offsetX: number,
    offsetY: number
): { x: number; y: number } => {
    const pivotWorld = resolveRolloverWorldPivot(rollover);
    return {
        x: pivotWorld.x + offsetX,
        y: pivotWorld.y + offsetY
    };
};

const resolveRolloverInterpolatedPoint = (
    rollover: PlayerSquareRolloverState,
    fromOffsetX: number,
    fromOffsetY: number,
    toOffsetX: number,
    toOffsetY: number,
    t: number
): { x: number; y: number } => {
    const worldPoint = resolveRolloverWorldOffsetPoint(
        rollover,
        linearInterpolate(fromOffsetX, toOffsetX, t),
        linearInterpolate(fromOffsetY, toOffsetY, t)
    );
    return worldPoint;
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

const linearInterpolate = (from: number, to: number, t: number): number => {
    return from + ((to - from) * t);
};

const wrapAngle = (angle: number): number => {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
};

const lerpAngle = (from: number, to: number, t: number): number => {
    return from + (wrapAngle(to - from) * t);
};
