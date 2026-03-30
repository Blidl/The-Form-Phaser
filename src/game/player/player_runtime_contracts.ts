import type { GameObjects } from 'phaser';
import type { PlayerFormAnchor, PlayerHazardHitShape } from './geometry/player_geometry_types';
import type { PlayerFormId } from './player_types';

export interface PlayerWorldActor {
    arcadeBodyObject: GameObjects.Arc;
    hazardHitShape: PlayerHazardHitShape;
    freezeForRespawn: () => void;
    respawnAt: (x: number, y: number) => void;
}

export interface PlayerHudModel {
    currentForm: PlayerFormId;
    squareTrailResourceCurrent: number;
    squareTrailResourceMax: number;
    squareTrailResourceRatio: number;
}

export interface PlayerDebugModel {
    currentForm: PlayerFormId;
    arcadeBodyObject: GameObjects.Arc;
    triangleVisualObject: GameObjects.Triangle;
    hazardHitShape: PlayerHazardHitShape;
    formAnchor: PlayerFormAnchor;
}
