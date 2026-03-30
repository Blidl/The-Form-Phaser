import { pollPlayerInputSnapshot, type PlayerInputKeys } from '../../game/player/player_input';
import { PfPlayer } from '../../game/player/PfPlayer';
import type { PlayerRespawnRuntime } from '../../game/world/runtime/player_respawn_runtime';
import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import type { TestDebugRuntime } from '../../ui/runtime/test_debug_runtime';
import type { TestHudRuntime } from '../../ui/runtime/test_hud_runtime';

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
}

export const createTestSceneFrameRuntime = (
    params: CreateTestSceneFrameRuntimeParams
): TestSceneFrameRuntime => {
    const { player, playerInputKeys, worldRuntime, respawnRuntime, hudRuntime, debugRuntime } = params;

    return {
        update: (deltaMs: number): void => {
            worldRuntime.updateMovingPlatforms();
            worldRuntime.syncPlayerCollisionMode();

            const input = pollPlayerInputSnapshot(playerInputKeys);
            const windInfluenceX = worldRuntime.resolveWindInfluenceX(player.arcadeBodyObject);

            player.tick(deltaMs, input, windInfluenceX);
            worldRuntime.syncPlayerCollisionMode();
            respawnRuntime.evaluateHazardOverlap(worldRuntime.hazards);
            debugRuntime.update();
            hudRuntime.update();
        }
    };
};
