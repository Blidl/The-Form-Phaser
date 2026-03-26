import { GameObjects, Physics, Scene } from 'phaser';

export interface CheckpointConfig {
    x: number;
    y: number;
    width?: number;
    height?: number;
    respawnX: number;
    respawnY: number;
}

export interface CheckpointObject {
    trigger: GameObjects.Rectangle;
    beacon: GameObjects.Arc;
    respawnX: number;
    respawnY: number;
    setActive: (isActive: boolean) => void;
}

export const createCheckpoint = (scene: Scene, config: CheckpointConfig): CheckpointObject => {
    const width = config.width ?? 68;
    const height = config.height ?? 88;

    const trigger = scene.add.rectangle(config.x, config.y, width, height, 0x90caf9, 0.3)
        .setStrokeStyle(2, 0x64b5f6)
        .setDepth(4100);
    const beacon = scene.add.circle(config.x, config.y - (height * 0.5) - 14, 9, 0x90caf9)
        .setStrokeStyle(2, 0xe3f2fd)
        .setDepth(4101);

    scene.physics.add.existing(trigger, true);
    const triggerBody = trigger.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

    const setActive = (isActive: boolean): void => {
        const fillColor = isActive ? 0x66bb6a : 0x90caf9;
        const strokeColor = isActive ? 0x2e7d32 : 0x64b5f6;
        const beaconColor = isActive ? 0x00e676 : 0x90caf9;

        trigger.setFillStyle(fillColor, 0.35);
        trigger.setStrokeStyle(2, strokeColor);
        beacon.setFillStyle(beaconColor);
    };

    return {
        trigger,
        beacon,
        respawnX: config.respawnX,
        respawnY: config.respawnY,
        setActive
    };
};
