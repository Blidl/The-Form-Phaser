import { Input, type Scene } from 'phaser';
import type { PlayerDebugModel } from '../../game/player/player_runtime_contracts';
import type { HazardObject } from '../../game/world/hazard';
import type { TestDebugRuntime } from './ui_runtime_types';
import { createTestDebugDrawRuntime } from './test_debug_draw_runtime';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../shared/dom_input_focus';

interface CreateTestDebugRuntimeParams {
    scene: Scene;
    player: PlayerDebugModel;
    setPlayerDebugVisualsVisible: (visible: boolean) => void;
    getHazards: () => readonly HazardObject[];
}

export const createTestDebugRuntime = (params: CreateTestDebugRuntimeParams): TestDebugRuntime => {
    const { scene, player, setPlayerDebugVisualsVisible, getHazards } = params;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.NINE);
    relaxKeyboardCapture(keyboard, [Input.Keyboard.KeyCodes.NINE]);
    const debugDrawRuntime = createTestDebugDrawRuntime({
        scene,
        player,
        getHazards
    });

    let visible = false;

    const applyVisibility = (nextVisible: boolean): void => {
        visible = nextVisible;
        debugDrawRuntime.setVisible(visible);
        setPlayerDebugVisualsVisible(visible);
        if (!visible) {
            debugDrawRuntime.reset();
        }
    };

    const toggleVisibility = (): void => {
        if (isDomTextInputFocused()) {
            return;
        }
        applyVisibility(!visible);
    };

    applyVisibility(false);

    return {
        update: (): void => {
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggleVisibility();
            }

            if (!visible) {
                debugDrawRuntime.reset();
                return;
            }

            debugDrawRuntime.render();
        },
        setVisible: (nextVisible: boolean): void => {
            applyVisibility(nextVisible);
        },
        reset: (): void => {
            debugDrawRuntime.reset();
        },
        destroy: (): void => {
            applyVisibility(false);
            debugDrawRuntime.destroy();
        }
    };
};

export type { TestDebugRuntime } from './ui_runtime_types';
