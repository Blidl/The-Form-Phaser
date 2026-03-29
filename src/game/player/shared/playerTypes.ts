import type { Scene } from 'phaser';
import type { PlayerFormId } from '../../../shared/types/formTypes';

export interface PlayerSpawnPoint {
    x: number;
    y: number;
}

export interface PfPlayerCreateConfig {
    scene: Scene;
    spawnPoint: PlayerSpawnPoint;
}

export interface PlayerSnapshot {
    readonly currentFormId: PlayerFormId;
    readonly isAlive: boolean;
    readonly x: number;
    readonly y: number;
    readonly spawnX: number;
    readonly spawnY: number;
}
