import { GameObjects, Scene } from 'phaser';
import { PfPlayer } from '../../player/PfPlayer';
import { createCheckpoint } from '../checkpoint';
import { createHazard, type HazardObject } from '../hazard';
import { createMovingPlatform, type MovingPlatformObject } from '../moving_platform';
import { createTriggerPlatform } from '../trigger_platform';
import { createWindZone, type WindZoneObject } from '../wind_zone';
import type { RespawnPoint } from './world_runtime_types';

export const TEST_WORLD_WIDTH = 2200;
export const TEST_WORLD_HEIGHT = 900;

export interface TestWorldRuntime {
    hazards: readonly HazardObject[];
    updateMovingPlatforms: () => void;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
}

interface CreateTestWorldRuntimeParams {
    scene: Scene;
    player: PfPlayer;
    onCheckpointActivated: (point: RespawnPoint) => void;
}

export const createTestWorldRuntime = (
    params: CreateTestWorldRuntimeParams
): TestWorldRuntime => {
    const { scene, player, onCheckpointActivated } = params;
    scene.physics.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT);

    const ground = scene.add.rectangle(TEST_WORLD_WIDTH * 0.5, 760, TEST_WORLD_WIDTH - 120, 56, 0x90a4ae)
        .setStrokeStyle(2, 0xcfd8dc)
        .setDepth(4200);
    const lowPlatform = scene.add.rectangle(760, 610, 280, 24, 0xb0bec5)
        .setStrokeStyle(2, 0xeceff1)
        .setDepth(4200);
    const highPlatform = scene.add.rectangle(1380, 500, 240, 24, 0xb0bec5)
        .setStrokeStyle(2, 0xeceff1)
        .setDepth(4200);

    scene.physics.add.existing(ground, true);
    scene.physics.add.existing(lowPlatform, true);
    scene.physics.add.existing(highPlatform, true);

    scene.physics.add.collider(player.arcadeBodyObject, ground);
    scene.physics.add.collider(player.arcadeBodyObject, lowPlatform);
    scene.physics.add.collider(player.arcadeBodyObject, highPlatform);

    const checkpoints = [
        createCheckpoint(scene, {
            x: 260,
            y: 676,
            respawnX: 220,
            respawnY: 620
        }),
        createCheckpoint(scene, {
            x: 1320,
            y: 676,
            respawnX: 1320,
            respawnY: 620
        })
    ];

    const activateCheckpoint = (index: number): void => {
        const checkpoint = checkpoints[index];
        if (!checkpoint) {
            return;
        }

        onCheckpointActivated({
            x: checkpoint.respawnX,
            y: checkpoint.respawnY
        });

        checkpoints.forEach((entry, entryIndex) => {
            entry.setActive(entryIndex === index);
        });
    };

    activateCheckpoint(0);

    checkpoints.forEach((checkpoint, index) => {
        scene.physics.add.overlap(player.arcadeBodyObject, checkpoint.trigger, () => {
            activateCheckpoint(index);
        });
    });

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
    scene.physics.add.collider(player.arcadeBodyObject, movingPlatforms[0].bodyObject);

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

    scene.physics.add.collider(player.arcadeBodyObject, triggerPlatform.platformBodyObject);
    scene.physics.add.overlap(player.arcadeBodyObject, triggerPlatform.triggerZone, () => {
        if (!triggerPlatform.isActivated()) {
            triggerPlatform.activate();
        }
    });

    const windZones: WindZoneObject[] = [
        createWindZone(scene, {
            x: 1080,
            y: 640,
            width: 260,
            height: 170,
            directionX: 1,
            force: 160
        })
    ];

    const updateMovingPlatforms = (): void => {
        movingPlatforms.forEach((platform) => {
            platform.update();
        });
    };

    const resolveWindInfluenceX = (playerObject: GameObjects.GameObject): number => {
        let horizontalInfluenceX = 0;

        windZones.forEach((zone) => {
            if (scene.physics.overlap(playerObject, zone.trigger)) {
                horizontalInfluenceX += zone.force * zone.directionX;
            }
        });

        return horizontalInfluenceX;
    };

    return {
        hazards,
        updateMovingPlatforms,
        resolveWindInfluenceX
    };
};
