import { GameObjects, Physics, Scene } from 'phaser';

export interface HazardConfig {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface HazardObject {
    trigger: GameObjects.Rectangle;
}

export const createHazard = (scene: Scene, config: HazardConfig): HazardObject => {
    const trigger = scene.add.rectangle(config.x, config.y, config.width, config.height, 0xef5350, 0.75)
        .setStrokeStyle(2, 0xb71c1c)
        .setDepth(4300);

    scene.physics.add.existing(trigger, true);
    const triggerBody = trigger.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

    return { trigger };
};
