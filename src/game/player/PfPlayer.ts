import { GameObjects, Math as PhaserMath, Physics, Scene } from 'phaser';
import {
    PLAYER_BALL_BOOST_COOLDOWN_MS,
    PLAYER_BALL_BOOST_HOLD_ACCEL,
    PLAYER_BALL_BOOST_HOLD_AIR_MOVE_SPEED,
    PLAYER_BALL_BOOST_HOLD_MOVE_SPEED,
    PLAYER_BALL_REBOUND_FULL_APPROACH_SPEED,
    PLAYER_BALL_REBOUND_LANDING_WINDOW_MS,
    PLAYER_BALL_REBOUND_MAX_JUMP_VELOCITY,
    PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED,
    PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY,
    PLAYER_BALL_BOOST_SPEED,
    PLAYER_AIR_MOVE_ACCEL,
    PLAYER_AIR_MOVE_DECEL,
    PLAYER_BALL_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC,
    PLAYER_TRIANGLE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC,
    PLAYER_SQUARE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC,
    PLAYER_AIR_MOVE_SPEED,
    PLAYER_AIR_WIND_INFLUENCE_MULTIPLIER,
    PLAYER_AIR_WIND_MIN_DRIFT_RATIO,
    PLAYER_AIR_WIND_RESPONSE,
    PLAYER_GROUND_MOVE_ACCEL,
    PLAYER_GROUND_MOVE_DECEL,
    PLAYER_GROUND_MOVE_SPEED,
    PLAYER_GRAVITY_Y,
    PLAYER_JUMP_CUT_MULTIPLIER,
    PLAYER_JUMP_VELOCITY,
    PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
    PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_START_FORM,
    PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS,
    PLAYER_TRIANGLE_JUMP_CUT_MULTIPLIER,
    PLAYER_TRIANGLE_DASH_SPEED
} from './player_constants';
import { EMPTY_PLAYER_INPUT_SNAPSHOT, type PlayerInputSnapshot } from './player_input';
import {
    clearCoyoteTime,
    clearJumpBuffer,
    clearSquareAttachEntryBuffer,
    createPlayerTimers,
    hasCoyoteTime,
    hasJumpBuffer,
    hasSquareAttachEntryBuffer,
    pushJumpBuffer,
    pushSquareAttachEntryBuffer,
    refreshCoyoteTime,
    tickPlayerTimers,
    type PlayerTimers
} from './player_timers';
import { getNextPlayerForm, getPrevPlayerForm } from './player_form_switch';
import {
    createTriangleShellState,
    resetTriangleShellState,
    tickTriangleShellOrientation
} from './player_triangle_shell';
import {
    createSquareShellState,
    resetSquareShellState,
    tickSquareShellOrientation
} from './player_square_shell';
import {
    clearSquareAttach,
    tickSquareAttachState,
    tryEnterSquareAttach
} from './player_square_attach';
import {
    beginSquareTrailAnchor,
    tickSquareTrailDetachedLifecycle,
    tickSquareTrailPaint
} from './player_square_trail';
import { resolveSquareAttachSurfaceVelocity } from './player_square_surface_move';
import { applyTriangleSpecialJump } from './player_triangle_jump';
import {
    createTriangleDashState,
    resetTriangleDashState,
    stopTriangleDash,
    tickTriangleDashActive,
    tickTriangleDashCooldown,
    updateTriangleDashSelectedLeadingCorner,
    tryStartTriangleDash
} from './player_triangle_dash';
import {
    cancelTriangleChargesRestore,
    createTriangleChargesState,
    hasTriangleDashCharges,
    resetTriangleChargesState,
    tickTriangleChargesRestore,
    tryStartTriangleChargesRestore,
    tryConsumeTriangleDashCharge
} from './player_triangle_charges';
import type {
    PlayerFormId,
    PlayerShellState
} from './player_types';
import {
    createPlayerRectSnapshot,
    resolveArcadeAxisContactSnapshot,
    resolvePlayerHazardHitShape,
    resolvePlayerLocomotionBodyConfig,
    resolvePlayerFormAnchor,
    resolveSquareContactNormal,
    resolveSquareSupportIntervalFromKnownBody,
    resolveSquareSupportIntervalFromOverlap,
    resolveSquareSupportProbe,
    resolveSquareTrailSurfacePoint
} from './geometry/player_geometry_queries';
import type {
    PlayerFormAnchor,
    PlayerHazardHitShape,
    PlayerSquareTrailSurfacePoint
} from './geometry/player_geometry_types';
import { PlayerView } from './view/player_view';
import {
    resolveFormSwitchDecision,
    resolveFormTransitionResetDirective,
    resolveFreezeResetDirective,
    resolveInvalidFormStateCombinationFlags,
    resolveRespawnResetDirective,
    resolveSquareAttachEntryBufferDirective,
    resolveSquareAttachHoldDecision,
    resolveSquareAttachStartDecision,
    resolveTriangleDashStartDecision
} from './state/player_form_state_guards';
import {
    applyBallReboundSurfaceInputLock,
    clearBallReboundTrajectoryOnHorizontalInput,
    createBallReboundRuntimeState,
    resetBallReboundRuntimeState,
    resolveBallReboundPreservedVelocityXForRuntime,
    tickBallReboundPauseRuntime,
    tickBallReboundSurfaceInputLock,
    tickBallWallReboundContactCoyote,
    tryStartBallSurfaceReboundRuntime,
    type BallReboundRuntimeState
} from './player_ball_rebound_runtime';

export class PfPlayer {
    public readonly state: PlayerShellState;
    private readonly timers: PlayerTimers;
    private readonly physicsBody: Physics.Arcade.Body;
    private readonly physicsSprite: GameObjects.Arc;
    private readonly view: PlayerView;
    private jumpCutConsumed: boolean;
    private boostCooldownMs: number;
    private boostActive: boolean;
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

    public constructor(scene: Scene, x: number, y: number) {
        this.state = {
            currentForm: PLAYER_START_FORM,
            triangleShell: createTriangleShellState(1),
            squareShell: createSquareShellState(),
            triangleDash: createTriangleDashState(),
            triangleCharges: createTriangleChargesState()
        };
        this.timers = createPlayerTimers();
        this.jumpCutConsumed = false;
        this.boostCooldownMs = 0;
        this.boostActive = false;
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
        this.groundedDragX = 2400;
        this.physicsBody.setDragX(this.groundedDragX);
        this.physicsBody.setMaxVelocity(Math.max(PLAYER_GROUND_MOVE_SPEED, PLAYER_AIR_MOVE_SPEED, PLAYER_BALL_BOOST_SPEED), 1200);
        this.physicsBody.setCollideWorldBounds(true);
        this.physicsBody.setGravityY(PLAYER_GRAVITY_Y);

        this.view = new PlayerView(scene, x, y);
        this.applyCurrentFormCollisionBody();
        this.applyCurrentFormVisual();
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

    public freezeForRespawn(): void {
        const freezeDirective = resolveFreezeResetDirective();
        this.frozenForRespawn = freezeDirective.shouldFreezeRespawnState;
        this.view.hideTransientMarkers();
        if (freezeDirective.shouldResetTriangleDash) {
            resetTriangleDashState(this.state.triangleDash);
        }
        if (freezeDirective.shouldClearAirborneWindDrift) {
            this.airborneWindDriftX = 0;
        }
        resetBallReboundRuntimeState(this.ballReboundRuntime);
        this.physicsBody.setVelocity(0, 0);
        this.physicsBody.setAcceleration(0, 0);
        this.physicsBody.setAllowGravity(false);
    }

    public respawnAt(x: number, y: number): void {
        const respawnDirective = resolveRespawnResetDirective(PLAYER_START_FORM);
        this.state.currentForm = respawnDirective.nextForm;
        if (respawnDirective.resetTriangleShell) {
            resetTriangleShellState(this.state.triangleShell, 1);
        }
        if (respawnDirective.resetSquareShell) {
            resetSquareShellState(this.state.squareShell);
        }
        if (respawnDirective.resetTriangleDash) {
            resetTriangleDashState(this.state.triangleDash);
        }
        if (respawnDirective.resetTriangleCharges) {
            resetTriangleChargesState(this.state.triangleCharges);
        }

        if (respawnDirective.resetJumpCutConsumed) {
            this.jumpCutConsumed = false;
        }
        if (respawnDirective.resetBoostCooldown) {
            this.boostCooldownMs = 0;
        }
        if (respawnDirective.resetBoostActive) {
            this.boostActive = false;
        }
        if (respawnDirective.resetPendingBoostRequest) {
            this.pendingBoostRequest = false;
        }
        if (respawnDirective.resetWasGrounded) {
            this.wasGrounded = false;
        }
        if (respawnDirective.resetLastMoveDirection) {
            this.lastMoveDirection = 1;
        }
        if (respawnDirective.resetReboundWindow) {
            this.reboundWindowMs = 0;
        }
        if (respawnDirective.resetReboundJumpVelocity) {
            this.reboundJumpVelocity = PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY;
        }
        if (respawnDirective.resetLastAirborneDownwardSpeed) {
            this.lastAirborneDownwardSpeed = 0;
        }
        resetBallReboundRuntimeState(this.ballReboundRuntime);
        if (respawnDirective.resetAirborneWindDrift) {
            this.airborneWindDriftX = 0;
        }

        if (respawnDirective.clearJumpBuffer) {
            clearJumpBuffer(this.timers);
        }
        if (respawnDirective.clearSquareAttachEntryBuffer) {
            clearSquareAttachEntryBuffer(this.timers);
        }
        if (respawnDirective.clearCoyoteTime) {
            clearCoyoteTime(this.timers);
        }
        if (respawnDirective.resetTransformLock) {
            this.timers.transformLockMs = 0;
        }
        if (respawnDirective.resetDeathPause) {
            this.timers.deathPauseMs = 0;
        }

        this.physicsBody.setAllowGravity(true);
        this.physicsBody.setVelocity(0, 0);
        this.physicsBody.setAcceleration(0, 0);
        this.physicsBody.reset(x, y);

        this.frozenForRespawn = !respawnDirective.unfreezeRespawnState;
        this.applyCurrentFormCollisionBody();
        this.applyCurrentFormVisual();
        this.syncVisualPosition();
        this.updateTriangleLeadingCornerVisual(false, EMPTY_PLAYER_INPUT_SNAPSHOT);
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot, externalHorizontalInfluenceX: number = 0): void {
        if (this.frozenForRespawn) {
            return;
        }

        const deltaSec = deltaMs / 1000;
        this.tryHandleFormSwitch(input);
        const isTriangleForm = this.state.currentForm === 'triangle';
        const isBallForm = this.state.currentForm === 'ball';
        const isSquareForm = this.state.currentForm === 'square';
        const triangleDash = this.state.triangleDash;
        const triangleCharges = this.state.triangleCharges;
        tickTriangleDashCooldown(triangleDash, deltaMs);

        const grounded = this.physicsBody.blocked.down || this.physicsBody.touching.down;
        this.physicsBody.setDragX(grounded ? this.groundedDragX : 0);
        const justLanded = grounded && !this.wasGrounded;
        if (grounded) {
            refreshCoyoteTime(this.timers);
            this.jumpCutConsumed = false;
            resetBallReboundRuntimeState(this.ballReboundRuntime);
        } else if (this.physicsBody.velocity.y > 0) {
            this.lastAirborneDownwardSpeed = Math.max(this.lastAirborneDownwardSpeed, this.physicsBody.velocity.y);
        }

        if (justLanded) {
            const reboundVelocity = this.resolveReboundJumpVelocity(this.lastAirborneDownwardSpeed);
            if (reboundVelocity !== null) {
                this.reboundJumpVelocity = reboundVelocity;
                this.reboundWindowMs = PLAYER_BALL_REBOUND_LANDING_WINDOW_MS;
            } else {
                this.reboundWindowMs = 0;
            }

            this.lastAirborneDownwardSpeed = 0;
        }

        if (isTriangleForm) {
            if (input.regenPressed) {
                tryStartTriangleChargesRestore(triangleCharges, grounded);
            }

            if (!grounded) {
                cancelTriangleChargesRestore(triangleCharges);
            } else {
                tickTriangleChargesRestore(triangleCharges, deltaMs);
            }
        } else {
            cancelTriangleChargesRestore(triangleCharges);
        }

        if (isBallForm && !input.actionHeld) {
            this.boostActive = false;
            this.pendingBoostRequest = false;
        } else if (!isBallForm) {
            this.boostActive = false;
            this.pendingBoostRequest = false;
        }

        if (input.jumpPressed) {
            pushJumpBuffer(this.timers);
        }

        const preMoveVelocityX = this.physicsBody.velocity.x;
        const preMoveVelocityY = this.physicsBody.velocity.y;

        const squareAttachEntryBufferDirective = resolveSquareAttachEntryBufferDirective({
            currentForm: this.state.currentForm,
            actionPressed: input.actionPressed,
            actionHeld: input.actionHeld
        });
        if (squareAttachEntryBufferDirective.shouldPushEntryBuffer) {
            pushSquareAttachEntryBuffer(this.timers);
        }
        if (squareAttachEntryBufferDirective.shouldClearEntryBuffer) {
            clearSquareAttachEntryBuffer(this.timers);
        }

        const rawHorizontalDir = ((input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0)) as -1 | 0 | 1;
        tickBallWallReboundContactCoyote(
            this.ballReboundRuntime,
            this.physicsBody,
            this.physicsSprite,
            isBallForm,
            grounded,
            deltaMs
        );
        const reboundPausePhase = tickBallReboundPauseRuntime(
            this.ballReboundRuntime,
            this.physicsBody,
            isBallForm,
            grounded,
            deltaMs
        );
        const isBallReboundPauseHolding = reboundPausePhase === 'holding';
        const didLaunchBallReboundThisFrame = reboundPausePhase === 'launched';
        tickBallReboundSurfaceInputLock(this.ballReboundRuntime, isBallForm, grounded, deltaMs);
        const horizontalDir = applyBallReboundSurfaceInputLock(this.ballReboundRuntime, rawHorizontalDir);
        if (horizontalDir !== 0) {
            this.lastMoveDirection = horizontalDir > 0 ? 1 : -1;
            clearBallReboundTrajectoryOnHorizontalInput(this.ballReboundRuntime);
        }
        const preservedReboundVelocityX = resolveBallReboundPreservedVelocityXForRuntime(
            this.ballReboundRuntime,
            isBallForm,
            grounded,
            horizontalDir
        );

        let isTriangleDashActive = isTriangleForm && triangleDash.isActive;
        let dashStartedThisFrame = false;
        if (isTriangleForm && !isTriangleDashActive) {
            const dashSelectionGrounded = this.isCurrentlyGrounded();
            updateTriangleDashSelectedLeadingCorner(
                triangleDash,
                this.state.triangleShell,
                input.forcePointX,
                input.forcePointY,
                input.forcePointActive,
                dashSelectionGrounded
            );
        }

        if (isSquareForm) {
            const attachedNormalX = this.state.squareShell.isAttached
                ? this.state.squareShell.attachNormalX
                : undefined;
            const attachedNormalY = this.state.squareShell.isAttached
                ? this.state.squareShell.attachNormalY
                : undefined;
            const verticalDir = (input.moveDown ? 1 : 0) - (input.moveUp ? 1 : 0);
            const contactSnapshot = resolveArcadeAxisContactSnapshot(
                this.physicsBody.blocked,
                this.physicsBody.touching
            );
            const squareContact = resolveSquareContactNormal(
                contactSnapshot,
                attachedNormalX,
                attachedNormalY,
                horizontalDir as -1 | 0 | 1,
                verticalDir as -1 | 0 | 1
            );
            tickSquareShellOrientation(
                this.state.squareShell,
                deltaSec,
                squareContact.normalX,
                squareContact.normalY,
                squareContact.hasContact
            );

            const squareAttachStartDecision = resolveSquareAttachStartDecision({
                currentForm: this.state.currentForm,
                actionHeld: input.actionHeld,
                hasEntryBuffer: hasSquareAttachEntryBuffer(this.timers),
                isAttached: this.state.squareShell.isAttached,
                hasContact: squareContact.hasContact
            });
            if (squareAttachStartDecision.canStart) {
                const attachStarted = tryEnterSquareAttach(
                    this.state.squareShell,
                    squareContact.hasContact,
                    squareContact.normalX,
                    squareContact.normalY
                );
                if (attachStarted) {
                    const surfacePoint = this.resolveSquareTrailSurfacePoint(
                        this.state.squareShell.attachNormalX,
                        this.state.squareShell.attachNormalY
                    );
                    beginSquareTrailAnchor(
                        this.state.squareShell,
                        surfacePoint.x,
                        surfacePoint.y,
                        surfacePoint.supportOwner
                    );
                    clearJumpBuffer(this.timers);
                    clearSquareAttachEntryBuffer(this.timers);
                }
            }

            const squareAttachHoldDecision = resolveSquareAttachHoldDecision({
                currentForm: this.state.currentForm,
                isAttached: this.state.squareShell.isAttached,
                actionHeld: input.actionHeld
            });
            tickSquareAttachState(
                this.state.squareShell,
                deltaMs,
                squareAttachHoldDecision.shouldKeepAttachHold,
                squareContact.hasContact,
                squareContact.normalX,
                squareContact.normalY
            );
            const trailSurfacePoint = this.resolveSquareTrailSurfacePoint(
                this.state.squareShell.attachNormalX,
                this.state.squareShell.attachNormalY
            );
            tickSquareTrailPaint(
                this.state.squareShell,
                trailSurfacePoint.x,
                trailSurfacePoint.y,
                trailSurfacePoint.supportOwner,
                this.state.squareShell.hasContact
            );
        }
        const triangleDashStartDecision = resolveTriangleDashStartDecision({
            currentForm: this.state.currentForm,
            actionPressed: input.actionPressed,
            isDashActive: isTriangleDashActive,
            dashCooldownMs: triangleDash.cooldownMs,
            hasDashCharges: hasTriangleDashCharges(this.state.triangleCharges)
        });
        if (triangleDashStartDecision.canStart) {
            dashStartedThisFrame = this.tryApplyTriangleDash();
            isTriangleDashActive = dashStartedThisFrame;
        }

        const hasBoostHold = this.boostActive && input.actionHeld;
        const effectiveExternalInfluenceX = grounded
            ? externalHorizontalInfluenceX
            : externalHorizontalInfluenceX * PLAYER_AIR_WIND_INFLUENCE_MULTIPLIER;
        const invalidFormStateFlags = resolveInvalidFormStateCombinationFlags({
            currentForm: this.state.currentForm,
            triangleDashActive: this.state.triangleDash.isActive,
            squareAttached: this.state.squareShell.isAttached
        });
        if (invalidFormStateFlags.triangleDashOutsideTriangle) {
            resetTriangleDashState(this.state.triangleDash);
        }
        const isSquareAttached = isSquareForm && !invalidFormStateFlags.squareAttachOutsideSquare && this.state.squareShell.isAttached;
        this.physicsBody.setAllowGravity(!isTriangleDashActive && !isSquareAttached && !isBallReboundPauseHolding);

        if (isTriangleDashActive) {
            this.state.triangleShell.orientationRad = triangleDash.lockedOrientationRad;
            this.physicsBody.setVelocity(
                triangleDash.directionX * PLAYER_TRIANGLE_DASH_SPEED,
                triangleDash.directionY * PLAYER_TRIANGLE_DASH_SPEED
            );
        } else if (isBallReboundPauseHolding) {
            this.physicsBody.setVelocity(0, 0);
            this.physicsBody.setAcceleration(0, 0);
        } else if (didLaunchBallReboundThisFrame) {
            this.physicsBody.setAcceleration(0, 0);
        } else if (isSquareAttached) {
            const attachVelocity = resolveSquareAttachSurfaceVelocity(
                this.state.squareShell.attachNormalX,
                this.state.squareShell.attachNormalY,
                input,
                PLAYER_SQUARE_ATTACH_HOLD_STICK_SPEED,
                PLAYER_SQUARE_ATTACH_SURFACE_MOVE_SPEED
            );
            this.physicsBody.setVelocity(attachVelocity.velocityX, attachVelocity.velocityY);
            this.physicsBody.setAcceleration(0, 0);
        } else {
            const currentVelocityX = this.physicsBody.velocity.x;
            let nextVelocityX = currentVelocityX;

            if (preservedReboundVelocityX !== null) {
                nextVelocityX = preservedReboundVelocityX;
            } else {
                const moveSpeed = this.resolveMoveSpeed(grounded, hasBoostHold);
                const moveResponse = this.resolveMoveResponse(grounded, horizontalDir, hasBoostHold);
                const targetVelocityX = this.resolveTargetVelocityX(
                    currentVelocityX,
                    grounded,
                    horizontalDir,
                    moveSpeed,
                    effectiveExternalInfluenceX
                );
                const maxStepX = moveResponse * deltaSec;
                nextVelocityX = this.moveToward(currentVelocityX, targetVelocityX, maxStepX);
                if (grounded) {
                    this.airborneWindDriftX = 0;
                } else {
                    if (horizontalDir === 0) {
                        nextVelocityX = this.applyAirborneNoInputInertiaDamping(nextVelocityX, deltaSec, this.state.currentForm);
                    }
                    nextVelocityX = this.applyAirborneWindDrift(nextVelocityX, effectiveExternalInfluenceX, deltaSec);
                }
            }

            this.physicsBody.setVelocityX(nextVelocityX);
        }

        if (isTriangleForm && !isTriangleDashActive) {
            tickTriangleShellOrientation(
                this.state.triangleShell,
                grounded,
                justLanded,
                horizontalDir,
                this.physicsBody.velocity.x,
                deltaSec
            );

            if (grounded) {
                updateTriangleDashSelectedLeadingCorner(
                    triangleDash,
                    this.state.triangleShell,
                    input.forcePointX,
                    input.forcePointY,
                    input.forcePointActive,
                    grounded
                );
            }
        }

        const canProcessJump = !isTriangleDashActive && !isSquareAttached && !isBallReboundPauseHolding && hasJumpBuffer(this.timers);
        if (canProcessJump && isBallForm && !grounded && tryStartBallSurfaceReboundRuntime(
            this.ballReboundRuntime,
            this.physicsBody,
            hasBoostHold,
            preMoveVelocityX,
            preMoveVelocityY
        )) {
            clearJumpBuffer(this.timers);
            clearCoyoteTime(this.timers);
            this.lastAirborneDownwardSpeed = 0;
            this.jumpCutConsumed = true;
            this.reboundWindowMs = 0;
        }

        const canJump = grounded || hasCoyoteTime(this.timers);
        if (canProcessJump && canJump && hasJumpBuffer(this.timers)) {
            if (this.state.currentForm === 'triangle') {
                const triangleJumpLaunch = applyTriangleSpecialJump(
                    this.state.triangleShell,
                    horizontalDir,
                    this.lastMoveDirection
                );
                this.physicsBody.setVelocityY(triangleJumpLaunch.velocityY);
                this.jumpCutConsumed = false;
                this.reboundWindowMs = 0;
            } else {
                const hasReboundJump = grounded && this.reboundWindowMs > 0;
                const jumpVelocity = hasReboundJump ? this.reboundJumpVelocity : PLAYER_JUMP_VELOCITY;
                this.physicsBody.setVelocityY(jumpVelocity);
                this.jumpCutConsumed = hasReboundJump;
                this.reboundWindowMs = 0;
            }

            clearJumpBuffer(this.timers);
            clearCoyoteTime(this.timers);
            this.lastAirborneDownwardSpeed = 0;
        }

        if (!isTriangleDashActive && !isSquareAttached && !input.jumpHeld && !this.jumpCutConsumed && this.physicsBody.velocity.y < 0) {
            const jumpCutMultiplier = this.state.currentForm === 'triangle'
                ? PLAYER_TRIANGLE_JUMP_CUT_MULTIPLIER
                : PLAYER_JUMP_CUT_MULTIPLIER;
            this.physicsBody.setVelocityY(this.physicsBody.velocity.y * jumpCutMultiplier);
            this.jumpCutConsumed = true;
        }

        if (input.actionPressed && isBallForm) {
            if (grounded) {
                this.tryApplyBoost(grounded, horizontalDir);
            } else {
                this.pendingBoostRequest = true;
            }
        }

        if (isBallForm && justLanded && this.pendingBoostRequest && input.actionHeld) {
            this.tryApplyBoost(grounded, horizontalDir, true);
            if (this.boostActive) {
                this.pendingBoostRequest = false;
            }
        }

        if (triangleDash.isActive && !dashStartedThisFrame) {
            tickTriangleDashActive(triangleDash, deltaMs);
            if (!triangleDash.isActive) {
                this.physicsBody.setAllowGravity(true);
            }
        }

        this.reboundWindowMs = Math.max(0, this.reboundWindowMs - deltaMs);
        this.boostCooldownMs = Math.max(0, this.boostCooldownMs - deltaMs);
        tickPlayerTimers(this.timers, deltaMs);
        const detachedTrailRefund = tickSquareTrailDetachedLifecycle(this.state.squareShell, deltaMs);
        if (detachedTrailRefund > 0) {
            this.state.squareShell.trailResourceCurrent = PhaserMath.Clamp(
                this.state.squareShell.trailResourceCurrent + detachedTrailRefund,
                0,
                this.state.squareShell.trailResourceMax
            );
        }
        this.wasGrounded = grounded;
        this.syncVisualPosition();
        this.updateTriangleLeadingCornerVisual(this.isCurrentlyGrounded(), input);
    }

    private tryHandleFormSwitch(input: PlayerInputSnapshot): void {
        const switchDecision = resolveFormSwitchDecision({
            currentForm: this.state.currentForm,
            transformLockMs: this.timers.transformLockMs,
            wantsNextForm: input.nextFormPressed,
            wantsPrevForm: input.prevFormPressed,
            nextForm: getNextPlayerForm(this.state.currentForm),
            prevForm: getPrevPlayerForm(this.state.currentForm)
        });
        if (!switchDecision.shouldSwitch) {
            return;
        }

        const previousForm = this.state.currentForm;
        this.state.currentForm = switchDecision.targetForm;
        if (switchDecision.shouldApplyTransformLock) {
            this.timers.transformLockMs = PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS;
        }
        const transitionReset = resolveFormTransitionResetDirective(previousForm, switchDecision.targetForm);
        if (transitionReset.resetTriangleShell) {
            resetTriangleShellState(this.state.triangleShell, this.lastMoveDirection);
        }
        if (transitionReset.resetTriangleDash) {
            resetTriangleDashState(this.state.triangleDash);
        } else if (transitionReset.stopTriangleDash) {
            stopTriangleDash(this.state.triangleDash);
        }
        if (transitionReset.resetSquareShell) {
            resetSquareShellState(this.state.squareShell);
        }
        if (transitionReset.clearSquareAttach) {
            clearSquareAttach(this.state.squareShell);
        }
        resetBallReboundRuntimeState(this.ballReboundRuntime);
        this.physicsBody.setAllowGravity(true);
        this.applyCurrentFormCollisionBody();
        this.applyCurrentFormVisual();
    }

    private applyCurrentFormVisual(): void {
        this.view.applyCurrentFormVisibility(this.state.currentForm, this.state.squareShell);
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
            this.state.triangleShell,
            this.state.squareShell
        );
    }

    private applyCurrentFormCollisionBody(): void {
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

    private updateTriangleLeadingCornerVisual(
        grounded: boolean,
        input: PlayerInputSnapshot
    ): void {
        this.view.updateTriangleLeadingCornerMarker(
            this.state.currentForm,
            this.physicsSprite.x,
            this.physicsSprite.y,
            this.state.triangleShell,
            this.state.triangleDash,
            grounded,
            input
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

    private resolveReboundJumpVelocity(approachSpeed: number): number | null {
        if (approachSpeed < PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED) {
            return null;
        }

        const range = PLAYER_BALL_REBOUND_FULL_APPROACH_SPEED - PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED;
        const clampedAlpha = range <= 0
            ? 1
            : PhaserMath.Clamp((approachSpeed - PLAYER_BALL_REBOUND_MIN_APPROACH_SPEED) / range, 0, 1);

        return PhaserMath.Linear(
            PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY,
            PLAYER_BALL_REBOUND_MAX_JUMP_VELOCITY,
            clampedAlpha
        );
    }

    private tryApplyBoost(grounded: boolean, horizontalDir: number, ignoreCooldown: boolean = false): void {
        if (!grounded || (!ignoreCooldown && this.boostCooldownMs > 0)) {
            return;
        }

        const boostDirection = this.resolveBoostDirection(horizontalDir);
        this.physicsBody.setVelocityX(boostDirection * PLAYER_BALL_BOOST_SPEED);
        this.boostCooldownMs = PLAYER_BALL_BOOST_COOLDOWN_MS;
        this.boostActive = true;
    }

    private tryApplyTriangleDash(): boolean {
        if (this.state.currentForm !== 'triangle') {
            return false;
        }

        if (!hasTriangleDashCharges(this.state.triangleCharges)) {
            return false;
        }

        const grounded = this.isCurrentlyGrounded();
        const dashLaunch = tryStartTriangleDash(
            this.state.triangleDash,
            this.state.triangleShell,
            grounded
        );

        if (dashLaunch === null) {
            return false;
        }

        tryConsumeTriangleDashCharge(this.state.triangleCharges);
        this.jumpCutConsumed = false;
        this.state.triangleShell.orientationRad = dashLaunch.lockedOrientationRad;
        this.physicsBody.setAllowGravity(false);
        this.physicsBody.setVelocity(dashLaunch.velocityX, dashLaunch.velocityY);
        return true;
    }

    private resolveBoostDirection(horizontalDir: number): -1 | 1 {
        if (horizontalDir < 0) {
            return -1;
        }

        if (horizontalDir > 0) {
            return 1;
        }

        return this.lastMoveDirection;
    }

    private moveToward(current: number, target: number, maxDelta: number): number {
        if (current < target) {
            return Math.min(current + maxDelta, target);
        }

        if (current > target) {
            return Math.max(current - maxDelta, target);
        }

        return target;
    }

    private resolveMoveResponse(
        grounded: boolean,
        horizontalDir: number,
        hasBoostHold: boolean
    ): number {
        if (hasBoostHold && horizontalDir !== 0) {
            return PLAYER_BALL_BOOST_HOLD_ACCEL;
        }

        if (grounded) {
            return horizontalDir === 0 ? PLAYER_GROUND_MOVE_DECEL : PLAYER_GROUND_MOVE_ACCEL;
        }

        return horizontalDir === 0 ? PLAYER_AIR_MOVE_DECEL : PLAYER_AIR_MOVE_ACCEL;
    }

    private resolveTargetVelocityX(
        currentVelocityX: number,
        grounded: boolean,
        horizontalDir: number,
        moveSpeed: number,
        externalInfluenceX: number
    ): number {
        if (!grounded && horizontalDir === 0) {
            return currentVelocityX;
        }

        return (horizontalDir * moveSpeed) + (grounded ? externalInfluenceX : 0);
    }

    private applyAirborneWindDrift(baseVelocityX: number, windInfluenceX: number, deltaSec: number): number {
        const windStep = PLAYER_AIR_WIND_RESPONSE * deltaSec;
        this.airborneWindDriftX = this.moveToward(this.airborneWindDriftX, windInfluenceX, windStep);

        if (Math.abs(this.airborneWindDriftX) <= 0.001) {
            return baseVelocityX;
        }

        let velocityWithDrift = baseVelocityX + this.airborneWindDriftX;
        const minDriftMagnitude = Math.abs(this.airborneWindDriftX) * PLAYER_AIR_WIND_MIN_DRIFT_RATIO;
        const windDirection = this.airborneWindDriftX > 0 ? 1 : -1;
        const signedMinDrift = minDriftMagnitude * windDirection;

        if (windDirection > 0 && velocityWithDrift < signedMinDrift) {
            velocityWithDrift = signedMinDrift;
        } else if (windDirection < 0 && velocityWithDrift > signedMinDrift) {
            velocityWithDrift = signedMinDrift;
        }

        return velocityWithDrift;
    }

    private applyAirborneNoInputInertiaDamping(
        velocityX: number,
        deltaSec: number,
        form: PlayerFormId
    ): number {
        const dampingPerSec = this.resolveAirNoInputInertiaDampingPerSec(form);
        const dampingFactor = Math.max(0, 1 - (dampingPerSec * deltaSec));
        return velocityX * dampingFactor;
    }

    private resolveAirNoInputInertiaDampingPerSec(form: PlayerFormId): number {
        if (form === 'square') {
            return PLAYER_SQUARE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
        }

        if (form === 'triangle') {
            return PLAYER_TRIANGLE_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
        }

        return PLAYER_BALL_AIR_NO_INPUT_INERTIA_DAMPING_PER_SEC;
    }

    private resolveMoveSpeed(grounded: boolean, hasBoostHold: boolean): number {
        if (!hasBoostHold) {
            return grounded ? PLAYER_GROUND_MOVE_SPEED : PLAYER_AIR_MOVE_SPEED;
        }

        return grounded ? PLAYER_BALL_BOOST_HOLD_MOVE_SPEED : PLAYER_BALL_BOOST_HOLD_AIR_MOVE_SPEED;
    }

    private isCurrentlyGrounded(): boolean {
        return this.physicsBody.blocked.down || this.physicsBody.touching.down;
    }
}
