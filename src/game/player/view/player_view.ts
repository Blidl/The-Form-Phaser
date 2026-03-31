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
import { resolveTriangleCentroidOffset } from '../geometry/player_geometry_queries';
import { squareSupportLocalToWorld } from '../player_square_support_space';
import { resolveSquareTrailSegmentWorldLine } from '../player_square_trail';
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
        this.squareTrailGraphics = scene.add.graphics().setDepth(4400);
        this.squareAttachJumpTetherGraphics = scene.add.graphics().setDepth(4499);
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.triangleVisual;
    }

    public hideTransientMarkers(): void {
        this.squareContactMarker.setVisible(false);
        this.squareAttachJumpTetherGraphics.clear();
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
        ballBoostActive: boolean
    ): void {
        this.ballVisual.setPosition(playerX, playerY);
        this.triangleVisual.setPosition(formAnchor.x, formAnchor.y);
        this.triangleVisual.setRotation(triangleShell.orientationRad);
        this.squareVisual.setPosition(playerX, playerY);
        this.squareVisual.setRotation(squareShell.orientationRad);
        this.updateBallBoostVisualState(currentForm, ballBoostActive);
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached, squareShell.isTrailRegenerating);
        this.updateSquareContactVisual(playerX, playerY, currentForm, squareShell);
        this.renderSquareTrail(squareShell.trailSegments);
        this.renderSquareAttachJumpTether(playerX, playerY, currentForm, squareShell);
        this.updateMarkerVisual(currentForm, playerX, playerY, formAnchor, marker, triangleShell, triangleFlight);
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
