import type { PlayerFormId } from '../../../shared/types/formTypes';
import type { PlayerSnapshot } from '../shared/playerTypes';

export interface PlayerRuntimeState {
    currentFormId: PlayerFormId;
    isAlive: boolean;
    spawnX: number;
    spawnY: number;
}

export interface CreatePlayerRuntimeStateConfig {
    currentFormId: PlayerFormId;
    spawnX: number;
    spawnY: number;
}

export function createPlayerRuntimeState(config: CreatePlayerRuntimeStateConfig): PlayerRuntimeState {
    return {
        currentFormId: config.currentFormId,
        isAlive: true,
        spawnX: config.spawnX,
        spawnY: config.spawnY
    };
}

export function setPlayerRuntimeRespawnPoint(runtimeState: PlayerRuntimeState, x: number, y: number): void {
    runtimeState.spawnX = x;
    runtimeState.spawnY = y;
}

export function createPlayerSnapshotFromRuntimeState(
    runtimeState: PlayerRuntimeState,
    x: number,
    y: number
): PlayerSnapshot {
    return {
        currentFormId: runtimeState.currentFormId,
        isAlive: runtimeState.isAlive,
        x,
        y,
        spawnX: runtimeState.spawnX,
        spawnY: runtimeState.spawnY
    };
}