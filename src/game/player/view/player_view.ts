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
    PLAYER_SQUARE_VISUAL_ATTACH_STROKE_COLOR,
    PLAYER_SQUARE_VISUAL_STROKE_COLOR,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH
} from '../player_constants';
import { resolveMarkerIntent } from '../marker/player_marker_math';
import type { PlayerMarkerState } from '../marker/player_marker_types';
import { resolveTriangleCentroidOffset } from '../geometry/player_geometry_queries';
import { resolveSquareTrailSegmentWorldLine } from '../player_square_trail';
import { resolveTriangleDashLeadingCornerPreview } from '../player_triangle_dash';
import type {
    PlayerFormId,
    PlayerSquareTrailSegment,
    PlayerSquareShellState,
    PlayerTriangleDashState,
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
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.triangleVisual;
    }

    public hideTransientMarkers(): void {
        this.squareContactMarker.setVisible(false);
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
        this.squareContactMarker.setVisible(currentForm === 'square' && squareShell.hasContact);
        this.updateBallBoostVisualState(currentForm, ballBoostActive);
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached);
    }

    public syncVisualPosition(
        playerX: number,
        playerY: number,
        formAnchor: PlayerFormAnchor,
        currentForm: PlayerFormId,
        marker: PlayerMarkerState,
        triangleShell: PlayerTriangleShellState,
        squareShell: PlayerSquareShellState,
        triangleDash: PlayerTriangleDashState,
        ballBoostActive: boolean
    ): void {
        this.ballVisual.setPosition(playerX, playerY);
        this.triangleVisual.setPosition(formAnchor.x, formAnchor.y);
        this.triangleVisual.setRotation(triangleShell.orientationRad);
        this.squareVisual.setPosition(playerX, playerY);
        this.squareVisual.setRotation(squareShell.orientationRad);
        this.updateBallBoostVisualState(currentForm, ballBoostActive);
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached);
        this.updateSquareContactVisual(playerX, playerY, currentForm, squareShell);
        this.renderSquareTrail(squareShell.trailSegments);
        this.updateMarkerVisual(currentForm, playerX, playerY, formAnchor, marker, triangleShell, triangleDash);
    }

    private updateSquareContactVisual(
        playerX: number,
        playerY: number,
        currentForm: PlayerFormId,
        squareShell: PlayerSquareShellState
    ): void {
        if (currentForm !== 'square' || !squareShell.hasContact) {
            this.squareContactMarker.setVisible(false);
            return;
        }

        const markerLength = (PLAYER_FORM_SQUARE_SIZE * 0.5) + 10;
        this.squareContactMarker.setVisible(true);
        this.squareContactMarker.setPosition(playerX, playerY);
        this.squareContactMarker.setTo(0, 0, squareShell.contactNormalX * markerLength, squareShell.contactNormalY * markerLength);
    }

    private updateSquareAttachVisualState(currentForm: PlayerFormId, isAttached: boolean): void {
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
        triangleDash: PlayerTriangleDashState
    ): void {
        const markerOffset = triangleDash.isActive && currentForm === 'triangle'
            ? this.resolveTriangleDashMarkerOffset(triangleShell, triangleDash)
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
        this.markerVisual.setAlpha(markerIntent.active || triangleDash.isActive ? PLAYER_MARKER_ACTIVE_ALPHA : PLAYER_MARKER_IDLE_ALPHA);
    }

    private resolveTriangleDashMarkerOffset(
        triangleShell: PlayerTriangleShellState,
        triangleDash: PlayerTriangleDashState
    ): { x: number; y: number } {
        const grounded = false;
        const dashPreview = resolveTriangleDashLeadingCornerPreview(triangleDash, triangleShell, grounded);
        const cornerOffset = resolveTriangleCornerOffset(dashPreview.leadingCornerIndex, dashPreview.lockedOrientationRad);
        return {
            x: cornerOffset.x * 0.45,
            y: cornerOffset.y * 0.45
        };
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

const resolveTriangleCornerOffset = (
    cornerIndex: 0 | 1 | 2,
    orientationRad: number
): { x: number; y: number } => {
    const halfWidth = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
    const halfHeight = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
    const localCorners = [
        { x: -halfWidth, y: halfHeight },
        { x: 0, y: -halfHeight },
        { x: halfWidth, y: halfHeight }
    ] as const;
    const centroidOffset = resolveTriangleCentroidOffset();
    const localCorner = localCorners[cornerIndex] ?? localCorners[1];
    const centroidLocalCorner = {
        x: localCorner.x - centroidOffset.x,
        y: localCorner.y - centroidOffset.y
    };
    const sin = Math.sin(orientationRad);
    const cos = Math.cos(orientationRad);

    return {
        x: (centroidLocalCorner.x * cos) - (centroidLocalCorner.y * sin),
        y: (centroidLocalCorner.x * sin) + (centroidLocalCorner.y * cos)
    };
};
