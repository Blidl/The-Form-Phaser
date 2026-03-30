import type { Scene } from 'phaser';
import { createCheckpoint } from '../checkpoint';
import type { RespawnPoint } from './world_runtime_types';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';

interface CreateTestWorldCheckpointRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    onCheckpointActivated: (point: RespawnPoint) => void;
}

export const createTestWorldCheckpointRuntime = (
    params: CreateTestWorldCheckpointRuntimeParams
): void => {
    const { scene, player, onCheckpointActivated } = params;

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
};
