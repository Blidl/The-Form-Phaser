import { GameObjects, Physics, Scene } from 'phaser';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface } from './world_surface_tags';

export interface TriggerPlatformConfig {
    triggerX: number;
    triggerY: number;
    triggerWidth: number;
    triggerHeight: number;
    platformX: number;
    platformY: number;
    platformWidth: number;
    platformHeight: number;
}

export interface TriggerPlatformObject {
    triggerZone: GameObjects.Rectangle;
    platformBodyObject: GameObjects.Rectangle;
    matterBody: MatterJS.BodyType;
    isActivated: () => boolean;
    activate: () => void;
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
    scene.physics.add.existing(platformBodyObject, true);
    markAsPlatformSurface(platformBodyObject);

    const triggerBody = triggerZone.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

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

    const activate = (): void => {
        if (activated) {
            return;
        }

        activated = true;
        platformBody.enable = true;
        platformBody.updateFromGameObject();
        scene.matter.world.add(matterBody);

        triggerZone.setFillStyle(0xc5e1a5, 0.45);
        triggerZone.setStrokeStyle(2, 0x558b2f);

        platformBodyObject.setFillStyle(0xa5d6a7, 1);
        platformBodyObject.setStrokeStyle(2, 0x2e7d32);
    };

    return {
        triggerZone,
        platformBodyObject,
        matterBody,
        isActivated: () => activated,
        activate
    };
};
