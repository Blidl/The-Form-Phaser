import { type GameObjects, type Physics, type Scene } from 'phaser';
import { createCheckpoint, type CheckpointObject } from '../checkpoint';
import { createHazard, type HazardObject } from '../hazard';
import { createMovingPlatform, type MovingPlatformObject } from '../moving_platform';
import { createTriangleFlightPickup, type TriangleFlightPickupObject } from '../triangle_flight_pickup';
import { createTriggerPlatform, type TriggerPlatformObject } from '../trigger_platform';
import { createWindZone, type WindZoneObject } from '../wind_zone';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface } from '../world_surface_tags';
import type { RespawnPoint } from './world_runtime_types';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import {
    TEST_WORLD_CONFIG,
    cloneTestWorldConfig,
    type TestWorldCheckpointConfig,
    type TestWorldConfig,
    type TestWorldHazardConfig,
    type TestWorldMovingPlatformConfig,
    type TestWorldSurfaceConfig,
    type TestWorldTrianglePickupConfig,
    type TestWorldTriggerPlatformConfig,
    type TestWorldWindZoneConfig
} from './test_world_config';
import { TEST_WORLD_HEIGHT, TEST_WORLD_WIDTH } from './test_world_layout';

export { TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT } from './test_world_layout';

export type TestWorldEditableElementKind =
    | 'surface'
    | 'hazard'
    | 'checkpoint'
    | 'moving_platform'
    | 'trigger_platform_trigger'
    | 'trigger_platform_surface'
    | 'wind_zone'
    | 'triangle_pickup';

export interface TestWorldEditableBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TestWorldEditableElement {
    id: string;
    label: string;
    kind: TestWorldEditableElementKind;
    getBounds: () => TestWorldEditableBounds;
    setBounds: (bounds: TestWorldEditableBounds) => void;
    containsPoint: (worldX: number, worldY: number) => boolean;
}

export interface TestWorldRuntime {
    hazards: readonly HazardObject[];
    updateMovingPlatforms: () => void;
    syncPlayerCollisionMode: () => void;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
    getConfig: () => TestWorldConfig;
    getEditableElements: () => readonly TestWorldEditableElement[];
    rebuildFromCurrentConfig: () => void;
    addElement: (kind: TestWorldEditableElementKind, worldX: number, worldY: number) => string | null;
    removeElement: (id: string) => void;
}

interface CreateTestWorldRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    onCheckpointActivated: (point: RespawnPoint) => void;
}

interface BuiltWorldInstance {
    hazards: HazardObject[];
    editableElements: TestWorldEditableElement[];
    updateMovingPlatforms: () => void;
    syncPlayerCollisionMode: (useArcadePlatformCollisions: boolean) => void;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
    destroy: () => void;
}

export const createTestWorldRuntime = (
    params: CreateTestWorldRuntimeParams
): TestWorldRuntime => {
    const { scene, player, onCheckpointActivated } = params;
    scene.physics.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT);
    scene.matter.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT, 64, true, true, true, true);

    let currentConfig = cloneTestWorldConfig(TEST_WORLD_CONFIG);
    let useArcadePlatformCollisions = player.currentForm !== 'triangle';
    let instance = buildWorldInstance(scene, player, onCheckpointActivated, currentConfig, useArcadePlatformCollisions);

    const rebuildFromCurrentConfig = (): void => {
        instance.destroy();
        instance = buildWorldInstance(scene, player, onCheckpointActivated, currentConfig, useArcadePlatformCollisions);
    };

    return {
        get hazards(): readonly HazardObject[] {
            return instance.hazards;
        },
        updateMovingPlatforms: (): void => {
            instance.updateMovingPlatforms();
        },
        syncPlayerCollisionMode: (): void => {
            useArcadePlatformCollisions = player.currentForm !== 'triangle';
            instance.syncPlayerCollisionMode(useArcadePlatformCollisions);
        },
        resolveWindInfluenceX: (playerObject: GameObjects.GameObject): number => {
            return instance.resolveWindInfluenceX(playerObject);
        },
        getConfig: (): TestWorldConfig => {
            return cloneTestWorldConfig(currentConfig);
        },
        getEditableElements: (): readonly TestWorldEditableElement[] => {
            return instance.editableElements;
        },
        rebuildFromCurrentConfig,
        addElement: (kind: TestWorldEditableElementKind, worldX: number, worldY: number): string | null => {
            const nextId = createNextElementId(kind, currentConfig);
            if (kind === 'surface') {
                currentConfig.surfaces.push({
                    id: nextId,
                    x: worldX,
                    y: worldY,
                    width: 160,
                    height: 24,
                    fillColor: 0xb0bec5,
                    strokeColor: 0xeceff1
                });
            } else if (kind === 'hazard') {
                currentConfig.hazards.push({
                    id: nextId,
                    x: worldX,
                    y: worldY,
                    width: 140,
                    height: 20
                });
            } else if (kind === 'checkpoint') {
                currentConfig.checkpoints.push({
                    id: nextId,
                    x: worldX,
                    y: worldY,
                    width: 68,
                    height: 88,
                    respawnX: worldX,
                    respawnY: worldY - 56
                });
            } else if (kind === 'moving_platform') {
                currentConfig.movingPlatforms.push({
                    id: nextId,
                    x: worldX,
                    y: worldY,
                    width: 180,
                    height: 20,
                    axis: 'horizontal',
                    travelDistance: 200,
                    speed: 120
                });
            } else if (kind === 'trigger_platform_trigger' || kind === 'trigger_platform_surface') {
                currentConfig.triggerPlatforms.push({
                    id: nextId,
                    triggerX: worldX - 120,
                    triggerY: worldY + 80,
                    triggerWidth: 110,
                    triggerHeight: 84,
                    platformX: worldX,
                    platformY: worldY,
                    platformWidth: 180,
                    platformHeight: 22
                });
            } else if (kind === 'wind_zone') {
                currentConfig.windZones.push({
                    id: nextId,
                    x: worldX,
                    y: worldY,
                    width: 260,
                    height: 170,
                    directionX: 1,
                    force: 160
                });
            } else if (kind === 'triangle_pickup') {
                currentConfig.trianglePickups.push({
                    id: nextId,
                    x: worldX,
                    y: worldY,
                    radius: 10
                });
            } else {
                return null;
            }

            rebuildFromCurrentConfig();
            if (kind === 'trigger_platform_trigger') {
                return `${nextId}:trigger`;
            }
            if (kind === 'trigger_platform_surface') {
                return `${nextId}:platform`;
            }
            return nextId;
        },
        removeElement: (id: string): void => {
            const baseId = id.split(':')[0];
            const removeById = <T extends { id: string }>(items: T[]): boolean => {
                const index = items.findIndex((item) => item.id === baseId);
                if (index < 0) {
                    return false;
                }
                items.splice(index, 1);
                return true;
            };

            const removed = removeById(currentConfig.surfaces)
                || removeById(currentConfig.hazards)
                || removeById(currentConfig.checkpoints)
                || removeById(currentConfig.movingPlatforms)
                || removeById(currentConfig.triggerPlatforms)
                || removeById(currentConfig.windZones)
                || removeById(currentConfig.trianglePickups);

            if (removed) {
                rebuildFromCurrentConfig();
            }
        }
    };
};

const buildWorldInstance = (
    scene: Scene,
    player: PlayerWorldActor,
    onCheckpointActivated: (point: RespawnPoint) => void,
    config: TestWorldConfig,
    useArcadePlatformCollisions: boolean
): BuiltWorldInstance => {
    const cleanup: Array<() => void> = [];
    const editableElements: TestWorldEditableElement[] = [];
    const hazards: HazardObject[] = [];
    const movingPlatforms: MovingPlatformObject[] = [];
    const staticColliders: Physics.Arcade.Collider[] = [];
    const dynamicColliders: Physics.Arcade.Collider[] = [];
    const overlapColliders: Physics.Arcade.Collider[] = [];
    const windZones: WindZoneObject[] = [];
    let activeCheckpointId = config.checkpoints[0]?.id ?? null;

    const addCleanup = (cleanupFn: () => void): void => {
        cleanup.push(cleanupFn);
    };

    config.surfaces.forEach((surfaceConfig) => {
        const surface = createSurface(scene, surfaceConfig);
        staticColliders.push(scene.physics.add.collider(player.arcadeBodyObject, surface));
        editableElements.push(createRectangleEditorElement(surfaceConfig.id, 'surface', surfaceConfig.id, surfaceConfig));
        addCleanup(() => {
            const matterBody = surface.getData('pf_matter_body') as MatterJS.BodyType | undefined;
            if (matterBody) {
                scene.matter.world.remove(matterBody);
            }
            surface.destroy();
        });
    });

    config.hazards.forEach((hazardConfig) => {
        const hazard = createHazard(scene, hazardConfig);
        hazards.push(hazard);
        editableElements.push(createRectangleEditorElement(hazardConfig.id, 'hazard', hazardConfig.id, hazardConfig));
        addCleanup(() => hazard.destroy());
    });

    const checkpoints: CheckpointObject[] = config.checkpoints.map((checkpointConfig) => {
        const checkpoint = createCheckpoint(scene, {
            x: checkpointConfig.x,
            y: checkpointConfig.y,
            width: checkpointConfig.width,
            height: checkpointConfig.height,
            respawnX: checkpointConfig.respawnX,
            respawnY: checkpointConfig.respawnY
        });
        overlapColliders.push(scene.physics.add.overlap(player.arcadeBodyObject, checkpoint.trigger, () => {
            activeCheckpointId = checkpointConfig.id;
            applyActiveCheckpointState(checkpoints, config.checkpoints, activeCheckpointId, onCheckpointActivated);
        }));
        editableElements.push(createCheckpointEditorElement(checkpointConfig));
        addCleanup(() => checkpoint.destroy());
        return checkpoint;
    });
    applyActiveCheckpointState(checkpoints, config.checkpoints, activeCheckpointId, onCheckpointActivated);

    config.movingPlatforms.forEach((platformConfig) => {
        const platform = createMovingPlatform(scene, platformConfig);
        movingPlatforms.push(platform);
        const collider = scene.physics.add.collider(player.arcadeBodyObject, platform.bodyObject);
        collider.active = useArcadePlatformCollisions;
        dynamicColliders.push(collider);
        editableElements.push(createRectangleEditorElement(platformConfig.id, 'moving_platform', platformConfig.id, platformConfig));
        addCleanup(() => platform.destroy());
    });

    config.triggerPlatforms.forEach((triggerPlatformConfig) => {
        const triggerPlatform = createTriggerPlatform(scene, triggerPlatformConfig);
        const platformCollider = scene.physics.add.collider(player.arcadeBodyObject, triggerPlatform.platformBodyObject);
        platformCollider.active = useArcadePlatformCollisions;
        dynamicColliders.push(platformCollider);
        overlapColliders.push(scene.physics.add.overlap(player.arcadeBodyObject, triggerPlatform.triggerZone, () => {
            if (!triggerPlatform.isActivated()) {
                triggerPlatform.activate();
            }
        }));
        editableElements.push(createTriggerEditorElement(triggerPlatformConfig, 'trigger'));
        editableElements.push(createTriggerEditorElement(triggerPlatformConfig, 'platform'));
        addCleanup(() => triggerPlatform.destroy());
    });

    config.windZones.forEach((windZoneConfig) => {
        const windZone = createWindZone(scene, windZoneConfig);
        windZones.push(windZone);
        editableElements.push(createRectangleEditorElement(windZoneConfig.id, 'wind_zone', windZoneConfig.id, windZoneConfig));
        addCleanup(() => windZone.destroy());
    });

    config.trianglePickups.forEach((pickupConfig) => {
        const pickup = createTriangleFlightPickup(scene, pickupConfig);
        overlapColliders.push(scene.physics.add.overlap(player.arcadeBodyObject, pickup.trigger, () => {
            if (pickup.isCollected() || player.currentForm !== 'triangle') {
                return;
            }

            pickup.collect();
            player.refillTriangleFlightResource();
        }));
        editableElements.push(createPickupEditorElement(pickupConfig));
        addCleanup(() => pickup.destroy());
    });

    return {
        hazards,
        editableElements,
        updateMovingPlatforms: (): void => {
            movingPlatforms.forEach((platform) => {
                platform.update();
            });
        },
        syncPlayerCollisionMode: (shouldUseArcadePlatformCollisions: boolean): void => {
            staticColliders.forEach((collider) => {
                collider.active = shouldUseArcadePlatformCollisions;
            });
            dynamicColliders.forEach((collider) => {
                collider.active = shouldUseArcadePlatformCollisions;
            });
        },
        resolveWindInfluenceX: (playerObject: GameObjects.GameObject): number => {
            let horizontalInfluenceX = 0;

            windZones.forEach((zone) => {
                if (scene.physics.overlap(playerObject, zone.trigger)) {
                    horizontalInfluenceX += zone.force * zone.directionX;
                }
            });

            return horizontalInfluenceX;
        },
        destroy: (): void => {
            [...staticColliders, ...dynamicColliders, ...overlapColliders].forEach((collider) => {
                collider.destroy();
            });
            cleanup.forEach((cleanupFn) => {
                cleanupFn();
            });
        }
    };
};

const applyActiveCheckpointState = (
    checkpoints: CheckpointObject[],
    checkpointConfigs: TestWorldCheckpointConfig[],
    activeCheckpointId: string | null,
    onCheckpointActivated: (point: RespawnPoint) => void
): void => {
    const activeIndex = checkpointConfigs.findIndex((entry) => entry.id === activeCheckpointId);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const activeConfig = checkpointConfigs[safeIndex];
    if (activeConfig) {
        onCheckpointActivated({
            x: activeConfig.respawnX,
            y: activeConfig.respawnY
        });
    }

    checkpoints.forEach((checkpoint, index) => {
        checkpoint.setActive(index === safeIndex);
    });
};

const createSurface = (scene: Scene, config: TestWorldSurfaceConfig): Phaser.GameObjects.Rectangle => {
    const surface = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor)
        .setName(config.id)
        .setStrokeStyle(2, config.strokeColor)
        .setDepth(4200);

    scene.physics.add.existing(surface, true);
    const matterBody = scene.matter.add.rectangle(surface.x, surface.y, surface.width, surface.height, { isStatic: true });
    markMatterBodyAsPlatformSurface(matterBody);
    markAsPlatformSurface(surface);
    surface.setData('pf_matter_body', matterBody);
    return surface;
};

const createRectangleEditorElement = (
    id: string,
    kind: TestWorldEditableElementKind,
    label: string,
    config: { x: number; y: number; width: number; height: number }
): TestWorldEditableElement => {
    return {
        id,
        label,
        kind,
        getBounds: () => ({ x: config.x, y: config.y, width: config.width, height: config.height }),
        setBounds: (bounds) => {
            config.x = bounds.x;
            config.y = bounds.y;
            config.width = Math.max(8, bounds.width);
            config.height = Math.max(8, bounds.height);
        },
        containsPoint: (worldX, worldY) => {
            return Math.abs(worldX - config.x) <= (config.width * 0.5)
                && Math.abs(worldY - config.y) <= (config.height * 0.5);
        }
    };
};

const createCheckpointEditorElement = (config: TestWorldCheckpointConfig): TestWorldEditableElement => {
    return {
        id: config.id,
        label: config.id,
        kind: 'checkpoint',
        getBounds: () => ({ x: config.x, y: config.y, width: config.width, height: config.height }),
        setBounds: (bounds) => {
            const dx = bounds.x - config.x;
            const dy = bounds.y - config.y;
            config.x = bounds.x;
            config.y = bounds.y;
            config.width = Math.max(16, bounds.width);
            config.height = Math.max(16, bounds.height);
            config.respawnX += dx;
            config.respawnY += dy;
        },
        containsPoint: (worldX, worldY) => {
            return Math.abs(worldX - config.x) <= (config.width * 0.5)
                && Math.abs(worldY - config.y) <= (config.height * 0.5);
        }
    };
};

const createTriggerEditorElement = (
    config: TestWorldTriggerPlatformConfig,
    part: 'trigger' | 'platform'
): TestWorldEditableElement => {
    return {
        id: `${config.id}:${part}`,
        label: `${config.id}:${part}`,
        kind: part === 'trigger' ? 'trigger_platform_trigger' : 'trigger_platform_surface',
        getBounds: () => {
            if (part === 'trigger') {
                return {
                    x: config.triggerX,
                    y: config.triggerY,
                    width: config.triggerWidth,
                    height: config.triggerHeight
                };
            }

            return {
                x: config.platformX,
                y: config.platformY,
                width: config.platformWidth,
                height: config.platformHeight
            };
        },
        setBounds: (bounds) => {
            if (part === 'trigger') {
                config.triggerX = bounds.x;
                config.triggerY = bounds.y;
                config.triggerWidth = Math.max(8, bounds.width);
                config.triggerHeight = Math.max(8, bounds.height);
                return;
            }

            config.platformX = bounds.x;
            config.platformY = bounds.y;
            config.platformWidth = Math.max(8, bounds.width);
            config.platformHeight = Math.max(8, bounds.height);
        },
        containsPoint: (worldX, worldY) => {
            const bounds = part === 'trigger'
                ? { x: config.triggerX, y: config.triggerY, width: config.triggerWidth, height: config.triggerHeight }
                : { x: config.platformX, y: config.platformY, width: config.platformWidth, height: config.platformHeight };
            return Math.abs(worldX - bounds.x) <= (bounds.width * 0.5)
                && Math.abs(worldY - bounds.y) <= (bounds.height * 0.5);
        }
    };
};

const createPickupEditorElement = (config: TestWorldTrianglePickupConfig): TestWorldEditableElement => {
    return {
        id: config.id,
        label: config.id,
        kind: 'triangle_pickup',
        getBounds: () => ({
            x: config.x,
            y: config.y,
            width: config.radius * 2,
            height: config.radius * 2
        }),
        setBounds: (bounds) => {
            config.x = bounds.x;
            config.y = bounds.y;
            config.radius = Math.max(4, Math.round(Math.max(bounds.width, bounds.height) * 0.5));
        },
        containsPoint: (worldX, worldY) => {
            return Math.hypot(worldX - config.x, worldY - config.y) <= config.radius;
        }
    };
};

const createNextElementId = (kind: TestWorldEditableElementKind, config: TestWorldConfig): string => {
    const prefix = kind.replace(/[^a-z0-9]+/gi, '_');
    const allIds = [
        ...config.surfaces,
        ...config.hazards,
        ...config.checkpoints,
        ...config.movingPlatforms,
        ...config.triggerPlatforms,
        ...config.windZones,
        ...config.trianglePickups
    ].map((entry) => entry.id);

    let nextIndex = 1;
    while (allIds.includes(`${prefix}_${nextIndex}`)) {
        nextIndex += 1;
    }

    return `${prefix}_${nextIndex}`;
};
