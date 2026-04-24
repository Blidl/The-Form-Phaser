import { Scene } from 'phaser';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import {
    doesHazardOverlapPlayerShape,
    resolveHazardContactPoint,
    type HazardContactPoint,
    type HazardObject
} from '../hazard';
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

const PLAYER_DEATH_TRANSITION_DURATION_MS = 260;

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

    const handlePlayerDefeat = (contactPoint: HazardContactPoint): void => {
        if (respawnInProgress) {
            return;
        }

        respawnInProgress = true;
        player.startDeathTransition(
            contactPoint.pointX,
            contactPoint.pointY,
            contactPoint.normalX,
            contactPoint.normalY,
            PLAYER_DEATH_TRANSITION_DURATION_MS
        );
        player.freezeForRespawn();

        scene.time.delayedCall(PLAYER_DEATH_TRANSITION_DURATION_MS, () => {
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
        const collidedHazard = hazards.find((hazard) => {
            return doesHazardOverlapPlayerShape(hazard, playerHazardShape);
        });

        if (collidedHazard) {
            const contactPoint = resolveHazardContactPoint(collidedHazard, playerHazardShape);
            handlePlayerDefeat(contactPoint);
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
