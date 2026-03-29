import { GameObjects, Physics, Scene } from 'phaser';

export interface PfTriggerVolumeConfig {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PfTriggerPlatformConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    trigger: PfTriggerVolumeConfig;
    inactivePlatformColor?: number;
    activePlatformColor?: number;
    triggerColor?: number;
    triggerActivatedColor?: number;
}

const DEFAULT_INACTIVE_PLATFORM_COLOR = 0x475569;
const DEFAULT_ACTIVE_PLATFORM_COLOR = 0x22c55e;
const DEFAULT_TRIGGER_COLOR = 0xfacc15;
const DEFAULT_TRIGGER_ACTIVATED_COLOR = 0x86efac;

export class PfTriggerPlatform {
    private readonly platformGameObject: GameObjects.Rectangle;
    private readonly triggerGameObject: GameObjects.Rectangle;
    private readonly platformBody: Physics.Arcade.StaticBody;
    private isActivated = false;
    private readonly activePlatformColor: number;
    private readonly triggerActivatedColor: number;

    public constructor(scene: Scene, config: PfTriggerPlatformConfig) {
        this.activePlatformColor = config.activePlatformColor ?? DEFAULT_ACTIVE_PLATFORM_COLOR;
        this.triggerActivatedColor = config.triggerActivatedColor ?? DEFAULT_TRIGGER_ACTIVATED_COLOR;

        this.platformGameObject = scene.add
            .rectangle(
                config.x,
                config.y,
                config.width,
                config.height,
                config.inactivePlatformColor ?? DEFAULT_INACTIVE_PLATFORM_COLOR,
                0.65
            )
            .setStrokeStyle(2, 0x334155)
            .setName(config.id);

        this.triggerGameObject = scene.add
            .rectangle(
                config.trigger.x,
                config.trigger.y,
                config.trigger.width,
                config.trigger.height,
                config.triggerColor ?? DEFAULT_TRIGGER_COLOR,
                0.35
            )
            .setStrokeStyle(2, 0xa16207)
            .setName(`${config.id}_trigger`);

        scene.physics.add.existing(this.platformGameObject, true);
        scene.physics.add.existing(this.triggerGameObject, true);

        this.platformBody = this.platformGameObject.body as Physics.Arcade.StaticBody;
        this.platformBody.enable = false;
    }

    public getPlatformGameObject(): GameObjects.Rectangle {
        return this.platformGameObject;
    }

    public getTriggerGameObject(): GameObjects.Rectangle {
        return this.triggerGameObject;
    }

    public activate(): void {
        if (this.isActivated) {
            return;
        }

        this.isActivated = true;
        this.platformBody.enable = true;
        this.platformBody.updateFromGameObject();

        this.platformGameObject.setFillStyle(this.activePlatformColor, 0.9);
        this.platformGameObject.setStrokeStyle(2, 0x166534);

        this.triggerGameObject.setFillStyle(this.triggerActivatedColor, 0.5);
        this.triggerGameObject.setStrokeStyle(2, 0x15803d);
    }
}
