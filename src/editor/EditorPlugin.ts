import { Input, type Scene } from 'phaser';
import { relaxKeyboardCapture, isDomTextInputFocused } from '../shared/dom_input_focus';
import { EditorShell } from './core/EditorShell';

export interface EditorPlugin {
    update(deltaMs: number): void;
    isOpen(): boolean;
    open(): void;
    close(): void;
    destroy(): void;
}

interface CreateEditorPluginOptions {
    scene: Scene;
    followTarget: Phaser.GameObjects.GameObject;
}

export const createEditorPlugin = (options: CreateEditorPluginOptions): EditorPlugin => {
    const { scene, followTarget } = options;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available for EditorPlugin.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.F2);
    const shiftKey = keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT);
    relaxKeyboardCapture(keyboard, [Input.Keyboard.KeyCodes.F2]);

    const shell = new EditorShell({
        scene,
        camera: scene.cameras.main,
        followTarget
    });

    let destroyed = false;

    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        shell.destroy();
    };

    scene.events.once('shutdown', destroy);
    scene.events.once('destroy', destroy);

    return {
        update: (_deltaMs: number): void => {
            if (destroyed) {
                return;
            }

            if (!isDomTextInputFocused() && Input.Keyboard.JustDown(toggleKey) && !shiftKey.isDown) {
                shell.toggle();
            }

            shell.update();
        },
        isOpen: (): boolean => shell.isOpen(),
        open: (): void => shell.open(),
        close: (): void => shell.close(),
        destroy
    };
};
