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
    PLAYER_FORM_SQUARE_SIZE,
    PLAYER_FORM_TRIANGLE_HEIGHT,
    PLAYER_FORM_TRIANGLE_WIDTH,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_START_FORM,
    PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS,
    PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD,
    PLAYER_TRIANGLE_JUMP_CUT_MULTIPLIER,
    PLAYER_TRIANGLE_DASH_SPEED,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_ALPHA,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_SCALE,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_ALPHA,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_SCALE,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_OUTWARD_OFFSET,
    PLAYER_TRIANGLE_LEADING_CORNER_MARKER_RADIUS
} from './player_constants';
import { EMPTY_PLAYER_INPUT_SNAPSHOT, type PlayerInputSnapshot } from './player_input';
import {
    clearCoyoteTime,
    clearJumpBuffer,
    createPlayerTimers,
    hasCoyoteTime,
    hasJumpBuffer,
    pushJumpBuffer,
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
import { applyTriangleSpecialJump } from './player_triangle_jump';
import {
    createTriangleDashState,
    resolveTriangleDashLeadingCornerPreview,
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
import { resolveTriangleLeadingCornerMarkerOffset } from './player_triangle_leading_corner_visual';
import type { PlayerFormId, PlayerShellState } from './player_types';

export class PfPlayer {
    public readonly state: PlayerShellState;
    private readonly timers: PlayerTimers;
    private lastInput: PlayerInputSnapshot;
    private readonly physicsBody: Physics.Arcade.Body;
    private readonly physicsSprite: GameObjects.Arc;
    private readonly ballVisual: GameObjects.Arc;
    private readonly triangleVisual: GameObjects.Triangle;
    private readonly squareVisual: GameObjects.Rectangle;
    private readonly triangleLeadingCornerMarker: GameObjects.Arc;
    private jumpCutConsumed: boolean;
    private boostCooldownMs: number;
    private boostActive: boolean;
    private pendingBoostRequest: boolean;
    private wasGrounded: boolean;
    private lastMoveDirection: -1 | 1;
    private reboundWindowMs: number;
    private reboundJumpVelocity: number;
    private lastAirborneDownwardSpeed: number;
    private frozenForRespawn: boolean;
    private airborneWindDriftX: number;

    public constructor(scene: Scene, x: number, y: number) {
        this.state = {
            currentForm: PLAYER_START_FORM,
            triangleShell: createTriangleShellState(1),
            triangleDash: createTriangleDashState(),
            triangleCharges: createTriangleChargesState()
        };
        this.timers = createPlayerTimers();
        this.lastInput = EMPTY_PLAYER_INPUT_SNAPSHOT;
        this.jumpCutConsumed = false;
        this.boostCooldownMs = 0;
        this.boostActive = false;
        this.pendingBoostRequest = false;
        this.wasGrounded = false;
        this.lastMoveDirection = 1;
        this.reboundWindowMs = 0;
        this.reboundJumpVelocity = PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY;
        this.lastAirborneDownwardSpeed = 0;
        this.frozenForRespawn = false;
        this.airborneWindDriftX = 0;

        this.physicsSprite = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0xffffff, 0.01);
        this.physicsSprite.setDepth(4498);
        this.physicsSprite.name = 'pf_player';
        scene.physics.add.existing(this.physicsSprite);
        this.physicsBody = this.physicsSprite.body as Physics.Arcade.Body;
        this.physicsBody.setCircle(PLAYER_PLACEHOLDER_RADIUS);
        this.physicsBody.setBounce(0);
        this.physicsBody.setDragX(2400);
        this.physicsBody.setMaxVelocity(Math.max(PLAYER_GROUND_MOVE_SPEED, PLAYER_AIR_MOVE_SPEED, PLAYER_BALL_BOOST_SPEED), 1200);
        this.physicsBody.setCollideWorldBounds(true);
        this.physicsBody.setGravityY(PLAYER_GRAVITY_Y);

        this.ballVisual = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0x00e5ff)
            .setStrokeStyle(2, 0xffffff)
            .setDepth(4500);
        this.triangleVisual = scene.add.triangle(
            x,
            y,
            0,
            PLAYER_FORM_TRIANGLE_HEIGHT,
            PLAYER_FORM_TRIANGLE_WIDTH * 0.5,
            0,
            PLAYER_FORM_TRIANGLE_WIDTH,
            PLAYER_FORM_TRIANGLE_HEIGHT,
            0xffb74d
        )
            .setStrokeStyle(2, 0xffffff)
            .setDepth(4500)
            .setVisible(false)
            .setRotation(PLAYER_TRIANGLE_EDGE_DOWN_POSE_RAD);
        this.squareVisual = scene.add.rectangle(x, y, PLAYER_FORM_SQUARE_SIZE, PLAYER_FORM_SQUARE_SIZE, 0xa5d6a7)
            .setStrokeStyle(2, 0xffffff)
            .setDepth(4500)
            .setVisible(false);
        this.triangleLeadingCornerMarker = scene.add.circle(x, y, PLAYER_TRIANGLE_LEADING_CORNER_MARKER_RADIUS, 0xffffff)
            .setStrokeStyle(2, 0xffb74d)
            .setDepth(4501)
            .setVisible(false)
            .setAlpha(PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_ALPHA);

        this.applyCurrentFormVisual();
    }

    public get currentForm(): PlayerFormId {
        return this.state.currentForm;
    }

    public get arcadeBodyObject(): GameObjects.Arc {
        return this.physicsSprite;
    }

    public freezeForRespawn(): void {
        this.frozenForRespawn = true;
        this.triangleLeadingCornerMarker.setVisible(false);
        this.airborneWindDriftX = 0;
        this.physicsBody.setVelocity(0, 0);
        this.physicsBody.setAcceleration(0, 0);
        this.physicsBody.setAllowGravity(false);
    }

    public respawnAt(x: number, y: number): void {
        this.state.currentForm = PLAYER_START_FORM;
        resetTriangleShellState(this.state.triangleShell, 1);
        resetTriangleDashState(this.state.triangleDash);
        resetTriangleChargesState(this.state.triangleCharges);

        this.lastInput = EMPTY_PLAYER_INPUT_SNAPSHOT;
        this.jumpCutConsumed = false;
        this.boostCooldownMs = 0;
        this.boostActive = false;
        this.pendingBoostRequest = false;
        this.wasGrounded = false;
        this.lastMoveDirection = 1;
        this.reboundWindowMs = 0;
        this.reboundJumpVelocity = PLAYER_BALL_REBOUND_MIN_JUMP_VELOCITY;
        this.lastAirborneDownwardSpeed = 0;
        this.airborneWindDriftX = 0;

        clearJumpBuffer(this.timers);
        clearCoyoteTime(this.timers);
        this.timers.transformLockMs = 0;
        this.timers.deathPauseMs = 0;

        this.physicsBody.setAllowGravity(true);
        this.physicsBody.setVelocity(0, 0);
        this.physicsBody.setAcceleration(0, 0);
        this.physicsBody.reset(x, y);

        this.frozenForRespawn = false;
        this.applyCurrentFormVisual();
        this.syncVisualPosition();
        this.updateTriangleLeadingCornerVisual(false, EMPTY_PLAYER_INPUT_SNAPSHOT);
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot, externalHorizontalInfluenceX: number = 0): void {
        if (this.frozenForRespawn) {
            this.lastInput = EMPTY_PLAYER_INPUT_SNAPSHOT;
            return;
        }

        this.lastInput = input;
        const deltaSec = deltaMs / 1000;
        this.tryHandleFormSwitch(input);
        const isTriangleForm = this.state.currentForm === 'triangle';
        const isBallForm = this.state.currentForm === 'ball';
        const triangleDash = this.state.triangleDash;
        const triangleCharges = this.state.triangleCharges;
        tickTriangleDashCooldown(triangleDash, deltaMs);

        const grounded = this.physicsBody.blocked.down || this.physicsBody.touching.down;
        const justLanded = grounded && !this.wasGrounded;
        if (grounded) {
            refreshCoyoteTime(this.timers);
            this.jumpCutConsumed = false;
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

        const horizontalDir = (input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0);
        if (horizontalDir !== 0) {
            this.lastMoveDirection = horizontalDir > 0 ? 1 : -1;
        }

        let isTriangleDashActive = isTriangleForm && triangleDash.isActive;
        let dashStartedThisFrame = false;
        if (isTriangleForm && !isTriangleDashActive) {
            const dashSelectionGrounded = this.isCurrentlyGrounded();
            updateTriangleDashSelectedLeadingCorner(
                triangleDash,
                this.state.triangleShell,
                horizontalDir,
                this.lastMoveDirection,
                dashSelectionGrounded
            );
        }
        if (input.actionPressed && isTriangleForm && !isTriangleDashActive) {
            dashStartedThisFrame = this.tryApplyTriangleDash();
            isTriangleDashActive = dashStartedThisFrame;
        }

        const hasBoostHold = this.boostActive && input.actionHeld;
        const effectiveExternalInfluenceX = grounded
            ? externalHorizontalInfluenceX
            : externalHorizontalInfluenceX * PLAYER_AIR_WIND_INFLUENCE_MULTIPLIER;
        this.physicsBody.setAllowGravity(!isTriangleDashActive);

        if (isTriangleDashActive) {
            this.state.triangleShell.orientationRad = triangleDash.lockedOrientationRad;
            this.physicsBody.setVelocity(
                triangleDash.directionX * PLAYER_TRIANGLE_DASH_SPEED,
                triangleDash.directionY * PLAYER_TRIANGLE_DASH_SPEED
            );
        } else {
            const moveSpeed = this.resolveMoveSpeed(grounded, hasBoostHold);
            const moveResponse = this.resolveMoveResponse(grounded, horizontalDir, hasBoostHold);
            const targetVelocityX = (horizontalDir * moveSpeed) + (grounded ? effectiveExternalInfluenceX : 0);
            const currentVelocityX = this.physicsBody.velocity.x;
            const maxStepX = moveResponse * deltaSec;
            let nextVelocityX = this.moveToward(currentVelocityX, targetVelocityX, maxStepX);

            if (grounded) {
                this.airborneWindDriftX = 0;
            } else {
                nextVelocityX = this.applyAirborneWindDrift(nextVelocityX, effectiveExternalInfluenceX, deltaSec);
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
                    horizontalDir,
                    this.lastMoveDirection,
                    grounded
                );
            }
        }

        const canJump = grounded || hasCoyoteTime(this.timers);
        if (!isTriangleDashActive && canJump && hasJumpBuffer(this.timers)) {
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

        if (!isTriangleDashActive && !input.jumpHeld && !this.jumpCutConsumed && this.physicsBody.velocity.y < 0) {
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
        this.wasGrounded = grounded;
        this.syncVisualPosition();
        this.updateTriangleLeadingCornerVisual(this.isCurrentlyGrounded(), input);
    }

    private tryHandleFormSwitch(input: PlayerInputSnapshot): void {
        if (this.timers.transformLockMs > 0) {
            return;
        }

        const wantsNextForm = input.nextFormPressed;
        const wantsPrevForm = input.prevFormPressed;
        if (wantsNextForm === wantsPrevForm) {
            return;
        }

        const nextForm = wantsNextForm
            ? getNextPlayerForm(this.state.currentForm)
            : getPrevPlayerForm(this.state.currentForm);

        if (nextForm === this.state.currentForm) {
            return;
        }

        const previousForm = this.state.currentForm;
        this.state.currentForm = nextForm;
        this.timers.transformLockMs = PLAYER_TIMER_DEFAULT_TRANSFORM_LOCK_MS;
        if (nextForm === 'triangle') {
            resetTriangleShellState(this.state.triangleShell, this.lastMoveDirection);
            stopTriangleDash(this.state.triangleDash);
        } else if (previousForm === 'triangle') {
            stopTriangleDash(this.state.triangleDash);
        }
        this.physicsBody.setAllowGravity(true);
        this.applyCurrentFormVisual();
    }

    private applyCurrentFormVisual(): void {
        const currentForm = this.state.currentForm;
        this.ballVisual.setVisible(currentForm === 'ball');
        this.triangleVisual.setVisible(currentForm === 'triangle');
        this.squareVisual.setVisible(currentForm === 'square');
        this.triangleLeadingCornerMarker.setVisible(currentForm === 'triangle');
    }

    private syncVisualPosition(): void {
        const x = this.physicsSprite.x;
        const y = this.physicsSprite.y;
        this.ballVisual.setPosition(x, y);
        this.triangleVisual.setPosition(x, y + this.state.triangleShell.visualOffsetY);
        this.triangleVisual.setRotation(this.state.triangleShell.orientationRad);
        this.squareVisual.setPosition(x, y);
    }

    private updateTriangleLeadingCornerVisual(
        grounded: boolean,
        input: PlayerInputSnapshot
    ): void {
        if (this.state.currentForm !== 'triangle') {
            this.triangleLeadingCornerMarker.setVisible(false);
            return;
        }

        const triangleDash = this.state.triangleDash;
        const dashPreview = triangleDash.isActive
            ? {
                leadingCornerIndex: triangleDash.leadingCornerIndex,
                lockedOrientationRad: triangleDash.lockedOrientationRad
            }
            : resolveTriangleDashLeadingCornerPreview(
                triangleDash,
                this.state.triangleShell,
                grounded
            );
        const markerOffset = resolveTriangleLeadingCornerMarkerOffset(
            dashPreview.leadingCornerIndex,
            dashPreview.lockedOrientationRad,
            PLAYER_TRIANGLE_LEADING_CORNER_MARKER_OUTWARD_OFFSET
        );
        const markerBaseY = this.physicsSprite.y + this.state.triangleShell.visualOffsetY;
        const isDashRelevant = input.actionHeld || input.actionPressed || triangleDash.isActive;

        this.triangleLeadingCornerMarker.setVisible(true);
        this.triangleLeadingCornerMarker.setPosition(
            this.physicsSprite.x + markerOffset.x,
            markerBaseY + markerOffset.y
        );
        this.triangleLeadingCornerMarker.setAlpha(
            isDashRelevant
                ? PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_ALPHA
                : PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_ALPHA
        );
        this.triangleLeadingCornerMarker.setScale(
            isDashRelevant
                ? PLAYER_TRIANGLE_LEADING_CORNER_MARKER_ACTIVE_SCALE
                : PLAYER_TRIANGLE_LEADING_CORNER_MARKER_IDLE_SCALE
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
