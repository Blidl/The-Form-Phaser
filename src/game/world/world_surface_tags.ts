import { GameObjects } from 'phaser';

const WORLD_SURFACE_KIND_DATA_KEY = 'pf_world_surface_kind';
const WORLD_SURFACE_KIND_PLATFORM = 'platform';

export function markAsPlatformSurface(gameObject: GameObjects.GameObject): void {
    gameObject.setData(WORLD_SURFACE_KIND_DATA_KEY, WORLD_SURFACE_KIND_PLATFORM);
}

export function isPlatformSurfaceGameObject(gameObject: GameObjects.GameObject | undefined): boolean {
    if (!gameObject) {
        return false;
    }

    return gameObject.getData(WORLD_SURFACE_KIND_DATA_KEY) === WORLD_SURFACE_KIND_PLATFORM;
}
