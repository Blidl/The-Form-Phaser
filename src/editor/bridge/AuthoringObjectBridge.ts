import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import type { LegacyObjectSource } from './LegacyObjectAdapter';

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

export const createAuthoringObjectBridgeSource = (worldRuntime: TestWorldRuntime): LegacyObjectSource => {
    return {
        getLevelId: () => worldRuntime.getLevelId(),
        getLevelDisplayName: () => worldRuntime.getLevelId(),
        getWorldBounds: () => {
            const bounds = worldRuntime.getWorldBounds();
            return {
                width: bounds.width,
                height: bounds.height
            };
        },
        listObjects: () => {
            return worldRuntime.getEditorObjects().map((entry) => ({
                id: entry.id,
                type: entry.type,
                label: entry.label,
                locked: entry.locked,
                onlyDebugView: entry.onlyDebugView
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
        setEditorDebugViewActive: (active) => {
            worldRuntime.setEditorDebugViewActive(active);
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
