import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import {
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_MARKER_RADIUS,
    PLAYER_PLACEHOLDER_RADIUS
} from '../player_constants';
import { resolveTriangleLocalVertices } from '../geometry/player_geometry_queries';
import type { PlayerFormId } from '../player_types';

export interface PlayerDeathTransitionStartParams {
    currentForm: PlayerFormId;
    formCenterX: number;
    formCenterY: number;
    formOrientationRad: number;
    formScaleX: number;
    formScaleY: number;
    impactX: number;
    impactY: number;
    impactNormalX: number;
    impactNormalY: number;
    markerX: number;
    markerY: number;
    velocityX: number;
    velocityY: number;
    grounded: boolean;
    durationMs: number;
}

interface PlayerDeathTransitionState {
    currentForm: PlayerFormId;
    elapsedMs: number;
    durationMs: number;
    contour: ClosedContour;
    impactPoint: Point;
    impactArc: number;
    normal: Point;
    tangent: Point;
    markerX: number;
    markerY: number;
    grounded: boolean;
    fillColor: number;
    outlinePieces: [OutlinePieceState, OutlinePieceState];
}

interface OutlinePieceState {
    basePoints: Point[];
    center: Point;
    sideSign: -1 | 1;
    velocityX: number;
    velocityY: number;
    angularVelocity: number;
}

interface ClosedContour {
    points: Point[];
    cumulativeLength: number[];
    totalLength: number;
}

type Point = { x: number; y: number };

const OUTLINE_SAMPLE_COUNT = 96;
const OUTLINE_BASE_WIDTH = 3;
const DEATH_DURATION_DEFAULT_MS = 260;
const MARKER_FLASH_MS = 60;
const OUTLINE_BURST_MS = 160;
const SMOKE_FADE_MS = 220;
const OUTLINE_GRAVITY_PX_PER_SEC2 = 220;

const SMOKE_BLOBS = [
    { sideX: -0.8, normalY: -0.4, radius: 10, alpha: 0.62 },
    { sideX: -0.2, normalY: 0.2, radius: 8, alpha: 0.54 },
    { sideX: 0.45, normalY: -0.15, radius: 9, alpha: 0.5 },
    { sideX: 0.95, normalY: 0.28, radius: 7, alpha: 0.42 },
    { sideX: -0.5, normalY: 0.72, radius: 6, alpha: 0.34 },
    { sideX: 0.2, normalY: 1.0, radius: 5, alpha: 0.28 }
] as const;

export interface PlayerDeathTransitionDebugSnapshot {
    rendererKind: 'stylized_split_v1';
    isActive: boolean;
    hasLegacyTailPath: false;
    outlineRenderCallCount: number;
    debugOverlayEnabled: boolean;
    progressOverride: number | null;
    lastProgress: number | null;
    contourSampleCount: number;
    projectedImpactArc: number | null;
    hasFrameData: boolean;
    halfGap: number | null;
    openLength: number | null;
    unwrapFront: number | null;
    qSampleCount: number;
    sSampleCount: number;
    rSampleCount: number;
}

export class PlayerDeathTransition {
    private readonly fillGraphics: GameObjects.Graphics;
    private readonly outlineGraphics: GameObjects.Graphics;
    private readonly markerGraphics: GameObjects.Graphics;
    private readonly debugGraphics: GameObjects.Graphics;
    private state: PlayerDeathTransitionState | null = null;
    private debugOverlayEnabled: boolean = false;
    private progressOverride: number | null = null;
    private outlineRenderCallCount: number = 0;
    private lastProgress: number | null = null;

    public constructor(scene: Scene) {
        this.fillGraphics = scene.add.graphics().setDepth(4500).setVisible(false);
        this.outlineGraphics = scene.add.graphics().setDepth(4503).setVisible(false);
        this.markerGraphics = scene.add.graphics().setDepth(4504).setVisible(false);
        this.debugGraphics = scene.add.graphics().setDepth(4505).setVisible(false);
    }

    public get isActive(): boolean {
        return this.state !== null;
    }

    public setDebugOverlay(enabled: boolean, progressOverride: number | null): void {
        this.debugOverlayEnabled = enabled;
        this.progressOverride = progressOverride === null
            ? null
            : PhaserMath.Clamp(progressOverride, 0, 1);
        this.debugGraphics.clear().setVisible(enabled);
        this.render();
    }

    public getDebugSnapshot(): PlayerDeathTransitionDebugSnapshot {
        return {
            rendererKind: 'stylized_split_v1',
            isActive: this.state !== null,
            hasLegacyTailPath: false,
            outlineRenderCallCount: this.outlineRenderCallCount,
            debugOverlayEnabled: this.debugOverlayEnabled,
            progressOverride: this.progressOverride,
            lastProgress: this.lastProgress,
            contourSampleCount: this.state?.contour.points.length ?? 0,
            projectedImpactArc: this.state?.impactArc ?? null,
            hasFrameData: this.state !== null,
            halfGap: this.state === null ? null : this.state.contour.totalLength * 0.03,
            openLength: this.state?.contour.totalLength ?? null,
            unwrapFront: null,
            qSampleCount: 0,
            sSampleCount: 0,
            rSampleCount: this.state?.outlinePieces[0].basePoints.length ?? 0
        };
    }

    public start(params: PlayerDeathTransitionStartParams): void {
        const contourPoints = resolveFormOutlinePoints(
            params.currentForm,
            params.formCenterX,
            params.formCenterY,
            params.formOrientationRad,
            params.formScaleX,
            params.formScaleY
        );
        const contour = createClosedContour(contourPoints);
        if (contour.points.length < 3 || contour.totalLength <= 1e-4) {
            this.reset();
            return;
        }

        const impactProjection = projectOnContour(contour, params.impactX, params.impactY);
        const normal = normalizeOrFallback(
            params.impactNormalX,
            params.impactNormalY,
            params.formCenterX - impactProjection.point.x,
            params.formCenterY - impactProjection.point.y
        );
        const tangent = normalizeOrFallback(-normal.y, normal.x, impactProjection.tangent.x, impactProjection.tangent.y);
        const splitIndex = resolveNearestContourIndex(contour.points, impactProjection.point);
        const pieceSampleCount = Math.max(12, Math.floor(contour.points.length * 0.45));
        const pieceA = buildContourPiece(contour.points, splitIndex + 1, 1, pieceSampleCount);
        const pieceB = buildContourPiece(contour.points, splitIndex, -1, pieceSampleCount);

        if (pieceA.length < 2 || pieceB.length < 2) {
            this.reset();
            return;
        }

        const velocityMagnitude = Math.hypot(params.velocityX, params.velocityY);
        const sideSpeed = 72 + PhaserMath.Clamp(velocityMagnitude * 0.12, 0, 22);
        const awaySpeed = 18 + PhaserMath.Clamp(velocityMagnitude * 0.08, 0, 12);
        const upwardBoost = params.grounded ? 36 : 22;

        this.state = {
            currentForm: params.currentForm,
            elapsedMs: 0,
            durationMs: Math.max(1, params.durationMs || DEATH_DURATION_DEFAULT_MS),
            contour,
            impactPoint: impactProjection.point,
            impactArc: impactProjection.arcLength,
            normal,
            tangent,
            markerX: params.markerX,
            markerY: params.markerY,
            grounded: params.grounded,
            fillColor: resolveFormFillColor(params.currentForm),
            outlinePieces: [
                {
                    basePoints: pieceA,
                    center: resolvePolylineCenter(pieceA),
                    sideSign: 1,
                    velocityX: (tangent.x * sideSpeed) + (normal.x * awaySpeed),
                    velocityY: (tangent.y * sideSpeed) + (normal.y * awaySpeed) - upwardBoost,
                    angularVelocity: 1.4
                },
                {
                    basePoints: pieceB,
                    center: resolvePolylineCenter(pieceB),
                    sideSign: -1,
                    velocityX: (-tangent.x * sideSpeed) + (normal.x * awaySpeed),
                    velocityY: (-tangent.y * sideSpeed) + (normal.y * awaySpeed) - (upwardBoost * 0.8),
                    angularVelocity: -1.2
                }
            ]
        };

        this.fillGraphics.setVisible(true);
        this.outlineGraphics.setVisible(true);
        this.markerGraphics.setVisible(true);
        this.render();
    }

    public tickAndRender(deltaMs: number): void {
        if (this.state === null) {
            return;
        }

        this.state.elapsedMs = Math.min(this.state.durationMs, this.state.elapsedMs + Math.max(0, deltaMs));
        this.render();
        if (this.state.elapsedMs >= this.state.durationMs) {
            this.reset();
        }
    }

    public reset(): void {
        this.state = null;
        this.fillGraphics.clear().setVisible(false);
        this.outlineGraphics.clear().setVisible(false);
        this.markerGraphics.clear().setVisible(false);
        this.lastProgress = null;
        this.debugGraphics.clear().setVisible(this.debugOverlayEnabled);
    }

    public destroy(): void {
        this.fillGraphics.destroy();
        this.outlineGraphics.destroy();
        this.markerGraphics.destroy();
        this.debugGraphics.destroy();
    }

    private render(): void {
        if (this.state === null) {
            return;
        }

        const rawProgress = PhaserMath.Clamp(this.state.elapsedMs / this.state.durationMs, 0, 1);
        const progress = this.progressOverride ?? rawProgress;
        this.lastProgress = progress;

        this.fillGraphics.clear();
        this.outlineGraphics.clear();
        this.markerGraphics.clear();
        this.debugGraphics.clear();

        const elapsedMs = progress * this.state.durationMs;
        this.renderFillLayer(this.state, elapsedMs);
        this.renderOutlineLayer(this.state, elapsedMs);
        this.renderMarkerLayer(this.state, elapsedMs);

        if (this.debugOverlayEnabled) {
            this.renderDebugOverlay(this.state);
        }
    }

    private renderMarkerLayer(state: PlayerDeathTransitionState, elapsedMs: number): void {
        if (elapsedMs >= MARKER_FLASH_MS) {
            return;
        }

        const t = PhaserMath.Clamp(elapsedMs / MARKER_FLASH_MS, 0, 1);
        const fade = 1 - smoothstep(0.1, 1, t);
        const burst = smoothstep(0, 0.28, t);
        const glowRadius = PhaserMath.Linear(PLAYER_MARKER_RADIUS * 2.8, PLAYER_MARKER_RADIUS * 7.2, burst);
        const coreRadius = PhaserMath.Linear(PLAYER_MARKER_RADIUS * 1.4, PLAYER_MARKER_RADIUS * 3.4, burst);
        const ringRadius = PhaserMath.Linear(PLAYER_MARKER_RADIUS * 2.1, PLAYER_MARKER_RADIUS * 5.6, burst);
        const rayLength = PhaserMath.Linear(PLAYER_MARKER_RADIUS * 2.0, PLAYER_MARKER_RADIUS * 6.2, burst);
        const burstRadius = PhaserMath.Linear(PLAYER_MARKER_RADIUS * 2.6, PLAYER_MARKER_RADIUS * 5.0, burst);

        this.markerGraphics.fillStyle(0xffffff, fade * 0.6);
        this.markerGraphics.fillCircle(state.markerX, state.markerY, burstRadius);
        this.markerGraphics.fillStyle(0xd5f7ff, fade * 0.88);
        this.markerGraphics.fillCircle(state.markerX, state.markerY, glowRadius);
        this.markerGraphics.fillStyle(0xffffff, fade);
        this.markerGraphics.fillCircle(state.markerX, state.markerY, coreRadius);
        this.markerGraphics.lineStyle(3.8, 0xffffff, fade * 0.95);
        this.markerGraphics.strokeCircle(state.markerX, state.markerY, ringRadius);
        this.markerGraphics.lineStyle(4.8, 0xeafcff, fade);

        const rays = 8;
        for (let index = 0; index < rays; index += 1) {
            const angle = (index / rays) * Math.PI * 2;
            const dx = Math.cos(angle) * rayLength;
            const dy = Math.sin(angle) * rayLength;
            this.markerGraphics.beginPath();
            this.markerGraphics.moveTo(state.markerX - (dx * 0.2), state.markerY - (dy * 0.2));
            this.markerGraphics.lineTo(state.markerX + dx, state.markerY + dy);
            this.markerGraphics.strokePath();
        }
    }

    private renderOutlineLayer(state: PlayerDeathTransitionState, elapsedMs: number): void {
        const outlineProgress = PhaserMath.Clamp(elapsedMs / OUTLINE_BURST_MS, 0, 1);
        const alpha = 1 - smoothstep(0.78, 1, outlineProgress);
        if (alpha <= 0.01) {
            return;
        }

        this.outlineRenderCallCount += 1;
        const seconds = elapsedMs * 0.001;
        const darkness = smoothstep(0.1, 0.9, outlineProgress);
        const shade = Math.round(PhaserMath.Linear(255, 0, darkness));
        const color = (shade << 16) | (shade << 8) | shade;
        const lineWidth = PhaserMath.Linear(4.2, 1.1, outlineProgress);
        const sideSeparation = PhaserMath.Linear(6, 34, outlineProgress);
        const normalSeparation = PhaserMath.Linear(2, 10, outlineProgress);
        const settleDown = (state.grounded ? 8 : 4) * outlineProgress * outlineProgress;
        const highlightAlpha = alpha * (1 - (darkness * 0.72));

        state.outlinePieces.forEach((piece) => {
            const offsetX = (piece.velocityX * seconds)
                + (state.tangent.x * piece.sideSign * sideSeparation)
                + (state.normal.x * normalSeparation);
            const offsetY = (piece.velocityY * seconds)
                + (0.5 * OUTLINE_GRAVITY_PX_PER_SEC2 * seconds * seconds)
                + (state.tangent.y * piece.sideSign * sideSeparation)
                + (state.normal.y * normalSeparation)
                + settleDown;
            const rotation = piece.angularVelocity * seconds * (1 - (outlineProgress * 0.2));
            const transformed = transformPolyline(piece.basePoints, piece.center, rotation, offsetX, offsetY);
            if (highlightAlpha > 0.01) {
                drawPolyline(this.outlineGraphics, transformed, lineWidth + 1.8, 0xffffff, highlightAlpha * 0.38);
            }
            drawPolyline(this.outlineGraphics, transformed, lineWidth, color, alpha);
            if (darkness > 0.35) {
                drawPolyline(this.outlineGraphics, transformed, Math.max(0.8, lineWidth - 0.6), 0x000000, alpha * darkness);
            }
        });
    }

    private renderFillLayer(state: PlayerDeathTransitionState, elapsedMs: number): void {
        const intactAlpha = 1 - smoothstep(0, 58, elapsedMs);
        if (intactAlpha > 0.01) {
            drawFilledContour(this.fillGraphics, state.contour.points, state.fillColor, intactAlpha * 0.36);
        }

        const smokeProgress = PhaserMath.Clamp(elapsedMs / SMOKE_FADE_MS, 0, 1);
        const smokeAlpha = 1 - smoothstep(0.35, 1, smokeProgress);
        if (smokeAlpha <= 0.01) {
            return;
        }

        const spreadDistance = PhaserMath.Linear(8, 38, smokeProgress);
        const normalPush = PhaserMath.Linear(4, 16, smokeProgress);
        const downDrift = (state.grounded ? 20 : 12) * smokeProgress * smokeProgress;
        const colorDarken = smoothstep(0.2, 1, smokeProgress);
        const smokeColor = mixColor(state.fillColor, 0x181818, colorDarken * 0.72);

        const lobes: ReadonlyArray<{ sideSign: -1 | 1 }> = [
            { sideSign: -1 },
            { sideSign: 1 }
        ];

        lobes.forEach((lobe) => {
            const anchorX = state.impactPoint.x
                + (state.tangent.x * spreadDistance * lobe.sideSign)
                + (state.normal.x * normalPush);
            const anchorY = state.impactPoint.y
                + (state.tangent.y * spreadDistance * lobe.sideSign)
                + (state.normal.y * normalPush)
                + downDrift;
            const sideDirX = state.tangent.x * lobe.sideSign;
            const sideDirY = state.tangent.y * lobe.sideSign;

            SMOKE_BLOBS.forEach((blob, blobIndex) => {
                const expansion = 1 + (smokeProgress * (0.55 + (blobIndex * 0.08)));
                const blobX = anchorX
                    + (sideDirX * blob.sideX * 16 * expansion)
                    + (state.normal.x * blob.normalY * 12 * expansion);
                const blobY = anchorY
                    + (sideDirY * blob.sideX * 16 * expansion)
                    + (state.normal.y * blob.normalY * 12 * expansion)
                    + (blobIndex * 0.9 * smokeProgress);
                const radius = PhaserMath.Linear(blob.radius * 0.9, blob.radius * 1.8, smokeProgress);
                this.fillGraphics.fillStyle(smokeColor, smokeAlpha * blob.alpha);
                this.fillGraphics.fillCircle(blobX, blobY, radius);
            });
        });
    }

    private renderDebugOverlay(state: PlayerDeathTransitionState): void {
        this.debugGraphics.lineStyle(1.5, 0xffcc66, 0.8);
        this.debugGraphics.beginPath();
        this.debugGraphics.moveTo(state.contour.points[0].x, state.contour.points[0].y);
        for (let index = 1; index < state.contour.points.length; index += 1) {
            this.debugGraphics.lineTo(state.contour.points[index].x, state.contour.points[index].y);
        }
        this.debugGraphics.closePath();
        this.debugGraphics.strokePath();

        this.debugGraphics.fillStyle(0xff4f4f, 1);
        this.debugGraphics.fillCircle(state.impactPoint.x, state.impactPoint.y, 3.6);
    }
}

const drawFilledContour = (
    graphics: GameObjects.Graphics,
    points: ReadonlyArray<Point>,
    color: number,
    alpha: number
): void => {
    if (points.length < 3 || alpha <= 0.001) {
        return;
    }

    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.closePath();
    graphics.fillPath();
};

const drawPolyline = (
    graphics: GameObjects.Graphics,
    points: ReadonlyArray<Point>,
    lineWidth: number,
    color: number,
    alpha: number
): void => {
    if (points.length < 2 || alpha <= 0.003) {
        return;
    }

    graphics.lineStyle(lineWidth, color, alpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.strokePath();
};

const resolveFormOutlinePoints = (
    form: PlayerFormId,
    centerX: number,
    centerY: number,
    orientationRad: number,
    scaleX: number,
    scaleY: number
): Point[] => {
    if (form === 'ball') {
        const points: Point[] = [];
        const sin = Math.sin(orientationRad);
        const cos = Math.cos(orientationRad);

        for (let index = 0; index < OUTLINE_SAMPLE_COUNT; index += 1) {
            const t = (index / OUTLINE_SAMPLE_COUNT) * Math.PI * 2;
            const localX = Math.cos(t) * PLAYER_PLACEHOLDER_RADIUS * scaleX;
            const localY = Math.sin(t) * PLAYER_PLACEHOLDER_RADIUS * scaleY;
            points.push({
                x: centerX + ((localX * cos) - (localY * sin)),
                y: centerY + ((localX * sin) + (localY * cos))
            });
        }
        return points;
    }

    if (form === 'square') {
        const halfSize = PLAYER_FORM_SQUARE_SIZE * 0.5;
        return samplePolygonEdges(
            [
                { x: -halfSize, y: -halfSize },
                { x: halfSize, y: -halfSize },
                { x: halfSize, y: halfSize },
                { x: -halfSize, y: halfSize }
            ],
            centerX,
            centerY,
            orientationRad,
            scaleX,
            scaleY,
            24
        );
    }

    return samplePolygonEdges(
        resolveTriangleLocalVertices(),
        centerX,
        centerY,
        orientationRad,
        scaleX,
        scaleY,
        32
    );
};

const samplePolygonEdges = (
    localVertices: ReadonlyArray<Point>,
    centerX: number,
    centerY: number,
    orientationRad: number,
    scaleX: number,
    scaleY: number,
    subdivisionsPerEdge: number
): Point[] => {
    const points: Point[] = [];
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);

    for (let vertexIndex = 0; vertexIndex < localVertices.length; vertexIndex += 1) {
        const start = localVertices[vertexIndex];
        const end = localVertices[(vertexIndex + 1) % localVertices.length];
        for (let step = 0; step < subdivisionsPerEdge; step += 1) {
            const t = step / subdivisionsPerEdge;
            const localX = PhaserMath.Linear(start.x, end.x, t) * scaleX;
            const localY = PhaserMath.Linear(start.y, end.y, t) * scaleY;
            points.push({
                x: centerX + ((localX * cos) - (localY * sin)),
                y: centerY + ((localX * sin) + (localY * cos))
            });
        }
    }

    return points;
};

const createClosedContour = (sourcePoints: ReadonlyArray<Point>): ClosedContour => {
    const points = sourcePoints.length >= 3 ? sourcePoints.map((point) => ({ x: point.x, y: point.y })) : [];
    const cumulativeLength: number[] = [0];
    if (points.length < 3) {
        return { points, cumulativeLength, totalLength: 0 };
    }

    let totalLength = 0;
    for (let index = 0; index < points.length; index += 1) {
        const nextIndex = (index + 1) % points.length;
        totalLength += Math.hypot(points[nextIndex].x - points[index].x, points[nextIndex].y - points[index].y);
        cumulativeLength.push(totalLength);
    }

    return { points, cumulativeLength, totalLength };
};

const projectOnContour = (
    contour: ClosedContour,
    x: number,
    y: number
): { point: Point; tangent: Point; arcLength: number } => {
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    let bestPoint = contour.points[0] ?? { x, y };
    let bestTangent = { x: 1, y: 0 };
    let bestArc = 0;

    for (let index = 0; index < contour.points.length; index += 1) {
        const nextIndex = (index + 1) % contour.points.length;
        const start = contour.points[index];
        const end = contour.points[nextIndex];
        const segmentX = end.x - start.x;
        const segmentY = end.y - start.y;
        const segmentLengthSq = (segmentX * segmentX) + (segmentY * segmentY);
        if (segmentLengthSq <= 1e-8) {
            continue;
        }

        const projectionT = PhaserMath.Clamp(
            (((x - start.x) * segmentX) + ((y - start.y) * segmentY)) / segmentLengthSq,
            0,
            1
        );
        const candidateX = start.x + (segmentX * projectionT);
        const candidateY = start.y + (segmentY * projectionT);
        const dx = candidateX - x;
        const dy = candidateY - y;
        const distanceSq = (dx * dx) + (dy * dy);
        if (distanceSq >= bestDistanceSq) {
            continue;
        }

        bestDistanceSq = distanceSq;
        bestPoint = { x: candidateX, y: candidateY };
        const segmentLength = Math.sqrt(segmentLengthSq);
        bestTangent = { x: segmentX / segmentLength, y: segmentY / segmentLength };
        bestArc = contour.cumulativeLength[index] + (segmentLength * projectionT);
    }

    return { point: bestPoint, tangent: bestTangent, arcLength: bestArc };
};

const resolveNearestContourIndex = (
    points: ReadonlyArray<Point>,
    target: Point
): number => {
    let bestIndex = 0;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    points.forEach((point, index) => {
        const dx = point.x - target.x;
        const dy = point.y - target.y;
        const distanceSq = (dx * dx) + (dy * dy);
        if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            bestIndex = index;
        }
    });

    return bestIndex;
};

const buildContourPiece = (
    points: ReadonlyArray<Point>,
    startIndex: number,
    direction: -1 | 1,
    sampleCount: number
): Point[] => {
    const length = points.length;
    if (length === 0) {
        return [];
    }

    const resolved: Point[] = [];
    for (let step = 0; step < sampleCount; step += 1) {
        const index = wrapIndex(startIndex + (step * direction), length);
        const point = points[index];
        resolved.push({ x: point.x, y: point.y });
    }
    return resolved;
};

const resolvePolylineCenter = (points: ReadonlyArray<Point>): Point => {
    if (points.length === 0) {
        return { x: 0, y: 0 };
    }

    let sumX = 0;
    let sumY = 0;
    points.forEach((point) => {
        sumX += point.x;
        sumY += point.y;
    });

    return {
        x: sumX / points.length,
        y: sumY / points.length
    };
};

const transformPolyline = (
    points: ReadonlyArray<Point>,
    center: Point,
    rotationRad: number,
    offsetX: number,
    offsetY: number
): Point[] => {
    const sin = Math.sin(rotationRad);
    const cos = Math.cos(rotationRad);

    return points.map((point) => {
        const localX = point.x - center.x;
        const localY = point.y - center.y;
        const rotatedX = (localX * cos) - (localY * sin);
        const rotatedY = (localX * sin) + (localY * cos);

        return {
            x: center.x + rotatedX + offsetX,
            y: center.y + rotatedY + offsetY
        };
    });
};

const resolveFormFillColor = (form: PlayerFormId): number => {
    if (form === 'triangle') {
        return 0xffb74d;
    }
    if (form === 'square') {
        return 0xa5d6a7;
    }
    return 0x00e5ff;
};

const normalizeOrFallback = (
    x: number,
    y: number,
    fallbackX: number,
    fallbackY: number
): Point => {
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1e-6) {
        return {
            x: x / magnitude,
            y: y / magnitude
        };
    }

    const fallbackMagnitude = Math.hypot(fallbackX, fallbackY);
    if (fallbackMagnitude > 1e-6) {
        return {
            x: fallbackX / fallbackMagnitude,
            y: fallbackY / fallbackMagnitude
        };
    }

    return { x: 0, y: -1 };
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
    if (Math.abs(edge1 - edge0) <= 1e-6) {
        return x < edge0 ? 0 : 1;
    }
    const t = PhaserMath.Clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - (2 * t));
};

const wrapIndex = (index: number, length: number): number => {
    if (length <= 0) {
        return 0;
    }
    const wrapped = index % length;
    return wrapped < 0 ? wrapped + length : wrapped;
};

const mixColor = (from: number, to: number, t: number): number => {
    const clampedT = PhaserMath.Clamp(t, 0, 1);
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;
    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    const r = Math.round(PhaserMath.Linear(fromR, toR, clampedT));
    const g = Math.round(PhaserMath.Linear(fromG, toG, clampedT));
    const b = Math.round(PhaserMath.Linear(fromB, toB, clampedT));
    return (r << 16) | (g << 8) | b;
};
