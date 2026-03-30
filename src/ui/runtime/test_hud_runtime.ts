import type { GameObjects, Scene } from 'phaser';
import type { PlayerHudModel } from '../../game/player/player_runtime_contracts';
import type { TestHudRuntime } from './ui_runtime_types';
import { createTestHudSquareTrailBarRuntime } from './test_hud_square_trail_bar_runtime';

interface CreateTestHudRuntimeParams {
    scene: Scene;
    player: PlayerHudModel;
}

export const createTestHudRuntime = (params: CreateTestHudRuntimeParams): TestHudRuntime => {
    const { scene, player } = params;

    const title = scene.add.text(24, 24, 'sc_test', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '24px'
    }).setDepth(5000).setScrollFactor(0);
    const squareTrailBarRuntime = createTestHudSquareTrailBarRuntime({
        scene,
        player
    });

    const setVisible = (visible: boolean): void => {
        title.setVisible(visible);
        squareTrailBarRuntime.setVisible(visible);
    };

    const reset = (): void => {
        squareTrailBarRuntime.update();
    };

    const destroy = (): void => {
        const objects: GameObjects.GameObject[] = [
            title
        ];
        objects.forEach((object) => object.destroy());
        squareTrailBarRuntime.destroy();
    };

    reset();

    return {
        update: squareTrailBarRuntime.update,
        setVisible,
        reset,
        destroy
    };
};

export type { TestHudRuntime } from './ui_runtime_types';
