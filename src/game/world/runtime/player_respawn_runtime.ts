import { Scene } from 'phaser';
import { PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS } from '../../player/player_constants';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import { doesHazardOverlapPlayerShape, type HazardObject } from '../hazard';
import type { RespawnPoint } from './world_runtime_types';

export interface PlayerRespawnRuntime {
    setRespawnPoint: (point: RespawnPoint) => void;
    setOnPlayerRespawned: (callback: (() => void) | null) => void;
    evaluateHazardOverlap: (hazards: readonly HazardObject[]) => void;
    isRespawnInProgress: () => boolean;
}

interface CreatePlayerRespawnRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    initialRespawnPoint: RespawnPoint;
}

export const createPlayerRespawnRuntime = (
    params: CreatePlayerRespawnRuntimeParams
): PlayerRespawnRuntime => {
    const { scene, player, initialRespawnPoint } = params;
    let currentRespawnPoint: RespawnPoint = {
        x: initialRespawnPoint.x,
        y: initialRespawnPoint.y
    };
    let respawnInProgress = false;
    let onPlayerRespawned: (() => void) | null = null;

    const handlePlayerDefeat = (): void => {
        if (respawnInProgress) {
            return;
        }

        respawnInProgress = true;
        player.freezeForRespawn();

        scene.time.delayedCall(PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS, () => {
            player.respawnAt(currentRespawnPoint.x, currentRespawnPoint.y);
            onPlayerRespawned?.();
            respawnInProgress = false;
        });
    };

    const setRespawnPoint = (point: RespawnPoint): void => {
        currentRespawnPoint = {
            x: point.x,
            y: point.y
        };
    };

    const evaluateHazardOverlap = (hazards: readonly HazardObject[]): void => {
        if (respawnInProgress) {
            return;
        }

        const playerHazardShape = player.hazardHitShape;
        const isTouchingHazard = hazards.some((hazard) => {
            return doesHazardOverlapPlayerShape(hazard, playerHazardShape);
        });

        if (isTouchingHazard) {
            handlePlayerDefeat();
        }
    };

    return {
        setRespawnPoint,
        setOnPlayerRespawned: (callback): void => {
            onPlayerRespawned = callback;
        },
        evaluateHazardOverlap,
        isRespawnInProgress: () => respawnInProgress
    };
};
