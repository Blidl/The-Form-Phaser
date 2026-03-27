import { Input, Scene } from 'phaser';

export interface PlayerInputSnapshot {
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    jumpPressed: boolean;
    jumpHeld: boolean;
    nextFormPressed: boolean;
    prevFormPressed: boolean;
    actionPressed: boolean;
    actionHeld: boolean;
    regenPressed: boolean;
}

export interface PlayerInputKeys {
    left: Input.Keyboard.Key;
    right: Input.Keyboard.Key;
    up: Input.Keyboard.Key;
    down: Input.Keyboard.Key;
    jump: Input.Keyboard.Key;
    nextForm: Input.Keyboard.Key;
    prevForm: Input.Keyboard.Key;
    action: Input.Keyboard.Key;
    regen: Input.Keyboard.Key;
}

export const EMPTY_PLAYER_INPUT_SNAPSHOT: PlayerInputSnapshot = {
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    jumpPressed: false,
    jumpHeld: false,
    nextFormPressed: false,
    prevFormPressed: false,
    actionPressed: false,
    actionHeld: false,
    regenPressed: false
};

export const createPlayerInputKeys = (scene: Scene): PlayerInputKeys => {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    return {
        left: keyboard.addKey(Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Input.Keyboard.KeyCodes.D),
        up: keyboard.addKey(Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Input.Keyboard.KeyCodes.S),
        jump: keyboard.addKey(Input.Keyboard.KeyCodes.SPACE),
        nextForm: keyboard.addKey(Input.Keyboard.KeyCodes.E),
        prevForm: keyboard.addKey(Input.Keyboard.KeyCodes.Q),
        action: keyboard.addKey(Input.Keyboard.KeyCodes.K),
        regen: keyboard.addKey(Input.Keyboard.KeyCodes.O)
    };
};

export const pollPlayerInputSnapshot = (keys: PlayerInputKeys): PlayerInputSnapshot => {
    return {
        moveLeft: keys.left.isDown,
        moveRight: keys.right.isDown,
        moveUp: keys.up.isDown,
        moveDown: keys.down.isDown,
        jumpPressed: Input.Keyboard.JustDown(keys.jump),
        jumpHeld: keys.jump.isDown,
        nextFormPressed: Input.Keyboard.JustDown(keys.nextForm),
        prevFormPressed: Input.Keyboard.JustDown(keys.prevForm),
        actionPressed: Input.Keyboard.JustDown(keys.action),
        actionHeld: keys.action.isDown,
        regenPressed: Input.Keyboard.JustDown(keys.regen)
    };
};
