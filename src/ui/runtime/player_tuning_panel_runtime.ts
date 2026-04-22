import { Input, type Scene } from 'phaser';
import { PLAYER_TUNING_TABS } from '../../game/player/tuning/player_tuning_schema';
import type { PlayerTuningTabId } from '../../game/player/tuning/player_tuning_types';
import type { PlayerTuningRuntime } from '../../game/player/tuning/player_tuning_runtime';
import { PlayerTuningSidebar } from './player_tuning_sidebar';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../shared/dom_input_focus';

export interface PlayerTuningPanelRuntime {
    update: (deltaMs: number) => void;
    isActive: () => boolean;
    close: () => void;
    shouldMuteGameplayInput: () => boolean;
    destroy: () => void;
}

interface CreatePlayerTuningPanelRuntimeParams {
    scene: Scene;
    tuningRuntime: PlayerTuningRuntime;
    onOpened: () => void;
}

export const createPlayerTuningPanelRuntime = (
    params: CreatePlayerTuningPanelRuntimeParams
): PlayerTuningPanelRuntime => {
    const { scene, tuningRuntime, onOpened } = params;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const appRoot = document.getElementById('app');
    if (!appRoot) {
        throw new Error('#app was not found.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.ZERO);
    relaxKeyboardCapture(keyboard, [Input.Keyboard.KeyCodes.ZERO]);
    const sidebar = new PlayerTuningSidebar(appRoot, {
        onSelectTab: (tabId) => {
            activeTabId = tabId;
            syncSidebar();
        },
        onChangeField: (fieldId, value) => {
            const activeTab = PLAYER_TUNING_TABS.find((tab) => tab.id === activeTabId) ?? PLAYER_TUNING_TABS[0];
            const field = activeTab.sections
                .flatMap((section) => [...section.fields, ...section.rawFields])
                .find((entry) => entry.id === fieldId);
            if (!field) {
                return;
            }

            isFieldMutating = true;
            try {
                tuningRuntime.updateDraft((draft) => {
                    field.write(draft, value);
                });
            } finally {
                isFieldMutating = false;
                syncSidebar();
            }
        },
        onSaveToProject: () => {
            void tuningRuntime.saveToProject();
        },
        onRevertUnsaved: () => {
            tuningRuntime.revertUnsaved();
        },
        onResetToDefaults: () => {
            tuningRuntime.resetToDefaults();
        }
    });

    let active = false;
    let activeTabId: PlayerTuningTabId = 'common';
    let isFieldMutating = false;

    const syncSidebar = (): void => {
        const runtimeState = tuningRuntime.getState();
        sidebar.setState({
            visible: active,
            activeTabId,
            snapshot: runtimeState.draftSnapshot,
            status: runtimeState.saveStatus,
            isSaving: runtimeState.isSaving,
            isDirty: tuningRuntime.isDirty()
        });
    };

    const open = (): void => {
        if (active) {
            return;
        }
        active = true;
        onOpened();
        syncSidebar();
    };

    const close = (): void => {
        if (!active) {
            return;
        }
        active = false;
        syncSidebar();
    };

    const toggle = (): void => {
        if (active) {
            close();
            return;
        }
        open();
    };

    tuningRuntime.subscribe(() => {
        if (!isFieldMutating) {
            syncSidebar();
        }
    });

    syncSidebar();

    return {
        update: (): void => {
            if (isDomTextInputFocused()) {
                return;
            }
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggle();
            }
        },
        isActive: (): boolean => active,
        close: (): void => {
            close();
        },
        shouldMuteGameplayInput: (): boolean => isDomTextInputFocused(),
        destroy: (): void => {
            close();
            sidebar.destroy();
        }
    };
};
