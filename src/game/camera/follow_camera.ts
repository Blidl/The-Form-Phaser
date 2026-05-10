import { Cameras, Scene } from 'phaser';
import { PLAYER_CAMERA_FOLLOW_LERP } from '../player/player_constants';

export interface FollowCameraBounds {
    width: number;
    height: number;
}

export interface FollowCameraProfile {
    enabled?: boolean;
    zoom?: number;
    lerpX?: number;
    lerpY?: number;
    offsetX?: number;
    offsetY?: number;
    deadzoneWidth?: number;
    deadzoneHeight?: number;
}

export const BASELINE_FOLLOW_CAMERA_ZOOM = 1;
export const BASELINE_FOLLOW_CAMERA_OFFSET_X = 0;
export const BASELINE_FOLLOW_CAMERA_OFFSET_Y = 96;

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const resolveFollowProfile = (profile?: FollowCameraProfile): Required<FollowCameraProfile> => {
    const enabled = profile?.enabled ?? true;
    const zoom = clamp(profile?.zoom ?? BASELINE_FOLLOW_CAMERA_ZOOM, 0.2, 4);
    const lerpX = clamp(profile?.lerpX ?? PLAYER_CAMERA_FOLLOW_LERP, 0, 1);
    const lerpY = clamp(profile?.lerpY ?? PLAYER_CAMERA_FOLLOW_LERP, 0, 1);
    const offsetX = Number.isFinite(profile?.offsetX) ? Number(profile?.offsetX) : BASELINE_FOLLOW_CAMERA_OFFSET_X;
    const offsetY = Number.isFinite(profile?.offsetY) ? Number(profile?.offsetY) : BASELINE_FOLLOW_CAMERA_OFFSET_Y;
    const deadzoneWidth = Math.max(0, Number.isFinite(profile?.deadzoneWidth) ? Number(profile?.deadzoneWidth) : 0);
    const deadzoneHeight = Math.max(0, Number.isFinite(profile?.deadzoneHeight) ? Number(profile?.deadzoneHeight) : 0);
    return {
        enabled,
        zoom,
        lerpX,
        lerpY,
        offsetX,
        offsetY,
        deadzoneWidth,
        deadzoneHeight
    };
};

export const applyFollowCameraProfile = (
    camera: Cameras.Scene2D.Camera,
    target: Phaser.GameObjects.GameObject,
    bounds: FollowCameraBounds,
    profile?: FollowCameraProfile
): Cameras.Scene2D.Camera => {
    const resolved = resolveFollowProfile(profile);
    camera.panEffect.reset();
    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.setZoom(resolved.zoom);
    camera.setDeadzone();
    camera.stopFollow();
    if (resolved.enabled) {
        camera.startFollow(target, true, resolved.lerpX, resolved.lerpY);
        camera.setLerp(resolved.lerpX, resolved.lerpY);
        camera.setFollowOffset(resolved.offsetX, resolved.offsetY);
        if (resolved.deadzoneWidth > 0 && resolved.deadzoneHeight > 0) {
            camera.setDeadzone(resolved.deadzoneWidth, resolved.deadzoneHeight);
        }
    }
    camera.roundPixels = true;
    return camera;
};

export const setupBaselineFollowCamera = (
    scene: Scene,
    target: Phaser.GameObjects.GameObject,
    bounds: FollowCameraBounds,
    profile?: FollowCameraProfile
): Cameras.Scene2D.Camera => {
    const camera = scene.cameras.main;
    return applyFollowCameraProfile(camera, target, bounds, profile);
};

export const refreshBaselineFollowCameraLerp = (
    camera: Cameras.Scene2D.Camera,
    override?: { lerpX?: number; lerpY?: number }
): Cameras.Scene2D.Camera => {
    const lerpX = clamp(override?.lerpX ?? PLAYER_CAMERA_FOLLOW_LERP, 0, 1);
    const lerpY = clamp(override?.lerpY ?? PLAYER_CAMERA_FOLLOW_LERP, 0, 1);
    camera.setLerp(lerpX, lerpY);
    return camera;
};
