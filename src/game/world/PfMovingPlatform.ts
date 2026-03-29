import { GameObjects, Physics, Scene } from 'phaser';

export interface PfMovingPlatformConfig {
    id: string;
    width: number;
    height: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    speedPxPerSec: number;
    fillColor?: number;
    strokeColor?: number;
}

const DEFAULT_FILL_COLOR = 0xf59e0b;
const DEFAULT_STROKE_COLOR = 0x92400e;

export class PfMovingPlatform {
    private readonly gameObject: GameObjects.Rectangle;
    private readonly body: Physics.Arcade.StaticBody;
    private readonly startX: number;
    private readonly startY: number;
    private readonly endX: number;
    private readonly endY: number;
    private readonly halfCycleMs: number;
    private elapsedMs = 0;

    public constructor(scene: Scene, config: PfMovingPlatformConfig) {
        this.startX = config.startX;
        this.startY = config.startY;
        this.endX = config.endX;
        this.endY = config.endY;

        this.gameObject = scene.add
            .rectangle(
                this.startX,
                this.startY,
                config.width,
                config.height,
                config.fillColor ?? DEFAULT_FILL_COLOR
            )
            .setStrokeStyle(2, config.strokeColor ?? DEFAULT_STROKE_COLOR)
            .setName(config.id);

        scene.physics.add.existing(this.gameObject, true);
        this.body = this.gameObject.body as Physics.Arcade.StaticBody;

        const travelDistance = Math.hypot(this.endX - this.startX, this.endY - this.startY);
        const minSpeed = Math.max(config.speedPxPerSec, 1);
        this.halfCycleMs = travelDistance <= 0 ? 1 : (travelDistance / minSpeed) * 1000;
    }

    public getGameObject(): GameObjects.Rectangle {
        return this.gameObject;
    }

    public update(deltaMs: number): void {
        this.elapsedMs += deltaMs;

        const normalizedPhase = (this.elapsedMs / this.halfCycleMs) % 2;
        const forwardProgress = normalizedPhase <= 1
            ? normalizedPhase
            : 2 - normalizedPhase;

        const nextX = this.startX + ((this.endX - this.startX) * forwardProgress);
        const nextY = this.startY + ((this.endY - this.startY) * forwardProgress);

        this.gameObject.setPosition(nextX, nextY);
        this.body.updateFromGameObject();
    }
}
