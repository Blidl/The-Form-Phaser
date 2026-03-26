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

        const { width, height } = this.scale;

        this.add.rectangle(width * 0.5, height * 0.78, width * 0.7, 44, 0x90a4ae).setStrokeStyle(2, 0xcfd8dc);
        this.add.circle(width * 0.25, height * 0.62, 26, 0x4fc3f7);
        this.add.rectangle(width * 0.6, height * 0.5, 64, 64, 0xffca28).setAngle(12);
        this.add.triangle(width * 0.78, height * 0.62, 0, 54, 34, 0, 68, 54, 0x81c784);

        this.player = new PfPlayer(this, width * 0.5, height * 0.78 - 24);
        this.playerInputKeys = createPlayerInputKeys(this);

        this.add.text(24, 24, 'sc_test', {
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '24px'
        });
    }

    public update(_time: number, delta: number): void {
        const input = pollPlayerInputSnapshot(this.playerInputKeys);
        this.player.tick(delta, input);
    }
}
