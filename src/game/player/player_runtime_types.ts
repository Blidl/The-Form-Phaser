import type { GameObjects, Physics } from 'phaser';
import type { PlayerInputSnapshot } from './player_input';
import type { PlayerView } from './view/player_view';
import type { BallReboundRuntimeState } from './player_ball_rebound_runtime';
import type { PlayerShellState } from './player_types';
import type { PlayerTimers } from './player_timers';
import type { PlayerSquareAttachPoseQuery, PlayerSquareTrailSurfacePoint } from './geometry/player_geometry_types';

export interface PlayerMutableRuntimeState {
    jumpCutConsumed: boolean;
    boostCooldownMs: number;
    boostImpulseMs: number;
    boostActive: boolean;
    boostModeActive: boolean;
    pendingBoostRequest: boolean;
    wasGrounded: boolean;
    lastMoveDirection: -1 | 1;
    reboundWindowMs: number;
    reboundJumpVelocity: number;
    lastAirborneDownwardSpeed: number;
    frozenForRespawn: boolean;
    airborneWindDriftX: number;
}

export interface PlayerLifecycleRuntimeContext {
    state: PlayerShellState;
    timers: PlayerTimers;
    physicsBody: Physics.Arcade.Body;
    view: PlayerView;
    ballReboundRuntime: BallReboundRuntimeState;
    mutable: PlayerMutableRuntimeState;
    applyCurrentFormCollisionBody: () => void;
    applyCurrentFormVisual: () => void;
    syncVisualPosition: () => void;
}

export interface PlayerTickRuntimeContext {
    state: PlayerShellState;
    timers: PlayerTimers;
    physicsBody: Physics.Arcade.Body;
    physicsSprite: GameObjects.Arc;
    ballReboundRuntime: BallReboundRuntimeState;
    input: PlayerInputSnapshot;
    deltaMs: number;
    externalHorizontalInfluenceX: number;
    mutable: PlayerMutableRuntimeState;
    groundedDragX: number;
    handleFormSwitch: () => void;
    refreshTrianglePhysicsState: () => void;
    commitTrianglePhysicsState: (deltaSec: number) => void;
    getTransformLockMs: () => number;
    resolveSquareTrailSurfacePoint: (normalX: -1 | 0 | 1, normalY: -1 | 0 | 1) => PlayerSquareTrailSurfacePoint;
    querySquareAttachPose: (
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ) => PlayerSquareAttachPoseQuery;
    isCurrentlyGrounded: () => boolean;
}
