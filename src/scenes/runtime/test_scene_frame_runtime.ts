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
import { relaxKeyboardCapture } from '../../shared/dom_input_focus';

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
    editorRuntime: TestWorldEditorRuntime;
    devHelperRuntime: TestDevHelperRuntime;
    tuningRuntime: PlayerTuningRuntime;
    tuningPanelRuntime: PlayerTuningPanelRuntime;
}

export const createTestSceneFrameRuntime = (
    params: CreateTestSceneFrameRuntimeParams
): TestSceneFrameRuntime => {
    const { scene, player, playerInputKeys, worldRuntime, respawnRuntime, hudRuntime, debugRuntime, editorRuntime, devHelperRuntime, tuningPanelRuntime } = params;
    const pauseKey = scene.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ESC);
    if (scene.input.keyboard) {
        relaxKeyboardCapture(scene.input.keyboard, [Input.Keyboard.KeyCodes.ESC]);
    }

    return {
        update: (deltaMs: number): void => {
            if (devHelperRuntime.update()) {
                return;
            }
            editorRuntime.update(deltaMs);
            tuningPanelRuntime.update(deltaMs);
            if (editorRuntime.isActive() && tuningPanelRuntime.isActive()) {
                tuningPanelRuntime.close();
            }
            if (editorRuntime.isActive()) {
                debugRuntime.update();
                hudRuntime.update();
                return;
            }
            if (pauseKey && Input.Keyboard.JustDown(pauseKey)) {
                openPauseMenu(scene, {
                    levelId: worldRuntime.getLevelId()
                });
                return;
            }

            worldRuntime.updateMovingPlatforms();
            worldRuntime.syncPlayerCollisionMode();

            const input = tuningPanelRuntime.shouldMuteGameplayInput()
                ? EMPTY_PLAYER_INPUT_SNAPSHOT
                : pollPlayerInputSnapshot(playerInputKeys);
            const windInfluenceX = worldRuntime.resolveWindInfluenceX(player.arcadeBodyObject);

            player.tick(deltaMs, input, windInfluenceX);
            worldRuntime.postPlayerTickUpdate();
            worldRuntime.syncPlayerCollisionMode();
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
