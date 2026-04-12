import type { Scene } from 'phaser';
import { createTestSceneBootstrapRuntime } from './test_scene_bootstrap';
import { createTestSceneFrameRuntime } from './test_scene_frame_runtime';

export interface TestSceneRuntime {
    update: (deltaMs: number) => void;
    destroy: () => void;
}

interface CreateTestSceneRuntimeParams {
    scene: Scene;
    levelId?: string;
    editorOpen?: boolean;
}

export const createTestSceneRuntime = (
    params: CreateTestSceneRuntimeParams
): TestSceneRuntime => {
    const { scene, levelId, editorOpen } = params;
    const bootstrapRuntime = createTestSceneBootstrapRuntime(scene, levelId, editorOpen);
    const frameRuntime = createTestSceneFrameRuntime({
        ...bootstrapRuntime,
        scene
    });

    let destroyed = false;
    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        bootstrapRuntime.devHelperRuntime.destroy();
        bootstrapRuntime.tuningPanelRuntime.destroy();
    };

    scene.events.once('shutdown', destroy);
    scene.events.once('destroy', destroy);

    return {
        update: frameRuntime.update,
        destroy
    };
};
