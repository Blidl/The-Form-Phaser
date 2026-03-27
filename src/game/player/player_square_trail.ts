import {
    PLAYER_SQUARE_TRAIL_MAX_SEGMENTS,
    PLAYER_SQUARE_TRAIL_MIN_SEGMENT_LENGTH,
    PLAYER_SQUARE_TRAIL_REATTACH_SNAP_DISTANCE
} from './player_constants';
import type {
    PlayerSquareShellState,
    PlayerSquareTrailSegment,
    PlayerSquareTrailSupportOwner
} from './player_types';

const TRAIL_LOCAL_MERGE_AXIS_EPSILON = 1.5;
const TRAIL_LOCAL_MERGE_GAP_EPSILON = 0.5;

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
    const anchorLocal = worldToOwnerLocal(anchorX, anchorY, supportOwner);

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
    const currentSurfaceLocal = worldToOwnerLocal(surfaceX, surfaceY, effectiveSupportOwner);

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

    const anchorWorld = ownerLocalToWorld(
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

    appendOrMergeSweptLocalInterval(
        squareShell,
        {
            x: squareShell.trailAnchorLocalX,
            y: squareShell.trailAnchorLocalY
        },
        currentSurfaceLocal,
        effectiveSupportOwner,
        normalX,
        normalY
    );

    squareShell.trailAnchorX = surfaceX;
    squareShell.trailAnchorY = surfaceY;
    squareShell.trailAnchorLocalX = currentSurfaceLocal.x;
    squareShell.trailAnchorLocalY = currentSurfaceLocal.y;
};

export const resolveSquareTrailSegmentWorldLine = (
    segment: PlayerSquareTrailSegment
): { startX: number; startY: number; endX: number; endY: number } => {
    const supportOwner: PlayerSquareTrailSupportOwner = {
        body: segment.supportBody,
        originX: segment.supportOriginX,
        originY: segment.supportOriginY
    };
    const worldStart = ownerLocalToWorld(segment.startLocalX, segment.startLocalY, supportOwner);
    const worldEnd = ownerLocalToWorld(segment.endLocalX, segment.endLocalY, supportOwner);

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

const getSupportCurrentPosition = (
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    if (supportOwner.body === null) {
        return { x: supportOwner.originX, y: supportOwner.originY };
    }

    return {
        x: supportOwner.body.x,
        y: supportOwner.body.y
    };
};

const worldToOwnerLocal = (
    worldX: number,
    worldY: number,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    const supportPosition = getSupportCurrentPosition(supportOwner);
    return {
        x: worldX - supportPosition.x + supportOwner.originX,
        y: worldY - supportPosition.y + supportOwner.originY
    };
};

const ownerLocalToWorld = (
    localX: number,
    localY: number,
    supportOwner: PlayerSquareTrailSupportOwner
): { x: number; y: number } => {
    const supportPosition = getSupportCurrentPosition(supportOwner);
    return {
        x: localX + supportPosition.x - supportOwner.originX,
        y: localY + supportPosition.y - supportOwner.originY
    };
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
    const worldStart = ownerLocalToWorld(localStart.x, localStart.y, supportOwner);
    const worldEnd = ownerLocalToWorld(localEnd.x, localEnd.y, supportOwner);

    const trailingSegment = squareShell.trailSegments.length > 0
        ? squareShell.trailSegments[squareShell.trailSegments.length - 1]
        : null;
    const canMergeWithTrailing = trailingSegment !== null
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
            const mergedWorldStart = ownerLocalToWorld(mergedStartLocal.x, mergedStartLocal.y, supportOwner);
            const mergedWorldEnd = ownerLocalToWorld(mergedEndLocal.x, mergedEndLocal.y, supportOwner);

            trailingSegment.startLocalX = mergedStartLocal.x;
            trailingSegment.startLocalY = mergedStartLocal.y;
            trailingSegment.endLocalX = mergedEndLocal.x;
            trailingSegment.endLocalY = mergedEndLocal.y;
            trailingSegment.startX = mergedWorldStart.x;
            trailingSegment.startY = mergedWorldStart.y;
            trailingSegment.endX = mergedWorldEnd.x;
            trailingSegment.endY = mergedWorldEnd.y;
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
        normalY
    });
    if (squareShell.trailSegments.length > PLAYER_SQUARE_TRAIL_MAX_SEGMENTS) {
        squareShell.trailSegments.splice(0, squareShell.trailSegments.length - PLAYER_SQUARE_TRAIL_MAX_SEGMENTS);
    }
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
