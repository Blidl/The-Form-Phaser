import type { Input } from 'phaser';

const DOM_TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const isDomTextInputFocused = (): boolean => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
        return false;
    }

    return activeElement.isContentEditable || DOM_TEXT_INPUT_TAGS.has(activeElement.tagName);
};

export const isEditorTextInputFocused = (): boolean => {
    return isDomTextInputFocused();
};

export const relaxKeyboardCapture = (
    keyboard: Input.Keyboard.KeyboardPlugin,
    keyCodes: number[]
): void => {
    keyboard.removeCapture(keyCodes);
};
