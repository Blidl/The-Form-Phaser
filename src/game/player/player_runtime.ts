import { GameObjects, Math as PhaserMath, Physics, Scene } from 'phaser';
import {
    PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY,
    PLAYER_BALL_BOOST_SPEED,
    PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED,
    PLAYER_GROUNDED_DRAG_X,
    PLAYER_MAX_FORM_MOVE_SPEED,
    PLAYER_GRAVITY_Y,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_SQUARE_TRAIL_RESOURCE_MAX,
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
    resolveTriangleFlightResource,
    syncTriangleFlightRuntimeTuning
} from './player_triangle_flight';
import type {
    PlayerFormId,
    PlayerShellState
} from './player_types';
import {
    createArcadeBodyContactShapeSnapshot,
    createPolygonContactShapeSnapshot,
    type TestWorldActorContactMode,
    type TestWorldActorContactShapeSnapshot,
    type TestWorldActorWorldContactSnapshot
} from '../world/runtime/test_world_actor_contact_shapes';
import {
    createPlayerRectSnapshot,
    doesConvexPolygonOverlapRect,
    resolveSquarePoseClear,
    resolvePlayerHazardHitShape,
    resolvePlayerLocomotionBodyConfig,
    resolvePlayerFormAnchor,
    resolveSquareWorldPoints,
    resolveSquareSupportIntervalFromKnownBody,
    resolveSquareSupportIntervalFromOverlap,
    resolveSquareSupportProbe,
    resolveTriangleWorldPoints,
    resolveSquareTrailSurfacePoint,
    resolveWorldPointBounds
} from './geometry/player_geometry_queries';
import { squareSupportLocalToWorld } from './player_square_support_space';
import {
    createTriangleCollisionState,
    createTriangleMatterRuntime,
    destroyTriangleMatterRuntime,
    hardResetTriangleWorldGeometryState,
    primeTriangleMatterKinematicState,
    syncTriangleProxyFromMatter,
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
import type { PlayerDeathTransitionDebugSnapshot } from './view/player_death_transition';
import { isPlatformSurfaceGameObject } from '../world/world_surface_tags';
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
import { clearSquareAttach } from './player_square_attach';
import { createEmptyPlayerPresentationFrameHooks, type PlayerPresentationFrameHooks } from './view/player_presentation_hooks';

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
    private presentationPrevGrounded: boolean;
    private presentationPrevVerticalSpeed: number;
    private presentationApexEmitted: boolean;
    private presentationFallEmitted: boolean;
    private presentationPrevTriangleFlightActive: boolean;
    private presentationPrevSquareAttached: boolean;
    private lastVisualDeltaMs: number;
    private pendingPresentationHooks: PlayerPresentationFrameHooks;
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
        this.presentationPrevGrounded = false;
        this.presentationPrevVerticalSpeed = 0;
        this.presentationApexEmitted = false;
        this.presentationFallEmitted = false;
        this.presentationPrevTriangleFlightActive = false;
        this.presentationPrevSquareAttached = false;
        this.lastVisualDeltaMs = 16;
        this.pendingPresentationHooks = createEmptyPlayerPresentationFrameHooks();

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
            syncVisualPosition: () => this.syncVisualPosition(),
            notifyFormSwitchIn: (previousForm, nextForm) => this.queuePresentationFormSwitchIn(previousForm, nextForm),
            resetVisualPose: () => this.view.resetFormAnimationPose(this.state.currentForm)
        };
        this.applyCurrentFormCollisionBody();
        this.view.resetFormAnimationPose(this.state.currentForm);
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
            airborneWindDriftX: this.airborneWindDriftX,
            presentationPrevGrounded: this.presentationPrevGrounded,
            presentationPrevVerticalSpeed: this.presentationPrevVerticalSpeed,
            presentationApexEmitted: this.presentationApexEmitted,
            presentationFallEmitted: this.presentationFallEmitted,
            presentationPrevTriangleFlightActive: this.presentationPrevTriangleFlightActive,
            presentationPrevSquareAttached: this.presentationPrevSquareAttached
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
        this.presentationPrevGrounded = value.presentationPrevGrounded;
        this.presentationPrevVerticalSpeed = value.presentationPrevVerticalSpeed;
        this.presentationApexEmitted = value.presentationApexEmitted;
        this.presentationFallEmitted = value.presentationFallEmitted;
        this.presentationPrevTriangleFlightActive = value.presentationPrevTriangleFlightActive;
        this.presentationPrevSquareAttached = value.presentationPrevSquareAttached;
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

    public get contactMode(): TestWorldActorContactMode {
        return this.state.currentForm === 'triangle' ? 'triangle_polygon' : 'arcade';
    }

    public get contactShapeSnapshot(): TestWorldActorContactShapeSnapshot {
        if (this.state.currentForm !== 'triangle') {
            return createArcadeBodyContactShapeSnapshot(this.physicsSprite, this.physicsBody);
        }

        const trianglePoints = this.triangleMatterRuntime.debugPoints.length >= 3
            ? this.triangleMatterRuntime.debugPoints
            : resolveTriangleWorldPoints(
                this.formAnchor.x,
                this.formAnchor.y,
                this.state.triangleShell.orientationRad
            );

        return createPolygonContactShapeSnapshot(
            trianglePoints.map((point) => ({ x: point.x, y: point.y }))
        );
    }

    public get worldContactSnapshot(): TestWorldActorWorldContactSnapshot {
        if (this.state.currentForm === 'triangle') {
            return {
                mode: 'triangle_polygon',
                grounded: this.state.triangleCollision.hasGroundContact && this.state.triangleCollision.groundSupportEdgeIndex !== null,
                blockedLeft: this.state.triangleCollision.hasLeftWallContact,
                blockedRight: this.state.triangleCollision.hasRightWallContact
            };
        }

        return {
            mode: 'arcade',
            grounded: this.physicsBody.blocked.down
                || this.physicsBody.touching.down
                || this.physicsBody.wasTouching.down
                || this.physicsBody.onFloor(),
            blockedLeft: this.physicsBody.blocked.left,
            blockedRight: this.physicsBody.blocked.right
        };
    }

    public applyActorContactPush(deltaX: number, deltaY: number): { appliedDeltaX: number; appliedDeltaY: number } {
        if (Math.abs(deltaX) <= 0.0001 && Math.abs(deltaY) <= 0.0001) {
            return { appliedDeltaX: 0, appliedDeltaY: 0 };
        }

        if (this.state.currentForm !== 'triangle') {
            const startX = this.physicsSprite.x;
            const startY = this.physicsSprite.y;
            const velocityX = this.physicsBody.velocity.x;
            const velocityY = this.physicsBody.velocity.y;
            this.physicsBody.reset(this.physicsBody.x + deltaX, this.physicsBody.y + deltaY);
            this.physicsBody.setVelocity(velocityX, velocityY);
            return {
                appliedDeltaX: this.physicsSprite.x - startX,
                appliedDeltaY: this.physicsSprite.y - startY
            };
        }

        const startX = this.physicsSprite.x;
        const startY = this.physicsSprite.y;
        syncTriangleMatterMode(
            this.scene,
            this.triangleMatterRuntime,
            this.state,
            this.physicsSprite,
            this.physicsBody,
            this.frozenForRespawn
        );
        this.scene.matter.body.translate(this.triangleMatterRuntime.body, { x: deltaX, y: deltaY });
        primeTriangleMatterKinematicState(
            this.scene,
            this.triangleMatterRuntime,
            this.state.triangleCollision,
            this.physicsSprite,
            this.physicsBody
        );
        syncTriangleProxyFromMatter(this.triangleMatterRuntime, this.physicsSprite, this.physicsBody);
        this.syncVisualPosition();
        return {
            appliedDeltaX: this.physicsSprite.x - startX,
            appliedDeltaY: this.physicsSprite.y - startY
        };
    }

    public get squareAttachJumpPullBody(): Physics.Arcade.Body | Physics.Arcade.StaticBody | null {
        return this.state.squareShell.attachJumpState.phase !== 'return'
            ? null
            : this.state.squareShell.attachJumpState.anchorSupportBody;
    }

    public get isCurrentlyGrounded(): boolean {
        return this.computeIsCurrentlyGrounded();
    }

    public get isTriangleFlightActive(): boolean {
        return this.state.currentForm === 'triangle' && this.state.triangleFlight.isActive;
    }

    public get isTriangleBreakWallActive(): boolean {
        return this.state.currentForm === 'triangle' && this.state.triangleFlight.isActive;
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

    public get presentationDebugState(): {
        ball: { visible: boolean; scaleX: number; scaleY: number; rotationRad: number };
        triangle: { visible: boolean; scaleX: number; scaleY: number; rotationRad: number };
        square: { visible: boolean; scaleX: number; scaleY: number; rotationRad: number };
        velocityX: number;
        velocityY: number;
    } {
        return {
            ...this.view.getPresentationDebugState(),
            velocityX: this.physicsBody.velocity.x,
            velocityY: this.physicsBody.velocity.y
        };
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

    public setDebugVisualsVisible(visible: boolean): void {
        this.view.setDebugVisualsVisible(visible);
    }

    public setDeathDebugOverlay(enabled: boolean, progressOverride: number | null): void {
        this.view.setDeathDebugOverlay(enabled, progressOverride);
    }

    public get deathDebugSnapshot(): PlayerDeathTransitionDebugSnapshot {
        return this.view.getDeathDebugSnapshot();
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

    public startDeathTransition(
        impactX: number,
        impactY: number,
        impactNormalX: number,
        impactNormalY: number,
        durationMs: number
    ): void {
        this.view.startDeathTransition(
            this.state.currentForm,
            impactX,
            impactY,
            impactNormalX,
            impactNormalY,
            this.physicsBody.velocity.x,
            this.physicsBody.velocity.y,
            this.computeIsCurrentlyGrounded(),
            durationMs
        );
    }

    public respawnAt(x: number, y: number): void {
        this.lifecycleContext.mutable = this.mutableState;
        respawnPlayerAt(this.lifecycleContext, x, y);
        this.view.resetDeathTransition();
        this.mutableState = this.lifecycleContext.mutable;
    }

    public refreshWorldGeometryState(): void {
        hardResetTriangleWorldGeometryState(this.triangleMatterRuntime, this.state.triangleCollision);
        clearSquareAttach(this.state.squareShell);
        this.state.squareShell.hasContact = false;
        this.state.squareShell.contactNormalX = 0;
        this.state.squareShell.contactNormalY = -1;
        this.state.squareShell.trailAnchorSupportBody = null;
        this.state.squareShell.trailLatchSupportBody = null;
        this.physicsBody.checkCollision.none = false;
        this.applyCurrentFormCollisionBody();
        this.refreshTrianglePhysicsState();
        this.view.resetFormAnimationPose(this.state.currentForm);
        this.syncVisualPosition();
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot, externalHorizontalInfluenceX: number = 0): void {
        if (this.frozenForRespawn) {
            this.lastVisualDeltaMs = deltaMs;
            this.view.tickDeathTransition(deltaMs);
            return;
        }

        this.pendingPresentationHooks = createEmptyPlayerPresentationFrameHooks();
        this.syncLiveTuningRuntimeState();
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
            isSquareAttachPathClear: (fromCenterX, fromCenterY, toCenterX, toCenterY, supportBody) => this.isSquareAttachPathClear(fromCenterX, fromCenterY, toCenterX, toCenterY, supportBody),
            isSquareRolloverPoseClear: (centerX, centerY, orientationRad, ignoreBodyA, ignoreBodyB) => this.isSquareRolloverPoseClear(centerX, centerY, orientationRad, ignoreBodyA, ignoreBodyB),
            isCurrentlyGrounded: () => this.computeIsCurrentlyGrounded(),
            notifyJumpIntent: () => this.queuePresentationJumpIntent(),
            notifyJumpCommit: (impulseX, impulseY) => this.queuePresentationJumpCommit(impulseX, impulseY),
            notifyApexEnter: () => this.queuePresentationApexEnter(),
            notifyFallEnter: () => this.queuePresentationFallEnter(),
            notifyLandImpact: (impactSpeed) => this.queuePresentationLandImpact(impactSpeed),
            notifyBallReboundLaunch: (impulseX, impulseY) => this.queuePresentationBallReboundLaunch(impulseX, impulseY),
            notifyBallBoostGroundStart: (impulseX, impulseY) => this.queuePresentationBallBoostGroundStart(impulseX, impulseY),
            notifyBallBoostGroundSustain: (dirX, dirY) => this.queuePresentationBallBoostGroundSustain(dirX, dirY),
            notifyTriangleFlightStart: () => this.queuePresentationTriangleFlightStart(),
            notifyTriangleFlightEnd: () => this.queuePresentationTriangleFlightEnd(),
            notifySquareAttachEnter: () => this.queuePresentationSquareAttachEnter(),
            notifySquareAttachExit: () => this.queuePresentationSquareAttachExit(),
            notifySquareAttachJumpCommit: (impulseX, impulseY) => this.queuePresentationSquareAttachJumpCommit(impulseX, impulseY)
        };

        tickPlayerRuntime(tickContext);
        this.mutableState = tickContext.mutable;
        this.lastVisualDeltaMs = deltaMs;
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
        const grounded = this.computeIsCurrentlyGrounded();
        const presentationHooks = this.consumePresentationHooks();
        this.view.syncVisualPosition(
            x,
            y,
            formAnchor,
            this.state.currentForm,
            this.state.marker,
            this.state.triangleShell,
            this.state.squareShell,
            this.state.triangleFlight,
            this.state.currentForm === 'ball' && this.boostModeActive,
            presentationHooks,
            grounded,
            this.physicsBody.velocity.x,
            this.physicsBody.velocity.y,
            this.lastVisualDeltaMs
        );
    }

    private consumePresentationHooks(): PlayerPresentationFrameHooks {
        const snapshot: PlayerPresentationFrameHooks = { ...this.pendingPresentationHooks };
        this.pendingPresentationHooks = createEmptyPlayerPresentationFrameHooks();
        return snapshot;
    }

    private queuePresentationJumpIntent(): void {
        this.pendingPresentationHooks.jumpIntent = true;
    }

    private queuePresentationJumpCommit(impulseX: number, impulseY: number): void {
        this.pendingPresentationHooks.jumpCommit = true;
        this.pendingPresentationHooks.jumpCommitImpulseX = impulseX;
        this.pendingPresentationHooks.jumpCommitImpulseY = impulseY;
    }

    private queuePresentationApexEnter(): void {
        this.pendingPresentationHooks.apexEnter = true;
    }

    private queuePresentationFallEnter(): void {
        this.pendingPresentationHooks.fallEnter = true;
    }

    private queuePresentationLandImpact(impactSpeed: number): void {
        const nextImpactSpeed = Math.max(0, impactSpeed);
        if (this.pendingPresentationHooks.landImpactSpeed === null) {
            this.pendingPresentationHooks.landImpactSpeed = nextImpactSpeed;
            return;
        }

        this.pendingPresentationHooks.landImpactSpeed = Math.max(
            this.pendingPresentationHooks.landImpactSpeed,
            nextImpactSpeed
        );
    }

    private queuePresentationFormSwitchIn(previousForm: PlayerFormId, nextForm: PlayerFormId): void {
        this.pendingPresentationHooks.formSwitchIn = nextForm;
        this.pendingPresentationHooks.formSwitchStart = {
            outgoingForm: previousForm,
            incomingForm: nextForm
        };
    }

    private queuePresentationBallReboundLaunch(impulseX: number, impulseY: number): void {
        this.pendingPresentationHooks.ballReboundLaunch = true;
        this.pendingPresentationHooks.ballReboundLaunchImpulseX = impulseX;
        this.pendingPresentationHooks.ballReboundLaunchImpulseY = impulseY;
    }

    private queuePresentationBallBoostGroundStart(impulseX: number, impulseY: number): void {
        this.pendingPresentationHooks.ballBoostGroundStart = true;
        this.pendingPresentationHooks.ballBoostGroundStartImpulseX = impulseX;
        this.pendingPresentationHooks.ballBoostGroundStartImpulseY = impulseY;
    }

    private queuePresentationBallBoostGroundSustain(dirX: number, dirY: number): void {
        this.pendingPresentationHooks.ballBoostGroundSustain = true;
        this.pendingPresentationHooks.ballBoostGroundSustainDirX = dirX;
        this.pendingPresentationHooks.ballBoostGroundSustainDirY = dirY;
    }

    private queuePresentationTriangleFlightStart(): void {
        this.pendingPresentationHooks.triangleFlightStart = true;
    }

    private queuePresentationTriangleFlightEnd(): void {
        this.pendingPresentationHooks.triangleFlightEnd = true;
    }

    private queuePresentationSquareAttachEnter(): void {
        this.pendingPresentationHooks.squareAttachEnter = true;
    }

    private queuePresentationSquareAttachExit(): void {
        this.pendingPresentationHooks.squareAttachExit = true;
    }

    private queuePresentationSquareAttachJumpCommit(impulseX: number, impulseY: number): void {
        this.pendingPresentationHooks.squareAttachJumpCommit = true;
        this.pendingPresentationHooks.squareAttachJumpCommitImpulseX = impulseX;
        this.pendingPresentationHooks.squareAttachJumpCommitImpulseY = impulseY;
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
        const supportInterval = this.resolvePreferredSquareSupportInterval(
            overlapBodies,
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

    private syncLiveTuningRuntimeState(): void {
        this.physicsBody.setMaxVelocity(
            Math.max(PLAYER_MAX_FORM_MOVE_SPEED, PLAYER_BALL_BOOST_SPEED, PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED),
            1200
        );

        const previousSquareTrailMax = Math.max(0.0001, this.state.squareShell.trailResourceMax);
        const squareTrailRatio = PhaserMath.Clamp(this.state.squareShell.trailResourceCurrent / previousSquareTrailMax, 0, 1);
        this.state.squareShell.trailResourceMax = PLAYER_SQUARE_TRAIL_RESOURCE_MAX;
        this.state.squareShell.trailResourceCurrent = PhaserMath.Clamp(
            this.state.squareShell.trailResourceMax * squareTrailRatio,
            0,
            this.state.squareShell.trailResourceMax
        );

        syncTriangleFlightRuntimeTuning(this.state.triangleFlight);
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
        const supportInterval = this.resolvePreferredSquareSupportInterval(
            supportBodies,
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
        const poseBodies = this.physicsSprite.scene.physics.overlapRect(
            snappedCenter.left,
            snappedCenter.top,
            snappedCenter.width,
            snappedCenter.height,
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
            isPoseClear: resolveSquarePoseClear(
                poseBodies,
                this.physicsBody,
                snappedCenter,
                supportInterval?.ownerBody ?? null,
                normalX,
                normalY
            )
        };
    }

    private resolvePreferredSquareSupportInterval(
        overlapBodies: Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>,
        normalX: -1 | 0 | 1,
        normalY: -1 | 0 | 1,
        playerRect: PlayerSquareAttachPoseQuery['rect'],
        probe: ReturnType<typeof resolveSquareSupportProbe>
    ): PlayerSquareAttachPoseQuery['supportInterval'] | null {
        const squareShell = this.state.squareShell;
        const shouldPreferAttachedSupport = squareShell.isAttached
            && squareShell.attachSupportBody !== null
            && normalX === squareShell.attachNormalX
            && normalY === squareShell.attachNormalY;
        if (shouldPreferAttachedSupport) {
            const attachedSupportInterval = resolveSquareSupportIntervalFromKnownBody(
                squareShell.attachSupportBody,
                this.physicsBody,
                normalX,
                normalY,
                playerRect
            );
            if (attachedSupportInterval !== null) {
                return attachedSupportInterval;
            }
        }

        return resolveSquareSupportIntervalFromOverlap(
            overlapBodies,
            this.physicsBody,
            normalX,
            normalY,
            playerRect,
            probe
        );
    }

    private isSquareAttachPathClear(
        fromCenterX: number,
        fromCenterY: number,
        toCenterX: number,
        toCenterY: number,
        supportBody: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
    ): boolean {
        const distancePx = Math.hypot(toCenterX - fromCenterX, toCenterY - fromCenterY);
        if (distancePx <= 0.001) {
            return true;
        }

        const stepDistancePx = Math.max(2, this.physicsBody.width * 0.125);
        const sampleCount = Math.max(1, Math.ceil(distancePx / stepDistancePx));

        // Attach and attach-jump may disable Arcade collision briefly, so path validity
        // must be checked before every reset into a snapped or interpolated pose.
        for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
            const t = sampleIndex / sampleCount;
            const centerX = PhaserMath.Linear(fromCenterX, toCenterX, t);
            const centerY = PhaserMath.Linear(fromCenterY, toCenterY, t);
            const sampledRect = createPlayerRectSnapshot(
                centerX - (this.physicsBody.width * 0.5),
                centerY - (this.physicsBody.height * 0.5),
                this.physicsBody.width,
                this.physicsBody.height
            );
            const overlapBodies = this.physicsSprite.scene.physics.overlapRect(
                sampledRect.left,
                sampledRect.top,
                sampledRect.width,
                sampledRect.height,
                true,
                true
            ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;

            if (!resolveSquarePoseClear(
                overlapBodies,
                this.physicsBody,
                sampledRect,
                supportBody,
                0,
                0
            )) {
                return false;
            }
        }

        return true;
    }

    private isSquareRolloverPoseClear(
        centerX: number,
        centerY: number,
        orientationRad: number,
        ignoreBodyA: Physics.Arcade.Body | Physics.Arcade.StaticBody | null,
        ignoreBodyB: Physics.Arcade.Body | Physics.Arcade.StaticBody | null
    ): boolean {
        const worldPoints = resolveSquareWorldPoints(
            centerX,
            centerY,
            this.physicsBody.width * 0.5,
            orientationRad
        );
        const worldBounds = resolveWorldPointBounds(worldPoints);
        const overlapBodies = this.physicsSprite.scene.physics.overlapRect(
            worldBounds.left,
            worldBounds.top,
            worldBounds.width,
            worldBounds.height,
            true,
            true
        ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;

        return !overlapBodies.some((candidateBody) => {
            if (
                candidateBody === this.physicsBody
                || candidateBody === ignoreBodyA
                || candidateBody === ignoreBodyB
                || candidateBody.enable === false
                || candidateBody.gameObject?.active !== true
                || !isPlatformSurfaceGameObject(candidateBody.gameObject)
            ) {
                return false;
            }

            const candidateRect = createPlayerRectSnapshot(
                candidateBody.x,
                candidateBody.y,
                candidateBody.width,
                candidateBody.height
            );
            return doesConvexPolygonOverlapRect(worldPoints, candidateRect);
        });
    }

    private computeIsCurrentlyGrounded(): boolean {
        if (this.state.currentForm === 'triangle') {
            return this.state.triangleCollision.hasGroundContact && this.state.triangleCollision.groundSupportEdgeIndex !== null;
        }

        return this.physicsBody.blocked.down
            || this.physicsBody.touching.down
            || this.physicsBody.wasTouching.down
            || this.physicsBody.onFloor();
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

