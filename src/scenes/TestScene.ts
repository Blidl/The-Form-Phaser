import { Scene } from 'phaser';
import { createTestSceneRuntime, type TestSceneRuntime } from './runtime/test_scene_runtime';

export class TestScene extends Scene {
    public static readonly KEY = 'sc_test';
    private runtime!: TestSceneRuntime;

    public constructor() {
        super(TestScene.KEY);
    }

    public create(): void {
        this.runtime = createTestSceneRuntime({
            scene: this
        });
    }

    public update(_time: number, delta: number): void {
        this.runtime.update(delta);
    }
}
