import { GameObjects, Math as PhaserMath, Physics, Scene } from 'phaser';
import {
    PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY,
    PLAYER_BALL_BOOST_SPEED,
    PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED,
    PLAYER_GROUNDED_DRAG_X,
    PLAYER_MAX_FORM_MOVE_SPEED,
    PLAYER_GRAVITY_Y,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_SQUARE_ROLLOVER_SURFACE_VALIDATION_RANGE_PX,
    PLAYER_START_FORM
} from './player_constants';
import { type PlayerInputSnapshot } from './player_input';
import { createPlayerMarkerState } from './marker/player_marker_runtime';
import {
    createPlayerTimers,
    type PlayerTimers
} from './player_timers';
import {
    createTriangleShellState,
} from './player_triangle_shell';
import {
    createSquareShellState
} from './player_square_shell';
import {
    createTriangleFlightState,
    refillTriangleFlightResource,
    resolveTriangleFlightResource
} from './player_triangle_flight';
import type {
    PlayerFormId,
    PlayerShellState
} from './player_types';
import {
    createPlayerRectSnapshot,
    resolveSquarePoseClear,
    resolvePlayerHazardHitShape,
    resolvePlayerLocomotionBodyConfig,
    resolvePlayerFormAnchor,
    resolveSquareSupportIntervalFromKnownBody,
    resolveSquareSupportIntervalFromOverlap,
    resolveSquareSupportProbe,
    resolveSquareTrailSurfacePoint
} from './geometry/player_geometry_queries';
import { squareSupportLocalToWorld } from './player_square_support_space';
import {
    createTriangleCollisionState,
    createTriangleMatterRuntime,
    destroyTriangleMatterRuntime,
    primeTriangleMatterKinematicState,
    stepTriangleMatterKinematicRuntime,
    syncTriangleArcadeBodyMode,
    syncTriangleMatterMode,
    type PlayerTriangleMatterRuntime
} from './geometry/player_triangle_collision_runtime';
import type {
    PlayerSquareAttachPoseQuery,
    PlayerFormAnchor,
    PlayerHazardHitShape,
    PlayerSquareTrailSurfacePoint
} from './geometry/player_geometry_types';
import type { PlayerSquareDebugView, PlayerSquareDebugZoneId } from './player_runtime_contracts';
import { PlayerView } from './view/player_view';
import {
    createBallReboundRuntimeState,
    type BallReboundRuntimeState
} from './player_ball_rebound_runtime';
import {
    freezePlayerForRespawn,
    handlePlayerFormSwitch,
    respawnPlayerAt
} from './player_lifecycle_runtime';
import { tickPlayerRuntime } from './player_tick_runtime';
import type { PlayerLifecycleRuntimeContext, PlayerMutableRuntimeState, PlayerTickRuntimeContext } from './player_runtime_types';

export class PfPlayerRuntime {
    private readonly scene: Scene;
    public readonly state: PlayerShellState;
    private readonly timers: PlayerTimers;
    private readonly physicsBody: Physics.Arcade.Body;
    private readonly physicsSprite: GameObjects.Arc;
    private readonly view: PlayerView;
    private readonly triangleMatterRuntime: PlayerTriangleMatterRuntime;
    private jumpCutConsumed: boolean;
    private boostCooldownMs: number;
    private boostImpulseMs: number;
    private boostActive: boolean;
    private boostModeActive: boolean;
    private pendingBoostRequest: boolean;
    private wasGrounded: boolean;
    private lastMoveDirection: -1 | 1;
    private reboundWindowMs: number;
    private reboundJumpVelocity: number;
    private lastAirborneDownwardSpeed: number;
    private readonly ballReboundRuntime: BallReboundRuntimeState;
    private frozenForRespawn: boolean;
    private airborneWindDriftX: number;
    private readonly groundedDragX: number;
    private readonly lifecycleContext: PlayerLifecycleRuntimeContext;

    public constructor(scene: Scene, x: number, y: number) {
        this.scene = scene;
        this.state = {
            currentForm: PLAYER_START_FORM,
            marker: createPlayerMarkerState(),
            triangleShell: createTriangleShellState(1),
            triangleCollision: createTriangleCollisionState(),
            squareShell: createSquareShellState(),
            triangleFlight: createTriangleFlightState()
        };
        this.timers = createPlayerTimers();
        this.jumpCutConsumed = false;
        this.boostCooldownMs = 0;
        this.boostImpulseMs = 0;
        this.boostActive = false;
        this.boostModeActive = false;
        this.pendingBoostRequest = false;
        this.wasGrounded = false;
        this.lastMoveDirection = 1;
        this.reboundWindowMs = 0;
        this.reboundJumpVelocity = PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY;
        this.lastAirborneDownwardSpeed = 0;
        this.ballReboundRuntime = createBallReboundRuntimeState();
        this.frozenForRespawn = false;
        this.airborneWindDriftX = 0;

        this.physicsSprite = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0xffffff, 0.01);
        this.physicsSprite.setDepth(4498);
        this.physicsSprite.name = 'pf_player';
        scene.physics.add.existing(this.physicsSprite);
        this.physicsBody = this.physicsSprite.body as Physics.Arcade.Body;
        this.physicsBody.setCircle(PLAYER_PLACEHOLDER_RADIUS);
        this.physicsBody.setBounce(0);
        this.groundedDragX = PLAYER_GROUNDED_DRAG_X;
        this.physicsBody.setDragX(this.groundedDragX);
        this.physicsBody.setMaxVelocity(
            Math.max(PLAYER_MAX_FORM_MOVE_SPEED, PLAYER_BALL_BOOST_SPEED, PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED),
            1200
        );
        this.physicsBody.setCollideWorldBounds(true);
        this.physicsBody.setGravityY(PLAYER_GRAVITY_Y);
        this.triangleMatterRuntime = createTriangleMatterRuntime(scene, x, y);

        this.view = new PlayerView(scene, x, y);
        this.lifecycleContext = {
            state: this.state,
            timers: this.timers,
            physicsBody: this.physicsBody,
            view: this.view,
            ballReboundRuntime: this.ballReboundRuntime,
            mutable: this.mutableState,
            applyCurrentFormCollisionBody: () => this.applyCurrentFormCollisionBody(),
            applyCurrentFormVisual: () => this.applyCurrentFormVisual(),
            syncVisualPosition: () => this.syncVisualPosition()
        };
        this.applyCurrentFormCollisionBody();
        this.applyCurrentFormVisual();
    }

    private get mutableState(): PlayerMutableRuntimeState {
        return {
            jumpCutConsumed: this.jumpCutConsumed,
            boostCooldownMs: this.boostCooldownMs,
            boostImpulseMs: this.boostImpulseMs,
            boostActive: this.boostActive,
            boostModeActive: this.boostModeActive,
            pendingBoostRequest: this.pendingBoostRequest,
            wasGrounded: this.wasGrounded,
            lastMoveDirection: this.lastMoveDirection,
            reboundWindowMs: this.reboundWindowMs,
            reboundJumpVelocity: this.reboundJumpVelocity,
            lastAirborneDownwardSpeed: this.lastAirborneDownwardSpeed,
            frozenForRespawn: this.frozenForRespawn,
            airborneWindDriftX: this.airborneWindDriftX
        };
    }

    private set mutableState(value: PlayerMutableRuntimeState) {
        this.jumpCutConsumed = value.jumpCutConsumed;
        this.boostCooldownMs = value.boostCooldownMs;
        this.boostImpulseMs = value.boostImpulseMs;
        this.boostActive = value.boostActive;
        this.boostModeActive = value.boostModeActive;
        this.pendingBoostRequest = value.pendingBoostRequest;
        this.wasGrounded = value.wasGrounded;
        this.lastMoveDirection = value.lastMoveDirection;
        this.reboundWindowMs = value.reboundWindowMs;
        this.reboundJumpVelocity = value.reboundJumpVelocity;
        this.lastAirborneDownwardSpeed = value.lastAirborneDownwardSpeed;
        this.frozenForRespawn = value.frozenForRespawn;
        this.airborneWindDriftX = value.airborneWindDriftX;
    }

    public get currentForm(): PlayerFormId {
        return this.state.currentForm;
    }

    public get squareTrailResourceCurrent(): number {
        return this.state.squareShell.trailResourceCurrent;
    }

    public get squareTrailResourceMax(): number {
        return this.state.squareShell.trailResourceMax;
    }

    public get squareTrailResourceRatio(): number {
        const maxResource = this.state.squareShell.trailResourceMax;
        if (maxResource <= 0) {
            return 0;
        }

        return PhaserMath.Clamp(this.state.squareShell.trailResourceCurrent / maxResource, 0, 1);
    }

    public get triangleFlightResourceCurrent(): number {
        return resolveTriangleFlightResource(this.state.triangleFlight).current;
    }

    public get triangleFlightResourceMax(): number {
        return resolveTriangleFlightResource(this.state.triangleFlight).max;
    }

    public get triangleFlightResourceRatio(): number {
        return resolveTriangleFlightResource(this.state.triangleFlight).ratio;
    }

    public get arcadeBodyObject(): GameObjects.Arc {
        return this.physicsSprite;
    }

    public get squareAttachJumpPullBody(): Physics.Arcade.Body | Physics.Arcade.StaticBody | null {
        return this.state.squareShell.attachJumpState.phase !== 'return'
            ? null
            : this.state.squareShell.attachJumpState.anchorSupportBody;
    }

    public get isCurrentlyGrounded(): boolean {
        return this.computeIsCurrentlyGrounded();
    }

    public get hazardHitShape(): PlayerHazardHitShape {
        return resolvePlayerHazardHitShape({
            form: this.state.currentForm,
            playerX: this.physicsSprite.x,
            playerY: this.physicsSprite.y,
            triangleShell: this.state.triangleShell
        });
    }

    public get formAnchor(): PlayerFormAnchor {
        return resolvePlayerFormAnchor({
            form: this.state.currentForm,
            playerX: this.physicsSprite.x,
            playerY: this.physicsSprite.y,
            triangleShell: this.state.triangleShell
        });
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.view.triangleVisualObject;
    }

    public get trianglePhysicsPoints(): ReadonlyArray<{ x: number; y: number }> | null {
        if (this.state.currentForm !== 'triangle') {
            return null;
        }

        return this.triangleMatterRuntime.debugPoints;
    }

    public get squareDebugView(): PlayerSquareDebugView | null {
        if (this.state.currentForm !== 'square') {
            return null;
        }

        const squareShell = this.state.squareShell;
        const attachedZoneIds: PlayerSquareDebugZoneId[] = [];
        const danglingZoneIds: PlayerSquareDebugZoneId[] = [];
        const rolloverPivotWorld = squareShell.rolloverState.phase === 'inactive'
            ? null
            : squareSupportLocalToWorld(
                squareShell.rolloverState.pivotLocalX,
                squareShell.rolloverState.pivotLocalY,
                {
                    body: squareShell.rolloverState.pivotSupportBody,
                    originX: squareShell.rolloverState.pivotSupportOriginX,
                    originY: squareShell.rolloverState.pivotSupportOriginY
                }
            );

        if (squareShell.isAttached) {
            const currentCenterX = this.physicsBody.x + (this.physicsBody.width * 0.5);
            const currentCenterY = this.physicsBody.y + (this.physicsBody.height * 0.5);
            const currentPose = this.querySquareAttachPose(
                currentCenterX,
                currentCenterY,
                squareShell.attachNormalX,
                squareShell.attachNormalY
            );
            const activeZones = resolveSquareDebugAttachZones(
                currentPose,
                squareShell.attachNormalX,
                squareShell.attachNormalY
            );
            attachedZoneIds.push(...activeZones.attachedZoneIds);
            danglingZoneIds.push(...activeZones.danglingZoneIds);
        }

        return {
            orientationRad: squareShell.orientationRad,
            isAttached: squareShell.isAttached,
            attachNormalX: squareShell.attachNormalX,
            attachNormalY: squareShell.attachNormalY,
            attachedZoneIds,
            danglingZoneIds,
            rolloverPivotWorld
        };
    }

    public refillTriangleFlightResource(): void {
        refillTriangleFlightResource(this.state.triangleFlight);
    }

    public freezeForRespawn(): void {
        let mutable = this.mutableState;
        this.lifecycleContext.mutable = mutable;
        freezePlayerForRespawn(this.lifecycleContext);
        this.mutableState = this.lifecycleContext.mutable;
    }

    public respawnAt(x: number, y: number): void {
        this.lifecycleContext.mutable = this.mutableState;
        respawnPlayerAt(this.lifecycleContext, x, y);
        this.mutableState = this.lifecycleContext.mutable;
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot, externalHorizontalInfluenceX: number = 0): void {
        if (this.frozenForRespawn) {
            return;
        }

        const tickContext: PlayerTickRuntimeContext = {
            state: this.state,
            timers: this.timers,
            physicsBody: this.physicsBody,
            physicsSprite: this.physicsSprite,
            ballReboundRuntime: this.ballReboundRuntime,
            input,
            deltaMs,
            externalHorizontalInfluenceX,
            mutable: this.mutableState,
            groundedDragX: this.groundedDragX,
            handleFormSwitch: () => {
                this.lifecycleContext.mutable = tickContext.mutable;
                handlePlayerFormSwitch(this.lifecycleContext, input);
                tickContext.mutable = this.lifecycleContext.mutable;
            },
            refreshTrianglePhysicsState: () => this.refreshTrianglePhysicsState(),
            commitTrianglePhysicsState: (triangleDeltaSec) => this.commitTrianglePhysicsState(triangleDeltaSec),
            getTransformLockMs: () => this.timers.transformLockMs,
            resolveSquareTrailSurfacePoint: (normalX, normalY) => this.resolveSquareTrailSurfacePoint(normalX, normalY),
            querySquareAttachPose: (centerX, centerY, normalX, normalY) => this.querySquareAttachPose(centerX, centerY, normalX, normalY),
            isCurrentlyGrounded: () => this.computeIsCurrentlyGrounded()
        };

        tickPlayerRuntime(tickContext);
        this.mutableState = tickContext.mutable;
        this.syncVisualPosition();
    }

    private applyCurrentFormVisual(): void {
        this.view.applyCurrentFormVisibility(
            this.state.currentForm,
            this.state.squareShell,
            this.state.currentForm === 'ball' && this.boostModeActive
        );
    }

    private syncVisualPosition(): void {
        const x = this.physicsSprite.x;
        const y = this.physicsSprite.y;
        this.applyCurrentFormCollisionBody();
        const formAnchor = this.formAnchor;
        this.view.syncVisualPosition(
            x,
            y,
            formAnchor,
            this.state.currentForm,
            this.state.marker,
            this.state.triangleShell,
            this.state.squareShell,
            this.state.triangleFlight,
            this.state.currentForm === 'ball' && this.boostModeActive
        );
    }

    private applyCurrentFormCollisionBody(): void {
        syncTriangleArcadeBodyMode(this.state, this.physicsBody, this.frozenForRespawn);
        syncTriangleMatterMode(
            this.scene,
            this.triangleMatterRuntime,
            this.state,
            this.physicsSprite,
            this.physicsBody,
            this.frozenForRespawn
        );
        const bodyConfig = resolvePlayerLocomotionBodyConfig(this.state.currentForm, this.state.triangleShell);
        const spriteWidth = this.physicsSprite.displayWidth;
        const spriteHeight = this.physicsSprite.displayHeight;

        if (bodyConfig.kind === 'circle') {
            const diameter = bodyConfig.radius * 2;
            this.physicsBody.setCircle(bodyConfig.radius);
            this.physicsBody.setOffset(
                ((spriteWidth - diameter) * 0.5) + bodyConfig.centerOffset.x,
                ((spriteHeight - diameter) * 0.5) + bodyConfig.centerOffset.y
            );
            return;
        }

        this.physicsBody.setSize(bodyConfig.width, bodyConfig.height, false);
        this.physicsBody.setOffset(
            ((spriteWidth - bodyConfig.width) * 0.5) + bodyConfig.centerOffset.x,
            ((spriteHeight - bodyConfig.height) * 0.5) + bodyConfig.centerOffset.y
        );
    }

    private resolveSquareTrailSurfacePoint(
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ): PlayerSquareTrailSurfacePoint {
        const playerRect = createPlayerRectSnapshot(
            this.physicsBody.x,
            this.physicsBody.y,
            this.physicsBody.width,
            this.physicsBody.height
        );
        const probe = resolveSquareSupportProbe(normalX, normalY, playerRect);
        const overlapBodies = this.physicsSprite.scene.physics.overlapRect(
            probe.x,
            probe.y,
            probe.width,
            probe.height,
            true,
            true
        ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;
        const supportInterval = resolveSquareSupportIntervalFromOverlap(
            overlapBodies,
            this.physicsBody,
            normalX,
            normalY,
            playerRect,
            probe
        ) ?? resolveSquareSupportIntervalFromKnownBody(
            this.state.squareShell.trailAnchorSupportBody,
            this.physicsBody,
            normalX,
            normalY,
            playerRect
        );

        return resolveSquareTrailSurfacePoint(
            normalX,
            normalY,
            playerRect,
            supportInterval,
            null
        );
    }

    private querySquareAttachPose(
        centerX: number,
        centerY: number,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1
    ): PlayerSquareAttachPoseQuery {
        const halfSize = this.physicsBody.width * 0.5;
        const playerRect = createPlayerRectSnapshot(
            centerX - halfSize,
            centerY - halfSize,
            this.physicsBody.width,
            this.physicsBody.height
        );
        const probe = resolveSquareSupportProbe(normalX, normalY, playerRect);
        const supportBodies = this.physicsSprite.scene.physics.overlapRect(
            probe.x,
            probe.y,
            probe.width,
            probe.height,
            true,
            true
        ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;
        const supportInterval = resolveSquareSupportIntervalFromOverlap(
            supportBodies,
            this.physicsBody,
            normalX,
            normalY,
            playerRect,
            probe
        ) ?? resolveSquareSupportIntervalFromKnownBody(
            this.state.squareShell.trailAnchorSupportBody,
            this.physicsBody,
            normalX,
            normalY,
            playerRect
        );
        const snappedCenter = resolveSnappedSquareAttachCenter(
            centerX,
            centerY,
            this.physicsBody.width * 0.5,
            normalX,
            normalY,
            supportInterval
        );
        const surfacePoint = resolveSquareTrailSurfacePoint(
            normalX,
            normalY,
            snappedCenter,
            supportInterval,
            null
        );
        const interiorInset = PLAYER_SQUARE_ROLLOVER_SURFACE_VALIDATION_RANGE_PX;
        const interiorBodies = this.physicsSprite.scene.physics.overlapRect(
            snappedCenter.left + interiorInset,
            snappedCenter.top + interiorInset,
            Math.max(1, snappedCenter.width - (interiorInset * 2)),
            Math.max(1, snappedCenter.height - (interiorInset * 2)),
            true,
            true
        ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;

        return {
            centerX,
            centerY,
            snappedCenterX: snappedCenter.centerX,
            snappedCenterY: snappedCenter.centerY,
            rect: snappedCenter,
            supportInterval,
            surfacePoint,
            isPoseClear: resolveSquarePoseClear(interiorBodies, this.physicsBody)
        };
    }

    private computeIsCurrentlyGrounded(): boolean {
        if (this.state.currentForm === 'triangle') {
            return this.state.triangleCollision.hasGroundContact && this.state.triangleCollision.groundSupportEdgeIndex !== null;
        }

        return this.physicsBody.blocked.down || this.physicsBody.touching.down;
    }

    private refreshTrianglePhysicsState(): void {
        if (this.state.currentForm !== 'triangle') {
            return;
        }

        syncTriangleMatterMode(
            this.scene,
            this.triangleMatterRuntime,
            this.state,
            this.physicsSprite,
            this.physicsBody,
            this.frozenForRespawn
        );
        primeTriangleMatterKinematicState(
            this.scene,
            this.triangleMatterRuntime,
            this.state.triangleCollision,
            this.physicsSprite,
            this.physicsBody
        );
    }

    private commitTrianglePhysicsState(deltaSec: number): void {
        if (this.state.currentForm !== 'triangle') {
            return;
        }

        syncTriangleMatterMode(
            this.scene,
            this.triangleMatterRuntime,
            this.state,
            this.physicsSprite,
            this.physicsBody,
            this.frozenForRespawn
        );
        stepTriangleMatterKinematicRuntime(
            this.scene,
            this.triangleMatterRuntime,
            this.state.triangleCollision,
            this.physicsSprite,
            this.physicsBody,
            deltaSec
        );
    }

    public destroy(): void {
        destroyTriangleMatterRuntime(this.scene, this.triangleMatterRuntime);
    }
}

const resolveSquareDebugAttachZones = (
    pose: PlayerSquareAttachPoseQuery,
    attachNormalX: -1 | 0 | 1,
    attachNormalY: -1 | 0 | 1
): { attachedZoneIds: PlayerSquareDebugZoneId[]; danglingZoneIds: PlayerSquareDebugZoneId[] } => {
    if (pose.supportInterval === null) {
        return { attachedZoneIds: [], danglingZoneIds: [] };
    }

    if (attachNormalY === -1) {
        return resolveSquareDebugHorizontalZones(pose, 'BL', 'BR');
    }

    if (attachNormalY === 1) {
        return resolveSquareDebugHorizontalZones(pose, 'TL', 'TR');
    }

    if (attachNormalX === 1) {
        return resolveSquareDebugVerticalZones(pose, 'TL', 'BL');
    }

    return resolveSquareDebugVerticalZones(pose, 'TR', 'BR');
};

const resolveSnappedSquareAttachCenter = (
    centerX: number,
    centerY: number,
    halfSize: number,
    normalX: -1 | 0 | 1,
    normalY: -1 | 0 | 1,
    supportInterval: PlayerSquareAttachPoseQuery['supportInterval']
) => {
    let snappedCenterX = centerX;
    let snappedCenterY = centerY;

    if (supportInterval !== null) {
        const supportBody = supportInterval.ownerBody;
        const supportRect = createPlayerRectSnapshot(
            supportBody.x,
            supportBody.y,
            supportBody.width,
            supportBody.height
        );

        if (normalY === -1) {
            snappedCenterY = supportRect.top - halfSize;
        } else if (normalY === 1) {
            snappedCenterY = supportRect.bottom + halfSize;
        } else if (normalX === 1) {
            snappedCenterX = supportRect.right + halfSize;
        } else if (normalX === -1) {
            snappedCenterX = supportRect.left - halfSize;
        }
    }

    return createPlayerRectSnapshot(
        snappedCenterX - halfSize,
        snappedCenterY - halfSize,
        halfSize * 2,
        halfSize * 2
    );
};

const resolveSquareDebugHorizontalZones = (
    pose: PlayerSquareAttachPoseQuery,
    negativeZoneId: PlayerSquareDebugZoneId,
    positiveZoneId: PlayerSquareDebugZoneId
): { attachedZoneIds: PlayerSquareDebugZoneId[]; danglingZoneIds: PlayerSquareDebugZoneId[] } => {
    const centerX = pose.rect.centerX;
    const negativeAttached = doesDebugZoneOverlapSupport(pose, pose.rect.left, centerX);
    const positiveAttached = doesDebugZoneOverlapSupport(pose, centerX, pose.rect.right);

    return {
        attachedZoneIds: [
            ...(negativeAttached ? [negativeZoneId] : []),
            ...(positiveAttached ? [positiveZoneId] : [])
        ],
        danglingZoneIds: [
            ...(!negativeAttached ? [negativeZoneId] : []),
            ...(!positiveAttached ? [positiveZoneId] : [])
        ]
    };
};

const resolveSquareDebugVerticalZones = (
    pose: PlayerSquareAttachPoseQuery,
    negativeZoneId: PlayerSquareDebugZoneId,
    positiveZoneId: PlayerSquareDebugZoneId
): { attachedZoneIds: PlayerSquareDebugZoneId[]; danglingZoneIds: PlayerSquareDebugZoneId[] } => {
    const centerY = pose.rect.centerY;
    const negativeAttached = doesDebugZoneOverlapSupport(pose, pose.rect.top, centerY);
    const positiveAttached = doesDebugZoneOverlapSupport(pose, centerY, pose.rect.bottom);

    return {
        attachedZoneIds: [
            ...(negativeAttached ? [negativeZoneId] : []),
            ...(positiveAttached ? [positiveZoneId] : [])
        ],
        danglingZoneIds: [
            ...(!negativeAttached ? [negativeZoneId] : []),
            ...(!positiveAttached ? [positiveZoneId] : [])
        ]
    };
};

const doesDebugZoneOverlapSupport = (
    pose: PlayerSquareAttachPoseQuery,
    zoneMin: number,
    zoneMax: number
): boolean => {
    if (pose.supportInterval === null) {
        return false;
    }

    const overlapMin = Math.max(pose.supportInterval.min, zoneMin);
    const overlapMax = Math.min(pose.supportInterval.max, zoneMax);
    return (overlapMax - overlapMin) > 0.5;
};

