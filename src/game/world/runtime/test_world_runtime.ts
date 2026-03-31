import { type GameObjects, Physics, type Scene } from 'phaser';
import { createCheckpoint, type CheckpointObject } from '../checkpoint';
import { createDraggableBox, type DraggableBoxObject } from '../draggable_box';
import { createHazard, type HazardObject } from '../hazard';
import { createMovingPlatform, type MovingPlatformObject } from '../moving_platform';
import { createTriangleFlightPickup, type TriangleFlightPickupObject } from '../triangle_flight_pickup';
import {
    createTriangleFlightBreakWall,
    doesTriangleFlightBreakWallOverlapPlayerShape,
    type TriangleFlightBreakWallObject
} from '../triangle_flight_break_wall';
import { createTriggerPlatform, type TriggerPlatformObject } from '../trigger_platform';
import { createWindZone, type WindZoneObject } from '../wind_zone';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface } from '../world_surface_tags';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import type { RespawnPoint } from './world_runtime_types';
import {
    TEST_WORLD_EDITOR_ADAPTERS,
    createNextWorldObjectId,
    type TestWorldEditorBounds,
    type TestWorldEditorHandleDefinition,
    type TestWorldEditorObjectType,
    type TestWorldEditorSelectionPart
} from './test_world_editor_adapters';
import {
    cloneTestWorldConfig,
    type TestWorldCheckpointConfig,
    type TestWorldConfig,
    type TestWorldDragBoxConfig,
    type TestWorldHazardConfig,
    type TestWorldMovingPlatformConfig,
    type TestWorldPlayerSpawnConfig,
    type TestWorldSurfaceConfig,
    type TestWorldTriangleFlightBreakWallConfig,
    type TestWorldTrianglePickupConfig,
    type TestWorldTriggerPlatformConfig,
    type TestWorldWindZoneConfig
} from './test_world_config';
import { normalizeTestWorldConfig } from './test_world_config_validation';
import { TEST_WORLD_HEIGHT, TEST_WORLD_WIDTH } from './test_world_layout';

export { TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT } from './test_world_layout';

export interface TestWorldEditorHandle {
    id: string;
    rootId: string;
    label: string;
    type: TestWorldEditorObjectType;
    part: TestWorldEditorSelectionPart;
    isLocked: () => boolean;
    getBounds: () => TestWorldEditorBounds;
    containsPoint: (worldX: number, worldY: number) => boolean;
}

export interface TestWorldEditorObjectSummary {
    id: string;
    label: string;
    type: TestWorldEditorObjectType;
    locked: boolean;
}

export interface TestWorldRuntime {
    hazards: readonly HazardObject[];
    updateMovingPlatforms: () => void;
    postPlayerTickUpdate: () => void;
    resetRespawnObjects: () => void;
    syncPlayerCollisionMode: () => void;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
    getConfig: () => TestWorldConfig;
    setConfig: (config: TestWorldConfig) => void;
    getEditorHandles: () => readonly TestWorldEditorHandle[];
    getEditorObjects: () => readonly TestWorldEditorObjectSummary[];
    getEditorHandle: (id: string) => TestWorldEditorHandle | null;
    patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds) => boolean;
    patchObjectFields: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectColors: (rootId: string, patch: Record<string, unknown>) => boolean;
    setObjectLocked: (rootId: string, locked: boolean) => boolean;
    createObject: (type: TestWorldEditorObjectType, worldX: number, worldY: number) => string | null;
    duplicateObject: (rootId: string) => string | null;
    removeObject: (rootId: string) => boolean;
    focusObjectPoint: (targetId: string) => { x: number; y: number } | null;
    rebuildFromCurrentConfig: () => void;
}

interface CreateTestWorldRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    initialConfig: TestWorldConfig;
    onCheckpointActivated: (point: RespawnPoint) => void;
}

interface PlayerSpawnMarkerObject {
    body: Phaser.GameObjects.Rectangle;
    glow: Phaser.GameObjects.Rectangle;
    crosshair: Phaser.GameObjects.Graphics;
    refresh: () => void;
    destroy: () => void;
}

interface RuntimeBinding {
    rootId: string;
    type: TestWorldEditorObjectType;
    label: string;
    isLocked: () => boolean;
    setLocked: (locked: boolean) => void;
    handleDefinitions: TestWorldEditorHandleDefinition<unknown>[];
    refresh: () => void;
    patchFields: (patch: Record<string, unknown>) => void;
    patchColors: (patch: Record<string, unknown>) => void;
}

interface BuiltWorldInstance {
    hazards: HazardObject[];
    updateMovingPlatforms: () => void;
    postPlayerTickUpdate: () => void;
    resetRespawnObjects: () => void;
    syncPlayerCollisionMode: (useArcadePlatformCollisions: boolean) => void;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
    getEditorHandles: () => readonly TestWorldEditorHandle[];
    getEditorObjects: () => readonly TestWorldEditorObjectSummary[];
    getEditorHandle: (id: string) => TestWorldEditorHandle | null;
    patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds) => boolean;
    patchObjectFields: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectColors: (rootId: string, patch: Record<string, unknown>) => boolean;
    setObjectLocked: (rootId: string, locked: boolean) => boolean;
    focusObjectPoint: (targetId: string) => { x: number; y: number } | null;
    destroy: () => void;
}

const DRAG_BOX_TRIGGER_RELEASE_SPEED_EPSILON = 16;

export const createTestWorldRuntime = (
    params: CreateTestWorldRuntimeParams
): TestWorldRuntime => {
    const { scene, player, onCheckpointActivated } = params;
    scene.physics.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT);
    scene.matter.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT, 64, true, true, true, true);

    let currentConfig = normalizeTestWorldConfig(params.initialConfig);
    let useArcadePlatformCollisions = player.currentForm !== 'triangle';
    let instance = buildWorldInstance(scene, player, onCheckpointActivated, currentConfig, useArcadePlatformCollisions);

    const rebuildFromCurrentConfig = (): void => {
        instance.destroy();
        instance = buildWorldInstance(scene, player, onCheckpointActivated, currentConfig, useArcadePlatformCollisions);
    };

    const removeByRootId = (rootId: string): boolean => {
        if (rootId === 'player_spawn') {
            return false;
        }

        const removeFrom = <T extends { id: string }>(items: T[]): boolean => {
            const index = items.findIndex((entry) => entry.id === rootId);
            if (index < 0) {
                return false;
            }
            items.splice(index, 1);
            return true;
        };

        return removeFrom(currentConfig.surfaces)
            || removeFrom(currentConfig.hazards)
            || removeFrom(currentConfig.checkpoints)
            || removeFrom(currentConfig.movingPlatforms)
            || removeFrom(currentConfig.triggerPlatforms)
            || removeFrom(currentConfig.dragBoxes)
            || removeFrom(currentConfig.windZones)
            || removeFrom(currentConfig.triangleFlightBreakWalls)
            || removeFrom(currentConfig.trianglePickups);
    };

    const findRootConfigById = (
        rootId: string
    ):
        | TestWorldPlayerSpawnConfig
        | TestWorldSurfaceConfig
        | TestWorldHazardConfig
        | TestWorldCheckpointConfig
        | TestWorldMovingPlatformConfig
        | TestWorldTriggerPlatformConfig
        | TestWorldDragBoxConfig
        | TestWorldWindZoneConfig
        | TestWorldTriangleFlightBreakWallConfig
        | TestWorldTrianglePickupConfig
        | null => {
        if (rootId === 'player_spawn') {
            return currentConfig.playerSpawn;
        }

        return currentConfig.surfaces.find((entry) => entry.id === rootId)
            ?? currentConfig.hazards.find((entry) => entry.id === rootId)
            ?? currentConfig.checkpoints.find((entry) => entry.id === rootId)
            ?? currentConfig.movingPlatforms.find((entry) => entry.id === rootId)
            ?? currentConfig.triggerPlatforms.find((entry) => entry.id === rootId)
            ?? currentConfig.dragBoxes.find((entry) => entry.id === rootId)
            ?? currentConfig.windZones.find((entry) => entry.id === rootId)
            ?? currentConfig.triangleFlightBreakWalls.find((entry) => entry.id === rootId)
            ?? currentConfig.trianglePickups.find((entry) => entry.id === rootId)
            ?? null;
    };

    return {
        get hazards(): readonly HazardObject[] {
            return instance.hazards;
        },
        updateMovingPlatforms: (): void => {
            instance.updateMovingPlatforms();
        },
        postPlayerTickUpdate: (): void => {
            instance.postPlayerTickUpdate();
        },
        resetRespawnObjects: (): void => {
            instance.resetRespawnObjects();
        },
        syncPlayerCollisionMode: (): void => {
            useArcadePlatformCollisions = player.currentForm !== 'triangle';
            instance.syncPlayerCollisionMode(useArcadePlatformCollisions);
        },
        resolveWindInfluenceX: (playerObject: GameObjects.GameObject): number => {
            return instance.resolveWindInfluenceX(playerObject);
        },
        getConfig: (): TestWorldConfig => cloneTestWorldConfig(currentConfig),
        setConfig: (config: TestWorldConfig): void => {
            currentConfig = normalizeTestWorldConfig(config);
            rebuildFromCurrentConfig();
        },
        getEditorHandles: (): readonly TestWorldEditorHandle[] => instance.getEditorHandles(),
        getEditorObjects: (): readonly TestWorldEditorObjectSummary[] => instance.getEditorObjects(),
        getEditorHandle: (id: string): TestWorldEditorHandle | null => instance.getEditorHandle(id),
        patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds): boolean => {
            return instance.patchObjectBounds(handleId, bounds);
        },
        patchObjectFields: (rootId: string, patch: Record<string, unknown>): boolean => {
            return instance.patchObjectFields(rootId, patch);
        },
        patchObjectColors: (rootId: string, patch: Record<string, unknown>): boolean => {
            return instance.patchObjectColors(rootId, patch);
        },
        setObjectLocked: (rootId: string, locked: boolean): boolean => {
            return instance.setObjectLocked(rootId, locked);
        },
        createObject: (type: TestWorldEditorObjectType, worldX: number, worldY: number): string | null => {
            if (type === 'playerSpawn') {
                currentConfig.playerSpawn.x = worldX;
                currentConfig.playerSpawn.y = worldY;
                instance.patchObjectFields('player_spawn', { x: worldX, y: worldY });
                return 'player_spawn';
            }

            const nextId = createNextWorldObjectId(type, currentConfig);
            const configFactory = TEST_WORLD_EDITOR_ADAPTERS[type];
            const nextObject = configFactory.createDefault({ id: nextId, x: worldX, y: worldY });
            if (nextObject === null) {
                return null;
            }

            if (type === 'surface') {
                currentConfig.surfaces.push(nextObject as TestWorldSurfaceConfig);
            } else if (type === 'hazard') {
                currentConfig.hazards.push(nextObject as TestWorldHazardConfig);
            } else if (type === 'checkpoint') {
                currentConfig.checkpoints.push(nextObject as TestWorldCheckpointConfig);
            } else if (type === 'movingPlatform') {
                currentConfig.movingPlatforms.push(nextObject as TestWorldMovingPlatformConfig);
            } else if (type === 'triggerPlatform') {
                currentConfig.triggerPlatforms.push(nextObject as TestWorldTriggerPlatformConfig);
            } else if (type === 'dragBox') {
                currentConfig.dragBoxes.push(nextObject as TestWorldDragBoxConfig);
            } else if (type === 'windZone') {
                currentConfig.windZones.push(nextObject as TestWorldWindZoneConfig);
            } else if (type === 'triangleFlightBreakWall') {
                currentConfig.triangleFlightBreakWalls.push(nextObject as TestWorldTriangleFlightBreakWallConfig);
            } else if (type === 'trianglePickup') {
                currentConfig.trianglePickups.push(nextObject as TestWorldTrianglePickupConfig);
            } else {
                return null;
            }

            rebuildFromCurrentConfig();
            return nextId;
        },
        duplicateObject: (rootId: string): string | null => {
            if (rootId === 'player_spawn') {
                return null;
            }

            const source = findRootConfigById(rootId);
            if (!source) {
                return null;
            }

            const binding = instance.getEditorObjects().find((entry) => entry.id === rootId);
            if (!binding) {
                return null;
            }

            const nextId = createNextWorldObjectId(binding.type, currentConfig);
            const adapter = TEST_WORLD_EDITOR_ADAPTERS[binding.type];
            const duplicated = adapter.duplicate(source as never, nextId) as never;
            if (binding.type === 'surface' || binding.type === 'hazard' || binding.type === 'checkpoint' || binding.type === 'movingPlatform'
                || binding.type === 'dragBox' || binding.type === 'windZone' || binding.type === 'triangleFlightBreakWall') {
                const rectLike = duplicated as { x: number; y: number };
                adapter.patchFields(duplicated, { x: rectLike.x + 24, y: rectLike.y + 24 });
            } else if (binding.type === 'trianglePickup') {
                const pickup = duplicated as TestWorldTrianglePickupConfig;
                adapter.patchFields(duplicated, { x: pickup.x + 24, y: pickup.y + 24 });
            } else if (binding.type === 'triggerPlatform') {
                const triggerPlatform = duplicated as TestWorldTriggerPlatformConfig;
                adapter.patchFields(duplicated, {
                    triggerX: triggerPlatform.triggerX + 24,
                    triggerY: triggerPlatform.triggerY + 24,
                    deactivateTriggerX: (triggerPlatform.deactivateTriggerX ?? triggerPlatform.triggerX) + 24,
                    deactivateTriggerY: (triggerPlatform.deactivateTriggerY ?? triggerPlatform.triggerY) + 24,
                    platformX: triggerPlatform.platformX + 24,
                    platformY: triggerPlatform.platformY + 24
                });
            }

            if (binding.type === 'surface') {
                currentConfig.surfaces.push(duplicated as TestWorldSurfaceConfig);
            } else if (binding.type === 'hazard') {
                currentConfig.hazards.push(duplicated as TestWorldHazardConfig);
            } else if (binding.type === 'checkpoint') {
                currentConfig.checkpoints.push(duplicated as TestWorldCheckpointConfig);
            } else if (binding.type === 'movingPlatform') {
                currentConfig.movingPlatforms.push(duplicated as TestWorldMovingPlatformConfig);
            } else if (binding.type === 'triggerPlatform') {
                currentConfig.triggerPlatforms.push(duplicated as TestWorldTriggerPlatformConfig);
            } else if (binding.type === 'dragBox') {
                currentConfig.dragBoxes.push(duplicated as TestWorldDragBoxConfig);
            } else if (binding.type === 'windZone') {
                currentConfig.windZones.push(duplicated as TestWorldWindZoneConfig);
            } else if (binding.type === 'triangleFlightBreakWall') {
                currentConfig.triangleFlightBreakWalls.push(duplicated as TestWorldTriangleFlightBreakWallConfig);
            } else if (binding.type === 'trianglePickup') {
                currentConfig.trianglePickups.push(duplicated as TestWorldTrianglePickupConfig);
            } else {
                return null;
            }

            rebuildFromCurrentConfig();
            return nextId;
        },
        removeObject: (rootId: string): boolean => {
            const removed = removeByRootId(rootId);
            if (removed) {
                rebuildFromCurrentConfig();
            }
            return removed;
        },
        focusObjectPoint: (targetId: string): { x: number; y: number } | null => {
            return instance.focusObjectPoint(targetId);
        },
        rebuildFromCurrentConfig
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
    const hazards: HazardObject[] = [];
    const movingPlatforms: MovingPlatformObject[] = [];
    const dragBoxes: DraggableBoxObject[] = [];
    const triggerPlatforms: TriggerPlatformObject[] = [];
    const windZones: WindZoneObject[] = [];
    const triangleFlightBreakWalls: TriangleFlightBreakWallObject[] = [];
    const trianglePickups: TriangleFlightPickupObject[] = [];
    const surfaces = new Map<string, Phaser.GameObjects.Rectangle>();
    const checkpointsById = new Map<string, CheckpointObject>();
    const movingPlatformsById = new Map<string, MovingPlatformObject>();
    const dragBoxesById = new Map<string, DraggableBoxObject>();
    const triggerPlatformsById = new Map<string, TriggerPlatformObject>();
    const windZonesById = new Map<string, WindZoneObject>();
    const pickupsById = new Map<string, TriangleFlightPickupObject>();
    const bindings = new Map<string, RuntimeBinding>();
    const handleMap = new Map<string, TestWorldEditorHandle>();
    const objectSummaries: TestWorldEditorObjectSummary[] = [];
    const playerPlatformColliders: Physics.Arcade.Collider[] = [];
    const dragBoxWorldColliders: Physics.Arcade.Collider[] = [];
    const overlapColliders: Physics.Arcade.Collider[] = [];
    const pickupOverlapColliders = new Map<string, Physics.Arcade.Collider>();
    let activeCheckpointId = config.checkpoints[0]?.id ?? null;
    let wasTriangleGrounded = false;

    const addCleanup = (cleanupFn: () => void): void => {
        cleanup.push(cleanupFn);
    };

    const destroyColliderList = (colliders: Physics.Arcade.Collider[]): void => {
        colliders.splice(0, colliders.length).forEach((collider) => collider.destroy());
    };

    const rebuildPlayerPlatformColliders = (): void => {
        destroyColliderList(playerPlatformColliders);
        surfaces.forEach((surface) => {
            playerPlatformColliders.push(scene.physics.add.collider(player.arcadeBodyObject, surface));
        });
        movingPlatforms.forEach((entry) => {
            playerPlatformColliders.push(scene.physics.add.collider(player.arcadeBodyObject, entry.bodyObject));
        });
        dragBoxes.forEach((entry) => {
            playerPlatformColliders.push(scene.physics.add.collider(player.arcadeBodyObject, entry.bodyObject));
        });
        triggerPlatforms.forEach((entry) => {
            playerPlatformColliders.push(scene.physics.add.collider(player.arcadeBodyObject, entry.platformBodyObject));
        });
        triangleFlightBreakWalls.forEach((entry) => {
            playerPlatformColliders.push(scene.physics.add.collider(player.arcadeBodyObject, entry.bodyObject));
        });
        playerPlatformColliders.forEach((collider) => {
            collider.active = useArcadePlatformCollisions;
        });
    };

    const rebuildDragBoxWorldColliders = (): void => {
        destroyColliderList(dragBoxWorldColliders);
        dragBoxes.forEach((dragBox) => {
            surfaces.forEach((surface) => {
                dragBoxWorldColliders.push(scene.physics.add.collider(dragBox.bodyObject, surface));
            });
            movingPlatforms.forEach((platform) => {
                dragBoxWorldColliders.push(scene.physics.add.collider(dragBox.bodyObject, platform.bodyObject));
            });
            triggerPlatforms.forEach((platform) => {
                dragBoxWorldColliders.push(scene.physics.add.collider(dragBox.bodyObject, platform.platformBodyObject));
            });
        });
    };

    const containsBoundsPoint = (bounds: TestWorldEditorBounds, worldX: number, worldY: number): boolean => {
        return Math.abs(worldX - bounds.x) <= (bounds.width * 0.5)
            && Math.abs(worldY - bounds.y) <= (bounds.height * 0.5);
    };

    const getLiveHandleBounds = <TConfig>(
        binding: Omit<RuntimeBinding, 'handleDefinitions'>,
        definition: TestWorldEditorHandleDefinition<TConfig>,
        configObject: TConfig
    ): TestWorldEditorBounds => {
        if (binding.type === 'dragBox' && definition.part === 'main') {
            const runtimeDragBox = dragBoxesById.get(binding.rootId);
            if (runtimeDragBox) {
                return {
                    x: runtimeDragBox.bodyObject.x,
                    y: runtimeDragBox.bodyObject.y,
                    width: runtimeDragBox.bodyObject.width,
                    height: runtimeDragBox.bodyObject.height
                };
            }
        }

        return definition.getBounds(configObject);
    };

    const addBinding = <TConfig>(
        configObject: TConfig,
        binding: Omit<RuntimeBinding, 'handleDefinitions'>,
        handleDefinitions: TestWorldEditorHandleDefinition<TConfig>[]
    ): void => {
        const runtimeBinding: RuntimeBinding = {
            ...binding,
            handleDefinitions: handleDefinitions as unknown as TestWorldEditorHandleDefinition<unknown>[]
        };
        bindings.set(binding.rootId, runtimeBinding);
        objectSummaries.push({
            id: binding.rootId,
            label: binding.label,
            type: binding.type,
            locked: binding.isLocked()
        });
        handleDefinitions.forEach((definition) => {
            handleMap.set(definition.id, {
                id: definition.id,
                rootId: definition.rootId,
                label: definition.label,
                type: definition.type,
                part: definition.part,
                isLocked: () => binding.isLocked(),
                getBounds: () => getLiveHandleBounds(binding, definition, configObject),
                containsPoint: (worldX, worldY) => {
                    if (binding.type === 'dragBox' && definition.part === 'main') {
                        return containsBoundsPoint(getLiveHandleBounds(binding, definition, configObject), worldX, worldY);
                    }

                    return definition.containsPoint(configObject, worldX, worldY);
                }
            });
        });
    };

    const playerSpawnMarker = createPlayerSpawnMarker(scene, config.playerSpawn);
    addCleanup(() => playerSpawnMarker.destroy());
    addBinding(
        config.playerSpawn,
        {
            rootId: 'player_spawn',
            type: 'playerSpawn',
            label: 'player_spawn',
            isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.getLocked(config.playerSpawn),
            setLocked: (locked) => {
                TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.setLocked(config.playerSpawn, locked);
            },
            refresh: () => {
                playerSpawnMarker.refresh();
            },
            patchFields: (patch) => {
                TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.patchFields(config.playerSpawn, patch);
                playerSpawnMarker.refresh();
            },
            patchColors: (patch) => {
                TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.patchColors(config.playerSpawn, patch);
                playerSpawnMarker.refresh();
            }
        },
        TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.getHandles(config.playerSpawn)
    );

    config.surfaces.forEach((surfaceConfig) => {
        const surface = createSurface(scene, surfaceConfig);
        surfaces.set(surfaceConfig.id, surface);
        addCleanup(() => {
            const matterBody = surface.getData('pf_matter_body') as MatterJS.BodyType | undefined;
            if (matterBody) {
                scene.matter.world.remove(matterBody);
            }
            surface.destroy();
        });
        addBinding(
            surfaceConfig,
            {
                rootId: surfaceConfig.id,
                type: 'surface',
                label: surfaceConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.surface.getLocked(surfaceConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.surface.setLocked(surfaceConfig, locked);
                },
                refresh: () => {
                    syncSurfaceObject(scene, surface, surfaceConfig);
                    rebuildDragBoxWorldColliders();
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.surface.patchFields(surfaceConfig, patch);
                    replaceSurfaceMatterBody(scene, surface, surfaceConfig);
                    syncSurfaceObject(scene, surface, surfaceConfig);
                    rebuildPlayerPlatformColliders();
                    rebuildDragBoxWorldColliders();
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.surface.patchColors(surfaceConfig, patch);
                    syncSurfaceObject(scene, surface, surfaceConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.surface.getHandles(surfaceConfig)
        );
    });

    config.hazards.forEach((hazardConfig) => {
        const hazard = createHazard(scene, hazardConfig);
        hazards.push(hazard);
        addCleanup(() => hazard.destroy());
        addBinding(
            hazardConfig,
            {
                rootId: hazardConfig.id,
                type: 'hazard',
                label: hazardConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.hazard.getLocked(hazardConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.hazard.setLocked(hazardConfig, locked);
                },
                refresh: () => {
                    syncHazardObject(scene, hazard, hazardConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.hazard.patchFields(hazardConfig, patch);
                    syncHazardObject(scene, hazard, hazardConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.hazard.patchColors(hazardConfig, patch);
                    syncHazardObject(scene, hazard, hazardConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.hazard.getHandles(hazardConfig)
        );
    });

    config.checkpoints.forEach((checkpointConfig) => {
        const checkpoint = createCheckpoint(scene, checkpointConfig);
        checkpointsById.set(checkpointConfig.id, checkpoint);
        overlapColliders.push(scene.physics.add.overlap(player.arcadeBodyObject, checkpoint.trigger, () => {
            activeCheckpointId = checkpointConfig.id;
            applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
        }));
        addCleanup(() => checkpoint.destroy());
        addBinding(
            checkpointConfig,
            {
                rootId: checkpointConfig.id,
                type: 'checkpoint',
                label: checkpointConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.checkpoint.getLocked(checkpointConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.checkpoint.setLocked(checkpointConfig, locked);
                },
                refresh: () => {
                    refreshCheckpointObject(scene, checkpoint, checkpointConfig);
                    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.checkpoint.patchFields(checkpointConfig, patch);
                    refreshCheckpointObject(scene, checkpoint, checkpointConfig);
                    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.checkpoint.patchColors(checkpointConfig, patch);
                    refreshCheckpointObject(scene, checkpoint, checkpointConfig);
                    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.checkpoint.getHandles(checkpointConfig)
        );
    });
    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);

    const rebuildMovingPlatformObject = (platformConfig: TestWorldMovingPlatformConfig): void => {
        const existing = movingPlatformsById.get(platformConfig.id);
        if (existing) {
            const index = movingPlatforms.indexOf(existing);
            if (index >= 0) {
                movingPlatforms.splice(index, 1);
            }
            existing.destroy();
        }
        const platform = createMovingPlatform(scene, platformConfig);
        movingPlatforms.push(platform);
        movingPlatformsById.set(platformConfig.id, platform);
        rebuildPlayerPlatformColliders();
        rebuildDragBoxWorldColliders();
    };

    config.movingPlatforms.forEach((platformConfig) => {
        rebuildMovingPlatformObject(platformConfig);
        addBinding(
            platformConfig,
            {
                rootId: platformConfig.id,
                type: 'movingPlatform',
                label: platformConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.getLocked(platformConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.setLocked(platformConfig, locked);
                },
                refresh: () => {
                    rebuildMovingPlatformObject(platformConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.patchFields(platformConfig, patch);
                    rebuildMovingPlatformObject(platformConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.patchColors(platformConfig, patch);
                    rebuildMovingPlatformObject(platformConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.getHandles(platformConfig)
        );
    });

    const rebuildDragBoxObject = (dragBoxConfig: TestWorldDragBoxConfig): void => {
        const existing = dragBoxesById.get(dragBoxConfig.id);
        if (existing) {
            const index = dragBoxes.indexOf(existing);
            if (index >= 0) {
                dragBoxes.splice(index, 1);
            }
            existing.destroy();
        }
        const dragBox = createDraggableBox(scene, dragBoxConfig);
        dragBox.bodyObject.setName(dragBoxConfig.id);
        dragBoxes.push(dragBox);
        dragBoxesById.set(dragBoxConfig.id, dragBox);
        rebuildPlayerPlatformColliders();
        rebuildDragBoxWorldColliders();
    };

    config.dragBoxes.forEach((dragBoxConfig) => {
        rebuildDragBoxObject(dragBoxConfig);
        addBinding(
            dragBoxConfig,
            {
                rootId: dragBoxConfig.id,
                type: 'dragBox',
                label: dragBoxConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.dragBox.getLocked(dragBoxConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.dragBox.setLocked(dragBoxConfig, locked);
                },
                refresh: () => {
                    rebuildDragBoxObject(dragBoxConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.dragBox.patchFields(dragBoxConfig, patch);
                    rebuildDragBoxObject(dragBoxConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.dragBox.patchColors(dragBoxConfig, patch);
                    rebuildDragBoxObject(dragBoxConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.dragBox.getHandles(dragBoxConfig)
        );
    });

    const resolveTriggerActionActiveState = (
        triggerConfig: TestWorldTriggerPlatformConfig,
        action: 'activate' | 'deactivate' | undefined
    ): boolean => {
        const initialActive = triggerConfig.initiallyActive ?? false;
        if (action === 'activate') {
            return true;
        }
        if (action === 'deactivate') {
            return false;
        }
        return initialActive;
    };

    const rebuildTriggerPlatformObject = (triggerConfig: TestWorldTriggerPlatformConfig): void => {
        const existing = triggerPlatformsById.get(triggerConfig.id);
        if (existing) {
            const index = triggerPlatforms.indexOf(existing);
            if (index >= 0) {
                triggerPlatforms.splice(index, 1);
            }
            existing.destroy();
        }
        const triggerPlatform = createTriggerPlatform(scene, triggerConfig);
        triggerPlatforms.push(triggerPlatform);
        triggerPlatformsById.set(triggerConfig.id, triggerPlatform);
        rebuildPlayerPlatformColliders();
        rebuildDragBoxWorldColliders();
    };

    config.triggerPlatforms.forEach((triggerConfig) => {
        rebuildTriggerPlatformObject(triggerConfig);
        addBinding(
            triggerConfig,
            {
                rootId: triggerConfig.id,
                type: 'triggerPlatform',
                label: triggerConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.getLocked(triggerConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.setLocked(triggerConfig, locked);
                },
                refresh: () => {
                    rebuildTriggerPlatformObject(triggerConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.patchFields(triggerConfig, patch);
                    rebuildTriggerPlatformObject(triggerConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.patchColors(triggerConfig, patch);
                    rebuildTriggerPlatformObject(triggerConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.getHandles(triggerConfig)
        );
    });

    const rebuildWindZoneObject = (windZoneConfig: TestWorldWindZoneConfig): void => {
        const existing = windZonesById.get(windZoneConfig.id);
        if (existing) {
            const index = windZones.indexOf(existing);
            if (index >= 0) {
                windZones.splice(index, 1);
            }
            existing.destroy();
        }
        const windZone = createWindZone(scene, windZoneConfig);
        windZones.push(windZone);
        windZonesById.set(windZoneConfig.id, windZone);
    };

    config.windZones.forEach((windZoneConfig) => {
        rebuildWindZoneObject(windZoneConfig);
        addBinding(
            windZoneConfig,
            {
                rootId: windZoneConfig.id,
                type: 'windZone',
                label: windZoneConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.windZone.getLocked(windZoneConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.windZone.setLocked(windZoneConfig, locked);
                },
                refresh: () => {
                    rebuildWindZoneObject(windZoneConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.windZone.patchFields(windZoneConfig, patch);
                    rebuildWindZoneObject(windZoneConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.windZone.patchColors(windZoneConfig, patch);
                    rebuildWindZoneObject(windZoneConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.windZone.getHandles(windZoneConfig)
        );
    });

    config.triangleFlightBreakWalls.forEach((wallConfig) => {
        const wall = createTriangleFlightBreakWall(scene, wallConfig);
        triangleFlightBreakWalls.push(wall);
        addCleanup(() => wall.destroy());
        addBinding(
            wallConfig,
            {
                rootId: wallConfig.id,
                type: 'triangleFlightBreakWall',
                label: wallConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.getLocked(wallConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.setLocked(wallConfig, locked);
                },
                refresh: () => {
                    syncBreakWallObject(scene, wall, wallConfig);
                    rebuildPlayerPlatformColliders();
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.patchFields(wallConfig, patch);
                    syncBreakWallObject(scene, wall, wallConfig);
                    rebuildPlayerPlatformColliders();
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.patchColors(wallConfig, patch);
                    syncBreakWallObject(scene, wall, wallConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.getHandles(wallConfig)
        );
    });

    const rebuildPickupObject = (pickupConfig: TestWorldTrianglePickupConfig): void => {
        const existing = pickupsById.get(pickupConfig.id);
        if (existing) {
            const index = trianglePickups.indexOf(existing);
            if (index >= 0) {
                trianglePickups.splice(index, 1);
            }
            existing.destroy();
        }
        pickupOverlapColliders.get(pickupConfig.id)?.destroy();
        pickupOverlapColliders.delete(pickupConfig.id);
        const pickup = createTriangleFlightPickup(scene, pickupConfig);
        trianglePickups.push(pickup);
        pickupsById.set(pickupConfig.id, pickup);
        const collider = scene.physics.add.overlap(player.arcadeBodyObject, pickup.trigger, () => {
            if (pickup.isCollected() || player.currentForm !== 'triangle') {
                return;
            }

            pickup.collect();
            player.refillTriangleFlightResource();
        });
        overlapColliders.push(collider);
        pickupOverlapColliders.set(pickupConfig.id, collider);
    };

    config.trianglePickups.forEach((pickupConfig) => {
        rebuildPickupObject(pickupConfig);
        addBinding(
            pickupConfig,
            {
                rootId: pickupConfig.id,
                type: 'trianglePickup',
                label: pickupConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.getLocked(pickupConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.setLocked(pickupConfig, locked);
                },
                refresh: () => {
                    rebuildPickupObject(pickupConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.patchFields(pickupConfig, patch);
                    rebuildPickupObject(pickupConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.patchColors(pickupConfig, patch);
                    rebuildPickupObject(pickupConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.getHandles(pickupConfig)
        );
    });

    rebuildPlayerPlatformColliders();
    rebuildDragBoxWorldColliders();

    return {
        hazards,
        updateMovingPlatforms: (): void => {
            movingPlatforms.forEach((platform) => {
                platform.update();
            });
            dragBoxes.forEach((dragBox) => {
                dragBox.update(player);
            });
            config.triggerPlatforms.forEach((triggerConfig) => {
                const triggerPlatform = triggerPlatformsById.get(triggerConfig.id);
                if (!triggerPlatform) {
                    return;
                }

                if (triggerConfig.activator === 'drag_box') {
                    const targetDragBox = resolveTriggerDragBox(triggerConfig, config.dragBoxes, dragBoxes);
                    const isBoxInside = targetDragBox !== null && scene.physics.overlap(targetDragBox.bodyObject, triggerPlatform.triggerZone);
                    const isBoxStillMoving = targetDragBox !== null && isDragBoxStillMoving(targetDragBox);
                    const activeWhenTriggered = resolveTriggerActionActiveState(triggerConfig, triggerConfig.triggerAction);
                    const activeWhenIdle = triggerConfig.initiallyActive ?? false;
                    const shouldUseTriggeredState = isBoxInside
                        || (triggerPlatform.isActivated() === activeWhenTriggered && isBoxStillMoving);
                    triggerPlatform.setActive(shouldUseTriggeredState ? activeWhenTriggered : activeWhenIdle);
                    return;
                }

                const isInActivateZone = scene.physics.overlap(player.arcadeBodyObject, triggerPlatform.triggerZone);
                const isInDeactivateZone = triggerPlatform.deactivateTriggerZone !== null
                    && scene.physics.overlap(player.arcadeBodyObject, triggerPlatform.deactivateTriggerZone);
                if (isInDeactivateZone) {
                    triggerPlatform.setActive(
                        resolveTriggerActionActiveState(triggerConfig, triggerConfig.deactivateTriggerAction)
                    );
                } else if (isInActivateZone) {
                    triggerPlatform.setActive(
                        resolveTriggerActionActiveState(triggerConfig, triggerConfig.triggerAction)
                    );
                }
            });
        },
        postPlayerTickUpdate: (): void => {
            if (player.currentForm === 'triangle' && player.isTriangleBreakWallActive) {
                triangleFlightBreakWalls.forEach((wall) => {
                    if (wall.isBroken()) {
                        return;
                    }

                    if (doesTriangleFlightBreakWallOverlapPlayerShape(wall, player.hazardHitShape)) {
                        wall.breakWall();
                    }
                });
            }

            const isTriangleGrounded = player.currentForm === 'triangle' && player.isCurrentlyGrounded;
            if (isTriangleGrounded && !wasTriangleGrounded) {
                trianglePickups.forEach((pickup) => {
                    pickup.respawn();
                });
            }
            wasTriangleGrounded = isTriangleGrounded;
        },
        resetRespawnObjects: (): void => {
            triangleFlightBreakWalls.forEach((wall) => {
                wall.respawn();
            });
        },
        syncPlayerCollisionMode: (shouldUseArcadePlatformCollisions: boolean): void => {
            playerPlatformColliders.forEach((collider) => {
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
        getEditorHandles: (): readonly TestWorldEditorHandle[] => [...handleMap.values()],
        getEditorObjects: (): readonly TestWorldEditorObjectSummary[] => {
            return objectSummaries.map((entry) => ({
                ...entry,
                locked: bindings.get(entry.id)?.isLocked() ?? entry.locked
            }));
        },
        getEditorHandle: (id: string): TestWorldEditorHandle | null => handleMap.get(id) ?? null,
        patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds): boolean => {
            const handle = handleMap.get(handleId);
            if (!handle) {
                return false;
            }
            const binding = bindings.get(handle.rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            const definition = binding.handleDefinitions.find((entry) => entry.id === handleId);
            if (!definition) {
                return false;
            }

            const targetConfig = getConfigReference(config, binding.type, handle.rootId);
            if (!targetConfig) {
                return false;
            }

            definition.setBounds(targetConfig as never, bounds);
            binding.refresh();
            return true;
        },
        patchObjectFields: (rootId: string, patch: Record<string, unknown>): boolean => {
            const binding = bindings.get(rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            binding.patchFields(patch);
            return true;
        },
        patchObjectColors: (rootId: string, patch: Record<string, unknown>): boolean => {
            const binding = bindings.get(rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            binding.patchColors(patch);
            return true;
        },
        setObjectLocked: (rootId: string, locked: boolean): boolean => {
            const binding = bindings.get(rootId);
            if (!binding) {
                return false;
            }
            binding.setLocked(locked);
            return true;
        },
        focusObjectPoint: (targetId: string): { x: number; y: number } | null => {
            const handle = handleMap.get(targetId)
                ?? [...handleMap.values()].find((entry) => entry.rootId === targetId)
                ?? null;
            if (!handle) {
                return null;
            }
            const bounds = handle.getBounds();
            return { x: bounds.x, y: bounds.y };
        },
        destroy: (): void => {
            destroyColliderList(playerPlatformColliders);
            destroyColliderList(dragBoxWorldColliders);
            destroyColliderList(overlapColliders);
            movingPlatforms.forEach((entry) => entry.destroy());
            dragBoxes.forEach((entry) => entry.destroy());
            triggerPlatforms.forEach((entry) => entry.destroy());
            windZones.forEach((entry) => entry.destroy());
            trianglePickups.forEach((entry) => entry.destroy());
            cleanup.forEach((cleanupFn) => cleanupFn());
        }
    };
};

const refreshRectangleGameObject = (
    scene: Scene,
    rectangle: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc,
    x: number,
    y: number,
    width: number,
    height: number
): void => {
    rectangle.setPosition(x, y);
    if (rectangle instanceof Phaser.GameObjects.Rectangle) {
        rectangle.setSize(width, height);
    } else {
        rectangle.setRadius(Math.max(width, height) * 0.5);
    }

    const body = rectangle.body as Physics.Arcade.StaticBody | Physics.Arcade.Body | undefined;
    if (body instanceof Physics.Arcade.Body) {
        body.setSize(width, height, true);
    }
    body?.updateFromGameObject();
    scene.children.bringToTop(rectangle);
};

const replaceSurfaceMatterBody = (
    scene: Scene,
    surface: Phaser.GameObjects.Rectangle,
    config: TestWorldSurfaceConfig
): void => {
    const existingMatterBody = surface.getData('pf_matter_body') as MatterJS.BodyType | undefined;
    if (existingMatterBody) {
        scene.matter.world.remove(existingMatterBody);
    }
    const matterBody = scene.matter.add.rectangle(config.x, config.y, config.width, config.height, { isStatic: true });
    markMatterBodyAsPlatformSurface(matterBody);
    surface.setData('pf_matter_body', matterBody);
};

const syncSurfaceObject = (
    scene: Scene,
    surface: Phaser.GameObjects.Rectangle,
    config: TestWorldSurfaceConfig
): void => {
    refreshRectangleGameObject(scene, surface, config.x, config.y, config.width, config.height);
    surface.setFillStyle(config.fillColor);
    surface.setStrokeStyle(2, config.strokeColor);
};

const syncHazardObject = (
    scene: Scene,
    hazard: HazardObject,
    config: TestWorldHazardConfig
): void => {
    refreshRectangleGameObject(scene, hazard.trigger, config.x, config.y, config.width, config.height);
    hazard.trigger.setFillStyle(config.fillColor ?? 0xef5350, 0.75);
    hazard.trigger.setStrokeStyle(2, config.strokeColor ?? 0xb71c1c);
};

const syncBreakWallObject = (
    scene: Scene,
    wall: TriangleFlightBreakWallObject,
    config: TestWorldTriangleFlightBreakWallConfig
): void => {
    refreshRectangleGameObject(scene, wall.bodyObject, config.x, config.y, config.width, config.height);
    wall.bodyObject.setFillStyle(config.fillColor ?? 0x8d6e63, 0.95);
    wall.bodyObject.setStrokeStyle(2, config.strokeColor ?? 0x4e342e);
    scene.matter.world.remove(wall.matterBody);
    wall.matterBody = scene.matter.add.rectangle(config.x, config.y, config.width, config.height, { isStatic: true });
    markMatterBodyAsPlatformSurface(wall.matterBody);
};

const refreshCheckpointObject = (
    scene: Scene,
    checkpoint: CheckpointObject,
    config: TestWorldCheckpointConfig
): void => {
    refreshRectangleGameObject(scene, checkpoint.trigger, config.x, config.y, config.width, config.height);
    checkpoint.beacon.setPosition(config.x, config.y - (config.height * 0.5) - 14);
    checkpoint.trigger.setFillStyle(config.fillColor ?? 0x90caf9, 0.35);
    checkpoint.trigger.setStrokeStyle(2, config.strokeColor ?? 0x64b5f6);
};

const createPlayerSpawnMarker = (scene: Scene, config: TestWorldPlayerSpawnConfig): PlayerSpawnMarkerObject => {
    const glow = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor ?? 0x81d4fa, 0.12)
        .setDepth(4188);
    const body = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor ?? 0x81d4fa, 0.28)
        .setStrokeStyle(2, config.strokeColor ?? 0x0277bd)
        .setDepth(4189);
    const crosshair = scene.add.graphics().setDepth(4190);

    const refresh = (): void => {
        glow.setPosition(config.x, config.y);
        glow.setSize(config.width, config.height);
        glow.setFillStyle(config.fillColor ?? 0x81d4fa, 0.12);
        body.setPosition(config.x, config.y);
        body.setSize(config.width, config.height);
        body.setFillStyle(config.fillColor ?? 0x81d4fa, 0.28);
        body.setStrokeStyle(2, config.strokeColor ?? 0x0277bd);
        crosshair.clear();
        crosshair.lineStyle(2, config.strokeColor ?? 0x0277bd, 1);
        crosshair.strokeLineShape(new Phaser.Geom.Line(config.x - 14, config.y, config.x + 14, config.y));
        crosshair.strokeLineShape(new Phaser.Geom.Line(config.x, config.y - 14, config.x, config.y + 14));
    };
    refresh();

    return {
        body,
        glow,
        crosshair,
        refresh,
        destroy: (): void => {
            glow.destroy();
            body.destroy();
            crosshair.destroy();
        }
    };
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

const getConfigReference = (config: TestWorldConfig, type: TestWorldEditorObjectType, rootId: string): unknown => {
    if (type === 'playerSpawn') {
        return config.playerSpawn;
    }
    if (type === 'surface') {
        return config.surfaces.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'hazard') {
        return config.hazards.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'checkpoint') {
        return config.checkpoints.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'movingPlatform') {
        return config.movingPlatforms.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'triggerPlatform') {
        return config.triggerPlatforms.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'dragBox') {
        return config.dragBoxes.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'windZone') {
        return config.windZones.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'triangleFlightBreakWall') {
        return config.triangleFlightBreakWalls.find((entry) => entry.id === rootId) ?? null;
    }
    return config.trianglePickups.find((entry) => entry.id === rootId) ?? null;
};

const isDragBoxStillMoving = (dragBox: DraggableBoxObject): boolean => {
    return Math.abs(dragBox.body.velocity.x) > DRAG_BOX_TRIGGER_RELEASE_SPEED_EPSILON
        || Math.abs(dragBox.body.velocity.y) > DRAG_BOX_TRIGGER_RELEASE_SPEED_EPSILON;
};

const applyActiveCheckpointState = (
    checkpointsById: Map<string, CheckpointObject>,
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

    checkpointConfigs.forEach((checkpointConfig, index) => {
        checkpointsById.get(checkpointConfig.id)?.setActive(index === safeIndex);
    });
};

const resolveTriggerDragBox = (
    triggerConfig: TestWorldTriggerPlatformConfig,
    dragBoxConfigs: TestWorldDragBoxConfig[],
    dragBoxes: DraggableBoxObject[]
): DraggableBoxObject | null => {
    const targetConfig = dragBoxConfigs.find((entry) => entry.targetTriggerPlatformId === triggerConfig.id) ?? null;
    if (targetConfig === null) {
        return null;
    }

    return dragBoxes.find((entry) => entry.bodyObject.name === targetConfig.id) ?? null;
};
