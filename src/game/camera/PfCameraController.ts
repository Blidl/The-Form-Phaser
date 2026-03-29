import { Cameras, GameObjects } from 'phaser';
import { CAMERA_CONFIG } from '../../config/camera/cameraConfig';

export interface PfCameraWorldBounds {
    width: number;
    height: number;
}

export interface PfCameraControllerConfig {
    camera: Cameras.Scene2D.Camera;
    followTarget: GameObjects.GameObject;
    worldBounds: PfCameraWorldBounds;
}

export class PfCameraController {
    public constructor(config: PfCameraControllerConfig) {
        const { camera, followTarget, worldBounds } = config;

        camera.setBounds(0, 0, worldBounds.width, worldBounds.height);
        camera.startFollow(
            followTarget,
            true,
            CAMERA_CONFIG.followLerpX,
            CAMERA_CONFIG.followLerpY
        );
        camera.setDeadzone(
            CAMERA_CONFIG.deadzoneWidth,
            CAMERA_CONFIG.deadzoneHeight
        );
        camera.setFollowOffset(
            CAMERA_CONFIG.followOffsetX,
            CAMERA_CONFIG.followOffsetY
        );
        camera.roundPixels = true;
    }
}
