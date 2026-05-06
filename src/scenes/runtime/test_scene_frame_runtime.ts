import {
    EMPTY_PLAYER_INPUT_SNAPSHOT,
    pollPlayerInputSnapshot,
    type PlayerInputKeys
} from '../../game/player/player_input';
import { Input, type Scene } from 'phaser';
import { PfPlayer } from '../../game/player/PfPlayer';
import type { PlayerTuningRuntime } from '../../game/player/tuning/player_tuning_runtime';
import type { PlayerRespawnRuntime } from '../../game/world/runtime/player_respawn_runtime';
import type { TestWorldEditorRuntime } from '../../game/world/runtime/test_world_editor_runtime';
import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import type { TestDebugRuntime } from '../../ui/runtime/test_debug_runtime';
import type { TestDevHelperRuntime } from '../../ui/runtime/test_dev_helper_runtime';
import type { TestHudRuntime } from '../../ui/runtime/test_hud_runtime';
import type { PlayerTuningPanelRuntime } from '../../ui/runtime/player_tuning_panel_runtime';
import { openEndScreen, openPauseMenu, startLevelScene } from '../demo_flow';
import { isEditorTextInputFocused, relaxKeyboardCapture } from '../../shared/dom_input_focus';
import type { TestCutsceneRuntime } from './test_cutscene_runtime';
import type { EditorPlugin } from '../../editor/EditorPlugin';

export interface TestSceneFrameRuntime {
    update: (deltaMs: number) => void;
}

interface CreateTestSceneFrameRuntimeParams {
    scene: Scene;
    player: PfPlayer;
    playerInputKeys: PlayerInputKeys;
    worldRuntime: TestWorldRuntime;
    respawnRuntime: PlayerRespawnRuntime;
    hudRuntime: TestHudRuntime;
    debugRuntime: TestDebugRuntime;
    cutsceneRuntime: TestCutsceneRuntime;
    editorRuntime: TestWorldEditorRuntime;
    editorPlugin: EditorPlugin;
    devHelperRuntime: TestDevHelperRuntime;
    tuningRuntime: PlayerTuningRuntime;
    tuningPanelRuntime: PlayerTuningPanelRuntime;
}

export const createTestSceneFrameRuntime = (
    params: CreateTestSceneFrameRuntimeParams
): TestSceneFrameRuntime => {
    const { scene, player, playerInputKeys, worldRuntime, respawnRuntime, hudRuntime, debugRuntime, cutsceneRuntime, editorRuntime, editorPlugin, devHelperRuntime, tuningPanelRuntime } = params;
    const pauseKey = scene.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ESC);
    const temporaryInteractionKey = scene.input.keyboard?.addKey(Input.Keyboard.KeyCodes.I);
    if (scene.input.keyboard) {
        relaxKeyboardCapture(scene.input.keyboard, [Input.Keyboard.KeyCodes.ESC, Input.Keyboard.KeyCodes.I]);
    }

    return {
        update: (deltaMs: number): void => {
            const textInputFocused = isEditorTextInputFocused();
            if (devHelperRuntime.update()) {
                return;
            }
            cutsceneRuntime.update(deltaMs);
            editorPlugin.update(deltaMs);
            editorRuntime.update(deltaMs);
            tuningPanelRuntime.update(deltaMs);
            if ((editorRuntime.isActive() || editorPlugin.isOpen()) && tuningPanelRuntime.isActive()) {
                tuningPanelRuntime.close();
            }
            if (editorRuntime.isActive()) {
                worldRuntime.updateNpcInteractionTarget();
                worldRuntime.updateNpcs(deltaMs);
                debugRuntime.update();
                hudRuntime.update();
                return;
            }
            if (!textInputFocused && !cutsceneRuntime.isInputLocked() && pauseKey && Input.Keyboard.JustDown(pauseKey)) {
                openPauseMenu(scene, {
                    levelId: worldRuntime.getLevelId()
                });
                return;
            }

            worldRuntime.updateMovingPlatforms();
            worldRuntime.updateNpcs(deltaMs);
            worldRuntime.syncNpcTriangleSupportSurfaces();
            worldRuntime.syncPlayerCollisionMode();

            const input = tuningPanelRuntime.shouldMuteGameplayInput()
                || cutsceneRuntime.isInputLocked()
                || textInputFocused
                ? EMPTY_PLAYER_INPUT_SNAPSHOT
                : pollPlayerInputSnapshot(playerInputKeys);
            const windInfluenceX = worldRuntime.resolveWindInfluenceX(player.arcadeBodyObject);

            player.tick(deltaMs, input, windInfluenceX);
            worldRuntime.postPlayerTickUpdate();
            worldRuntime.syncPlayerCollisionMode();
            worldRuntime.updateNpcInteractionTarget();
            if (!textInputFocused && !cutsceneRuntime.isInputLocked() && temporaryInteractionKey && Input.Keyboard.JustDown(temporaryInteractionKey)) {
                const handledByObjectLogic = worldRuntime.tryTriggerObjectLogicInteraction();
                if (!handledByObjectLogic) {
                    worldRuntime.tryTriggerNpcInteraction();
                }
            }
            if (worldRuntime.consumeFinishReached()) {
                const nextLevelId = worldRuntime.getNextLevelId();
                if (nextLevelId) {
                    startLevelScene(scene, { levelId: nextLevelId });
                    return;
                }
                openEndScreen(scene);
                return;
            }
            respawnRuntime.evaluateHazardOverlap(worldRuntime.hazards);
            debugRuntime.update();
            hudRuntime.update();
        }
    };
};
