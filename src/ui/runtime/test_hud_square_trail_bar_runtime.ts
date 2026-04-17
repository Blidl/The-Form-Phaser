import type { Scene } from 'phaser';
import {
    PLAYER_SQUARE_TRAIL_BAR_HEIGHT,
    PLAYER_SQUARE_TRAIL_BAR_WIDTH
} from '../../game/player/player_constants';
import type { PlayerHudModel } from '../../game/player/player_runtime_contracts';
import { resolveTestHudAnchorPosition, TEST_HUD_SQUARE_TRAIL_BAR_LAYOUT } from './test_hud_layout';

interface CreateTestHudSquareTrailBarRuntimeParams {
    scene: Scene;
    player: PlayerHudModel;
}

export interface TestHudSquareTrailBarRuntime {
    update: () => void;
    setVisible: (visible: boolean) => void;
    destroy: () => void;
}

export const createTestHudSquareTrailBarRuntime = (
    params: CreateTestHudSquareTrailBarRuntimeParams
): TestHudSquareTrailBarRuntime => {
    const { scene, player } = params;
    const initialPosition = resolveTestHudAnchorPosition(scene, TEST_HUD_SQUARE_TRAIL_BAR_LAYOUT);

    const squareTrailBarLabel = scene.add.text(
        initialPosition.x,
        initialPosition.y - 18,
        'Square trail',
        {
            color: '#d9f2ff',
            fontFamily: 'monospace',
            fontSize: '14px'
        }
    ).setDepth(5000).setScrollFactor(0);

    const squareTrailBarTrack = scene.add.rectangle(
        initialPosition.x,
        initialPosition.y,
        PLAYER_SQUARE_TRAIL_BAR_WIDTH,
        PLAYER_SQUARE_TRAIL_BAR_HEIGHT,
        0x122026,
        0.92
    )
        .setStrokeStyle(1, 0xd9f2ff, 0.85)
        .setOrigin(0, 0)
        .setDepth(5000)
        .setScrollFactor(0);

    const squareTrailBarFill = scene.add.rectangle(
        initialPosition.x,
        initialPosition.y,
        PLAYER_SQUARE_TRAIL_BAR_WIDTH,
        PLAYER_SQUARE_TRAIL_BAR_HEIGHT,
        0x7dd3fc,
        1
    )
        .setOrigin(0, 0)
        .setDepth(5001)
        .setScrollFactor(0);

    return {
        update: (): void => {
            const nextPosition = resolveTestHudAnchorPosition(scene, TEST_HUD_SQUARE_TRAIL_BAR_LAYOUT);
            squareTrailBarLabel.setPosition(nextPosition.x, nextPosition.y - 18);
            squareTrailBarTrack.setPosition(nextPosition.x, nextPosition.y);
            squareTrailBarFill.setPosition(nextPosition.x, nextPosition.y);
            const ratio = player.squareTrailResourceRatio;
            const current = Math.max(0, player.squareTrailResourceCurrent);
            const max = Math.max(0, player.squareTrailResourceMax);
            squareTrailBarFill.width = PLAYER_SQUARE_TRAIL_BAR_WIDTH * ratio;

            const isSquareForm = player.currentForm === 'square';
            const activeAlpha = isSquareForm ? 1 : 0.55;
            squareTrailBarFill.setAlpha(activeAlpha);
            squareTrailBarTrack.setAlpha(activeAlpha);
            squareTrailBarLabel.setAlpha(activeAlpha);
            squareTrailBarLabel.setText(`Square trail ${Math.round(current)}/${Math.round(max)}`);
        },
        setVisible: (visible: boolean): void => {
            squareTrailBarLabel.setVisible(visible);
            squareTrailBarTrack.setVisible(visible);
            squareTrailBarFill.setVisible(visible);
        },
        destroy: (): void => {
            squareTrailBarLabel.destroy();
            squareTrailBarTrack.destroy();
            squareTrailBarFill.destroy();
        }
    };
};
