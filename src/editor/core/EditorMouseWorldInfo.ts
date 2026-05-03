import type { Scene } from 'phaser';

export interface MouseWorldPosition {
    x: number;
    y: number;
}

export class EditorMouseWorldInfo {
    private readonly scene: Scene;
    private readonly camera: Phaser.Cameras.Scene2D.Camera;

    public constructor(scene: Scene, camera: Phaser.Cameras.Scene2D.Camera) {
        this.scene = scene;
        this.camera = camera;
    }

    public read(): MouseWorldPosition | null {
        const pointer = this.scene.input.activePointer;
        if (!pointer) {
            return null;
        }

        const isInsideGame = pointer.x >= 0
            && pointer.y >= 0
            && pointer.x <= this.scene.scale.width
            && pointer.y <= this.scene.scale.height;
        if (!isInsideGame) {
            return null;
        }

        const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
        return {
            x: worldPoint.x,
            y: worldPoint.y
        };
    }
}
