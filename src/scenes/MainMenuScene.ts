import { Input, Scene } from 'phaser';
import { startDemoFromMainMenu } from './demo_flow';

export class MainMenuScene extends Scene {
    public static readonly KEY = 'sc_main_menu';

    public constructor() {
        super(MainMenuScene.KEY);
    }

    public create(): void {
        const { width, height } = this.scale;

        this.cameras.main.setBackgroundColor('#08131f');

        const backdrop = this.add.graphics();
        backdrop.fillGradientStyle(0x0a1b2f, 0x0a1b2f, 0x16354f, 0x16354f, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x6ec6ff, 0.12);
        backdrop.fillCircle(width * 0.24, height * 0.28, 150);
        backdrop.fillStyle(0xffc56d, 0.1);
        backdrop.fillCircle(width * 0.78, height * 0.68, 190);

        this.add.text(width * 0.5, height * 0.28, 'THE FORM', {
            fontFamily: 'Georgia',
            fontSize: '56px',
            color: '#f3efe4'
        }).setOrigin(0.5);

        this.add.text(width * 0.5, height * 0.38, 'Demo Flow', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#9fc0d9',
            letterSpacing: 4
        }).setOrigin(0.5);

        this.add.text(width * 0.5, height * 0.48, 'A compact demo path over the existing level runtime.', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#d8e2ea',
            align: 'center'
        }).setOrigin(0.5);

        createMenuButton(this, width * 0.5, height * 0.64, 'Start Demo', () => {
            startDemoFromMainMenu(this);
        });

        const startKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ENTER);
        startKey?.once('down', () => {
            startDemoFromMainMenu(this);
        });
    }
}

const createMenuButton = (
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void
): void => {
    const background = scene.add.rectangle(x, y, 280, 62, 0x13314b, 0.96)
        .setStrokeStyle(2, 0x9cd7ff, 0.9)
        .setInteractive({ useHandCursor: true });

    const text = scene.add.text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f8f4e6'
    }).setOrigin(0.5);

    background.on('pointerover', () => {
        background.setFillStyle(0x1c496b, 0.98);
        text.setScale(1.02);
    });
    background.on('pointerout', () => {
        background.setFillStyle(0x13314b, 0.96);
        text.setScale(1);
    });
    background.on('pointerup', () => {
        onClick();
    });
};
