import { Scene } from 'phaser';
import { PfPlayer } from '../game/player/PfPlayer';
import { createPlayerInputKeys, pollPlayerInputSnapshot, type PlayerInputKeys } from '../game/player/player_input';

export class TestScene extends Scene {
    public static readonly KEY = 'sc_test';
    private player!: PfPlayer;
    private playerInputKeys!: PlayerInputKeys;

    public constructor() {
        super(TestScene.KEY);
    }

    public create(): void {
        const camera = this.cameras.main;
        camera.setBackgroundColor('#263238');

        const worldWidth = camera.width;
        const worldHeight = camera.height;
        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

        const ground = this.add.rectangle(420, 620, 700, 48, 0x90a4ae).setStrokeStyle(2, 0xcfd8dc).setDepth(4200);
        const testPlatform = this.add.rectangle(520, 460, 220, 24, 0xb0bec5).setStrokeStyle(2, 0xeceff1).setDepth(4200);
        this.physics.add.existing(ground, true);
        this.physics.add.existing(testPlatform, true);

        this.player = new PfPlayer(this, 250, 200);
        this.playerInputKeys = createPlayerInputKeys(this);
        this.physics.add.collider(this.player.arcadeBodyObject, ground);
        this.physics.add.collider(this.player.arcadeBodyObject, testPlatform);

        this.add.text(24, 24, 'sc_test', {
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '24px'
        }).setDepth(5000);
    }

    public update(_time: number, delta: number): void {
        const input = pollPlayerInputSnapshot(this.playerInputKeys);
        this.player.tick(delta, input);
    }
}
