import { GameObjects } from 'phaser';

const WORLD_SURFACE_KIND_DATA_KEY = 'pf_world_surface_kind';
const WORLD_SURFACE_KIND_PLATFORM = 'platform';
const WORLD_SURFACE_ATTACH_PRIORITY_DATA_KEY = 'pf_world_surface_attach_priority';
const WORLD_SURFACE_MATTER_LABEL = 'pf_platform_surface';

export function markAsPlatformSurface(gameObject: GameObjects.GameObject): void {
    gameObject.setData(WORLD_SURFACE_KIND_DATA_KEY, WORLD_SURFACE_KIND_PLATFORM);
}

export function isPlatformSurfaceGameObject(gameObject: GameObjects.GameObject | undefined): boolean {
    if (!gameObject) {
        return false;
    }

    return gameObject.getData(WORLD_SURFACE_KIND_DATA_KEY) === WORLD_SURFACE_KIND_PLATFORM;
}

export function setPlatformSurfaceAttachPriority(gameObject: GameObjects.GameObject, priority: number): void {
    gameObject.setData(WORLD_SURFACE_ATTACH_PRIORITY_DATA_KEY, priority);
}

export function getPlatformSurfaceAttachPriority(gameObject: GameObjects.GameObject | undefined): number {
    if (!gameObject) {
        return 0;
    }

    const priority = gameObject.getData(WORLD_SURFACE_ATTACH_PRIORITY_DATA_KEY);
    return typeof priority === 'number' ? priority : 0;
}

export function markMatterBodyAsPlatformSurface(body: MatterJS.BodyType): void {
    body.label = WORLD_SURFACE_MATTER_LABEL;
}

export function isPlatformSurfaceMatterBody(body: MatterJS.BodyType | undefined): boolean {
    if (!body) {
        return false;
    }

    return body.label === WORLD_SURFACE_MATTER_LABEL;
}
