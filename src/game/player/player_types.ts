export type PlayerFormId = 'ball' | 'triangle' | 'square';

export interface PlayerShellState {
    currentForm: PlayerFormId;
}
