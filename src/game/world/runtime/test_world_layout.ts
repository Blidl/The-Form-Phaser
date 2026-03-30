import type { Scene } from 'phaser';
import { markAsPlatformSurface } from '../world_surface_tags';

export interface TestWorldLayoutRuntime {
    ground: Phaser.GameObjects.Rectangle;
    lowPlatform: Phaser.GameObjects.Rectangle;
    highPlatform: Phaser.GameObjects.Rectangle;
}

export const TEST_WORLD_WIDTH = 2200;
export const TEST_WORLD_HEIGHT = 900;

export const createTestWorldLayoutRuntime = (scene: Scene): TestWorldLayoutRuntime => {
    scene.physics.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT);

    const ground = scene.add.rectangle(TEST_WORLD_WIDTH * 0.5, 760, TEST_WORLD_WIDTH - 120, 56, 0x90a4ae)
        .setStrokeStyle(2, 0xcfd8dc)
        .setDepth(4200);
    const lowPlatform = scene.add.rectangle(760, 610, 280, 24, 0xb0bec5)
        .setStrokeStyle(2, 0xeceff1)
        .setDepth(4200);
    const highPlatform = scene.add.rectangle(1380, 500, 240, 24, 0xb0bec5)
        .setStrokeStyle(2, 0xeceff1)
        .setDepth(4200);

    scene.physics.add.existing(ground, true);
    scene.physics.add.existing(lowPlatform, true);
    scene.physics.add.existing(highPlatform, true);

    markAsPlatformSurface(ground);
    markAsPlatformSurface(lowPlatform);
    markAsPlatformSurface(highPlatform);

    return {
        ground,
        lowPlatform,
        highPlatform
    };
};
