import { GameObjects, Physics, Scene } from 'phaser';
import {
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

    public constructor(scene: Scene, x: number, y: number) {
        this.state = { currentForm: PLAYER_START_FORM };
        this.timers = createPlayerTimers();
        this.lastInput = EMPTY_PLAYER_INPUT_SNAPSHOT;
        this.jumpCutConsumed = false;

        this.sprite = scene.add.circle(x, y, PLAYER_PLACEHOLDER_RADIUS, 0x00e5ff);
        this.sprite.setStrokeStyle(2, 0xffffff);
        this.sprite.setDepth(4500);
        this.sprite.name = 'pf_player';
        scene.physics.add.existing(this.sprite);
        this.physicsBody = this.sprite.body as Physics.Arcade.Body;
        this.physicsBody.setCircle(PLAYER_PLACEHOLDER_RADIUS);
        this.physicsBody.setBounce(0);
        this.physicsBody.setDragX(2400);
        this.physicsBody.setMaxVelocity(Math.max(PLAYER_GROUND_MOVE_SPEED, PLAYER_AIR_MOVE_SPEED), 1200);
        this.physicsBody.setCollideWorldBounds(true);
        this.physicsBody.setGravityY(PLAYER_GRAVITY_Y);
    }

    public get currentForm(): PlayerFormId {
        return this.state.currentForm;
    }

    public get arcadeBodyObject(): GameObjects.Arc {
        return this.sprite;
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot): void {
        this.lastInput = input;
        const deltaSec = deltaMs / 1000;

        const grounded = this.physicsBody.blocked.down || this.physicsBody.touching.down;
        if (grounded) {
            refreshCoyoteTime(this.timers);
            this.jumpCutConsumed = false;
        }

        if (input.jumpPressed) {
            pushJumpBuffer(this.timers);
        }

        const horizontalDir = (input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0);
        const moveSpeed = grounded ? PLAYER_GROUND_MOVE_SPEED : PLAYER_AIR_MOVE_SPEED;
        const moveResponse = this.resolveMoveResponse(grounded, horizontalDir);
        const targetVelocityX = horizontalDir * moveSpeed;
        const currentVelocityX = this.physicsBody.velocity.x;
        const maxStepX = moveResponse * deltaSec;
        const nextVelocityX = this.moveToward(currentVelocityX, targetVelocityX, maxStepX);
        this.physicsBody.setVelocityX(nextVelocityX);

        const canJump = grounded || hasCoyoteTime(this.timers);
        if (canJump && hasJumpBuffer(this.timers)) {
            this.physicsBody.setVelocityY(PLAYER_JUMP_VELOCITY);
            clearJumpBuffer(this.timers);
            clearCoyoteTime(this.timers);
            this.jumpCutConsumed = false;
        }

        if (!input.jumpHeld && !this.jumpCutConsumed && this.physicsBody.velocity.y < 0) {
            this.physicsBody.setVelocityY(this.physicsBody.velocity.y * PLAYER_JUMP_CUT_MULTIPLIER);
            this.jumpCutConsumed = true;
        }

        tickPlayerTimers(this.timers, deltaMs);
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

    private resolveMoveResponse(grounded: boolean, horizontalDir: number): number {
        if (grounded) {
            return horizontalDir === 0 ? PLAYER_GROUND_MOVE_DECEL : PLAYER_GROUND_MOVE_ACCEL;
        }

        return horizontalDir === 0 ? PLAYER_AIR_MOVE_DECEL : PLAYER_AIR_MOVE_ACCEL;
    }
}
