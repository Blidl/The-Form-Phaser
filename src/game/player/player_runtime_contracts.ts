import type { GameObjects, Physics } from 'phaser';
import type { PlayerFormAnchor, PlayerHazardHitShape } from './geometry/player_geometry_types';
import type { PlayerFormId } from './player_types';
import type {
    TestWorldActorContactMode,
    TestWorldActorContactShapeSnapshot,
    TestWorldActorWorldContactSnapshot
} from '../world/runtime/test_world_actor_contact_shapes';

export interface PlayerWorldActor {
    currentForm: PlayerFormId;
    arcadeBodyObject: GameObjects.Arc;
    contactMode: TestWorldActorContactMode;
    contactShapeSnapshot: TestWorldActorContactShapeSnapshot;
    worldContactSnapshot: TestWorldActorWorldContactSnapshot;
    applyActorContactPush: (deltaX: number, deltaY: number) => { appliedDeltaX: number; appliedDeltaY: number };
    squareAttachJumpPullBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    isCurrentlyGrounded: boolean;
    isTriangleFlightActive: boolean;
    isTriangleBreakWallActive: boolean;
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
    contactMode: TestWorldActorContactMode;
    triangleVisualObject: GameObjects.Triangle;
    trianglePhysicsPoints: ReadonlyArray<{ x: number; y: number }> | null;
    hazardHitShape: PlayerHazardHitShape;
    formAnchor: PlayerFormAnchor;
    squareDebugView: PlayerSquareDebugView | null;
}
