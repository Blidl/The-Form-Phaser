import { Scene } from 'phaser';
import { TestScene } from './TestScene';

export class BootScene extends Scene {
    public static readonly KEY = 'sc_bootstrap';

    public constructor() {
        super(BootScene.KEY);
    }

    public create(): void {
        this.scene.start(TestScene.KEY);
    }
}
