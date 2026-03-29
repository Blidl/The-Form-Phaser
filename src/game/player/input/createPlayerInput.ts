import { Input, type Scene } from 'phaser';
import type { PlayerInputKeys } from './playerInputTypes';

export function createPlayerInput(scene: Scene): PlayerInputKeys {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    return {
        moveLeft: keyboard.addKey(Input.Keyboard.KeyCodes.A),
        moveRight: keyboard.addKey(Input.Keyboard.KeyCodes.D),
        jump: keyboard.addKey(Input.Keyboard.KeyCodes.SPACE),
        previousForm: keyboard.addKey(Input.Keyboard.KeyCodes.Q),
        nextForm: keyboard.addKey(Input.Keyboard.KeyCodes.E),
        ability: keyboard.addKey(Input.Keyboard.KeyCodes.K),
        reset: keyboard.addKey(Input.Keyboard.KeyCodes.O)
    };
}
