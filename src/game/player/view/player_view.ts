import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import {
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_SQUARE_EDGE_DOWN_POSE_RAD,
    PLAYER_SQUARE_TRAIL_STROKE_ALPHA,
    PLAYER_SQUARE_TRAIL_STROKE_COLOR,
    PLAYER_SQUARE_TRAIL_STROKE_WIDTH,
    PLAYER_SQUARE_VISUAL_ATTACH_STROKE_COLOR,
    PLAYER_SQUARE_VISUAL_STROKE_COLOR,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_ALPHA,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_SCALE,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_ALPHA,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_SCALE,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_OUTWARD_OFFSET,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_RADIUS
} from '../player_constants';
import type { PlayerInputSnapshot } from '../player_input';
import { resolveSquareTrailSegmentWorldLine } from '../player_square_trail';
import {
    resolveTriangleDashLeadingCornerPreview
} from '../player_triangle_dash';
import { resolveTriangleLeadingCornerMarkerOffset } from '../player_triangle_leading_corner_visual';
import type {
    PlayerFormId,
    PlayerSquareTrailSegment,
    PlayerSquareShellState,
    PlayerTriangleDashState,
    PlayerTriangleShellState
} from '../player_types';
import type { PlayerFormAnchor } from '../player_form_collision_shapes';

export class PlayerView {
    private readonly ballVisual: GameObjects.Arc;
    private readonly triangleVisual: GameObjects.Triangle;
    private readonly squareVisual: GameObjects.Rectangle;
    private readonly squareContactMarker: GameObjects.Line;
    private readonly squareTrailGraphics: GameObjects.Graphics;
    private readonly triangleLeadingCornerMarker: GameObjects.Arc;

    public constructor(scene: Scene, x: number, y: number) {
        this.ballVisual = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0x00e5ff)
            .setStrokeStyle(2, 0xffffff)
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
        this.squareContactMarker = scene.add.line(x, y, 0, 0, 0, 12, 0xffffff)
            .setLineWidth(2, 2)
            .setDepth(4501)
            .setVisible(false)
            .setOrigin(0.5, 0.5);
        this.squareTrailGraphics = scene.add.graphics().setDepth(4400);
        this.triangleLeadingCornerMarker = scene.add.circle(x, y, PLAYER_TRIANGLE_LEADING_CORNER_MARKER_RADIUS, 0xffffff)
            .setStrokeStyle(2, 0xffb74d)
            .setDepth(4501)
            .setVisible(false)
            .setAlpha(PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_ALPHA);
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.triangleVisual;
    }

    public hideTransientMarkers(): void {
        this.triangleLeadingCornerMarker.setVisible(false);
        this.squareContactMarker.setVisible(false);
    }

    public applyCurrentFormVisibility(currentForm: PlayerFormId, squareShell: PlayerSquareShellState): void {
        this.ballVisual.setVisible(currentForm === 'ball');
        this.triangleVisual.setVisible(currentForm === 'triangle');
        this.squareVisual.setVisible(currentForm === 'square');
        this.squareContactMarker.setVisible(currentForm === 'square' && squareShell.hasContact);
        this.triangleLeadingCornerMarker.setVisible(currentForm === 'triangle');
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached);
    }

    public syncVisualPosition(
        playerX: number,
        playerY: number,
        formAnchor: PlayerFormAnchor,
        currentForm: PlayerFormId,
        triangleShell: PlayerTriangleShellState,
        squareShell: PlayerSquareShellState
    ): void {
        this.ballVisual.setPosition(playerX, playerY);
        this.triangleVisual.setPosition(formAnchor.x, formAnchor.y);
        this.triangleVisual.setRotation(triangleShell.orientationRad);
        this.squareVisual.setPosition(playerX, playerY);
        this.squareVisual.setRotation(squareShell.orientationRad);
        this.updateSquareAttachVisualState(currentForm, squareShell.isAttached);
        this.updateSquareContactVisual(playerX, playerY, currentForm, squareShell);
        this.renderSquareTrail(squareShell.trailSegments);
    }

    public updateTriangleLeadingCornerMarker(
        currentForm: PlayerFormId,
        playerX: number,
        playerY: number,
        triangleShell: PlayerTriangleShellState,
        triangleDash: PlayerTriangleDashState,
        grounded: boolean,
        input: PlayerInputSnapshot
    ): void {
        if (currentForm !== 'triangle') {
            this.triangleLeadingCornerMarker.setVisible(false);
            return;
        }

        const dashPreview = triangleDash.isActive
            ? {
                leadingCornerIndex: triangleDash.leadingCornerIndex,
                lockedOrientationRad: triangleDash.lockedOrientationRad
            }
            : resolveTriangleDashLeadingCornerPreview(
                triangleDash,
                triangleShell,
                grounded
            );
        const markerOffset = resolveTriangleLeadingCornerMarkerOffset(
            dashPreview.leadingCornerIndex,
            dashPreview.lockedOrientationRad,
            PLAYER_TRIANGLE_LEADING_CORNER_MARKER_OUTWARD_OFFSET
        );
        const markerBaseY = playerY + triangleShell.visualOffsetY;
        const isDashRelevant = input.actionHeld || input.actionPressed || triangleDash.isActive;

        this.triangleLeadingCornerMarker.setVisible(true);
        this.triangleLeadingCornerMarker.setPosition(
            playerX + markerOffset.x,
            markerBaseY + markerOffset.y
        );
        this.triangleLeadingCornerMarker.setAlpha(
            isDashRelevant
                ? PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_ALPHA
                : PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_ALPHA
        );
        this.triangleLeadingCornerMarker.setScale(
            isDashRelevant
                ? PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_SCALE
                : PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_SCALE
        );
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
