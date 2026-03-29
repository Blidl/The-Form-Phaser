import type { GameObjects, Scene } from 'phaser';
import type { PlayerMarkerConfig } from './playerMarkerTypes';

export const createPlayerMarker = (
    scene: Scene,
    playerX: number,
    playerY: number,
    config: PlayerMarkerConfig
): GameObjects.Arc => {
    const marker = scene.add.circle(
        playerX + config.offset.x,
        playerY + config.offset.y,
        config.size * 0.5,
        config.color
    );

    marker.name = 'pf_player_marker';

    return marker;
};
