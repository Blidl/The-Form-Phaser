import { Input, Scene } from 'phaser';
import { openMainMenu } from './demo_flow';

export class EndScreenScene extends Scene {
    public static readonly KEY = 'sc_end_screen';

    public constructor() {
        super(EndScreenScene.KEY);
    }

    public create(): void {
        const { width, height } = this.scale;

        this.cameras.main.setBackgroundColor('#140f1f');

        const backdrop = this.add.graphics();
        backdrop.fillGradientStyle(0x140f1f, 0x140f1f, 0x302241, 0x302241, 1);
        backdrop.fillRect(0, 0, width, height);
        backdrop.fillStyle(0x8ecae6, 0.1);
        backdrop.fillCircle(width * 0.3, height * 0.32, 130);
        backdrop.fillStyle(0xf4a261, 0.08);
        backdrop.fillCircle(width * 0.72, height * 0.62, 180);

        this.add.text(width * 0.5, height * 0.3, 'Demo Complete', {
            fontFamily: 'Georgia',
            fontSize: '52px',
            color: '#f5ead8'
        }).setOrigin(0.5);

        this.add.text(width * 0.5, height * 0.43, 'The current campaign chain has ended.', {
            fontFamily: 'monospace',
            fontSize: '19px',
            color: '#d9d4e7',
            align: 'center'
        }).setOrigin(0.5);

        createEndButton(this, width * 0.5, height * 0.62, 'Main Menu', () => {
            openMainMenu(this);
        });

        const confirmKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ENTER);
        confirmKey?.once('down', () => {
            openMainMenu(this);
        });
    }
}

const createEndButton = (
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void
): void => {
    const background = scene.add.rectangle(x, y, 260, 56, 0x382a4f, 0.95)
        .setStrokeStyle(2, 0xf0d6a6, 0.9)
        .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '21px',
        color: '#fff3dd'
    }).setOrigin(0.5);

    background.on('pointerover', () => {
        background.setFillStyle(0x4a3767, 0.98);
        text.setScale(1.02);
    });
    background.on('pointerout', () => {
        background.setFillStyle(0x382a4f, 0.95);
        text.setScale(1);
    });
    background.on('pointerup', () => {
        onClick();
    });
};
