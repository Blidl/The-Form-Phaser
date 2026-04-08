import type { Physics } from 'phaser';
import type { PlayerMarkerState } from './marker/player_marker_types';

export type PlayerFormId = 'ball' | 'triangle' | 'square';
export type TriangleCornerIndex = 0 | 1 | 2;
export type TriangleEdgeIndex = 0 | 1 | 2;

export interface PlayerTriangleShellState {
    orientationRad: number;
    groundedOrientationRad: number;
    visualOffsetY: number;
    airborneSpinDirection: -1 | 1;
    airborneAngularVelocityRadPerSec: number;
}

export interface PlayerTriangleCollisionState {
    hasGroundContact: boolean;
    hasCeilingContact: boolean;
    hasLeftWallContact: boolean;
    hasRightWallContact: boolean;
    groundSupportEdgeIndex: TriangleEdgeIndex | null;
    groundSupportBody: MatterJS.BodyType | null;
}

export interface PlayerSquareShellState {
    orientationRad: number;
    groundedOrientationRad: number;
    contactNormalX: -1 | 0 | 1;
    contactNormalY: -1 | 0 | 1;
    hasContact: boolean;
    isAttached: boolean;
    attachNormalX: -1 | 0 | 1;
    attachNormalY: -1 | 0 | 1;
    attachSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    attachContactGraceMs: number;
    trailSegments: PlayerSquareTrailSegment[];
    trailResourceCurrent: number;
    trailResourceMax: number;
    isOnTrail: boolean;
    isTrailRegenerating: boolean;
    isTrailLockedAtBoundary: boolean;
    trailAnchorActive: boolean;
    trailAnchorX: number;
    trailAnchorY: number;
    trailAnchorLocalX: number;
    trailAnchorLocalY: number;
    trailAnchorSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    trailAnchorSupportOriginX: number;
    trailAnchorSupportOriginY: number;
    trailAnchorNormalX: -1 | 0 | 1;
    trailAnchorNormalY: -1 | 0 | 1;
    trailLatchActive: boolean;
    trailLatchLocalX: number;
    trailLatchLocalY: number;
    trailLatchSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    trailLatchSupportOriginX: number;
    trailLatchSupportOriginY: number;
    trailLatchNormalX: -1 | 0 | 1;
    trailLatchNormalY: -1 | 0 | 1;
    attachJumpState: PlayerSquareAttachJumpState;
    rolloverState: PlayerSquareRolloverState;
}

export type PlayerSquareAttachJumpPhase = 'inactive' | 'outbound' | 'return';

export interface PlayerSquareAttachJumpState {
    phase: PlayerSquareAttachJumpPhase;
    elapsedMs: number;
    anchorLocalX: number;
    anchorLocalY: number;
    anchorSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    anchorSupportOriginX: number;
    anchorSupportOriginY: number;
    normalX: -1 | 0 | 1;
    normalY: -1 | 0 | 1;
    launchCenterX: number;
    launchCenterY: number;
    peakCenterX: number;
    peakCenterY: number;
    orientationRad: number;
}

export type PlayerSquareRolloverPhase = 'inactive' | 'forward' | 'rollback';

export interface PlayerSquareRolloverState {
    phase: PlayerSquareRolloverPhase;
    elapsedMs: number;
    pivotLocalX: number;
    pivotLocalY: number;
    pivotSupportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    pivotSupportOriginX: number;
    pivotSupportOriginY: number;
    deltaAngleRad: number;
    startOrientationRad: number;
    endOrientationRad: number;
    pivotSquareLocalX: number;
    pivotSquareLocalY: number;
    sourceNormalX: -1 | 0 | 1;
    sourceNormalY: -1 | 0 | 1;
    targetNormalX: -1 | 0 | 1;
    targetNormalY: -1 | 0 | 1;
    targetPoseValid: boolean;
}

export interface PlayerSquareTrailSegment {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startLocalX: number;
    startLocalY: number;
    endLocalX: number;
    endLocalY: number;
    supportOriginX: number;
    supportOriginY: number;
    supportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    normalX: -1 | 0 | 1;
    normalY: -1 | 0 | 1;
    isDetached: boolean;
    detachedVelocityY: number;
    detachedDissolveProgress: number;
    detachedAlpha: number;
    detachedRefundRemaining: number;
}

export interface PlayerSquareTrailSupportOwner {
    body: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    originX: number;
    originY: number;
}

export interface PlayerTriangleFlightState {
    isActive: boolean;
    directionX: number;
    directionY: number;
    forceBiasX: -1 | 1;
    forcePointIntentX: number;
    forcePointIntentY: number;
    selectedLeadingCornerIndex: TriangleCornerIndex;
    leadingCornerIndex: TriangleCornerIndex;
    activeSectionRemainingDistancePx: number;
    spentSectionCount: number;
    maxSectionCount: number;
}

export interface PlayerShellState {
    currentForm: PlayerFormId;
    marker: PlayerMarkerState;
    triangleShell: PlayerTriangleShellState;
    triangleCollision: PlayerTriangleCollisionState;
    squareShell: PlayerSquareShellState;
    triangleFlight: PlayerTriangleFlightState;
}
