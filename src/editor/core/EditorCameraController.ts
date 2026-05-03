import Phaser, { type Scene } from 'phaser';

interface EditorCameraControllerOptions {
    scene: Scene;
    camera: Phaser.Cameras.Scene2D.Camera;
    followTarget: Phaser.GameObjects.GameObject;
}

interface DragState {
    startClientX: number;
    startClientY: number;
    startScrollX: number;
    startScrollY: number;
}

export class EditorCameraController {
    private readonly scene: Scene;
    private readonly camera: Phaser.Cameras.Scene2D.Camera;
    private readonly followTarget: Phaser.GameObjects.GameObject;
    private readonly defaultZoom: number;
    private active: boolean;
    private dragState: DragState | null;

    public constructor(options: EditorCameraControllerOptions) {
        this.scene = options.scene;
        this.camera = options.camera;
        this.followTarget = options.followTarget;
        this.defaultZoom = options.camera.zoom;
        this.active = false;
        this.dragState = null;

        this.scene.input.on('wheel', this.handleWheel, this);
        this.scene.game.canvas.addEventListener('pointerdown', this.handleCanvasPointerDown);
        window.addEventListener('pointermove', this.handleWindowPointerMove);
        window.addEventListener('pointerup', this.handleWindowPointerUp);
    }

    public open(): void {
        if (this.active) {
            return;
        }
        this.active = true;
        this.camera.stopFollow();
    }

    public close(): void {
        if (!this.active) {
            return;
        }
        this.active = false;
        this.dragState = null;
        this.camera.setZoom(this.defaultZoom);
        this.camera.startFollow(this.followTarget, true);
    }

    public destroy(): void {
        this.scene.input.off('wheel', this.handleWheel, this);
        this.scene.game.canvas.removeEventListener('pointerdown', this.handleCanvasPointerDown);
        window.removeEventListener('pointermove', this.handleWindowPointerMove);
        window.removeEventListener('pointerup', this.handleWindowPointerUp);
    }

    private readonly handleCanvasPointerDown = (event: PointerEvent): void => {
        if (!this.active || event.button !== 1) {
            return;
        }

        event.preventDefault();
        this.dragState = {
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScrollX: this.camera.scrollX,
            startScrollY: this.camera.scrollY
        };
    };

    private readonly handleWindowPointerMove = (event: PointerEvent): void => {
        if (!this.active || !this.dragState) {
            return;
        }

        const dx = (event.clientX - this.dragState.startClientX) / this.camera.zoom;
        const dy = (event.clientY - this.dragState.startClientY) / this.camera.zoom;

        this.camera.scrollX = this.dragState.startScrollX - dx;
        this.camera.scrollY = this.dragState.startScrollY - dy;
    };

    private readonly handleWindowPointerUp = (): void => {
        this.dragState = null;
    };

    private handleWheel(
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
    ): void {
        if (!this.active) {
            return;
        }

        const worldPointBefore = this.camera.getWorldPoint(pointer.x, pointer.y);
        const nextZoom = Phaser.Math.Clamp(
            this.camera.zoom - (Math.sign(deltaY) * 0.1),
            0.25,
            3
        );
        if (nextZoom === this.camera.zoom) {
            return;
        }

        this.camera.setZoom(nextZoom);
        const worldPointAfter = this.camera.getWorldPoint(pointer.x, pointer.y);
        this.camera.scrollX += worldPointBefore.x - worldPointAfter.x;
        this.camera.scrollY += worldPointBefore.y - worldPointAfter.y;
    }
}
