import type { Input } from 'phaser';

export interface PlayerInputFrame {
    moveLeftPressed: boolean;
    moveRightPressed: boolean;
    jumpPressed: boolean;
    jumpJustPressed: boolean;
    previousFormPressed: boolean;
    nextFormPressed: boolean;
    abilityPressed: boolean;
    resetPressed: boolean;
}

export interface PlayerInputKeys {
    moveLeft: Input.Keyboard.Key;
    moveRight: Input.Keyboard.Key;
    jump: Input.Keyboard.Key;
    previousForm: Input.Keyboard.Key;
    nextForm: Input.Keyboard.Key;
    ability: Input.Keyboard.Key;
    reset: Input.Keyboard.Key;
}

export const EMPTY_PLAYER_INPUT_FRAME: PlayerInputFrame = {
    moveLeftPressed: false,
    moveRightPressed: false,
    jumpPressed: false,
    jumpJustPressed: false,
    previousFormPressed: false,
    nextFormPressed: false,
    abilityPressed: false,
    resetPressed: false
};
