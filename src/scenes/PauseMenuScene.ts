import { Input, Scene } from 'phaser';
import {
    MAIN_MENU_SCENE_KEY,
    TEST_SCENE_KEY,
    type PauseMenuSceneStartData
} from './demo_flow';

export class PauseMenuScene extends Scene {
    public static readonly KEY = 'sc_pause_menu';

    private currentLevelId = '';

    public constructor() {
        super(PauseMenuScene.KEY);
    }

    public create(data: PauseMenuSceneStartData): void {
        this.currentLevelId = data.levelId;

        const { width, height } = this.scale;
        this.add.rectangle(0, 0, width, height, 0x02060b, 0.68).setOrigin(0);
        this.add.rectangle(width * 0.5, height * 0.5, 360, 280, 0x102437, 0.94)
            .setStrokeStyle(2, 0xe5c07b, 0.95);

        this.add.text(width * 0.5, height * 0.33, 'Paused', {
            fontFamily: 'Georgia',
            fontSize: '42px',
            color: '#f4ead3'
        }).setOrigin(0.5);

        createPauseButton(this, width * 0.5, height * 0.46, 'Resume', () => {
            this.resumeGameplay();
        });
        createPauseButton(this, width * 0.5, height * 0.56, 'Restart Level', () => {
            this.scene.stop(TEST_SCENE_KEY);
            this.scene.start(TEST_SCENE_KEY, { levelId: this.currentLevelId });
        });
        createPauseButton(this, width * 0.5, height * 0.66, 'Main Menu', () => {
            this.scene.stop(TEST_SCENE_KEY);
            this.scene.start(MAIN_MENU_SCENE_KEY);
        });

        const escapeKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ESC);
        escapeKey?.on('down', () => {
            this.resumeGameplay();
        });
    }

    private resumeGameplay(): void {
        this.scene.resume(TEST_SCENE_KEY);
        this.scene.stop(PauseMenuScene.KEY);
    }
}

const createPauseButton = (
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void
): void => {
    const background = scene.add.rectangle(x, y, 240, 50, 0x1b3d56, 0.97)
        .setStrokeStyle(2, 0xbcdfff, 0.85)
        .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8f4e6'
    }).setOrigin(0.5);

    background.on('pointerover', () => {
        background.setFillStyle(0x275879, 0.99);
        text.setScale(1.02);
    });
    background.on('pointerout', () => {
        background.setFillStyle(0x1b3d56, 0.97);
        text.setScale(1);
    });
    background.on('pointerup', () => {
        onClick();
    });
};
