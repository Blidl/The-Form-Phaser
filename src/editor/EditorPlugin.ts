import { Input, type Scene } from 'phaser';
import { relaxKeyboardCapture, isDomTextInputFocused } from '../shared/dom_input_focus';
import { EditorShell } from './core/EditorShell';
import type { LegacyObjectSource } from './bridge/LegacyObjectAdapter';
import type { GameplayTimeController } from '../scenes/runtime/gameplay_time_controller';

export interface EditorPlugin {
    update(deltaMs: number): void;
    isOpen(): boolean;
    open(): void;
    close(): void;
    getGameplayTimeController(): GameplayTimeController;
    destroy(): void;
}

interface CreateEditorPluginOptions {
    scene: Scene;
    followTarget: Phaser.GameObjects.GameObject;
    legacyObjectSource?: LegacyObjectSource;
    gameplayTimeController: GameplayTimeController;
}

export const createEditorPlugin = (options: CreateEditorPluginOptions): EditorPlugin => {
    const { scene, followTarget, gameplayTimeController } = options;
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
        followTarget,
        legacyObjectSource: options.legacyObjectSource,
        gameplayTimeController
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
        getGameplayTimeController: (): GameplayTimeController => gameplayTimeController,
        destroy
    };
};
