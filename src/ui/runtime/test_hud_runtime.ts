import type { GameObjects, Scene } from 'phaser';
import type { PlayerHudModel } from '../../game/player/player_runtime_contracts';
import type { TestHudRuntime } from './ui_runtime_types';
import { createTestHudSquareTrailBarRuntime } from './test_hud_square_trail_bar_runtime';
import { createTestHudTriangleFlightBarRuntime } from './test_hud_triangle_flight_bar_runtime';
import { resolveTestHudAnchorPosition, TEST_HUD_TITLE_LAYOUT } from './test_hud_layout';

interface CreateTestHudRuntimeParams {
    scene: Scene;
    player: PlayerHudModel;
}

export const createTestHudRuntime = (params: CreateTestHudRuntimeParams): TestHudRuntime => {
    const { scene, player } = params;
    const titlePosition = resolveTestHudAnchorPosition(scene, TEST_HUD_TITLE_LAYOUT);

    const title = scene.add.text(titlePosition.x, titlePosition.y, 'sc_test', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '24px'
    }).setDepth(5000).setScrollFactor(0);
    const squareTrailBarRuntime = createTestHudSquareTrailBarRuntime({
        scene,
        player
    });
    const triangleFlightBarRuntime = createTestHudTriangleFlightBarRuntime({
        scene,
        player
    });

    const setVisible = (visible: boolean): void => {
        title.setVisible(visible);
        squareTrailBarRuntime.setVisible(visible);
        triangleFlightBarRuntime.setVisible(visible);
    };

    const reset = (): void => {
        squareTrailBarRuntime.update();
        triangleFlightBarRuntime.update();
    };

    const destroy = (): void => {
        const objects: GameObjects.GameObject[] = [
            title
        ];
        objects.forEach((object) => object.destroy());
        squareTrailBarRuntime.destroy();
        triangleFlightBarRuntime.destroy();
    };

    reset();

    return {
        update: (): void => {
            const nextTitlePosition = resolveTestHudAnchorPosition(scene, TEST_HUD_TITLE_LAYOUT);
            title.setPosition(nextTitlePosition.x, nextTitlePosition.y);
            squareTrailBarRuntime.update();
            triangleFlightBarRuntime.update();
        },
        setVisible,
        reset,
        destroy
    };
};

export type { TestHudRuntime } from './ui_runtime_types';
