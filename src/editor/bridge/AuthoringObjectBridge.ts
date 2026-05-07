import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import type { LegacyObjectSource } from './LegacyObjectAdapter';
import { saveTestWorldEditorDraft } from '../../game/world/runtime/test_world_editor_storage';
import type { TestWorldConfig } from '../../game/world/runtime/test_world_config';
import type { GameplayTimeController } from '../../scenes/runtime/gameplay_time_controller';

const isCreatableLegacyType = (type: string): boolean => {
    return type === 'surface'
        || type === 'movingPlatform'
        || type === 'triggerPlatform'
        || type === 'checkpoint'
        || type === 'playerSpawn'
        || type === 'finish'
        || type === 'windZone'
        || type === 'triggerVolume'
        || type === 'trianglePickup'
        || type === 'dragBox'
        || type === 'hazard'
        || type === 'triangleFlightBreakWall';
};

interface CreateAuthoringObjectBridgeSourceOptions {
    onRuntimeConfigApplied?: (config: TestWorldConfig) => void;
}

interface ImportRuntimeConfigOptions {
    mode?: 'runtime_patch' | 'full_import';
}

export const createAuthoringObjectBridgeSource = (
    worldRuntime: TestWorldRuntime,
    options?: CreateAuthoringObjectBridgeSourceOptions & {
        gameplayTimeController?: GameplayTimeController;
    }
): LegacyObjectSource => {
    let importInProgress = false;

    const countObjects = (config: TestWorldConfig): Record<string, number> => ({
        surfaces: config.surfaces.length,
        dragBoxes: config.dragBoxes.length,
        windZones: config.windZones.length,
        checkpoints: config.checkpoints.length,
        triggerVolumes: config.triggerVolumes.length,
        trianglePickups: config.trianglePickups.length,
        finish: config.finish ? 1 : 0,
        playerSpawn: 1
    });

    return {
        getLevelId: () => worldRuntime.getLevelId(),
        getLevelDisplayName: () => worldRuntime.getLevelId(),
        getRuntimeConfig: () => worldRuntime.getConfig(),
        getWorldOnStartLogicTrace: () => worldRuntime.getWorldOnStartLogicTrace(),
        getRuntimeWorldFlagsSnapshot: () => worldRuntime.getRuntimeWorldFlagsSnapshot(),
        getLastObjectInteractionTrace: () => worldRuntime.getLastObjectInteractionTrace(),
        getLastNpcInteractionTrace: () => worldRuntime.getLastNpcInteractionTrace(),
        getLastCutsceneLogicTrace: () => worldRuntime.getLastCutsceneLogicTrace(),
        getSurfaceMoveRuntimeDebugSnapshot: () => worldRuntime.getSurfaceMoveRuntimeDebugSnapshot(),
        getGameplayTimeState: () => {
            const snapshot = options?.gameplayTimeController?.getSnapshot();
            return snapshot
                ? { stopped: snapshot.stopped, speed: snapshot.speed }
                : { stopped: false, speed: 1 };
        },
        setGameplayStopped: (stopped) => {
            options?.gameplayTimeController?.setStopped(stopped);
        },
        setGameplaySpeed: (speed) => {
            options?.gameplayTimeController?.setSpeed(speed);
        },
        saveRuntimeConfig: () => {
            const levelId = worldRuntime.getLevelId();
            const config = worldRuntime.getConfig();
            try {
                saveTestWorldEditorDraft(levelId, config);
                return {
                    success: true,
                    source: 'localStorage' as const,
                    levelId,
                    objectCounts: countObjects(config)
                };
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    source: 'localStorage' as const,
                    reason,
                    levelId,
                    objectCounts: countObjects(config)
                };
            }
        },
        importRuntimeConfig: (config, importOptions: ImportRuntimeConfigOptions | undefined) => {
            const levelId = worldRuntime.getLevelId();
            if (importInProgress) {
                return {
                    success: false,
                    source: 'runtimeConfig' as const,
                    reason: 'Runtime import already in progress.',
                    levelId,
                    objectCounts: countObjects(worldRuntime.getConfig())
                };
            }
            importInProgress = true;
            try {
                const result = worldRuntime.replaceConfig(config, {
                    mode: importOptions?.mode ?? 'runtime_patch'
                });
                if (result.success) {
                    const appliedConfig = worldRuntime.getConfig();
                    try {
                        options?.onRuntimeConfigApplied?.(appliedConfig);
                    } catch {
                        // Runtime config is already applied; callback failures must not revert import.
                    }
                    return {
                        success: true,
                        source: 'runtimeConfig' as const,
                        levelId,
                        objectCounts: countObjects(appliedConfig)
                    };
                }
                return {
                    success: false,
                    source: 'runtimeConfig' as const,
                    reason: result.reason,
                    levelId,
                    objectCounts: countObjects(worldRuntime.getConfig())
                };
            } finally {
                importInProgress = false;
            }
        },
        getWorldBounds: () => {
            const bounds = worldRuntime.getWorldBounds();
            return {
                width: bounds.width,
                height: bounds.height
            };
        },
        listObjects: () => {
            const liveRootIds = new Set(worldRuntime.getEditorHandles().map((handle) => handle.rootId));
            return worldRuntime.getEditorObjects()
                .filter((entry) => {
                    // Treat runtime handle presence as liveness for runtime-backed editor objects.
                    if (entry.id === 'player_spawn') {
                        return true;
                    }
                    return liveRootIds.has(entry.id);
                })
                .map((entry) => ({
                id: entry.id,
                type: entry.type,
                label: entry.label,
                locked: entry.locked,
                onlyDebugView: entry.onlyDebugView,
                runtimeVisual: entry.runtimeVisual
                }));
        },
        listHandles: () => {
            return worldRuntime.getEditorHandles().map((entry) => ({
                id: entry.id,
                rootId: entry.rootId,
                type: entry.type,
                part: entry.part,
                getBounds: () => {
                    const bounds = entry.getBounds();
                    return {
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height
                        // TODO(authoring-step-4.1): runtime editor handles do not expose rotation yet.
                        // Keep rotation undefined so ProjectStore rotation is not clobbered during bridge sync.
                    };
                },
                containsPoint: (worldX: number, worldY: number) => entry.containsPoint(worldX, worldY)
            }));
        },
        patchHandleBounds: (handleId, bounds) => {
            return worldRuntime.patchObjectBounds(handleId, {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height
            });
        },
        patchObjectFields: (rootId, patch) => {
            return worldRuntime.patchObjectFields(rootId, patch);
        },
        patchObjectColors: (rootId, patch) => {
            return worldRuntime.patchObjectColors(rootId, patch);
        },
        patchObjectDebugVisibility: (rootId, onlyDebugView) => {
            return worldRuntime.patchObjectDebugVisibility(rootId, onlyDebugView);
        },
        setObjectLocked: (rootId, locked) => {
            return worldRuntime.setObjectLocked(rootId, locked);
        },
        setEditorDebugViewActive: (active) => {
            worldRuntime.setEditorDebugViewActive(active);
        },
        setSurfaceMoveRuntimeEditingActive: (rootId, active) => {
            return worldRuntime.setSurfaceMoveRuntimeEditingActive(rootId, active);
        },
        createObject: (type, worldX, worldY) => {
            if (!isCreatableLegacyType(type)) {
                return null;
            }
            return worldRuntime.createObject(type, worldX, worldY);
        },
        removeObject: (id) => {
            return worldRuntime.removeObject(id);
        }
    };
};
