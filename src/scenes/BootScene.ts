import { Scene } from 'phaser';
import { type TestSceneStartData } from './TestScene';
import { MAIN_MENU_SCENE_KEY, startLevelScene, resolveBootRoute } from './demo_flow';

export class BootScene extends Scene {
    public static readonly KEY = 'sc_bootstrap';

    public constructor() {
        super(BootScene.KEY);
    }

    public create(data: TestSceneStartData = {}): void {
        const route = resolveBootRoute(data);
        if (route.levelStart) {
            startLevelScene(this, route.levelStart);
            return;
        }

        this.scene.start(MAIN_MENU_SCENE_KEY);
    }
}
