export type PlayerFormId = 'ball' | 'triangle' | 'square';

export interface PlayerTriangleShellState {
    orientationRad: number;
    groundedOrientationRad: number;
    visualOffsetY: number;
    airborneSpinDirection: -1 | 1;
    airborneAngularVelocityRadPerSec: number;
}

export interface PlayerTriangleDashState {
    isActive: boolean;
    remainingMs: number;
    cooldownMs: number;
    directionX: number;
    directionY: number;
}

export interface PlayerShellState {
    currentForm: PlayerFormId;
    triangleShell: PlayerTriangleShellState;
    triangleDash: PlayerTriangleDashState;
}
