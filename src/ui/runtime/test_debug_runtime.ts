import type { Physics, Scene } from 'phaser';
import type { PfPlayer } from '../../game/player/PfPlayer';
import type { PlayerHazardHitShape } from '../../game/player/player_form_collision_shapes';
import type { HazardObject } from '../../game/world/hazard';
import type { TestDebugRuntime } from './ui_runtime_types';

interface CreateTestDebugRuntimeParams {
    scene: Scene;
    player: PfPlayer;
    hazards: readonly HazardObject[];
}

export const createTestDebugRuntime = (params: CreateTestDebugRuntimeParams): TestDebugRuntime => {
    const { scene, player, hazards } = params;
    const debugOverlay = scene.add.graphics().setDepth(6000);

    const drawHazardHitShape = (shape: PlayerHazardHitShape, color: number): void => {
        debugOverlay.lineStyle(2, color, 1);

        if (shape.kind === 'circle') {
            debugOverlay.strokeCircle(shape.centerX, shape.centerY, shape.radius);
            return;
        }

        if (shape.kind === 'box') {
            debugOverlay.strokeRect(
                shape.centerX - (shape.width * 0.5),
                shape.centerY - (shape.height * 0.5),
                shape.width,
                shape.height
            );
            return;
        }

        const points = shape.points;
        debugOverlay.beginPath();
        debugOverlay.moveTo(points[0].x, points[0].y);
        debugOverlay.lineTo(points[1].x, points[1].y);
        debugOverlay.lineTo(points[2].x, points[2].y);
        debugOverlay.closePath();
        debugOverlay.strokePath();
    };

    const drawBodyOutline = (body: Physics.Arcade.Body, color: number): void => {
        debugOverlay.lineStyle(2, color, 1);

        if (body.isCircle) {
            const radius = body.width * 0.5;
            debugOverlay.strokeCircle(body.x + radius, body.y + radius, radius);
            return;
        }

        debugOverlay.strokeRect(body.x, body.y, body.width, body.height);
    };

    const drawPlayerAnchor = (x: number, y: number, color: number): void => {
        const markerHalfSize = 4;
        debugOverlay.lineStyle(2, color, 1);
        debugOverlay.beginPath();
        debugOverlay.moveTo(x - markerHalfSize, y);
        debugOverlay.lineTo(x + markerHalfSize, y);
        debugOverlay.moveTo(x, y - markerHalfSize);
        debugOverlay.lineTo(x, y + markerHalfSize);
        debugOverlay.strokePath();
    };

    const renderCollisionDebugOverlay = (): void => {
        debugOverlay.clear();

        if (player.currentForm !== 'triangle') {
            drawBodyOutline(player.arcadeBodyObject.body as Physics.Arcade.Body, 0x4fc3f7);
        }
        drawHazardHitShape(player.hazardHitShape, 0xffd54f);
        if (player.currentForm !== 'triangle') {
            drawPlayerAnchor(player.formAnchor.x, player.formAnchor.y, 0xffffff);
        }

        hazards.forEach((hazard) => {
            const hazardBody = hazard.trigger.body as Physics.Arcade.StaticBody;
            debugOverlay.lineStyle(2, 0xef5350, 1);
            debugOverlay.strokeRect(hazardBody.x, hazardBody.y, hazardBody.width, hazardBody.height);
        });
    };

    const setVisible = (visible: boolean): void => {
        debugOverlay.setVisible(visible);
    };

    const reset = (): void => {
        debugOverlay.clear();
    };

    const destroy = (): void => {
        debugOverlay.destroy();
    };

    return {
        update: renderCollisionDebugOverlay,
        setVisible,
        reset,
        destroy
    };
};

export type { TestDebugRuntime } from './ui_runtime_types';
