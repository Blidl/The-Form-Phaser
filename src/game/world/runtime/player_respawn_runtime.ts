import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import {
    doesHazardOverlapPlayerShape,
    resolveHazardContactPoint,
    type HazardContactPoint,
    type HazardObject
} from '../hazard';
import type { RespawnPoint } from './world_runtime_types';

export interface PlayerRespawnRuntime {
    update: (deltaMs: number) => void;
    setRespawnPoint: (point: RespawnPoint) => void;
    setOnPlayerRespawned: (callback: (() => void) | null) => void;
    evaluateHazardOverlap: (hazards: readonly HazardObject[]) => void;
    isRespawnInProgress: () => boolean;
}

interface CreatePlayerRespawnRuntimeParams {
    player: PlayerWorldActor;
    initialRespawnPoint: RespawnPoint;
}

const PLAYER_DEATH_TRANSITION_DURATION_MS = 260;

export const createPlayerRespawnRuntime = (
    params: CreatePlayerRespawnRuntimeParams
): PlayerRespawnRuntime => {
    const { player, initialRespawnPoint } = params;
    let currentRespawnPoint: RespawnPoint = {
        x: initialRespawnPoint.x,
        y: initialRespawnPoint.y
    };
    let respawnInProgress = false;
    let respawnRemainingMs = 0;
    let pendingRespawnPoint: RespawnPoint | null = null;
    let onPlayerRespawned: (() => void) | null = null;

    const handlePlayerDefeat = (contactPoint: HazardContactPoint): void => {
        if (respawnInProgress) {
            return;
        }

        respawnInProgress = true;
        respawnRemainingMs = PLAYER_DEATH_TRANSITION_DURATION_MS;
        pendingRespawnPoint = {
            x: currentRespawnPoint.x,
            y: currentRespawnPoint.y
        };
        player.startDeathTransition(
            contactPoint.pointX,
            contactPoint.pointY,
            contactPoint.normalX,
            contactPoint.normalY,
            PLAYER_DEATH_TRANSITION_DURATION_MS
        );
        player.freezeForRespawn();
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
        update: (deltaMs: number): void => {
            if (!respawnInProgress || !pendingRespawnPoint) {
                return;
            }
            const safeDeltaMs = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
            if (safeDeltaMs <= 0) {
                return;
            }
            respawnRemainingMs = Math.max(0, respawnRemainingMs - safeDeltaMs);
            if (respawnRemainingMs > 0) {
                return;
            }
            player.respawnAt(pendingRespawnPoint.x, pendingRespawnPoint.y);
            pendingRespawnPoint = null;
            onPlayerRespawned?.();
            respawnInProgress = false;
        },
        setRespawnPoint,
        setOnPlayerRespawned: (callback): void => {
            onPlayerRespawned = callback;
        },
        evaluateHazardOverlap,
        isRespawnInProgress: () => respawnInProgress
    };
};
