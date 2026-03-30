import type { Scene } from 'phaser';
import { createTestSceneBootstrapRuntime } from './test_scene_bootstrap';
import { createTestSceneFrameRuntime } from './test_scene_frame_runtime';

export interface TestSceneRuntime {
    update: (deltaMs: number) => void;
}

interface CreateTestSceneRuntimeParams {
    scene: Scene;
}

export const createTestSceneRuntime = (
    params: CreateTestSceneRuntimeParams
): TestSceneRuntime => {
    const { scene } = params;
    const bootstrapRuntime = createTestSceneBootstrapRuntime(scene);
    return createTestSceneFrameRuntime(bootstrapRuntime);
};
