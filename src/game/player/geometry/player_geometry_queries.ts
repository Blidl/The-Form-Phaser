import { Math as PhaserMath, type Physics } from 'phaser';
import {
    PLAYER_BALL_HAZARD_RADIUS,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_SQUARE_BODY_SIZE,
    PLAYER_SQUARE_HAZARD_SIZE
} from '../player_constants';
import type {
    PlayerFormId,
    PlayerTriangleShellState,
    TriangleCornerIndex
} from '../player_types';
import type {
    HazardShapePoint,
    OrthogonalDirection,
    PlayerAnchorOffset,
    PlayerAxisContactSnapshot,
    PlayerFormAnchor,
    PlayerHazardHitShape,
    PlayerLocomotionBodyConfig,
    PlayerRectSnapshot,
    PlayerSquareContactResolution,
    PlayerSquareSupportInterval,
    PlayerSquareSupportProbe,
    PlayerSquareTrailSupportOwner,
    PlayerSquareTrailSurfacePoint,
    PlayerTriangleWorldPoint,
    ResolvePlayerGeometryInput,
    ResolveTriangleWorldPointInput
} from './player_geometry_types';

const TRIANGLE_HALF_WIDTH = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
const TRIANGLE_HALF_HEIGHT = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
const TRIANGLE_LOCAL_VERTICES = [
    { x: -TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT },
    { x: 0, y: -TRIANGLE_HALF_HEIGHT },
    { x: TRIANGLE_HALF_WIDTH, y: TRIANGLE_HALF_HEIGHT }
] as const;
const TRIANGLE_CENTROID_OFFSET = {
    x: (TRIANGLE_LOCAL_VERTICES[0].x + TRIANGLE_LOCAL_VERTICES[1].x + TRIANGLE_LOCAL_VERTICES[2].x) / 3,
    y: (TRIANGLE_LOCAL_VERTICES[0].y + TRIANGLE_LOCAL_VERTICES[1].y + TRIANGLE_LOCAL_VERTICES[2].y) / 3
} as const;

export const resolveTriangleLocalVertices = (): readonly [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number }
] => {
    return TRIANGLE_LOCAL_VERTICES;
};

export const resolveTriangleCentroidOffset = (): { x: number; y: number } => {
    return {
        x: TRIANGLE_CENTROID_OFFSET.x,
        y: TRIANGLE_CENTROID_OFFSET.y
    };
};

export const resolveTriangleLocalBounds = (
    orientationRad: number
): { minX: number; maxX: number; minY: number; maxY: number; centerX: number; centerY: number; width: number; height: number } => {
    const points = resolveTriangleWorldPoints(0, 0, orientationRad);
    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    return {
        minX,
        maxX,
        minY,
        maxY,
        centerX: (minX + maxX) * 0.5,
        centerY: (minY + maxY) * 0.5,
        width: maxX - minX,
        height: maxY - minY
    };
};

export const createPlayerRectSnapshot = (
    left: number,
    top: number,
    width: number,
    height: number
): PlayerRectSnapshot => {
    const right = left + width;
    const bottom = top + height;

    return {
        left,
        top,
        right,
        bottom,
        width,
        height,
        centerX: left + (width * 0.5),
        centerY: top + (height * 0.5)
    };
};

export const resolvePlayerAnchorOffset = (
    form: PlayerFormId,
    triangleShell: PlayerTriangleShellState
): PlayerAnchorOffset => {
    if (form !== 'triangle') {
        return { x: 0, y: 0 };
    }

    return {
        x: 0,
        y: 0
    };
};

export const resolvePlayerFormAnchor = ({
    form,
    playerX,
    playerY,
    triangleShell
}: ResolvePlayerGeometryInput): PlayerFormAnchor => {
    const anchorOffset = resolvePlayerAnchorOffset(form, triangleShell);
    return {
        x: playerX + anchorOffset.x,
        y: playerY + anchorOffset.y
    };
};

export const resolvePlayerLocomotionBodyConfig = (
    form: PlayerFormId,
    triangleShell: PlayerTriangleShellState
): PlayerLocomotionBodyConfig => {
    if (form === 'ball') {
        return {
            kind: 'circle',
            radius: PLAYER_PLACEHOLDER_RADIUS,
            centerOffset: { x: 0, y: 0 }
        };
    }

    if (form === 'square') {
        return {
            kind: 'box',
            width: PLAYER_SQUARE_BODY_SIZE,
            height: PLAYER_SQUARE_BODY_SIZE,
            centerOffset: { x: 0, y: 0 }
        };
    }

    const triangleBounds = resolveTriangleLocalBounds(triangleShell.orientationRad);
    return {
        kind: 'box',
        width: triangleBounds.width,
        height: triangleBounds.height,
        centerOffset: {
            x: triangleBounds.centerX,
            y: triangleBounds.centerY
        }
    };
};

export const resolveTriangleWorldPoints = (
    anchorX: number,
    anchorY: number,
    orientationRad: number
): [PlayerTriangleWorldPoint, PlayerTriangleWorldPoint, PlayerTriangleWorldPoint] => {
    const cos = Math.cos(orientationRad);
    const sin = Math.sin(orientationRad);

    return TRIANGLE_LOCAL_VERTICES.map((vertex) => {
        return {
            x: anchorX + ((vertex.x * cos) - (vertex.y * sin)),
            y: anchorY + ((vertex.x * sin) + (vertex.y * cos))
        };
    }) as [PlayerTriangleWorldPoint, PlayerTriangleWorldPoint, PlayerTriangleWorldPoint];
};

export const resolveTriangleLeadingCornerWorldPoint = ({
    anchorX,
    anchorY,
    orientationRad,
    cornerIndex
}: ResolveTriangleWorldPointInput): PlayerTriangleWorldPoint => {
    const localCorner = TRIANGLE_LOCAL_VERTICES[cornerIndex] ?? TRIANGLE_LOCAL_VERTICES[1];
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);
    return {
        x: anchorX + ((localCorner.x * cos) - (localCorner.y * sin)),
        y: anchorY + ((localCorner.x * sin) + (localCorner.y * cos))
    };
};

export const resolvePlayerHazardHitShape = ({
    form,
    playerX,
    playerY,
    triangleShell
}: ResolvePlayerGeometryInput): PlayerHazardHitShape => {
    const formAnchor = resolvePlayerFormAnchor({
        form,
        playerX,
        playerY,
        triangleShell
    });

    if (form === 'ball') {
        return {
            kind: 'circle',
            centerX: formAnchor.x,
            centerY: formAnchor.y,
            radius: PLAYER_BALL_HAZARD_RADIUS
        };
    }

    if (form === 'square') {
        return {
            kind: 'box',
            centerX: formAnchor.x,
            centerY: formAnchor.y,
            width: PLAYER_SQUARE_HAZARD_SIZE,
            height: PLAYER_SQUARE_HAZARD_SIZE
        };
    }

    const points = resolveTriangleWorldPoints(formAnchor.x, formAnchor.y, triangleShell.orientationRad)
        .map((point) => ({ x: point.x, y: point.y })) as [HazardShapePoint, HazardShapePoint, HazardShapePoint];

    return {
        kind: 'triangle',
        anchorX: formAnchor.x,
        anchorY: formAnchor.y,
        points
    };
};

export const resolveArcadeAxisContactSnapshot = (
    blocked: Physics.Arcade.Body['blocked'],
    touching: Physics.Arcade.Body['touching']
): PlayerAxisContactSnapshot => {
    return {
        hasDownContact: blocked.down || touching.down,
        hasUpContact: blocked.up || touching.up,
        hasLeftContact: blocked.left || touching.left,
        hasRightContact: blocked.right || touching.right
    };
};

export const resolveSquareOrthogonalCornerContact = (
    preferredNormalX: OrthogonalDirection | undefined,
    preferredNormalY: OrthogonalDirection | undefined,
    moveIntentX: OrthogonalDirection,
    moveIntentY: OrthogonalDirection,
    contacts: PlayerAxisContactSnapshot
): { normalX: OrthogonalDirection; normalY: OrthogonalDirection } | null => {
    if (preferredNormalX === 0 && preferredNormalY !== undefined && preferredNormalY !== 0) {
        if (moveIntentX > 0 && contacts.hasRightContact) {
            return { normalX: -1, normalY: 0 };
        }

        if (moveIntentX < 0 && contacts.hasLeftContact) {
            return { normalX: 1, normalY: 0 };
        }

        if (moveIntentX === 0) {
            if (contacts.hasRightContact && !contacts.hasLeftContact) {
                return { normalX: -1, normalY: 0 };
            }

            if (contacts.hasLeftContact && !contacts.hasRightContact) {
                return { normalX: 1, normalY: 0 };
            }
        }
    }

    if (preferredNormalY === 0 && preferredNormalX !== undefined && preferredNormalX !== 0) {
        if (moveIntentY < 0 && contacts.hasUpContact) {
            return { normalX: 0, normalY: 1 };
        }

        if (moveIntentY > 0 && contacts.hasDownContact) {
            return { normalX: 0, normalY: -1 };
        }

        if (moveIntentY === 0) {
            if (contacts.hasUpContact && !contacts.hasDownContact) {
                return { normalX: 0, normalY: 1 };
            }

            if (contacts.hasDownContact && !contacts.hasUpContact) {
                return { normalX: 0, normalY: -1 };
            }
        }
    }

    return null;
};

export const resolveSquareContactNormal = (
    contacts: PlayerAxisContactSnapshot,
    preferredNormalX?: OrthogonalDirection,
    preferredNormalY?: OrthogonalDirection,
    moveIntentX: OrthogonalDirection = 0,
    moveIntentY: OrthogonalDirection = 0
): PlayerSquareContactResolution => {
    const rolloverCandidate = resolveSquareOrthogonalCornerContact(
        preferredNormalX,
        preferredNormalY,
        moveIntentX,
        moveIntentY,
        contacts
    );
    if (rolloverCandidate !== null) {
        return {
            normalX: rolloverCandidate.normalX,
            normalY: rolloverCandidate.normalY,
            hasContact: true
        };
    }

    if (preferredNormalX === 0 && preferredNormalY === -1 && contacts.hasDownContact) {
        return { normalX: 0, normalY: -1, hasContact: true };
    }

    if (preferredNormalX === 0 && preferredNormalY === 1 && contacts.hasUpContact) {
        return { normalX: 0, normalY: 1, hasContact: true };
    }

    if (preferredNormalX === 1 && preferredNormalY === 0 && contacts.hasLeftContact) {
        return { normalX: 1, normalY: 0, hasContact: true };
    }

    if (preferredNormalX === -1 && preferredNormalY === 0 && contacts.hasRightContact) {
        return { normalX: -1, normalY: 0, hasContact: true };
    }

    if (contacts.hasDownContact) {
        return { normalX: 0, normalY: -1, hasContact: true };
    }

    if (contacts.hasUpContact) {
        return { normalX: 0, normalY: 1, hasContact: true };
    }

    if (contacts.hasLeftContact) {
        return { normalX: 1, normalY: 0, hasContact: true };
    }

    if (contacts.hasRightContact) {
        return { normalX: -1, normalY: 0, hasContact: true };
    }

    return { normalX: 0, normalY: -1, hasContact: false };
};

export const resolveSquareSupportProbe = (
    normalX: OrthogonalDirection,
    normalY: OrthogonalDirection,
    playerRect: PlayerRectSnapshot
): PlayerSquareSupportProbe => {
    const probeThickness = 4;
    const probePadding = 2;
    let probeX = playerRect.left - probePadding;
    let probeY = playerRect.top - probePadding;
    let probeWidth = playerRect.width + (probePadding * 2);
    let probeHeight = playerRect.height + (probePadding * 2);
    let tangentValue = playerRect.centerX;
    let useXAxisAsTangent = true;

    if (normalX === 0 && normalY === -1) {
        probeY = playerRect.bottom - (probeThickness * 0.5);
        probeHeight = probeThickness;
        tangentValue = playerRect.centerX;
        useXAxisAsTangent = true;
    } else if (normalX === 0 && normalY === 1) {
        probeY = playerRect.top - (probeThickness * 0.5);
        probeHeight = probeThickness;
        tangentValue = playerRect.centerX;
        useXAxisAsTangent = true;
    } else if (normalX === 1 && normalY === 0) {
        probeX = playerRect.left - (probeThickness * 0.5);
        probeWidth = probeThickness;
        tangentValue = playerRect.centerY;
        useXAxisAsTangent = false;
    } else if (normalX === -1 && normalY === 0) {
        probeX = playerRect.right - (probeThickness * 0.5);
        probeWidth = probeThickness;
        tangentValue = playerRect.centerY;
        useXAxisAsTangent = false;
    }

    return {
        x: probeX,
        y: probeY,
        width: probeWidth,
        height: probeHeight,
        tangentValue,
        useXAxisAsTangent
    };
};

export const resolveSquareSupportFaceGap = (
    normalX: OrthogonalDirection,
    normalY: OrthogonalDirection,
    playerRect: Pick<PlayerRectSnapshot, 'left' | 'top' | 'right' | 'bottom'>,
    candidateRect: Pick<PlayerRectSnapshot, 'left' | 'top' | 'right' | 'bottom'>
): number | null => {
    const faceAlignmentTolerance = 6;

    if (normalX === 0 && normalY === -1) {
        const faceGap = Math.abs(candidateRect.top - playerRect.bottom);
        return faceGap <= faceAlignmentTolerance ? faceGap : null;
    }

    if (normalX === 0 && normalY === 1) {
        const faceGap = Math.abs(candidateRect.bottom - playerRect.top);
        return faceGap <= faceAlignmentTolerance ? faceGap : null;
    }

    if (normalX === 1 && normalY === 0) {
        const faceGap = Math.abs(candidateRect.right - playerRect.left);
        return faceGap <= faceAlignmentTolerance ? faceGap : null;
    }

    const faceGap = Math.abs(candidateRect.left - playerRect.right);
    return faceGap <= faceAlignmentTolerance ? faceGap : null;
};

export const distanceToInterval = (value: number, min: number, max: number): number => {
    if (value < min) {
        return min - value;
    }

    if (value > max) {
        return value - max;
    }

    return 0;
};

export const resolveTrailSupportOwner = (
    supportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
): PlayerSquareTrailSupportOwner => {
    if (supportBody === null) {
        return {
            body: null,
            originX: 0,
            originY: 0
        };
    }

    return {
        body: supportBody,
        // Keep owner-local space stable across owner movement.
        originX: 0,
        originY: 0
    };
};

export const resolveSquareSupportIntervalFromKnownBody = (
    knownSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null,
    selfBody: Physics.Arcade.Body,
    normalX: OrthogonalDirection,
    normalY: OrthogonalDirection,
    playerRect: PlayerRectSnapshot
): PlayerSquareSupportInterval<Physics.Arcade.Body | Physics.Arcade.StaticBody> | null => {
    if (knownSupportBody === null || knownSupportBody === selfBody) {
        return null;
    }

    const candidateRect = createPlayerRectSnapshot(
        knownSupportBody.x,
        knownSupportBody.y,
        knownSupportBody.width,
        knownSupportBody.height
    );
    const isFaceCompatible = resolveSquareSupportFaceGap(
        normalX,
        normalY,
        playerRect,
        candidateRect
    ) !== null;
    if (!isFaceCompatible) {
        return null;
    }

    if (normalX === 0 && normalY !== 0) {
        const overlapsPlayerSpan = candidateRect.right > playerRect.left && candidateRect.left < playerRect.right;
        if (!overlapsPlayerSpan) {
            return null;
        }

        return {
            min: candidateRect.left,
            max: candidateRect.right,
            ownerBody: knownSupportBody
        };
    }

    const overlapsPlayerSpan = candidateRect.bottom > playerRect.top && candidateRect.top < playerRect.bottom;
    if (!overlapsPlayerSpan) {
        return null;
    }

    return {
        min: candidateRect.top,
        max: candidateRect.bottom,
        ownerBody: knownSupportBody
    };
};

export const resolveSquareSupportIntervalFromOverlap = (
    overlapBodies: Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>,
    selfBody: Physics.Arcade.Body,
    normalX: OrthogonalDirection,
    normalY: OrthogonalDirection,
    playerRect: PlayerRectSnapshot,
    probe: PlayerSquareSupportProbe
): PlayerSquareSupportInterval<Physics.Arcade.Body | Physics.Arcade.StaticBody> | null => {
    let bestInterval: PlayerSquareSupportInterval<Physics.Arcade.Body | Physics.Arcade.StaticBody> | null = null;
    let bestFaceGap = Infinity;
    let bestTangentDistance = Infinity;

    overlapBodies.forEach((candidateBody) => {
        if (candidateBody === selfBody) {
            return;
        }

        const candidateRect = createPlayerRectSnapshot(
            candidateBody.x,
            candidateBody.y,
            candidateBody.width,
            candidateBody.height
        );
        const faceGap = resolveSquareSupportFaceGap(normalX, normalY, playerRect, candidateRect);
        if (faceGap === null) {
            return;
        }

        if (probe.useXAxisAsTangent) {
            const overlapsPlayerSpan = candidateRect.right > playerRect.left && candidateRect.left < playerRect.right;
            if (!overlapsPlayerSpan) {
                return;
            }

            const tangentDistance = distanceToInterval(probe.tangentValue, candidateRect.left, candidateRect.right);
            const hasBetterFaceGap = faceGap < (bestFaceGap - 0.001);
            const hasEqualFaceGap = Math.abs(faceGap - bestFaceGap) <= 0.001;
            if (hasBetterFaceGap || (hasEqualFaceGap && tangentDistance < bestTangentDistance)) {
                bestFaceGap = faceGap;
                bestTangentDistance = tangentDistance;
                bestInterval = {
                    min: candidateRect.left,
                    max: candidateRect.right,
                    ownerBody: candidateBody
                };
            }
            return;
        }

        const overlapsPlayerSpan = candidateRect.bottom > playerRect.top && candidateRect.top < playerRect.bottom;
        if (!overlapsPlayerSpan) {
            return;
        }

        const tangentDistance = distanceToInterval(probe.tangentValue, candidateRect.top, candidateRect.bottom);
        const hasBetterFaceGap = faceGap < (bestFaceGap - 0.001);
        const hasEqualFaceGap = Math.abs(faceGap - bestFaceGap) <= 0.001;
        if (hasBetterFaceGap || (hasEqualFaceGap && tangentDistance < bestTangentDistance)) {
            bestFaceGap = faceGap;
            bestTangentDistance = tangentDistance;
            bestInterval = {
                min: candidateRect.top,
                max: candidateRect.bottom,
                ownerBody: candidateBody
            };
        }
    });

    return bestInterval;
};

export const resolveSquareTrailSurfacePoint = (
    normalX: OrthogonalDirection,
    normalY: OrthogonalDirection,
    playerRect: PlayerRectSnapshot,
    supportInterval: PlayerSquareSupportInterval<Physics.Arcade.Body | Physics.Arcade.StaticBody> | null,
    fallbackSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
): PlayerSquareTrailSurfacePoint => {
    const supportOwner = supportInterval !== null
        ? resolveTrailSupportOwner(supportInterval.ownerBody)
        : resolveTrailSupportOwner(fallbackSupportBody);

    if (normalX === 0 && normalY === -1) {
        return {
            x: supportInterval !== null ? PhaserMath.Clamp(playerRect.centerX, supportInterval.min, supportInterval.max) : playerRect.centerX,
            y: playerRect.bottom,
            supportOwner
        };
    }

    if (normalX === 0 && normalY === 1) {
        return {
            x: supportInterval !== null ? PhaserMath.Clamp(playerRect.centerX, supportInterval.min, supportInterval.max) : playerRect.centerX,
            y: playerRect.top,
            supportOwner
        };
    }

    if (normalX === 1 && normalY === 0) {
        return {
            x: playerRect.left,
            y: supportInterval !== null ? PhaserMath.Clamp(playerRect.centerY, supportInterval.min, supportInterval.max) : playerRect.centerY,
            supportOwner
        };
    }

    return {
        x: playerRect.right,
        y: supportInterval !== null ? PhaserMath.Clamp(playerRect.centerY, supportInterval.min, supportInterval.max) : playerRect.centerY,
        supportOwner
    };
};

export const resolveTriangleLeadingCornerMarkerOffset = (
    cornerIndex: TriangleCornerIndex,
    orientationRad: number,
    outwardOffset: number
): { x: number; y: number } => {
    const localCorner = TRIANGLE_LOCAL_VERTICES[cornerIndex] ?? TRIANGLE_LOCAL_VERTICES[1];
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);
    const rotatedX = (localCorner.x * cos) - (localCorner.y * sin);
    const rotatedY = (localCorner.x * sin) + (localCorner.y * cos);
    const cornerLength = Math.hypot(rotatedX, rotatedY);

    if (cornerLength <= 0.0001 || outwardOffset <= 0) {
        return {
            x: rotatedX,
            y: rotatedY
        };
    }

    const outwardScale = outwardOffset / cornerLength;
    return {
        x: rotatedX + (rotatedX * outwardScale),
        y: rotatedY + (rotatedY * outwardScale)
    };
};
