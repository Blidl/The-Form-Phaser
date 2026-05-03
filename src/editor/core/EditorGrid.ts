import type { Scene } from 'phaser';

const GRID_COLOR = 0xe6f7ff;
const GRID_ALPHA = 0.2;

export class EditorGrid {
    private readonly graphics: Phaser.GameObjects.Graphics;
    private visible: boolean;
    private gridSize: number;

    public constructor(scene: Scene, depth: number = 5000) {
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(depth);
        this.graphics.setVisible(false);
        this.visible = false;
        this.gridSize = 32;
    }

    public setVisible(visible: boolean): void {
        this.visible = visible;
        this.graphics.setVisible(visible);
        if (!visible) {
            this.graphics.clear();
        }
    }

    public setGridSize(gridSize: number): void {
        this.gridSize = Math.max(1, Math.round(gridSize));
    }

    public update(camera: Phaser.Cameras.Scene2D.Camera): void {
        if (!this.visible) {
            return;
        }

        const size = this.gridSize;
        const worldView = camera.worldView;
        const left = Math.floor(worldView.left / size) * size;
        const right = Math.ceil(worldView.right / size) * size;
        const top = Math.floor(worldView.top / size) * size;
        const bottom = Math.ceil(worldView.bottom / size) * size;

        this.graphics.clear();
        this.graphics.lineStyle(1, GRID_COLOR, GRID_ALPHA);

        for (let x = left; x <= right; x += size) {
            this.graphics.lineBetween(x, top, x, bottom);
        }
        for (let y = top; y <= bottom; y += size) {
            this.graphics.lineBetween(left, y, right, y);
        }
    }

    public destroy(): void {
        this.graphics.destroy();
    }
}
