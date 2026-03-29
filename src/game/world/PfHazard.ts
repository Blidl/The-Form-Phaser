import { GameObjects, Scene } from 'phaser';
import type { PfPlayer } from '../player';

export interface PfHazardConfig {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class PfHazard {
    private readonly gameObject: GameObjects.Rectangle;

    public constructor(scene: Scene, config: PfHazardConfig) {
        this.gameObject = scene.add
            .rectangle(config.x, config.y, config.width, config.height, 0xef4444, 0.65)
            .setStrokeStyle(2, 0x7f1d1d)
            .setName('pf_hazard');

        scene.physics.add.existing(this.gameObject, true);
    }

    public getGameObject(): GameObjects.Rectangle {
        return this.gameObject;
    }

    public handlePlayerOverlap(player: PfPlayer): void {
        player.resetToSpawn();
    }
}
