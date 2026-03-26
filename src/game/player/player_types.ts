export type PlayerFormId = 'ball' | 'triangle' | 'square';

export interface PlayerTriangleShellState {
    orientationRad: number;
    groundedOrientationRad: number;
    visualOffsetY: number;
    airborneSpinDirection: -1 | 1;
    airborneAngularVelocityRadPerSec: number;
}

export interface PlayerShellState {
    currentForm: PlayerFormId;
    triangleShell: PlayerTriangleShellState;
}
