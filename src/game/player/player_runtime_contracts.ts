import type { GameObjects } from 'phaser';
import type { PlayerFormAnchor, PlayerHazardHitShape } from './geometry/player_geometry_types';
import type { PlayerFormId } from './player_types';

export interface PlayerWorldActor {
    currentForm: PlayerFormId;
    arcadeBodyObject: GameObjects.Arc;
    hazardHitShape: PlayerHazardHitShape;
    refillTriangleFlightResource: () => void;
    freezeForRespawn: () => void;
    respawnAt: (x: number, y: number) => void;
}

export interface PlayerHudModel {
    currentForm: PlayerFormId;
    squareTrailResourceCurrent: number;
    squareTrailResourceMax: number;
    squareTrailResourceRatio: number;
    triangleFlightResourceCurrent: number;
    triangleFlightResourceMax: number;
    triangleFlightResourceRatio: number;
}

export type PlayerSquareDebugZoneId = 'TL' | 'TR' | 'BL' | 'BR';

export interface PlayerSquareDebugView {
    orientationRad: number;
    isAttached: boolean;
    attachNormalX: -1 | 0 | 1;
    attachNormalY: -1 | 0 | 1;
    attachedZoneIds: readonly PlayerSquareDebugZoneId[];
    danglingZoneIds: readonly PlayerSquareDebugZoneId[];
    rolloverPivotWorld: { x: number; y: number } | null;
}

export interface PlayerDebugModel {
    currentForm: PlayerFormId;
    arcadeBodyObject: GameObjects.Arc;
    triangleVisualObject: GameObjects.Triangle;
    trianglePhysicsPoints: ReadonlyArray<{ x: number; y: number }> | null;
    hazardHitShape: PlayerHazardHitShape;
    formAnchor: PlayerFormAnchor;
    squareDebugView: PlayerSquareDebugView | null;
}
