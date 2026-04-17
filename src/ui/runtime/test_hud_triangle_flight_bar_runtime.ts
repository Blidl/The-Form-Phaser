import type { Scene } from 'phaser';
import {
    PLAYER_TRIANGLE_FLIGHT_BAR_HEIGHT,
    PLAYER_TRIANGLE_FLIGHT_BAR_WIDTH
} from '../../game/player/player_constants';
import type { PlayerHudModel } from '../../game/player/player_runtime_contracts';
import { resolveTestHudAnchorPosition, TEST_HUD_TRIANGLE_FLIGHT_BAR_LAYOUT } from './test_hud_layout';

interface CreateTestHudTriangleFlightBarRuntimeParams {
    scene: Scene;
    player: PlayerHudModel;
}

export interface TestHudTriangleFlightBarRuntime {
    update: () => void;
    setVisible: (visible: boolean) => void;
    destroy: () => void;
}

export const createTestHudTriangleFlightBarRuntime = (
    params: CreateTestHudTriangleFlightBarRuntimeParams
): TestHudTriangleFlightBarRuntime => {
    const { scene, player } = params;
    const initialPosition = resolveTestHudAnchorPosition(scene, TEST_HUD_TRIANGLE_FLIGHT_BAR_LAYOUT);

    const label = scene.add.text(
        initialPosition.x,
        initialPosition.y - 18,
        'Triangle flight',
        {
            color: '#ffe7c2',
            fontFamily: 'monospace',
            fontSize: '14px'
        }
    ).setDepth(5000).setScrollFactor(0);

    const track = scene.add.rectangle(
        initialPosition.x,
        initialPosition.y,
        PLAYER_TRIANGLE_FLIGHT_BAR_WIDTH,
        PLAYER_TRIANGLE_FLIGHT_BAR_HEIGHT,
        0x24170e,
        0.92
    )
        .setStrokeStyle(1, 0xffd08a, 0.85)
        .setOrigin(0, 0)
        .setDepth(5000)
        .setScrollFactor(0);

    const fill = scene.add.rectangle(
        initialPosition.x,
        initialPosition.y,
        PLAYER_TRIANGLE_FLIGHT_BAR_WIDTH,
        PLAYER_TRIANGLE_FLIGHT_BAR_HEIGHT,
        0xffb74d,
        1
    )
        .setOrigin(0, 0)
        .setDepth(5001)
        .setScrollFactor(0);

    return {
        update: (): void => {
            const nextPosition = resolveTestHudAnchorPosition(scene, TEST_HUD_TRIANGLE_FLIGHT_BAR_LAYOUT);
            label.setPosition(nextPosition.x, nextPosition.y - 18);
            track.setPosition(nextPosition.x, nextPosition.y);
            fill.setPosition(nextPosition.x, nextPosition.y);
            const ratio = player.triangleFlightResourceRatio;
            const current = Math.max(0, player.triangleFlightResourceCurrent);
            const max = Math.max(0, player.triangleFlightResourceMax);
            const isTriangleForm = player.currentForm === 'triangle';
            const activeAlpha = isTriangleForm ? 1 : 0.55;

            fill.width = PLAYER_TRIANGLE_FLIGHT_BAR_WIDTH * ratio;
            fill.setAlpha(activeAlpha);
            track.setAlpha(activeAlpha);
            label.setAlpha(activeAlpha);
            label.setText(`Triangle flight ${Math.ceil(current)}/${Math.ceil(max)}`);
        },
        setVisible: (visible: boolean): void => {
            label.setVisible(visible);
            track.setVisible(visible);
            fill.setVisible(visible);
        },
        destroy: (): void => {
            label.destroy();
            track.destroy();
            fill.destroy();
        }
    };
};
