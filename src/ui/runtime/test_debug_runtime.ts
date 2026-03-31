import { Input, type Scene } from 'phaser';
import type { PlayerDebugModel } from '../../game/player/player_runtime_contracts';
import type { HazardObject } from '../../game/world/hazard';
import type { TestDebugRuntime } from './ui_runtime_types';
import { createTestDebugDrawRuntime } from './test_debug_draw_runtime';

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
        if (isTypingIntoDomElement()) {
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

const isTypingIntoDomElement = (): boolean => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
        return false;
    }

    const tagName = activeElement.tagName;
    return activeElement.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT';
};

export type { TestDebugRuntime } from './ui_runtime_types';
