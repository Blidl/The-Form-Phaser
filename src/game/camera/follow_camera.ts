import { Cameras, Scene } from 'phaser';

export interface FollowCameraBounds {
    width: number;
    height: number;
}

export const setupBaselineFollowCamera = (
    scene: Scene,
    target: Phaser.GameObjects.GameObject,
    bounds: FollowCameraBounds
): Cameras.Scene2D.Camera => {
    const camera = scene.cameras.main;

    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.startFollow(target, true, 1, 1);
    camera.setFollowOffset(0, 96);
    camera.roundPixels = true;

    return camera;
};
