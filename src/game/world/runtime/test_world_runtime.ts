import { GameObjects, Scene } from 'phaser';
import type { HazardObject } from '../hazard';
import type { RespawnPoint } from './world_runtime_types';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import { createTestWorldCheckpointRuntime } from './test_world_checkpoint_runtime';
import { createTestWorldLayoutRuntime } from './test_world_layout';
import { createTestWorldObjectRuntime } from './test_world_object_runtime';
import { createTestWorldWindRuntime } from './test_world_wind_runtime';

export { TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT } from './test_world_layout';

export interface TestWorldRuntime {
    hazards: readonly HazardObject[];
    updateMovingPlatforms: () => void;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
}

interface CreateTestWorldRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    onCheckpointActivated: (point: RespawnPoint) => void;
}

export const createTestWorldRuntime = (
    params: CreateTestWorldRuntimeParams
): TestWorldRuntime => {
    const { scene, player, onCheckpointActivated } = params;

    const layoutRuntime = createTestWorldLayoutRuntime(scene);
    scene.physics.add.collider(player.arcadeBodyObject, layoutRuntime.ground);
    scene.physics.add.collider(player.arcadeBodyObject, layoutRuntime.lowPlatform);
    scene.physics.add.collider(player.arcadeBodyObject, layoutRuntime.highPlatform);

    createTestWorldCheckpointRuntime({
        scene,
        player,
        onCheckpointActivated: (point) => {
            onCheckpointActivated(point);
        }
    });

    const objectRuntime = createTestWorldObjectRuntime({
        scene,
        player
    });
    const windRuntime = createTestWorldWindRuntime(scene);

    return {
        hazards: objectRuntime.hazards,
        updateMovingPlatforms: objectRuntime.updateMovingPlatforms,
        resolveWindInfluenceX: windRuntime.resolveWindInfluenceX
    };
};
