import { Cameras, Scene } from 'phaser';
import { PLAYER_CAMERA_FOLLOW_LERP } from '../player/player_constants';

export interface FollowCameraBounds {
    width: number;
    height: number;
}

export const BASELINE_FOLLOW_CAMERA_ZOOM = 1;
export const BASELINE_FOLLOW_CAMERA_OFFSET_X = 0;
export const BASELINE_FOLLOW_CAMERA_OFFSET_Y = 96;

export const setupBaselineFollowCamera = (
    scene: Scene,
    target: Phaser.GameObjects.GameObject,
    bounds: FollowCameraBounds
): Cameras.Scene2D.Camera => {
    const camera = scene.cameras.main;

    camera.panEffect.reset();
    camera.setZoom(BASELINE_FOLLOW_CAMERA_ZOOM);
    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.startFollow(target, true, PLAYER_CAMERA_FOLLOW_LERP, PLAYER_CAMERA_FOLLOW_LERP);
    camera.setFollowOffset(BASELINE_FOLLOW_CAMERA_OFFSET_X, BASELINE_FOLLOW_CAMERA_OFFSET_Y);
    camera.roundPixels = true;

    return camera;
};

export const refreshBaselineFollowCameraLerp = (
    camera: Cameras.Scene2D.Camera
): Cameras.Scene2D.Camera => {
    camera.setLerp(PLAYER_CAMERA_FOLLOW_LERP, PLAYER_CAMERA_FOLLOW_LERP);
    return camera;
};
