import { GameObjects, Physics, Scene } from 'phaser';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface } from './world_surface_tags';

export interface TriggerPlatformConfig {
    triggerX: number;
    triggerY: number;
    triggerWidth: number;
    triggerHeight: number;
    deactivateTriggerX?: number;
    deactivateTriggerY?: number;
    deactivateTriggerWidth?: number;
    deactivateTriggerHeight?: number;
    platformX: number;
    platformY: number;
    platformWidth: number;
    platformHeight: number;
}

export interface TriggerPlatformObject {
    triggerZone: GameObjects.Rectangle;
    deactivateTriggerZone: GameObjects.Rectangle | null;
    platformBodyObject: GameObjects.Rectangle;
    matterBody: MatterJS.BodyType;
    isActivated: () => boolean;
    activate: () => void;
    deactivate: () => void;
    setActive: (active: boolean) => void;
    destroy: () => void;
}

export const createTriggerPlatform = (scene: Scene, config: TriggerPlatformConfig): TriggerPlatformObject => {
    const triggerZone = scene.add.rectangle(
        config.triggerX,
        config.triggerY,
        config.triggerWidth,
        config.triggerHeight,
        0xfff59d,
        0.4
    )
        .setStrokeStyle(2, 0xf9a825)
        .setDepth(4202);

    const platformBodyObject = scene.add.rectangle(
        config.platformX,
        config.platformY,
        config.platformWidth,
        config.platformHeight,
        0x616161,
        0.55
    )
        .setStrokeStyle(2, 0xb0bec5)
        .setDepth(4203);

    scene.physics.add.existing(triggerZone, true);
    const deactivateTriggerZone = hasDeactivateTrigger(config)
        ? scene.add.rectangle(
            config.deactivateTriggerX!,
            config.deactivateTriggerY!,
            config.deactivateTriggerWidth!,
            config.deactivateTriggerHeight!,
            0xef9a9a,
            0.35
        )
            .setStrokeStyle(2, 0xc62828)
            .setDepth(4202)
        : null;
    if (deactivateTriggerZone !== null) {
        scene.physics.add.existing(deactivateTriggerZone, true);
    }
    scene.physics.add.existing(platformBodyObject, true);
    markAsPlatformSurface(platformBodyObject);

    const triggerBody = triggerZone.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;
    const deactivateTriggerBody = deactivateTriggerZone?.body as Physics.Arcade.StaticBody | undefined;
    if (deactivateTriggerBody) {
        deactivateTriggerBody.checkCollision.none = false;
        deactivateTriggerBody.checkCollision.up = false;
        deactivateTriggerBody.checkCollision.down = false;
        deactivateTriggerBody.checkCollision.left = false;
        deactivateTriggerBody.checkCollision.right = false;
    }

    const platformBody = platformBodyObject.body as Physics.Arcade.StaticBody;
    platformBody.enable = false;
    const matterBody = scene.matter.add.rectangle(
        platformBodyObject.x,
        platformBodyObject.y,
        platformBodyObject.width,
        platformBodyObject.height,
        { isStatic: true }
    );
    markMatterBodyAsPlatformSurface(matterBody);
    scene.matter.world.remove(matterBody);

    let activated = false;

    const setActive = (active: boolean): void => {
        if (activated === active) {
            return;
        }

        activated = active;
        platformBody.enable = active;
        platformBody.updateFromGameObject();
        if (active) {
            scene.matter.world.add(matterBody);
        } else {
            scene.matter.world.remove(matterBody);
        }

        triggerZone.setFillStyle(active ? 0xc5e1a5 : 0xfff59d, active ? 0.45 : 0.4);
        triggerZone.setStrokeStyle(2, active ? 0x558b2f : 0xf9a825);
        if (deactivateTriggerZone !== null) {
            deactivateTriggerZone.setFillStyle(active ? 0xef9a9a : 0xffccbc, active ? 0.4 : 0.3);
            deactivateTriggerZone.setStrokeStyle(2, active ? 0xb71c1c : 0xe64a19);
        }

        platformBodyObject.setVisible(active);
        platformBodyObject.setFillStyle(active ? 0xa5d6a7 : 0x616161, active ? 1 : 0.55);
        platformBodyObject.setStrokeStyle(2, active ? 0x2e7d32 : 0xb0bec5);
    };

    const activate = (): void => {
        setActive(true);
    };

    const deactivate = (): void => {
        setActive(false);
    };

    return {
        triggerZone,
        deactivateTriggerZone,
        platformBodyObject,
        matterBody,
        isActivated: () => activated,
        activate,
        deactivate,
        setActive,
        destroy: (): void => {
            scene.matter.world.remove(matterBody);
            triggerZone.destroy();
            deactivateTriggerZone?.destroy();
            platformBodyObject.destroy();
        }
    };
};

const hasDeactivateTrigger = (config: TriggerPlatformConfig): boolean => {
    return typeof config.deactivateTriggerX === 'number'
        && typeof config.deactivateTriggerY === 'number'
        && typeof config.deactivateTriggerWidth === 'number'
        && typeof config.deactivateTriggerHeight === 'number';
};
