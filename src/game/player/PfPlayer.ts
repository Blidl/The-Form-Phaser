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
    PLAYER_GROUND_MOVE_ACCEL,
    PLAYER_GROUND_MOVE_DECEL,
    PLAYER_GROUND_MOVE_SPEED,
    PLAYER_GRAVITY_Y,
    PLAYER_JUMP_CUT_MULTIPLIER,
    PLAYER_JUMP_VELOCITY,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_START_FORM
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
import type { PlayerFormId, PlayerShellState } from './player_types';

export class PfPlayer {
    public readonly state: PlayerShellState;
    private readonly timers: PlayerTimers;
    private lastInput: PlayerInputSnapshot;
    private readonly physicsBody: Physics.Arcade.Body;
    private readonly sprite: GameObjects.Arc;
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

    public constructor(scene: Scene, x: number, y: number) {
        this.state = { currentForm: PLAYER_START_FORM };
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

        this.sprite = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0x00e5ff);
        this.sprite.setStrokeStyle(2, 0xffffff);
        this.sprite.setDepth(4500);
        this.sprite.name = 'pf_player';
        scene.physics.add.existing(this.sprite);
        this.physicsBody = this.sprite.body as Physics.Arcade.Body;
        this.physicsBody.setCircle(PLAYER_PLACEHOLDER_RADIUS);
        this.physicsBody.setBounce(0);
        this.physicsBody.setDragX(2400);
        this.physicsBody.setMaxVelocity(Math.max(PLAYER_GROUND_MOVE_SPEED, PLAYER_AIR_MOVE_SPEED, PLAYER_BALL_BOOST_SPEED), 1200);
        this.physicsBody.setCollideWorldBounds(true);
        this.physicsBody.setGravityY(PLAYER_GRAVITY_Y);
    }

    public get currentForm(): PlayerFormId {
        return this.state.currentForm;
    }

    public get arcadeBodyObject(): GameObjects.Arc {
        return this.sprite;
    }

    public freezeForRespawn(): void {
        this.frozenForRespawn = true;
        this.physicsBody.setVelocity(0, 0);
        this.physicsBody.setAcceleration(0, 0);
        this.physicsBody.setAllowGravity(false);
    }

    public respawnAt(x: number, y: number): void {
        this.state.currentForm = PLAYER_START_FORM;

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

        clearJumpBuffer(this.timers);
        clearCoyoteTime(this.timers);
        this.timers.transformLockMs = 0;
        this.timers.deathPauseMs = 0;

        this.physicsBody.setAllowGravity(true);
        this.physicsBody.setVelocity(0, 0);
        this.physicsBody.setAcceleration(0, 0);
        this.physicsBody.reset(x, y);

        this.frozenForRespawn = false;
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot): void {
        if (this.frozenForRespawn) {
            this.lastInput = EMPTY_PLAYER_INPUT_SNAPSHOT;
            return;
        }

        this.lastInput = input;
        const deltaSec = deltaMs / 1000;

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

        if (!input.actionHeld) {
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

        const hasBoostHold = this.boostActive && input.actionHeld;
        const moveSpeed = this.resolveMoveSpeed(grounded, hasBoostHold);
        const moveResponse = this.resolveMoveResponse(grounded, horizontalDir, hasBoostHold);
        const targetVelocityX = horizontalDir * moveSpeed;
        const currentVelocityX = this.physicsBody.velocity.x;
        const maxStepX = moveResponse * deltaSec;
        const nextVelocityX = this.moveToward(currentVelocityX, targetVelocityX, maxStepX);
        this.physicsBody.setVelocityX(nextVelocityX);

        const canJump = grounded || hasCoyoteTime(this.timers);
        if (canJump && hasJumpBuffer(this.timers)) {
            const hasReboundJump = grounded && this.reboundWindowMs > 0;
            const jumpVelocity = hasReboundJump ? this.reboundJumpVelocity : PLAYER_JUMP_VELOCITY;
            this.physicsBody.setVelocityY(jumpVelocity);
            clearJumpBuffer(this.timers);
            clearCoyoteTime(this.timers);
            this.jumpCutConsumed = hasReboundJump;
            this.reboundWindowMs = 0;
            this.lastAirborneDownwardSpeed = 0;
        }

        if (!input.jumpHeld && !this.jumpCutConsumed && this.physicsBody.velocity.y < 0) {
            this.physicsBody.setVelocityY(this.physicsBody.velocity.y * PLAYER_JUMP_CUT_MULTIPLIER);
            this.jumpCutConsumed = true;
        }

        if (input.actionPressed) {
            if (grounded) {
                this.tryApplyBoost(grounded, horizontalDir);
            } else {
                this.pendingBoostRequest = true;
            }
        }

        if (justLanded && this.pendingBoostRequest && input.actionHeld) {
            this.tryApplyBoost(grounded, horizontalDir, true);
            if (this.boostActive) {
                this.pendingBoostRequest = false;
            }
        }

        this.reboundWindowMs = Math.max(0, this.reboundWindowMs - deltaMs);
        this.boostCooldownMs = Math.max(0, this.boostCooldownMs - deltaMs);
        tickPlayerTimers(this.timers, deltaMs);
        this.wasGrounded = grounded;
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

    private resolveMoveResponse(grounded: boolean, horizontalDir: number, hasBoostHold: boolean): number {
        if (hasBoostHold && horizontalDir !== 0) {
            return PLAYER_BALL_BOOST_HOLD_ACCEL;
        }

        if (grounded) {
            return horizontalDir === 0 ? PLAYER_GROUND_MOVE_DECEL : PLAYER_GROUND_MOVE_ACCEL;
        }

        return horizontalDir === 0 ? PLAYER_AIR_MOVE_DECEL : PLAYER_AIR_MOVE_ACCEL;
    }

    private resolveMoveSpeed(grounded: boolean, hasBoostHold: boolean): number {
        if (!hasBoostHold) {
            return grounded ? PLAYER_GROUND_MOVE_SPEED : PLAYER_AIR_MOVE_SPEED;
        }

        return grounded ? PLAYER_BALL_BOOST_HOLD_MOVE_SPEED : PLAYER_BALL_BOOST_HOLD_AIR_MOVE_SPEED;
    }
}
