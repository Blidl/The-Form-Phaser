import type { Physics } from 'phaser';
import type { PlayerFormId, PlayerTriangleShellState, TriangleCornerIndex } from '../player_types';

export type OrthogonalDirection = -1 | 0 | 1;

export interface PlayerAnchorOffset {
    x: number;
    y: number;
}

export interface PlayerFormAnchor {
    x: number;
    y: number;
}

export interface PlayerCircleBodyConfig {
    kind: 'circle';
    radius: number;
    centerOffset: PlayerAnchorOffset;
}

export interface PlayerBoxBodyConfig {
    kind: 'box';
    width: number;
    height: number;
    centerOffset: PlayerAnchorOffset;
}

export type PlayerLocomotionBodyConfig = PlayerCircleBodyConfig | PlayerBoxBodyConfig;

export interface HazardShapePoint {
    x: number;
    y: number;
}

export interface PlayerBallHazardHitShape {
    kind: 'circle';
    centerX: number;
    centerY: number;
    radius: number;
}

export interface PlayerSquareHazardHitShape {
    kind: 'box';
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

export interface PlayerTriangleHazardHitShape {
    kind: 'triangle';
    anchorX: number;
    anchorY: number;
    points: [HazardShapePoint, HazardShapePoint, HazardShapePoint];
}

export type PlayerHazardHitShape =
    | PlayerBallHazardHitShape
    | PlayerSquareHazardHitShape
    | PlayerTriangleHazardHitShape;

export interface PlayerRectSnapshot {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

export interface PlayerAxisContactSnapshot {
    hasDownContact: boolean;
    hasUpContact: boolean;
    hasLeftContact: boolean;
    hasRightContact: boolean;
}

export interface PlayerSquareContactResolution {
    normalX: OrthogonalDirection;
    normalY: OrthogonalDirection;
    hasContact: boolean;
}

export interface PlayerSquareSupportProbe {
    x: number;
    y: number;
    width: number;
    height: number;
    tangentValue: number;
    useXAxisAsTangent: boolean;
}

export interface PlayerSquareSupportInterval<TBody> {
    min: number;
    max: number;
    ownerBody: TBody;
}

export interface PlayerSquareTrailSupportOwner {
    body: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    originX: number;
    originY: number;
}

export interface PlayerSquareTrailSurfacePoint {
    x: number;
    y: number;
    supportOwner: PlayerSquareTrailSupportOwner;
}

export interface PlayerSquareAttachPoseQuery {
    centerX: number;
    centerY: number;
    snappedCenterX: number;
    snappedCenterY: number;
    rect: PlayerRectSnapshot;
    supportInterval: PlayerSquareSupportInterval<Physics.Arcade.Body | Physics.Arcade.StaticBody> | null;
    surfacePoint: PlayerSquareTrailSurfacePoint;
    isPoseClear: boolean;
}

export interface PlayerTriangleWorldPoint {
    x: number;
    y: number;
}

export interface ResolvePlayerGeometryInput {
    form: PlayerFormId;
    playerX: number;
    playerY: number;
    triangleShell: PlayerTriangleShellState;
}

export interface ResolveTriangleWorldPointInput {
    anchorX: number;
    anchorY: number;
    orientationRad: number;
    cornerIndex: TriangleCornerIndex;
}
