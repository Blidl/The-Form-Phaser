import { GameObjects, Math as PhaserMath, Physics, Scene } from 'phaser';
import {
    PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY,
    PLAYER_BALL_BOOST_SPEED,
    PLAYER_BALL_BOOST_JUMP_MIN_HORIZONTAL_SPEED,
    PLAYER_GROUNDED_DRAG_X,
    PLAYER_MAX_FORM_MOVE_SPEED,
    PLAYER_GRAVITY_Y,
    PLAYER_PLACEHOLDER_RADIUS,
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
    resolvePlayerHazardHitShape,
    resolvePlayerLocomotionBodyConfig,
    resolvePlayerFormAnchor,
    resolveSquareSupportIntervalFromKnownBody,
    resolveSquareSupportIntervalFromOverlap,
    resolveSquareSupportProbe,
    resolveSquareTrailSurfacePoint
} from './geometry/player_geometry_queries';
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
    PlayerFormAnchor,
    PlayerHazardHitShape,
    PlayerSquareTrailSurfacePoint
} from './geometry/player_geometry_types';
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
            isCurrentlyGrounded: () => this.isCurrentlyGrounded()
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

    private isCurrentlyGrounded(): boolean {
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

