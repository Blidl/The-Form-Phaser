export type PlayerFormId = 'ball' | 'triangle' | 'square';
export type TriangleCornerIndex = 0 | 1 | 2;

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
    forceBiasX: -1 | 1;
    selectedLeadingCornerIndex: TriangleCornerIndex;
    leadingCornerIndex: TriangleCornerIndex;
    lockedOrientationRad: number;
}

export interface PlayerTriangleChargesState {
    currentCharges: number;
    maxCharges: number;
}

export interface PlayerShellState {
    currentForm: PlayerFormId;
    triangleShell: PlayerTriangleShellState;
    triangleDash: PlayerTriangleDashState;
    triangleCharges: PlayerTriangleChargesState;
}
