import {
    EMPTY_PLAYER_INPUT_SNAPSHOT,
    pollPlayerInputSnapshot,
    type PlayerInputKeys
} from '../../game/player/player_input';
import { PfPlayer } from '../../game/player/PfPlayer';
import type { PlayerTuningRuntime } from '../../game/player/tuning/player_tuning_runtime';
import type { PlayerRespawnRuntime } from '../../game/world/runtime/player_respawn_runtime';
import type { TestWorldEditorRuntime } from '../../game/world/runtime/test_world_editor_runtime';
import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import type { TestDebugRuntime } from '../../ui/runtime/test_debug_runtime';
import type { TestHudRuntime } from '../../ui/runtime/test_hud_runtime';
import type { PlayerTuningPanelRuntime } from '../../ui/runtime/player_tuning_panel_runtime';

export interface TestSceneFrameRuntime {
    update: (deltaMs: number) => void;
}

interface CreateTestSceneFrameRuntimeParams {
    player: PfPlayer;
    playerInputKeys: PlayerInputKeys;
    worldRuntime: TestWorldRuntime;
    respawnRuntime: PlayerRespawnRuntime;
    hudRuntime: TestHudRuntime;
    debugRuntime: TestDebugRuntime;
    editorRuntime: TestWorldEditorRuntime;
    tuningRuntime: PlayerTuningRuntime;
    tuningPanelRuntime: PlayerTuningPanelRuntime;
}

export const createTestSceneFrameRuntime = (
    params: CreateTestSceneFrameRuntimeParams
): TestSceneFrameRuntime => {
    const { player, playerInputKeys, worldRuntime, respawnRuntime, hudRuntime, debugRuntime, editorRuntime, tuningPanelRuntime } = params;

    return {
        update: (deltaMs: number): void => {
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

            worldRuntime.updateMovingPlatforms();
            worldRuntime.syncPlayerCollisionMode();

            const input = tuningPanelRuntime.shouldMuteGameplayInput()
                ? EMPTY_PLAYER_INPUT_SNAPSHOT
                : pollPlayerInputSnapshot(playerInputKeys);
            const windInfluenceX = worldRuntime.resolveWindInfluenceX(player.arcadeBodyObject);

            player.tick(deltaMs, input, windInfluenceX);
            worldRuntime.postPlayerTickUpdate();
            worldRuntime.syncPlayerCollisionMode();
            respawnRuntime.evaluateHazardOverlap(worldRuntime.hazards);
            debugRuntime.update();
            hudRuntime.update();
        }
    };
};
