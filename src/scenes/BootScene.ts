import { Scene } from 'phaser';
import { SCENE_KEYS, type SceneKey } from '../shared/types/sceneTypes';

export class BootScene extends Scene {
    public static readonly KEY: SceneKey = SCENE_KEYS.boot;

    public constructor() {
        super(BootScene.KEY);
    }

    public preload(): void {
        // Step 00.1 preload hook intentionally minimal.
    }

    public create(): void {
        this.scene.start(SCENE_KEYS.test);
    }
}
