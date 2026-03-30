import type { Scene } from 'phaser';
import type { PlayerDebugModel } from '../../game/player/player_runtime_contracts';
import type { HazardObject } from '../../game/world/hazard';
import type { TestDebugRuntime } from './ui_runtime_types';
import { createTestDebugDrawRuntime } from './test_debug_draw_runtime';

interface CreateTestDebugRuntimeParams {
    scene: Scene;
    player: PlayerDebugModel;
    getHazards: () => readonly HazardObject[];
}

export const createTestDebugRuntime = (params: CreateTestDebugRuntimeParams): TestDebugRuntime => {
    const { scene, player, getHazards } = params;
    const debugDrawRuntime = createTestDebugDrawRuntime({
        scene,
        player,
        getHazards
    });

    return {
        update: debugDrawRuntime.render,
        setVisible: debugDrawRuntime.setVisible,
        reset: debugDrawRuntime.reset,
        destroy: debugDrawRuntime.destroy
    };
};

export type { TestDebugRuntime } from './ui_runtime_types';
