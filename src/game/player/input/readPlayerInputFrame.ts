import { Input } from 'phaser';
import type { PlayerInputFrame, PlayerInputKeys } from './playerInputTypes';

export function readPlayerInputFrame(inputKeys: PlayerInputKeys): PlayerInputFrame {
    return {
        moveLeftPressed: inputKeys.moveLeft.isDown,
        moveRightPressed: inputKeys.moveRight.isDown,
        jumpPressed: inputKeys.jump.isDown,
        jumpJustPressed: Input.Keyboard.JustDown(inputKeys.jump),
        previousFormPressed: Input.Keyboard.JustDown(inputKeys.previousForm),
        nextFormPressed: Input.Keyboard.JustDown(inputKeys.nextForm),
        abilityPressed: Input.Keyboard.JustDown(inputKeys.ability),
        resetPressed: Input.Keyboard.JustDown(inputKeys.reset)
    };
}
