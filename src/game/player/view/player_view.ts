import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import {
    PLAYER_BALL_VISUAL_BOOST_STROKE_WIDTH,
    PLAYER_BALL_VISUAL_STROKE_WIDTH,
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_MARKER_ACTIVE_ALPHA,
    PLAYER_MARKER_FILL_COLOR,
    PLAYER_MARKER_IDLE_ALPHA,
    PLAYER_MARKER_RADIUS,
    PLAYER_MARKER_STROKE_COLOR,
    PLAYER_MARKER_STROKE_WIDTH,
    PLAYER_MARKER_VISUAL_SCALE,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_SQUARE_EDGE_DOWN_POSE_RAD,
    PLAYER_SQUARE_TRAIL_STROKE_ALPHA,
    PLAYER_SQUARE_TRAIL_STROKE_COLOR,
    PLAYER_SQUARE_TRAIL_STROKE_WIDTH,
    PLAYER_SQUARE_ATTACH_JUMP_TETHER_STRETCH_PX,
    PLAYER_SQUARE_VISUAL_ATTACH_STROKE_COLOR,
    PLAYER_SQUARE_VISUAL_REGEN_STROKE_COLOR,
    PLAYER_SQUARE_VISUAL_REGEN_STROKE_WIDTH,
    PLAYER_SQUARE_VISUAL_STROKE_COLOR,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH
} from '../player_constants';
import { resolveMarkerIntent } from '../marker/player_marker_math';
import type { PlayerMarkerState } from '../marker/player_marker_types';
import { resolveTriangleCentroidOffset, resolveTriangleLocalVertices } from '../geometry/player_geometry_queries';
import { squareSupportLocalToWorld } from '../player_square_support_space';
import { resolveSquareTrailSegmentWorldLine } from '../player_square_trail';
import { PlayerFormAnimationRuntime } from './player_form_animation_runtime';
import type { PlayerPresentationFrameHooks } from './player_presentation_hooks';
import type {
    PlayerFormId,
    PlayerTriangleFlightState,
    PlayerSquareTrailSegment,
    PlayerSquareShellState,
    PlayerTriangleShellState
} from '../player_types';
import type { PlayerFormAnchor } from '../geometry/player_geometry_types';

export class PlayerView {
    private readonly ballVisual: GameObjects.Arc;
    private readonly triangleVisual: GameObjects.Triangle;
    private readonly squareVisual: GameObjects.Rectangle;
    private readonly markerVisual: GameObjects.Arc;
    private readonly squareContactMarker: GameObjects.Line;
    private readonly squareTrailGraphics: GameObjects.Graphics;
    private readonly squareAttachJumpTetherGraphics: GameObjects.Graphics;
    private readonly formAnimationRuntime: PlayerFormAnimationRuntime;
    private debugVisualsVisible: boolean = false;

    public constructor(scene: Scene, x: number, y: number) {
        this.ballVisual = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0x00e5ff)
            .setStrokeStyle(PLAYER_BALL_VISUAL_STROKE_WIDTH, 0xffffff)
            .setDepth(4500);
        this.triangleVisual = scene.add.triangle(
            x,
            y,
            0,
            PLAYER_FORM_TRIANGLE_HEIGHT,
            PLAYER_FORM_TRIANGLE_WIDTH * 0.5,
            0,
            PLAYER_FORM_TRIANGLE_WIDTH,
            PLAYER_FORM_TRIANGLE_HEIGHT,
            0xffb74d
        )
            .setStrokeStyle(2, 0xffffff)
            .setDepth(4500)
            .setVisible(false)
            .setRotation(PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD);
        this.squareVisual = scene.add.rectangle(x, y, PLAYER_FORM_SQUARE_SIZE, PLAYER_FORM_SQUARE_SIZE, 0xa5d6a7)
            .setStrokeStyle(2, PLAYER_SQUARE_VISUAL_STROKE_COLOR)
            .setDepth(4500)
            .setVisible(false)
            .setRotation(PLAYER_SQUARE_EDGE_DOWN_POSE_RAD);
        this.markerVisual = scene.add.circle(x, y, PLAYER_MARKER_RADIUS, PLAYER_MARKER_FILL_COLOR)
            .setStrokeStyle(PLAYER_MARKER_STROKE_WIDTH, PLAYER_MARKER_STROKE_COLOR)
            .setDepth(4502)
            .setScale(PLAYER_MARKER_VISUAL_SCALE)
            .setAlpha(PLAYER_MARKER_IDLE_ALPHA);
        this.squareContactMarker = scene.add.line(x, y, 0, 0, 0, 12, 0xffffff)
            .setLineWidth(2, 2)
            .setDepth(4501)
            .setVisible(false)
            .setOrigin(0.5, 0.5);
        this.squareTrailGraphics = scene.add.graphics().setDepth(4900);
        this.squareAttachJumpTetherGraphics = scene.add.graphics().setDepth(4499);
        this.formAnimationRuntime = new PlayerFormAnimationRuntime('ball');
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.triangleVisual;
    }

    public hideTransientMarkers(): void {
        this.squareContactMarker.setVisible(false);
        this.squareAttachJumpTetherGraphics.clear();
    }

    public resetFormAnimationPose(currentForm: PlayerFormId): void {
        this.formAnimationRuntime.resetPose(currentForm);
        this.applyFormAnimationPose(currentForm, PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD, PLAYER_SQUARE_EDGE_DOWN_POSE_RAD);
    }

    public setDebugVisualsVisible(visible: boolean): void {
        this.debugVisualsVisible = visible;
        if (!visible) {
            this.squareContactMarker.setVisible(false);
        }
    }

    public applyCurrentFormVisibility(
        currentForm: PlayerFormId,
        squareShell: PlayerSquareShellState,
        ballBoostActive: boolean
    ): void {
        this.ballVisual.setVisible(currentForm === 'ball');
        this.triangleVisual.setVisible(currentForm === 'triangle');
        this.squareVisual.setVisible(currentForm === 'square');
        this.markerVisual.setVisible(true);
        this.squareContactMarker.setVisible(
            this.debugVisualsVisible && currentForm === 'square' && squareShell.hasContact
        );
        this.updateBallBoostVisualState(currentForm, ballBoostActive);
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached, squareShell.isTrailRegenerating);
        this.applyFormAnimationPose(currentForm, PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD, PLAYER_SQUARE_EDGE_DOWN_POSE_RAD);
    }

    public syncVisualPosition(
        playerX: number,
        playerY: number,
        formAnchor: PlayerFormAnchor,
        currentForm: PlayerFormId,
        marker: PlayerMarkerState,
        triangleShell: PlayerTriangleShellState,
        squareShell: PlayerSquareShellState,
        triangleFlight: PlayerTriangleFlightState,
        ballBoostActive: boolean,
        presentationHooks: PlayerPresentationFrameHooks,
        grounded: boolean,
        verticalSpeed: number,
        deltaMs: number
    ): void {
        const animationPose = this.formAnimationRuntime.tick({
            currentForm,
            grounded,
            hooks: presentationHooks,
            verticalSpeed,
            deltaMs
        });
        const anchoredVisualOffset = this.resolveAnchoredFormVisualOffset(
            currentForm,
            grounded,
            animationPose.scaleX,
            animationPose.scaleY,
            triangleShell,
            squareShell
        );
        this.ballVisual.setPosition(playerX + anchoredVisualOffset.x, playerY + anchoredVisualOffset.y);
        this.triangleVisual.setPosition(formAnchor.x + anchoredVisualOffset.x, formAnchor.y + anchoredVisualOffset.y);
        this.squareVisual.setPosition(playerX + anchoredVisualOffset.x, playerY + anchoredVisualOffset.y);
        this.applyFormAnimationPose(currentForm, triangleShell.orientationRad, squareShell.orientationRad, animationPose.scaleX, animationPose.scaleY);
        this.updateBallBoostVisualState(currentForm, ballBoostActive);
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached, squareShell.isTrailRegenerating);
        this.updateSquareContactVisual(playerX, playerY, currentForm, squareShell);
        this.renderSquareTrail(squareShell.trailSegments);
        this.renderSquareAttachJumpTether(playerX, playerY, currentForm, squareShell);
        this.updateMarkerVisual(currentForm, playerX, playerY, formAnchor, marker, triangleShell, triangleFlight);
    }

    private applyFormAnimationPose(
        currentForm: PlayerFormId,
        triangleBaseRotationRad: number,
        squareBaseRotationRad: number,
        scaleX: number = 1,
        scaleY: number = 1
    ): void {
        this.ballVisual.setScale(1, 1);
        this.triangleVisual.setScale(1, 1);
        this.squareVisual.setScale(1, 1);
        this.triangleVisual.setRotation(triangleBaseRotationRad);
        this.squareVisual.setRotation(squareBaseRotationRad);

        if (currentForm === 'triangle') {
            this.triangleVisual
                .setScale(scaleX, scaleY)
                .setRotation(triangleBaseRotationRad);
            return;
        }

        if (currentForm === 'square') {
            this.squareVisual
                .setScale(scaleX, scaleY)
                .setRotation(squareBaseRotationRad);
            return;
        }

        this.ballVisual.setScale(scaleX, scaleY);
    }

    private updateSquareContactVisual(
        playerX: number,
        playerY: number,
        currentForm: PlayerFormId,
        squareShell: PlayerSquareShellState
    ): void {
        if (!this.debugVisualsVisible || currentForm !== 'square' || !squareShell.hasContact) {
            this.squareContactMarker.setVisible(false);
            return;
        }

        const markerLength = (PLAYER_FORM_SQUARE_SIZE * 0.5) + 10;
        this.squareContactMarker.setVisible(true);
        this.squareContactMarker.setPosition(playerX, playerY);
        this.squareContactMarker.setTo(0, 0, squareShell.contactNormalX * markerLength, squareShell.contactNormalY * markerLength);
    }

    private updateSquareAttachVisualState(currentForm: PlayerFormId, isAttached: boolean, isTrailRegenerating: boolean): void {
        if (currentForm === 'square' && isTrailRegenerating) {
            this.squareVisual.setStrokeStyle(
                PLAYER_SQUARE_VISUAL_REGEN_STROKE_WIDTH,
                PLAYER_SQUARE_VISUAL_REGEN_STROKE_COLOR
            );
            return;
        }

        const hasAttachedState = currentForm === 'square' && isAttached;
        this.squareVisual.setStrokeStyle(
            2,
            hasAttachedState ? PLAYER_SQUARE_VISUAL_ATTACH_STROKE_COLOR : PLAYER_SQUARE_VISUAL_STROKE_COLOR
        );
    }

    private updateBallBoostVisualState(currentForm: PlayerFormId, ballBoostActive: boolean): void {
        const strokeWidth = currentForm === 'ball' && ballBoostActive
            ? PLAYER_BALL_VISUAL_BOOST_STROKE_WIDTH
            : PLAYER_BALL_VISUAL_STROKE_WIDTH;
        this.ballVisual.setStrokeStyle(strokeWidth, 0xffffff);
    }

    private updateMarkerVisual(
        currentForm: PlayerFormId,
        playerX: number,
        playerY: number,
        formAnchor: PlayerFormAnchor,
        marker: PlayerMarkerState,
        triangleShell: PlayerTriangleShellState,
        triangleFlight: PlayerTriangleFlightState
    ): void {
        const markerOffset = currentForm === 'triangle'
            ? rotateTriangleLocalOffset(marker.currentOffsetX, marker.currentOffsetY, triangleShell.orientationRad)
            : {
                x: marker.currentOffsetX,
                y: marker.currentOffsetY
            };
        const triangleMarkerBaseOffset = currentForm === 'triangle'
            ? resolveTriangleCentroidWorldOffset(triangleShell.orientationRad)
            : { x: 0, y: 0 };
        const baseX = currentForm === 'triangle' ? formAnchor.x + triangleMarkerBaseOffset.x : playerX;
        const baseY = currentForm === 'triangle' ? formAnchor.y + triangleMarkerBaseOffset.y : playerY;
        const markerIntent = resolveMarkerIntent(markerOffset.x, markerOffset.y);

        this.markerVisual.setPosition(baseX + markerOffset.x, baseY + markerOffset.y);
        this.markerVisual.setAlpha(markerIntent.active || triangleFlight.isActive ? PLAYER_MARKER_ACTIVE_ALPHA : PLAYER_MARKER_IDLE_ALPHA);
    }

    private resolveAnchoredFormVisualOffset(
        currentForm: PlayerFormId,
        grounded: boolean,
        scaleX: number,
        scaleY: number,
        triangleShell: PlayerTriangleShellState,
        squareShell: PlayerSquareShellState
    ): { x: number; y: number } {
        if (!grounded) {
            return { x: 0, y: 0 };
        }

        if (currentForm === 'ball') {
            return {
                x: 0,
                y: PLAYER_PLACEHOLDER_RADIUS * (1 - scaleY)
            };
        }

        if (currentForm === 'square') {
            if (!squareShell.hasContact) {
                return { x: 0, y: 0 };
            }

            const halfSize = PLAYER_FORM_SQUARE_SIZE * 0.5;
            const supportAnchorWorldX = -squareShell.contactNormalX * halfSize;
            const supportAnchorWorldY = -squareShell.contactNormalY * halfSize;
            const supportAnchorLocal = rotateToLocalSpace(
                supportAnchorWorldX,
                supportAnchorWorldY,
                squareShell.orientationRad
            );

            return resolveScaledLocalAnchorWorldOffset(
                supportAnchorLocal.x,
                supportAnchorLocal.y,
                squareShell.orientationRad,
                scaleX,
                scaleY
            );
        }

        const triangleSupportAnchorLocal = resolveTriangleSupportAnchorLocal(triangleShell.orientationRad);
        return resolveScaledLocalAnchorWorldOffset(
            triangleSupportAnchorLocal.x,
            triangleSupportAnchorLocal.y,
            triangleShell.orientationRad,
            scaleX,
            scaleY
        );
    }

    private renderSquareTrail(segments: PlayerSquareTrailSegment[]): void {
        this.squareTrailGraphics.clear();
        if (segments.length === 0) {
            return;
        }

        segments.forEach((segment) => {
            const worldLine = resolveSquareTrailSegmentWorldLine(segment);
            const clippedWorldLine = segment.isDetached
                ? worldLine
                : this.clipTrailLineToSupportBounds(segment, worldLine);
            if (clippedWorldLine === null) {
                return;
            }
            const segmentAlpha = PhaserMath.Clamp(
                PLAYER_SQUARE_TRAIL_STROKE_ALPHA * (segment.isDetached ? segment.detachedAlpha : 1),
                0,
                1
            );
            this.squareTrailGraphics.lineStyle(
                PLAYER_SQUARE_TRAIL_STROKE_WIDTH,
                PLAYER_SQUARE_TRAIL_STROKE_COLOR,
                segmentAlpha
            );
            this.squareTrailGraphics.beginPath();
            this.squareTrailGraphics.moveTo(clippedWorldLine.startX, clippedWorldLine.startY);
            this.squareTrailGraphics.lineTo(clippedWorldLine.endX, clippedWorldLine.endY);
            this.squareTrailGraphics.strokePath();
        });
    }

    private clipTrailLineToSupportBounds(
        segment: {
            supportBody: PlayerSquareTrailSegment['supportBody'];
            normalX: -1 | 0 | 1;
            normalY: -1 | 0 | 1;
        },
        worldLine: { startX: number; startY: number; endX: number; endY: number }
    ): { startX: number; startY: number; endX: number; endY: number } | null {
        const supportBody = segment.supportBody;
        if (supportBody === null) {
            return worldLine;
        }

        const bodyMinX = supportBody.x;
        const bodyMaxX = supportBody.x + supportBody.width;
        const bodyMinY = supportBody.y;
        const bodyMaxY = supportBody.y + supportBody.height;

        if (segment.normalX === 0) {
            const clampedStartX = PhaserMath.Clamp(worldLine.startX, bodyMinX, bodyMaxX);
            const clampedEndX = PhaserMath.Clamp(worldLine.endX, bodyMinX, bodyMaxX);
            if (Math.abs(clampedEndX - clampedStartX) <= 0.001) {
                return null;
            }

            return {
                startX: clampedStartX,
                startY: worldLine.startY,
                endX: clampedEndX,
                endY: worldLine.endY
            };
        }

        const clampedStartY = PhaserMath.Clamp(worldLine.startY, bodyMinY, bodyMaxY);
        const clampedEndY = PhaserMath.Clamp(worldLine.endY, bodyMinY, bodyMaxY);
        if (Math.abs(clampedEndY - clampedStartY) <= 0.001) {
            return null;
        }

        return {
            startX: worldLine.startX,
            startY: clampedStartY,
            endX: worldLine.endX,
            endY: clampedEndY
        };
    }

    private renderSquareAttachJumpTether(
        playerX: number,
        playerY: number,
        currentForm: PlayerFormId,
        squareShell: PlayerSquareShellState
    ): void {
        this.squareAttachJumpTetherGraphics.clear();
        if (currentForm !== 'square' || squareShell.attachJumpState.phase === 'inactive') {
            return;
        }

        const anchorWorld = squareSupportLocalToWorld(
            squareShell.attachJumpState.anchorLocalX,
            squareShell.attachJumpState.anchorLocalY,
            {
                body: squareShell.attachJumpState.anchorSupportBody,
                originX: squareShell.attachJumpState.anchorSupportOriginX,
                originY: squareShell.attachJumpState.anchorSupportOriginY
            }
        );
        const tetherDx = playerX - anchorWorld.x;
        const tetherDy = playerY - anchorWorld.y;
        const tetherLength = Math.hypot(tetherDx, tetherDy);
        const tensionAlpha = PhaserMath.Clamp(
            tetherLength / Math.max(1, PLAYER_SQUARE_ATTACH_JUMP_TETHER_STRETCH_PX),
            0.45,
            1
        );

        this.squareAttachJumpTetherGraphics.lineStyle(4, 0x42a5f5, tensionAlpha);
        this.squareAttachJumpTetherGraphics.beginPath();
        this.squareAttachJumpTetherGraphics.moveTo(anchorWorld.x, anchorWorld.y);
        this.squareAttachJumpTetherGraphics.lineTo(playerX, playerY);
        this.squareAttachJumpTetherGraphics.strokePath();
        this.squareAttachJumpTetherGraphics.fillStyle(0x90caf9, tensionAlpha);
        this.squareAttachJumpTetherGraphics.fillCircle(anchorWorld.x, anchorWorld.y, 4);
    }
}

const resolveTriangleCentroidWorldOffset = (orientationRad: number): { x: number; y: number } => {
    const centroidOffset = resolveTriangleCentroidOffset();
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);

    return {
        x: (centroidOffset.x * cos) - (centroidOffset.y * sin),
        y: (centroidOffset.x * sin) + (centroidOffset.y * cos)
    };
};

const rotateTriangleLocalOffset = (
    offsetX: number,
    offsetY: number,
    orientationRad: number
): { x: number; y: number } => {
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);

    return {
        x: (offsetX * cos) - (offsetY * sin),
        y: (offsetX * sin) + (offsetY * cos)
    };
};

const resolveScaledLocalAnchorWorldOffset = (
    anchorLocalX: number,
    anchorLocalY: number,
    orientationRad: number,
    scaleX: number,
    scaleY: number
): { x: number; y: number } => {
    const offsetLocalX = (1 - scaleX) * anchorLocalX;
    const offsetLocalY = (1 - scaleY) * anchorLocalY;
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);

    return {
        x: (offsetLocalX * cos) - (offsetLocalY * sin),
        y: (offsetLocalX * sin) + (offsetLocalY * cos)
    };
};

const rotateToLocalSpace = (
    worldX: number,
    worldY: number,
    orientationRad: number
): { x: number; y: number } => {
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);

    return {
        x: (worldX * cos) + (worldY * sin),
        y: (-worldX * sin) + (worldY * cos)
    };
};

const resolveTriangleSupportAnchorLocal = (orientationRad: number): { x: number; y: number } => {
    const localVertices = resolveTriangleLocalVertices();
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);
    let bestEdgeStartIndex = 0;
    let bestMidpointY = -Infinity;

    for (let edgeStartIndex = 0; edgeStartIndex < localVertices.length; edgeStartIndex += 1) {
        const start = localVertices[edgeStartIndex];
        const end = localVertices[(edgeStartIndex + 1) % localVertices.length];
        const startRotatedY = (start.x * sin) + (start.y * cos);
        const endRotatedY = (end.x * sin) + (end.y * cos);
        const midpointY = (startRotatedY + endRotatedY) * 0.5;

        if (midpointY > bestMidpointY) {
            bestMidpointY = midpointY;
            bestEdgeStartIndex = edgeStartIndex;
        }
    }

    const edgeStart = localVertices[bestEdgeStartIndex];
    const edgeEnd = localVertices[(bestEdgeStartIndex + 1) % localVertices.length];
    return {
        x: (edgeStart.x + edgeEnd.x) * 0.5,
        y: (edgeStart.y + edgeEnd.y) * 0.5
    };
};
