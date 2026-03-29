import { GameObjects, Physics, Scene } from 'phaser';
import type { PfPlayer } from '../player';

export interface PfCheckpointConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    respawnX: number;
    respawnY: number;
}

export class PfCheckpoint {
    private readonly gameObject: GameObjects.Rectangle;
    private readonly marker: GameObjects.Arc;
    private isActivated = false;
    private readonly respawnX: number;
    private readonly respawnY: number;

    public constructor(scene: Scene, config: PfCheckpointConfig) {
        this.respawnX = config.respawnX;
        this.respawnY = config.respawnY;

        this.gameObject = scene.add
            .rectangle(config.x, config.y, config.width, config.height, 0x93c5fd, 0.35)
            .setStrokeStyle(2, 0x3b82f6)
            .setName('pf_checkpoint');
        this.marker = scene.add
            .circle(config.x, config.y - (config.height * 0.5) - 12, 8, 0x93c5fd)
            .setStrokeStyle(2, 0xdbebff);

        scene.physics.add.existing(this.gameObject, true);
        const body = this.gameObject.body as Physics.Arcade.StaticBody;
        body.checkCollision.none = false;
        body.checkCollision.up = false;
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
    }

    public getGameObject(): GameObjects.Rectangle {
        return this.gameObject;
    }

    public handlePlayerOverlap(player: PfPlayer): void {
        if (this.isActivated) {
            return;
        }

        this.isActivated = true;
        player.setRespawnPoint(this.respawnX, this.respawnY);
        this.gameObject.setFillStyle(0x4ade80, 0.4);
        this.gameObject.setStrokeStyle(2, 0x15803d);
        this.marker.setFillStyle(0x22c55e);
    }
}