import type { GameObjects, Physics, Scene } from 'phaser';

export interface TriangleFlightPickupConfig {
    x: number;
    y: number;
    radius?: number;
}

export interface TriangleFlightPickupObject {
    visual: GameObjects.Arc;
    trigger: GameObjects.Arc;
    collect: () => void;
    respawn: () => void;
    isCollected: () => boolean;
    destroy: () => void;
}

export const createTriangleFlightPickup = (
    scene: Scene,
    config: TriangleFlightPickupConfig
): TriangleFlightPickupObject => {
    const radius = config.radius ?? 10;
    let collected = false;

    const visual = scene.add.circle(config.x, config.y, radius, 0xfff59d, 0.95)
        .setStrokeStyle(2, 0xffca28, 1)
        .setDepth(4300);
    const core = scene.add.circle(config.x, config.y, radius * 0.42, 0xffffff, 0.92)
        .setDepth(4301);
    scene.physics.add.existing(visual, true);

    const triggerBody = visual.body as Physics.Arcade.StaticBody;
    triggerBody.setCircle(radius);
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

    const setVisibleState = (visible: boolean): void => {
        visual.setVisible(visible);
        core.setVisible(visible);
        if (visible) {
            triggerBody.enable = true;
            return;
        }

        triggerBody.enable = false;
    };

    return {
        visual,
        trigger: visual,
        collect: (): void => {
            if (collected) {
                return;
            }

            collected = true;
            setVisibleState(false);
        },
        respawn: (): void => {
            if (!collected) {
                return;
            }

            collected = false;
            setVisibleState(true);
        },
        isCollected: (): boolean => {
            return collected;
        },
        destroy: (): void => {
            visual.destroy();
            core.destroy();
        }
    };
};
