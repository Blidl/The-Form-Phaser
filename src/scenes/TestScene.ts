import { Scene } from 'phaser';
import { createTestSceneRuntime, type TestSceneRuntime } from './runtime/test_scene_runtime';

export class TestScene extends Scene {
    public static readonly KEY = 'sc_test';
    private runtime!: TestSceneRuntime;

    public constructor() {
        super({
            key: TestScene.KEY,
            physics: {
                arcade: {
                    gravity: { x: 0, y: 0 },
                    debug: false
                },
                matter: {
                    gravity: { x: 0, y: 0 },
                    debug: false
                }
            }
        });
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
