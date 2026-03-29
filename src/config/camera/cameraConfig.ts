export interface CameraConfig {
    readonly followLerpX: number;
    readonly followLerpY: number;
    readonly deadzoneWidth: number;
    readonly deadzoneHeight: number;
    readonly followOffsetX: number;
    readonly followOffsetY: number;
}

export const CAMERA_CONFIG: CameraConfig = {
    followLerpX: 0.15,
    followLerpY: 0.15,
    deadzoneWidth: 120,
    deadzoneHeight: 80,
    followOffsetX: 0,
    followOffsetY: 96
};
