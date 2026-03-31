import { Physics } from 'phaser';
import {
    PLAYER_SQUARE_TRAIL_DETACHED_CLEANUP_ALPHA,
    PLAYER_SQUARE_TRAIL_DETACHED_FALL_SPEED,
    PLAYER_SQUARE_TRAIL_DETACHED_REFUND_RATE,
    PLAYER_SQUARE_TRAIL_MAX_SEGMENTS,
    PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT,
    PLAYER_SQUARE_TRAIL_MIN_SEGMENT_LENGTH,
    PLAYER_SQUARE_TRAIL_REATTACH_SNAP_DISTANCE
} from './player_constants';
import type {
    PlayerSquareShellState,
    PlayerSquareTrailSegment,
    PlayerSquareTrailSupportOwner
} from './player_types';
import { squareSupportLocalToWorld, squareSupportWorldToLocal } from './player_square_support_space';

const TRAIL_LOCAL_MERGE_AXIS_EPSILON = 1.5;
const TRAIL_LOCAL_MERGE_GAP_EPSILON = 0.5;
const TRAIL_COVERAGE_DISTANCE_EPSILON = 1.25;

export const beginSquareTrailAnchor = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    supportOwner: PlayerSquareTrailSupportOwner
): void => {
    if (!squareShell.isAttached) {
        squareShell.trailAnchorActive = false;
        return;
    }

    const snappedAnchor = findNearestTrailJoinPoint(
        squareShell,
        surfaceX,
        surfaceY,
        squareShell.attachNormalX,
        squareShell.attachNormalY,
        supportOwner
    );
    const anchorX = snappedAnchor?.x ?? surfaceX;
    const anchorY = snappedAnchor?.y ?? surfaceY;
    const anchorLocal = squareSupportWorldToLocal(anchorX, anchorY, supportOwner);

    squareShell.trailAnchorActive = true;
    squareShell.trailAnchorX = anchorX;
    squareShell.trailAnchorY = anchorY;
    squareShell.trailAnchorLocalX = anchorLocal.x;
    squareShell.trailAnchorLocalY = anchorLocal.y;
    squareShell.trailAnchorSupportBody = supportOwner.body;
    squareShell.trailAnchorSupportOriginX = supportOwner.originX;
    squareShell.trailAnchorSupportOriginY = supportOwner.originY;
    squareShell.trailAnchorNormalX = squareShell.attachNormalX;
    squareShell.trailAnchorNormalY = squareShell.attachNormalY;
};

export const tickSquareTrailPaint = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    supportOwner: PlayerSquareTrailSupportOwner,
    hasSurfaceContact: boolean
): void => {
    if (!squareShell.isAttached) {
        squareShell.trailAnchorActive = false;
        return;
    }

    if (!hasSurfaceContact) {
        // Keep anchor through short contact flicker while attach grace is still active.
        return;
    }

    const normalX = squareShell.attachNormalX;
    const normalY = squareShell.attachNormalY;
    const anchorSupportOwner: PlayerSquareTrailSupportOwner = {
        body: squareShell.trailAnchorSupportBody,
        originX: squareShell.trailAnchorSupportOriginX,
        originY: squareShell.trailAnchorSupportOriginY
    };
    const effectiveSupportOwner = supportOwner.body === null && anchorSupportOwner.body !== null
        ? anchorSupportOwner
        : supportOwner;
    const currentSurfaceLocal = squareSupportWorldToLocal(surfaceX, surfaceY, effectiveSupportOwner);

    if (!squareShell.trailAnchorActive) {
        squareShell.trailAnchorActive = true;
        squareShell.trailAnchorX = surfaceX;
        squareShell.trailAnchorY = surfaceY;
        squareShell.trailAnchorLocalX = currentSurfaceLocal.x;
        squareShell.trailAnchorLocalY = currentSurfaceLocal.y;
        squareShell.trailAnchorSupportBody = effectiveSupportOwner.body;
        squareShell.trailAnchorSupportOriginX = effectiveSupportOwner.originX;
        squareShell.trailAnchorSupportOriginY = effectiveSupportOwner.originY;
        squareShell.trailAnchorNormalX = normalX;
        squareShell.trailAnchorNormalY = normalY;
        return;
    }

    const anchorWorld = squareSupportLocalToWorld(
        squareShell.trailAnchorLocalX,
        squareShell.trailAnchorLocalY,
        anchorSupportOwner
    );
    squareShell.trailAnchorX = anchorWorld.x;
    squareShell.trailAnchorY = anchorWorld.y;

    const ownerChanged = !isSameSupportOwner(anchorSupportOwner, effectiveSupportOwner);
    const normalChanged = squareShell.trailAnchorNormalX !== normalX || squareShell.trailAnchorNormalY !== normalY;
    if (ownerChanged || normalChanged) {
        squareShell.trailAnchorX = surfaceX;
        squareShell.trailAnchorY = surfaceY;
        squareShell.trailAnchorLocalX = currentSurfaceLocal.x;
        squareShell.trailAnchorLocalY = currentSurfaceLocal.y;
        squareShell.trailAnchorSupportBody = effectiveSupportOwner.body;
        squareShell.trailAnchorSupportOriginX = effectiveSupportOwner.originX;
        squareShell.trailAnchorSupportOriginY = effectiveSupportOwner.originY;
        squareShell.trailAnchorNormalX = normalX;
        squareShell.trailAnchorNormalY = normalY;
        return;
    }

    const tangentX = -normalY;
    const tangentY = normalX;
    const localDx = currentSurfaceLocal.x - squareShell.trailAnchorLocalX;
    const localDy = currentSurfaceLocal.y - squareShell.trailAnchorLocalY;
    const distanceAlongSurface = Math.abs((localDx * tangentX) + (localDy * tangentY));

    if (distanceAlongSurface < PLAYER_SQUARE_TRAIL_MIN_SEGMENT_LENGTH) {
        return;
    }
    const coveredDistance = resolveTrailCoveredDistanceForInterval(
        squareShell,
        { x: squareShell.trailAnchorLocalX, y: squareShell.trailAnchorLocalY },
        currentSurfaceLocal,
        effectiveSupportOwner,
        normalX,
        normalY
    );
    const uncoveredDistance = Math.max(0, distanceAlongSurface - coveredDistance);
    const maxPaintDistance = squareShell.trailResourceCurrent / PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT;
    const paintDistance = Math.min(uncoveredDistance, Math.max(0, maxPaintDistance));
    if (paintDistance <= 0) {
        setTrailAnchorToCurrentSurface(squareShell, currentSurfaceLocal, effectiveSupportOwner, normalX, normalY);
        return;
    }

    const paintAlpha = paintDistance / distanceAlongSurface;
    const paintTargetLocal = paintAlpha >= 1
        ? currentSurfaceLocal
        : {
            x: squareShell.trailAnchorLocalX + (localDx * paintAlpha),
            y: squareShell.trailAnchorLocalY + (localDy * paintAlpha)
        };

    appendOrMergeSweptLocalInterval(
        squareShell,
        {
            x: squareShell.trailAnchorLocalX,
            y: squareShell.trailAnchorLocalY
        },
        paintTargetLocal,
        effectiveSupportOwner,
        normalX,
        normalY
    );
    squareShell.trailResourceCurrent = Math.max(
        0,
        squareShell.trailResourceCurrent - (paintDistance * PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT)
    );

    setTrailAnchorToCurrentSurface(squareShell, currentSurfaceLocal, effectiveSupportOwner, normalX, normalY);
};

const setTrailAnchorToCurrentSurface = (
    squareShell: PlayerSquareShellState,
    currentSurfaceLocal: { x: number; y: number },
    supportOwner: PlayerSquareTrailSupportOwner,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): void => {
    const anchorWorld = squareSupportLocalToWorld(currentSurfaceLocal.x, currentSurfaceLocal.y, supportOwner);
    squareShell.trailAnchorX = anchorWorld.x;
    squareShell.trailAnchorY = anchorWorld.y;
    squareShell.trailAnchorLocalX = currentSurfaceLocal.x;
    squareShell.trailAnchorLocalY = currentSurfaceLocal.y;
    squareShell.trailAnchorSupportBody = supportOwner.body;
    squareShell.trailAnchorSupportOriginX = supportOwner.originX;
    squareShell.trailAnchorSupportOriginY = supportOwner.originY;
    squareShell.trailAnchorNormalX = normalX;
    squareShell.trailAnchorNormalY = normalY;
};

export const resolveSquareTrailSegmentWorldLine = (
    segment: PlayerSquareTrailSegment
): { startX: number; startY: number; endX: number; endY: number } => {
    if (segment.isDetached) {
        segment.startLocalX = segment.startX;
        segment.startLocalY = segment.startY;
        segment.endLocalX = segment.endX;
        segment.endLocalY = segment.endY;
        return {
            startX: segment.startX,
            startY: segment.startY,
            endX: segment.endX,
            endY: segment.endY
        };
    }

    const supportOwner: PlayerSquareTrailSupportOwner = {
        body: segment.supportBody,
        originX: segment.supportOriginX,
        originY: segment.supportOriginY
    };
    const worldStart = squareSupportLocalToWorld(segment.startLocalX, segment.startLocalY, supportOwner);
    const worldEnd = squareSupportLocalToWorld(segment.endLocalX, segment.endLocalY, supportOwner);

    segment.startX = worldStart.x;
    segment.startY = worldStart.y;
    segment.endX = worldEnd.x;
    segment.endY = worldEnd.y;

    return {
        startX: worldStart.x,
        startY: worldStart.y,
        endX: worldEnd.x,
        endY: worldEnd.y
    };
};

export const tickSquareTrailDetachedLifecycle = (
    squareShell: PlayerSquareShellState,
    deltaMs: number
): number => {
    const deltaSec = Math.max(0, deltaMs / 1000);
    let refundedAmount = 0;

    squareShell.trailSegments.forEach((segment) => {
        if (segment.isDetached || segment.supportBody === null) {
            // continue to detached update path
        } else if (isTrailSupportOwnerInvalid(segment.supportBody)) {
            detachTrailSegmentToWorldSpace(segment);
        }

        if (!segment.isDetached || deltaSec <= 0) {
            return;
        }

        const fallDeltaY = PLAYER_SQUARE_TRAIL_DETACHED_FALL_SPEED * deltaSec;
        segment.detachedVelocityY = PLAYER_SQUARE_TRAIL_DETACHED_FALL_SPEED;
        segment.startY += fallDeltaY;
        segment.endY += fallDeltaY;
        segment.startLocalY = segment.startY;
        segment.endLocalY = segment.endY;

        const previousProgress = segment.detachedDissolveProgress;
        const nextProgress = Math.min(1, previousProgress + (PLAYER_SQUARE_TRAIL_DETACHED_REFUND_RATE * deltaSec));
        segment.detachedDissolveProgress = nextProgress;
        segment.detachedAlpha = Math.max(0, 1 - nextProgress);

        const progressed = nextProgress - previousProgress;
        if (progressed > 0 && segment.detachedRefundRemaining > 0) {
            const remainingProgress = Math.max(0.0001, 1 - previousProgress);
            const refundDelta = Math.min(
                segment.detachedRefundRemaining,
                segment.detachedRefundRemaining * (progressed / remainingProgress)
            );
            segment.detachedRefundRemaining = Math.max(0, segment.detachedRefundRemaining - refundDelta);
            refundedAmount += refundDelta;
        }
    });

    for (let i = squareShell.trailSegments.length - 1; i >= 0; i -= 1) {
        const segment = squareShell.trailSegments[i];
        if (!segment.isDetached) {
            continue;
        }

        if (segment.detachedAlpha > PLAYER_SQUARE_TRAIL_DETACHED_CLEANUP_ALPHA) {
            continue;
        }

        squareShell.trailSegments.splice(i, 1);
    }

    return refundedAmount;
};

export const isSquareSurfacePointOnTrail = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    supportOwner: PlayerSquareTrailSupportOwner
): boolean => {
    return findTrailCoveragePoint(
        squareShell,
        surfaceX,
        surfaceY,
        normalX,
        normalY,
        supportOwner
    ) !== null;
};

export const findNearestSquareTrailPoint = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } | null => {
    return findNearestTrailCoveragePoint(
        squareShell,
        surfaceX,
        surfaceY,
        normalX,
        normalY,
        supportOwner
    );
};

export const tickSquareTrailManualRegen = (
    squareShell: PlayerSquareShellState,
    deltaMs: number,
    regenSpeedPxPerSec: number
): number => {
    if (deltaMs <= 0 || regenSpeedPxPerSec <= 0 || squareShell.trailSegments.length <= 0) {
        return 0;
    }

    let remainingDistance = regenSpeedPxPerSec * Math.max(0, deltaMs / 1000);
    let refundedAmount = 0;

    while (remainingDistance > 0.0001 && squareShell.trailSegments.length > 0) {
        const segment = squareShell.trailSegments[0];
        const segmentLength = Math.hypot(segment.endX - segment.startX, segment.endY - segment.startY);
        if (segmentLength <= 0.0001) {
            squareShell.trailSegments.shift();
            continue;
        }

        const shrinkDistance = Math.min(segmentLength, remainingDistance);
        const shrinkT = shrinkDistance / segmentLength;
        segment.startX += (segment.endX - segment.startX) * shrinkT;
        segment.startY += (segment.endY - segment.startY) * shrinkT;
        segment.startLocalX += (segment.endLocalX - segment.startLocalX) * shrinkT;
        segment.startLocalY += (segment.endLocalY - segment.startLocalY) * shrinkT;
        segment.detachedRefundRemaining = Math.max(
            0,
            segment.detachedRefundRemaining - (shrinkDistance * PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT)
        );

        refundedAmount += shrinkDistance * PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT;
        remainingDistance -= shrinkDistance;

        if (shrinkDistance >= segmentLength - 0.0001) {
            squareShell.trailSegments.shift();
        }
    }

    return refundedAmount;
};

const isTrailSupportOwnerInvalid = (
    supportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody
): boolean => {
    const maybeBody = supportBody as Physics.Arcade.Body & {
        enable?: boolean;
        world?: unknown;
        gameObject?: { active?: boolean } | null;
    };
    if (maybeBody.enable === false) {
        return true;
    }

    if (!maybeBody.world) {
        return true;
    }

    const ownerGameObject = maybeBody.gameObject;
    if (ownerGameObject && ownerGameObject.active === false) {
        return true;
    }

    return false;
};

const detachTrailSegmentToWorldSpace = (
    segment: PlayerSquareTrailSegment
): void => {
    const worldLine = resolveSquareTrailSegmentWorldLine(segment);
    segment.isDetached = true;
    segment.supportBody = null;
    segment.supportOriginX = 0;
    segment.supportOriginY = 0;
    segment.startX = worldLine.startX;
    segment.startY = worldLine.startY;
    segment.endX = worldLine.endX;
    segment.endY = worldLine.endY;
    segment.startLocalX = worldLine.startX;
    segment.startLocalY = worldLine.startY;
    segment.endLocalX = worldLine.endX;
    segment.endLocalY = worldLine.endY;
    segment.detachedVelocityY = 0;
    segment.detachedDissolveProgress = 0;
    segment.detachedAlpha = 1;
    if (segment.detachedRefundRemaining <= 0) {
        segment.detachedRefundRemaining = Math.max(
            0,
            Math.hypot(worldLine.endX - worldLine.startX, worldLine.endY - worldLine.startY)
            * PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT
        );
    }
};

const findNearestTrailJoinPoint = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    const snapDistanceSq = PLAYER_SQUARE_TRAIL_REATTACH_SNAP_DISTANCE * PLAYER_SQUARE_TRAIL_REATTACH_SNAP_DISTANCE;
    let bestPoint: { x: number; y: number } | null = null;
    let bestDistanceSq = Infinity;

    squareShell.trailSegments.forEach((segment) => {
        if (segment.normalX !== normalX || segment.normalY !== normalY) {
            return;
        }

        const segmentSupportOwner: PlayerSquareTrailSupportOwner = {
            body: segment.supportBody,
            originX: segment.supportOriginX,
            originY: segment.supportOriginY
        };
        if (!isSameSupportOwner(segmentSupportOwner, supportOwner)) {
            return;
        }

        const worldLine = resolveSquareTrailSegmentWorldLine(segment);
        const points = [
            { x: worldLine.startX, y: worldLine.startY },
            { x: worldLine.endX, y: worldLine.endY },
            projectPointToSegment(
                surfaceX,
                surfaceY,
                worldLine.startX,
                worldLine.startY,
                worldLine.endX,
                worldLine.endY
            )
        ];
        points.forEach((point) => {
            const dx = surfaceX - point.x;
            const dy = surfaceY - point.y;
            const distanceSq = (dx * dx) + (dy * dy);
            if (distanceSq <= snapDistanceSq && distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestPoint = point;
            }
        });
    });

    return bestPoint ?? { x: surfaceX, y: surfaceY };
};

const findTrailCoveragePoint = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } | null => {
    const nearestPoint = findNearestTrailCoveragePoint(
        squareShell,
        surfaceX,
        surfaceY,
        normalX,
        normalY,
        supportOwner
    );
    if (nearestPoint === null) {
        return null;
    }

    const dx = surfaceX - nearestPoint.x;
    const dy = surfaceY - nearestPoint.y;
    return ((dx * dx) + (dy * dy)) <= (TRAIL_COVERAGE_DISTANCE_EPSILON * TRAIL_COVERAGE_DISTANCE_EPSILON)
        ? nearestPoint
        : null;
};

const findNearestTrailCoveragePoint = (
    squareShell: PlayerSquareShellState,
    surfaceX: number,
    surfaceY: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } | null => {
    let bestPoint: { x: number; y: number } | null = null;
    let bestDistanceSq = Infinity;

    squareShell.trailSegments.forEach((segment) => {
        if (segment.isDetached || segment.normalX !== normalX || segment.normalY !== normalY) {
            return;
        }

        const segmentSupportOwner: PlayerSquareTrailSupportOwner = {
            body: segment.supportBody,
            originX: segment.supportOriginX,
            originY: segment.supportOriginY
        };
        if (!isSameSupportOwner(segmentSupportOwner, supportOwner)) {
            return;
        }

        const worldLine = resolveSquareTrailSegmentWorldLine(segment);
        const point = projectPointToSegment(
            surfaceX,
            surfaceY,
            worldLine.startX,
            worldLine.startY,
            worldLine.endX,
            worldLine.endY
        );
        const dx = surfaceX - point.x;
        const dy = surfaceY - point.y;
        const distanceSq = (dx * dx) + (dy * dy);
        if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            bestPoint = point;
        }
    });

    return bestPoint;
};

const isSameSupportOwner = (
    left: PlayerSquareTrailSupportOwner,
    right: PlayerSquareTrailSupportOwner
): boolean => {
    if (left.body !== null || right.body !== null) {
        return left.body === right.body;
    }

    return true;
};

const appendOrMergeSweptLocalInterval = (
    squareShell: PlayerSquareShellState,
    fromLocal: { x: number; y: number },
    toLocal: { x: number; y: number },
    supportOwner: PlayerSquareTrailSupportOwner,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): void => {
    const tangentX = -normalY;
    const tangentY = normalX;
    const fromT = (fromLocal.x * tangentX) + (fromLocal.y * tangentY);
    const toT = (toLocal.x * tangentX) + (toLocal.y * tangentY);
    const intervalMinT = Math.min(fromT, toT);
    const intervalMaxT = Math.max(fromT, toT);
    const intervalN = ((fromLocal.x * normalX) + (fromLocal.y * normalY) + (toLocal.x * normalX) + (toLocal.y * normalY)) * 0.5;

    const buildPointFromLocalInterval = (t: number): { x: number; y: number } => {
        return {
            x: (tangentX * t) + (normalX * intervalN),
            y: (tangentY * t) + (normalY * intervalN)
        };
    };

    const localStart = buildPointFromLocalInterval(intervalMinT);
    const localEnd = buildPointFromLocalInterval(intervalMaxT);
    const worldStart = squareSupportLocalToWorld(localStart.x, localStart.y, supportOwner);
    const worldEnd = squareSupportLocalToWorld(localEnd.x, localEnd.y, supportOwner);

    const trailingSegment = squareShell.trailSegments.length > 0
        ? squareShell.trailSegments[squareShell.trailSegments.length - 1]
        : null;
    const canMergeWithTrailing = trailingSegment !== null
        && !trailingSegment.isDetached
        && trailingSegment.normalX === normalX
        && trailingSegment.normalY === normalY
        && isSameSupportOwner(
            {
                body: trailingSegment.supportBody,
                originX: trailingSegment.supportOriginX,
                originY: trailingSegment.supportOriginY
            },
            supportOwner
        );

    if (canMergeWithTrailing && trailingSegment !== null) {
        const trailingStartT = (trailingSegment.startLocalX * tangentX) + (trailingSegment.startLocalY * tangentY);
        const trailingEndT = (trailingSegment.endLocalX * tangentX) + (trailingSegment.endLocalY * tangentY);
        const trailingMinT = Math.min(trailingStartT, trailingEndT);
        const trailingMaxT = Math.max(trailingStartT, trailingEndT);
        const trailingN = ((trailingSegment.startLocalX * normalX) + (trailingSegment.startLocalY * normalY)
            + (trailingSegment.endLocalX * normalX) + (trailingSegment.endLocalY * normalY)) * 0.5;
        const sharesLane = Math.abs(trailingN - intervalN) <= TRAIL_LOCAL_MERGE_AXIS_EPSILON;
        const overlapsOrTouches = intervalMinT <= (trailingMaxT + TRAIL_LOCAL_MERGE_GAP_EPSILON)
            && intervalMaxT >= (trailingMinT - TRAIL_LOCAL_MERGE_GAP_EPSILON);

        if (sharesLane && overlapsOrTouches) {
            const mergedMinT = Math.min(intervalMinT, trailingMinT);
            const mergedMaxT = Math.max(intervalMaxT, trailingMaxT);
            const mergedN = (trailingN + intervalN) * 0.5;
            const mergedStartLocal = {
                x: (tangentX * mergedMinT) + (normalX * mergedN),
                y: (tangentY * mergedMinT) + (normalY * mergedN)
            };
            const mergedEndLocal = {
                x: (tangentX * mergedMaxT) + (normalX * mergedN),
                y: (tangentY * mergedMaxT) + (normalY * mergedN)
            };
            const mergedWorldStart = squareSupportLocalToWorld(mergedStartLocal.x, mergedStartLocal.y, supportOwner);
            const mergedWorldEnd = squareSupportLocalToWorld(mergedEndLocal.x, mergedEndLocal.y, supportOwner);

            trailingSegment.startLocalX = mergedStartLocal.x;
            trailingSegment.startLocalY = mergedStartLocal.y;
            trailingSegment.endLocalX = mergedEndLocal.x;
            trailingSegment.endLocalY = mergedEndLocal.y;
            trailingSegment.startX = mergedWorldStart.x;
            trailingSegment.startY = mergedWorldStart.y;
            trailingSegment.endX = mergedWorldEnd.x;
            trailingSegment.endY = mergedWorldEnd.y;
            trailingSegment.isDetached = false;
            trailingSegment.detachedVelocityY = 0;
            trailingSegment.detachedDissolveProgress = 0;
            trailingSegment.detachedAlpha = 1;
            trailingSegment.detachedRefundRemaining = Math.max(
                0,
                Math.hypot(mergedWorldEnd.x - mergedWorldStart.x, mergedWorldEnd.y - mergedWorldStart.y) * PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT
            );
            return;
        }
    }

    squareShell.trailSegments.push({
        startX: worldStart.x,
        startY: worldStart.y,
        endX: worldEnd.x,
        endY: worldEnd.y,
        startLocalX: localStart.x,
        startLocalY: localStart.y,
        endLocalX: localEnd.x,
        endLocalY: localEnd.y,
        supportOriginX: supportOwner.originX,
        supportOriginY: supportOwner.originY,
        supportBody: supportOwner.body,
        normalX,
        normalY,
        isDetached: false,
        detachedVelocityY: 0,
        detachedDissolveProgress: 0,
        detachedAlpha: 1,
        detachedRefundRemaining: Math.max(
            0,
            Math.hypot(worldEnd.x - worldStart.x, worldEnd.y - worldStart.y) * PLAYER_SQUARE_TRAIL_RESOURCE_COST_PER_UNIT
        )
    });
    if (squareShell.trailSegments.length > PLAYER_SQUARE_TRAIL_MAX_SEGMENTS) {
        squareShell.trailSegments.splice(0, squareShell.trailSegments.length - PLAYER_SQUARE_TRAIL_MAX_SEGMENTS);
    }
};

const resolveTrailCoveredDistanceForInterval = (
    squareShell: PlayerSquareShellState,
    fromLocal: { x: number; y: number },
    toLocal: { x: number; y: number },
    supportOwner: PlayerSquareTrailSupportOwner,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1
): number => {
    const tangentX = -normalY;
    const tangentY = normalX;
    const intervalMinT = Math.min(
        (fromLocal.x * tangentX) + (fromLocal.y * tangentY),
        (toLocal.x * tangentX) + (toLocal.y * tangentY)
    );
    const intervalMaxT = Math.max(
        (fromLocal.x * tangentX) + (fromLocal.y * tangentY),
        (toLocal.x * tangentX) + (toLocal.y * tangentY)
    );
    const intervalN = ((fromLocal.x * normalX) + (fromLocal.y * normalY) + (toLocal.x * normalX) + (toLocal.y * normalY)) * 0.5;
    const overlaps: Array<{ min: number; max: number }> = [];

    squareShell.trailSegments.forEach((segment) => {
        if (segment.isDetached || segment.normalX !== normalX || segment.normalY !== normalY) {
            return;
        }

        const segmentOwner: PlayerSquareTrailSupportOwner = {
            body: segment.supportBody,
            originX: segment.supportOriginX,
            originY: segment.supportOriginY
        };
        if (!isSameSupportOwner(segmentOwner, supportOwner)) {
            return;
        }

        const segmentN = ((segment.startLocalX * normalX) + (segment.startLocalY * normalY)
            + (segment.endLocalX * normalX) + (segment.endLocalY * normalY)) * 0.5;
        if (Math.abs(segmentN - intervalN) > TRAIL_LOCAL_MERGE_AXIS_EPSILON) {
            return;
        }

        const segmentMinT = Math.min(
            (segment.startLocalX * tangentX) + (segment.startLocalY * tangentY),
            (segment.endLocalX * tangentX) + (segment.endLocalY * tangentY)
        );
        const segmentMaxT = Math.max(
            (segment.startLocalX * tangentX) + (segment.startLocalY * tangentY),
            (segment.endLocalX * tangentX) + (segment.endLocalY * tangentY)
        );
        const overlapMin = Math.max(intervalMinT, segmentMinT);
        const overlapMax = Math.min(intervalMaxT, segmentMaxT);
        if (overlapMax - overlapMin > 0.0001) {
            overlaps.push({ min: overlapMin, max: overlapMax });
        }
    });

    if (overlaps.length <= 0) {
        return 0;
    }

    overlaps.sort((left, right) => left.min - right.min);
    let coveredDistance = 0;
    let mergedMin = overlaps[0].min;
    let mergedMax = overlaps[0].max;

    for (let index = 1; index < overlaps.length; index += 1) {
        const overlap = overlaps[index];
        if (overlap.min <= mergedMax + TRAIL_LOCAL_MERGE_GAP_EPSILON) {
            mergedMax = Math.max(mergedMax, overlap.max);
            continue;
        }

        coveredDistance += mergedMax - mergedMin;
        mergedMin = overlap.min;
        mergedMax = overlap.max;
    }

    coveredDistance += mergedMax - mergedMin;
    return coveredDistance;
};

const projectPointToSegment = (
    pointX: number,
    pointY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number
): { x: number; y: number } => {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSq = (segmentX * segmentX) + (segmentY * segmentY);

    if (segmentLengthSq <= 0.0001) {
        return { x: startX, y: startY };
    }

    const fromStartX = pointX - startX;
    const fromStartY = pointY - startY;
    const t = Math.max(0, Math.min(1, ((fromStartX * segmentX) + (fromStartY * segmentY)) / segmentLengthSq));
    return {
        x: startX + (segmentX * t),
        y: startY + (segmentY * t)
    };
};
