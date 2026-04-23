import type { GameObjects, Physics } from 'phaser';
import type { PlayerInputSnapshot } from './player_input';
import type { PlayerView } from './view/player_view';
import type { BallReboundRuntimeState } from './player_ball_rebound_runtime';
import type { PlayerFormId, PlayerShellState } from './player_types';
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
    presentationPrevGrounded: boolean;
    presentationPrevVerticalSpeed: number;
    presentationApexEmitted: boolean;
    presentationFallEmitted: boolean;
    presentationPrevTriangleFlightActive: boolean;
    presentationPrevSquareAttached: boolean;
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
    notifyFormSwitchIn: (nextForm: PlayerFormId) => void;
    resetVisualPose: () => void;
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
    handleFormSwitch: (deltaMs: number) => void;
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
    isSquareAttachPathClear: (
        fromCenterX: number,
        fromCenterY: number,
        toCenterX: number,
        toCenterY: number,
        supportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
    ) => boolean;
    isSquareRolloverPoseClear: (
        centerX: number,
        centerY: number,
        orientationRad: number,
        ignoreBodyA: Physics.Arcade.Body | Physics.Arcade.StaticBody | null,
        ignoreBodyB: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
    ) => boolean;
    isCurrentlyGrounded: () => boolean;
    notifyJumpIntent: () => void;
    notifyJumpCommit: (impulseX: number, impulseY: number) => void;
    notifyApexEnter: () => void;
    notifyFallEnter: () => void;
    notifyLandImpact: (impactSpeed: number) => void;
    notifyBallReboundLaunch: (impulseX: number, impulseY: number) => void;
    notifyBallBoostGroundStart: (impulseX: number, impulseY: number) => void;
    notifyBallBoostGroundSustain: (dirX: number, dirY: number) => void;
    notifyTriangleFlightStart: () => void;
    notifyTriangleFlightEnd: () => void;
    notifySquareAttachEnter: () => void;
    notifySquareAttachExit: () => void;
    notifySquareAttachJumpCommit: (impulseX: number, impulseY: number) => void;
}
