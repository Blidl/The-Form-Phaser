export type PlayerFormId = 'ball' | 'triangle' | 'square';

export interface PlayerTriangleShellState {
    orientationRad: number;
    airborneSpinDirection: -1 | 1;
}

export interface PlayerShellState {
    currentForm: PlayerFormId;
    triangleShell: PlayerTriangleShellState;
}
