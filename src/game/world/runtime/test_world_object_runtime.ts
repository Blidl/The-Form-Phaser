import type { Scene } from 'phaser';
import { createHazard, type HazardObject } from '../hazard';
import { createMovingPlatform, type MovingPlatformObject } from '../moving_platform';
import { createTriggerPlatform } from '../trigger_platform';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';

export interface TestWorldObjectRuntime {
    hazards: readonly HazardObject[];
    updateMovingPlatforms: () => void;
    syncPlayerCollisionMode: (useArcadePlatformCollisions: boolean) => void;
}

interface CreateTestWorldObjectRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
}

export const createTestWorldObjectRuntime = (
    params: CreateTestWorldObjectRuntimeParams
): TestWorldObjectRuntime => {
    const { scene, player } = params;

    const hazards: HazardObject[] = [
        createHazard(scene, {
            x: 980,
            y: 720,
            width: 180,
            height: 20
        })
    ];

    const movingPlatforms: MovingPlatformObject[] = [
        createMovingPlatform(scene, {
            x: 980,
            y: 555,
            width: 180,
            height: 20,
            axis: 'horizontal',
            travelDistance: 200,
            speed: 120
        })
    ];
    const movingPlatformCollider = scene.physics.add.collider(player.arcadeBodyObject, movingPlatforms[0].bodyObject);

    const triggerPlatform = createTriggerPlatform(scene, {
        triggerX: 560,
        triggerY: 692,
        triggerWidth: 110,
        triggerHeight: 84,
        platformX: 760,
        platformY: 470,
        platformWidth: 180,
        platformHeight: 22
    });

    const triggerPlatformCollider = scene.physics.add.collider(player.arcadeBodyObject, triggerPlatform.platformBodyObject);
    scene.physics.add.overlap(player.arcadeBodyObject, triggerPlatform.triggerZone, () => {
        if (!triggerPlatform.isActivated()) {
            triggerPlatform.activate();
        }
    });

    return {
        hazards,
        updateMovingPlatforms: (): void => {
            movingPlatforms.forEach((platform) => {
                platform.update();
            });
        },
        syncPlayerCollisionMode: (useArcadePlatformCollisions: boolean): void => {
            movingPlatformCollider.active = useArcadePlatformCollisions;
            triggerPlatformCollider.active = useArcadePlatformCollisions;
        }
    };
};
