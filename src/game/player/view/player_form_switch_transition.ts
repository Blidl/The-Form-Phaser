import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import type { PlayerFormId } from '../player_types';
import {
    PLAYER_PLACEHOLDER_RADIUS
} from '../player_constants';
import {
    type PlayerFormSwitchResolvedTransitionSpec,
    type PlayerFormSwitchTransitionShapeParams,
    resolvePlayerFormSwitchTransitionSpec
} from './player_form_switch_transition_data';

const TRANSITION_DEPTH = 4501;
const TRANSITION_BALL_COLOR = 0x00e5ff;
const TRANSITION_TRIANGLE_COLOR = 0xffb74d;
const TRANSITION_SQUARE_COLOR = 0xa5d6a7;
const TRANSITION_LINE_COLOR = 0xffffff;
const TRANSITION_POINT_COUNT = 52;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;
const EPSILON = 0.0001;
const MAX_TRANSITION_RENDER_DELTA_MS = 34;

interface FormSwitchTransitionVisualState {
    active: boolean;
    outgoingForm: PlayerFormId;
    incomingForm: PlayerFormId;
    elapsedMs: number;
    startCenterX: number;
    startCenterY: number;
    startPlayerX: number;
    startPlayerY: number;
    groundBaselineWorldY: number | null;
    transitionSpec: PlayerFormSwitchResolvedTransitionSpec | null;
}

interface SilhouettePoint {
    x: number;
    y: number;
}

export class PlayerFormSwitchTransition {
    private readonly graphics: GameObjects.Graphics;
    private readonly state: FormSwitchTransitionVisualState;

    public constructor(scene: Scene) {
        this.graphics = scene.add.graphics().setDepth(TRANSITION_DEPTH);
        this.state = {
            active: false,
            outgoingForm: 'ball',
            incomingForm: 'ball',
            elapsedMs: 0,
            startCenterX: 0,
            startCenterY: 0,
            startPlayerX: 0,
            startPlayerY: 0,
            groundBaselineWorldY: null,
            transitionSpec: null
        };
    }

    public reset(): void {
        this.state.active = false;
        this.state.elapsedMs = 0;
        this.state.groundBaselineWorldY = null;
        this.state.transitionSpec = null;
        this.graphics.clear();
    }

    public get isActive(): boolean {
        return this.state.active;
    }

    public start(
        outgoingForm: PlayerFormId,
        incomingForm: PlayerFormId,
        centerX: number,
        centerY: number,
        playerX: number,
        playerY: number
    ): void {
        if (outgoingForm === incomingForm) {
            this.reset();
            return;
        }

        if (this.state.active) {
            return;
        }

        const transitionSpec = resolvePlayerFormSwitchTransitionSpec(outgoingForm, incomingForm);
        if (transitionSpec === null) {
            this.reset();
            return;
        }

        this.state.active = true;
        this.state.outgoingForm = outgoingForm;
        this.state.incomingForm = incomingForm;
        this.state.elapsedMs = 0;
        this.state.startCenterX = centerX;
        this.state.startCenterY = centerY;
        this.state.startPlayerX = playerX;
        this.state.startPlayerY = playerY;
        this.state.groundBaselineWorldY = null;
        this.state.transitionSpec = transitionSpec;
    }

    public tickAndRender(
        playerX: number,
        playerY: number,
        grounded: boolean,
        deltaMs: number
    ): void {
        if (!this.state.active || this.state.transitionSpec === null) {
            this.graphics.clear();
            return;
        }

        this.state.elapsedMs = Math.min(
            this.state.transitionSpec.timing.totalDurationMs,
            this.state.elapsedMs + Math.min(MAX_TRANSITION_RENDER_DELTA_MS, Math.max(0, deltaMs))
        );

        const centerX = this.state.startCenterX + (playerX - this.state.startPlayerX);
        const centerY = this.state.startCenterY + (playerY - this.state.startPlayerY);
        const interpolatedShape = resolveInterpolatedShape(this.state.transitionSpec, this.state.elapsedMs);
        const localPoints = resolveSilhouetteLocalPoints(interpolatedShape);
        const supportExtentY = resolveSupportExtentY(localPoints);
        const drawCenterY = this.resolveGroundAnchoredCenterY(centerY, supportExtentY, grounded);
        const outgoingColor = resolveFormColor(this.state.outgoingForm);
        const incomingColor = resolveFormColor(this.state.incomingForm);
        const blendProgress = PhaserMath.Clamp(
            this.state.elapsedMs / this.state.transitionSpec.timing.totalDurationMs,
            0,
            1
        );
        const fillColor = mixColors(outgoingColor, incomingColor, easeInOutSine(blendProgress));
        const worldPoints = localPoints.map((point) => ({
            x: centerX + point.x,
            y: drawCenterY + point.y
        }));

        this.graphics.clear();
        drawShapeSilhouette(
            this.graphics,
            worldPoints,
            fillColor,
            interpolatedShape.alpha,
            interpolatedShape.lineWidth
        );
        if (this.state.elapsedMs >= this.state.transitionSpec.timing.totalDurationMs) {
            this.state.active = false;
            this.state.elapsedMs = 0;
            this.state.groundBaselineWorldY = null;
            this.state.transitionSpec = null;
            this.graphics.clear();
        }
    }

    private resolveGroundAnchoredCenterY(centerY: number, supportExtentY: number, grounded: boolean): number {
        if (!grounded) {
            this.state.groundBaselineWorldY = null;
            return centerY;
        }

        if (this.state.groundBaselineWorldY === null) {
            this.state.groundBaselineWorldY = centerY + supportExtentY;
        }

        return this.state.groundBaselineWorldY - supportExtentY;
    }
}

const resolveInterpolatedShape = (
    transitionSpec: PlayerFormSwitchResolvedTransitionSpec,
    elapsedMs: number
): PlayerFormSwitchTransitionShapeParams => {
    const timing = transitionSpec.timing;
    const clampedElapsedMs = PhaserMath.Clamp(elapsedMs, 0, timing.totalDurationMs);
    const stage1EndMs = timing.sourceToCompressMs;
    const stage2EndMs = stage1EndMs + timing.compressToBridgeMs;
    const stage3EndMs = stage2EndMs + timing.bridgeToEmergeMs;

    if (clampedElapsedMs <= stage1EndMs) {
        const t = easeInOutSine(clampedElapsedMs / Math.max(EPSILON, stage1EndMs));
        return interpolateShape(transitionSpec.stages.source, transitionSpec.stages.compress, t);
    }

    if (clampedElapsedMs <= stage2EndMs) {
        const t = easeInOutSine((clampedElapsedMs - stage1EndMs) / Math.max(EPSILON, timing.compressToBridgeMs));
        return interpolateShape(transitionSpec.stages.compress, transitionSpec.stages.bridge, t);
    }

    if (clampedElapsedMs <= stage3EndMs) {
        const t = easeOutCubic((clampedElapsedMs - stage2EndMs) / Math.max(EPSILON, timing.bridgeToEmergeMs));
        return interpolateShape(transitionSpec.stages.bridge, transitionSpec.stages.emerge, t);
    }

    const t = easeOutQuad((clampedElapsedMs - stage3EndMs) / Math.max(EPSILON, timing.emergeToTargetMs));
    return interpolateShape(transitionSpec.stages.emerge, transitionSpec.stages.target, t);
};

const interpolateShape = (
    sourceShape: PlayerFormSwitchTransitionShapeParams,
    targetShape: PlayerFormSwitchTransitionShapeParams,
    t: number
): PlayerFormSwitchTransitionShapeParams => {
    const clampedT = PhaserMath.Clamp(t, 0, 1);
    return {
        widthScale: PhaserMath.Linear(sourceShape.widthScale, targetShape.widthScale, clampedT),
        heightScale: PhaserMath.Linear(sourceShape.heightScale, targetShape.heightScale, clampedT),
        cornerHardness: PhaserMath.Linear(sourceShape.cornerHardness, targetShape.cornerHardness, clampedT),
        topWidth: PhaserMath.Linear(sourceShape.topWidth, targetShape.topWidth, clampedT),
        bottomWidth: PhaserMath.Linear(sourceShape.bottomWidth, targetShape.bottomWidth, clampedT),
        sideBulge: PhaserMath.Linear(sourceShape.sideBulge, targetShape.sideBulge, clampedT),
        topBulge: PhaserMath.Linear(sourceShape.topBulge, targetShape.topBulge, clampedT),
        bottomBulge: PhaserMath.Linear(sourceShape.bottomBulge, targetShape.bottomBulge, clampedT),
        apexSharpness: PhaserMath.Linear(sourceShape.apexSharpness, targetShape.apexSharpness, clampedT),
        tiltRad: PhaserMath.Linear(sourceShape.tiltRad, targetShape.tiltRad, clampedT),
        alpha: PhaserMath.Linear(sourceShape.alpha, targetShape.alpha, clampedT),
        lineWidth: PhaserMath.Linear(sourceShape.lineWidth, targetShape.lineWidth, clampedT)
    };
};

const resolveSilhouetteLocalPoints = (
    shape: PlayerFormSwitchTransitionShapeParams
): SilhouettePoint[] => {
    const points: SilhouettePoint[] = [];
    const widthScale = Math.max(0.05, shape.widthScale);
    const heightScale = Math.max(0.05, shape.heightScale);
    const sinRotation = Math.sin(shape.tiltRad);
    const cosRotation = Math.cos(shape.tiltRad);

    for (let pointIndex = 0; pointIndex < TRANSITION_POINT_COUNT; pointIndex += 1) {
        const progress = pointIndex / TRANSITION_POINT_COUNT;
        const angle = (-HALF_PI) + (progress * TWO_PI);
        const unitX = Math.cos(angle);
        const unitY = Math.sin(angle);
        const shapedRadius = resolveShapedRadius(unitX, unitY, shape);
        const localX = unitX * PLAYER_PLACEHOLDER_RADIUS * shapedRadius * widthScale;
        const localY = unitY * PLAYER_PLACEHOLDER_RADIUS * shapedRadius * heightScale;
        points.push({
            x: (localX * cosRotation) - (localY * sinRotation),
            y: (localX * sinRotation) + (localY * cosRotation)
        });
    }

    return points;
};

const resolveShapedRadius = (
    unitX: number,
    unitY: number,
    shape: PlayerFormSwitchTransitionShapeParams
): number => {
    const upness = PhaserMath.Clamp((1 - unitY) * 0.5, 0, 1);
    const sideProfile = Math.sin(Math.PI * upness);
    const topProfile = upness * upness;
    const bottomProfile = (1 - upness) * (1 - upness);
    const apexProfile = topProfile * topProfile * upness;

    const widthByHeight = PhaserMath.Linear(shape.bottomWidth, shape.topWidth, upness);
    const sideBulge = shape.sideBulge * sideProfile;
    const apexPinch = shape.apexSharpness * apexProfile * 0.95;
    const safeXScale = Math.max(0.05, widthByHeight + sideBulge - apexPinch);

    const yBulge = (shape.topBulge * topProfile) + (shape.bottomBulge * bottomProfile);
    const safeYScale = Math.max(0.05, 1 + yBulge);

    const deformedX = unitX / safeXScale;
    const deformedY = unitY / safeYScale;
    const superellipseExponent = 2.6;
    const radialDenominator = Math.pow(
        Math.pow(Math.abs(deformedX), superellipseExponent) + Math.pow(Math.abs(deformedY), superellipseExponent),
        1 / superellipseExponent
    );
    const roundedRadius = 1 / Math.max(EPSILON, radialDenominator);
    const polygonRadius = resolveTrapezoidRayRadius(unitX, unitY, shape);
    return PhaserMath.Linear(roundedRadius, polygonRadius, PhaserMath.Clamp(shape.cornerHardness, 0, 1));
};

const resolveTrapezoidRayRadius = (
    unitX: number,
    unitY: number,
    shape: PlayerFormSwitchTransitionShapeParams
): number => {
    const topHalfWidth = Math.max(0.015, shape.topWidth * (1 - (shape.apexSharpness * 0.82)));
    const bottomHalfWidth = Math.max(topHalfWidth + 0.01, shape.bottomWidth);
    const sideWarp = shape.sideBulge * 0.15;
    const topY = -1 - (shape.topBulge * 0.18);
    const bottomY = 1 + (shape.bottomBulge * 0.12);
    const vertices: ReadonlyArray<{ x: number; y: number }> = [
        { x: -(bottomHalfWidth * (1 + sideWarp)), y: bottomY },
        { x: bottomHalfWidth * (1 + sideWarp), y: bottomY },
        { x: topHalfWidth * (1 - sideWarp), y: topY },
        { x: -(topHalfWidth * (1 - sideWarp)), y: topY }
    ];

    let bestT = Number.POSITIVE_INFINITY;
    for (let edgeIndex = 0; edgeIndex < vertices.length; edgeIndex += 1) {
        const edgeStart = vertices[edgeIndex];
        const edgeEnd = vertices[(edgeIndex + 1) % vertices.length];
        const edgeVectorX = edgeEnd.x - edgeStart.x;
        const edgeVectorY = edgeEnd.y - edgeStart.y;
        const denominator = cross2(unitX, unitY, edgeVectorX, edgeVectorY);
        if (Math.abs(denominator) <= EPSILON) {
            continue;
        }

        const t = cross2(edgeStart.x, edgeStart.y, edgeVectorX, edgeVectorY) / denominator;
        const segmentProgress = cross2(edgeStart.x, edgeStart.y, unitX, unitY) / denominator;
        if (t > EPSILON && segmentProgress >= -EPSILON && segmentProgress <= (1 + EPSILON)) {
            bestT = Math.min(bestT, t);
        }
    }

    if (!Number.isFinite(bestT)) {
        return 1;
    }

    return Math.max(0.08, bestT);
};

const cross2 = (ax: number, ay: number, bx: number, by: number): number => (ax * by) - (ay * bx);

const resolveSupportExtentY = (localPoints: SilhouettePoint[]): number => {
    let maxY = 0;
    for (const point of localPoints) {
        if (point.y > maxY) {
            maxY = point.y;
        }
    }
    return Math.max(1, maxY);
};

const drawShapeSilhouette = (
    graphics: GameObjects.Graphics,
    worldPoints: SilhouettePoint[],
    fillColor: number,
    alpha: number,
    lineWidth: number
): void => {
    const clampedAlpha = PhaserMath.Clamp(alpha, 0, 1);
    if (worldPoints.length < 3 || clampedAlpha <= 0.001) {
        return;
    }

    graphics.fillStyle(fillColor, clampedAlpha);
    graphics.lineStyle(Math.max(1, lineWidth), TRANSITION_LINE_COLOR, Math.min(0.95, clampedAlpha * 0.9));
    graphics.beginPath();
    graphics.moveTo(worldPoints[0].x, worldPoints[0].y);
    for (let pointIndex = 1; pointIndex < worldPoints.length; pointIndex += 1) {
        graphics.lineTo(worldPoints[pointIndex].x, worldPoints[pointIndex].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
};

const resolveFormColor = (form: PlayerFormId): number => {
    if (form === 'triangle') {
        return TRANSITION_TRIANGLE_COLOR;
    }
    if (form === 'square') {
        return TRANSITION_SQUARE_COLOR;
    }
    return TRANSITION_BALL_COLOR;
};

const mixColors = (fromColor: number, toColor: number, t: number): number => {
    const clampedT = PhaserMath.Clamp(t, 0, 1);
    const fromR = (fromColor >> 16) & 0xff;
    const fromG = (fromColor >> 8) & 0xff;
    const fromB = fromColor & 0xff;
    const toR = (toColor >> 16) & 0xff;
    const toG = (toColor >> 8) & 0xff;
    const toB = toColor & 0xff;
    const mixedR = Math.round(PhaserMath.Linear(fromR, toR, clampedT));
    const mixedG = Math.round(PhaserMath.Linear(fromG, toG, clampedT));
    const mixedB = Math.round(PhaserMath.Linear(fromB, toB, clampedT));
    return (mixedR << 16) | (mixedG << 8) | mixedB;
};

const easeOutCubic = (value: number): number => {
    const t = PhaserMath.Clamp(value, 0, 1);
    const inverse = 1 - t;
    return 1 - (inverse * inverse * inverse);
};

const easeOutQuad = (value: number): number => {
    const t = PhaserMath.Clamp(value, 0, 1);
    return 1 - ((1 - t) * (1 - t));
};

const easeInOutSine = (value: number): number => {
    const t = PhaserMath.Clamp(value, 0, 1);
    return 0.5 - (0.5 * Math.cos(Math.PI * t));
};
