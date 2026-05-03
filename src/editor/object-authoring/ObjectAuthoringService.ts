import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import type { EditorObjectBoundsData, EditorObjectData } from '../data/EditorObjectData';
import type { ObjectTypeRegistry } from '../data/ObjectTypeRegistry';
import type { ProjectStore } from '../data/ProjectStore';
import { objectDiag } from '../debug/ObjectEditorDiagnostics';

const KNOWN_RUNTIME_OBJECT_TYPES = new Set<string>([
    'platform_default',
    'drag_box',
    'wind_zone',
    'checkpoint',
    'player_spawn',
    'finish',
    'trigger_volume',
    'triangle_pickup',
    'break_wall',
    'breakable_wall'
]);

export interface DeleteObjectResult {
    success: boolean;
    reason?: string;
}

export interface CreateObjectResult {
    success: boolean;
    objectId?: string;
    reason?: string;
    runtimeType?: string;
}

export interface ObjectAuthoringServiceOptions {
    projectStore: ProjectStore;
    objectTypeRegistry: ObjectTypeRegistry;
    legacyObjectAdapter: LegacyObjectAdapter | null;
}

export interface UpdateObjectBoundsResult {
    success: boolean;
    reason?: string;
}

export class ObjectAuthoringService {
    private readonly projectStore: ProjectStore;
    private readonly objectTypeRegistry: ObjectTypeRegistry;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private static readonly CATALOG_TO_RUNTIME_TYPE: Record<string, string> = {
        platform_default: 'surface',
        drag_box: 'dragBox',
        wind_zone: 'windZone',
        checkpoint: 'checkpoint',
        player_spawn: 'playerSpawn',
        finish: 'finish',
        trigger_volume: 'triggerVolume',
        triangle_pickup: 'trianglePickup'
    };

    public constructor(options: ObjectAuthoringServiceOptions) {
        this.projectStore = options.projectStore;
        this.objectTypeRegistry = options.objectTypeRegistry;
        this.legacyObjectAdapter = options.legacyObjectAdapter;
    }

    public listObjects(): EditorObjectData[] {
        this.syncProjectStoreMirror();
        const activeLevel = this.projectStore.getActiveLevel();
        return this.projectStore.listObjects(activeLevel.id);
    }

    public createObject(catalogId: string, x: number, y: number): CreateObjectResult {
        const resolvedCatalogId = this.objectTypeRegistry.resolveId(catalogId) ?? catalogId;
        const runtimeType = ObjectAuthoringService.CATALOG_TO_RUNTIME_TYPE[resolvedCatalogId];
        const beforeList = this.listObjects();
        const beforeIds = new Set(beforeList.map((item) => item.id));
        if (!runtimeType) {
            objectDiag('[ObjectCreate:service]', {
                catalogId: resolvedCatalogId,
                normalizedRuntimeType: null,
                x,
                y,
                resultId: null,
                success: false,
                reason: `Unsupported catalog type: ${resolvedCatalogId}`,
                serviceListCountBefore: beforeList.length,
                serviceListCountAfter: beforeList.length
            });
            return {
                success: false,
                runtimeType: undefined,
                reason: `Unsupported catalog type: ${resolvedCatalogId}`
            };
        }
        if (!this.legacyObjectAdapter) {
            objectDiag('[ObjectCreate:service]', {
                catalogId: resolvedCatalogId,
                normalizedRuntimeType: runtimeType,
                x,
                y,
                resultId: null,
                success: false,
                reason: 'Runtime bridge unavailable.',
                serviceListCountBefore: beforeList.length,
                serviceListCountAfter: beforeList.length
            });
            return { success: false, runtimeType, reason: 'Runtime bridge unavailable.' };
        }

        const creation = this.legacyObjectAdapter.createRuntimeObjectFromCatalog(resolvedCatalogId, x, y);
        this.syncProjectStoreMirror();
        const afterList = this.listObjects();
        const createdById = creation.legacyId
            ? afterList.find((item) => item.id === creation.legacyId)
            : undefined;
        const createdByDiff = afterList.find((item) => !beforeIds.has(item.id));
        const createdByNearest = afterList
            .filter((item) => (this.objectTypeRegistry.resolveId(item.settings.type) ?? item.settings.type) === resolvedCatalogId)
            .sort((left, right) => {
                const leftDx = (left.bounds.x + (left.bounds.width * 0.5)) - x;
                const leftDy = (left.bounds.y + (left.bounds.height * 0.5)) - y;
                const rightDx = (right.bounds.x + (right.bounds.width * 0.5)) - x;
                const rightDy = (right.bounds.y + (right.bounds.height * 0.5)) - y;
                return ((leftDx * leftDx) + (leftDy * leftDy)) - ((rightDx * rightDx) + (rightDy * rightDy));
            })[0];
        const createdObject = createdById ?? createdByDiff ?? createdByNearest;
        const success = creation.success && !!createdObject;
        const reason = !creation.success
            ? (creation.error ?? 'Runtime create failed.')
            : (!createdObject ? 'Created object not found in live list.' : undefined);

        objectDiag('[ObjectCreate:service]', {
            catalogId: resolvedCatalogId,
            normalizedRuntimeType: runtimeType,
            x,
            y,
            resultId: createdObject?.id ?? creation.legacyId ?? null,
            success,
            reason: reason ?? null,
            serviceListCountBefore: beforeList.length,
            serviceListCountAfter: afterList.length
        });

        return {
            success,
            objectId: createdObject?.id,
            runtimeType,
            reason
        };
    }

    public deleteObject(objectId: string): DeleteObjectResult {
        objectDiag('[ObjectAuthoringService:delete]', {
            phase: 'start',
            objectId
        });
        try {
            this.syncProjectStoreMirror();
            const beforeList = this.listObjects();
            const activeLevel = this.projectStore.getActiveLevel();
            const objectData = this.projectStore.getObject(activeLevel.id, objectId);
            if (!objectData) {
                objectDiag('[ObjectAuthoringService:delete]', {
                    phase: 'result',
                    objectIdReceived: objectId,
                    objectFoundInServiceList: false,
                    objectType: null,
                    objectCategory: null,
                    runtimeRootIdUsed: null,
                    callingRuntimeRemove: false,
                    removeResult: false,
                    serviceListCountBefore: beforeList.length,
                    serviceListCountAfter: beforeList.length,
                    objectStillPresentAfterDelete: false,
                    failureReason: 'Object is not present in active runtime level.'
                });
                return { success: false, reason: 'Object is not present in active runtime level.' };
            }

            const hasRuntimeLink = this.legacyObjectAdapter?.hasRuntimeLink(objectId) ?? false;
            if (this.isKnownRuntimeType(objectData.settings.type) && !hasRuntimeLink) {
                objectDiag('[ObjectAuthoringService:delete]', {
                    phase: 'result',
                    objectIdReceived: objectId,
                    objectFoundInServiceList: true,
                    objectType: objectData.settings.type,
                    objectCategory: objectData.settings.category,
                    runtimeRootIdUsed: objectId,
                    callingRuntimeRemove: false,
                    removeResult: false,
                    serviceListCountBefore: beforeList.length,
                    serviceListCountAfter: beforeList.length,
                    objectStillPresentAfterDelete: beforeList.some((item) => item.id === objectId),
                    failureReason: 'Object has no live runtime link.'
                });
                return { success: false, reason: 'Object has no live runtime link.' };
            }
            let runtimeRemoved = false;
            if (hasRuntimeLink) {
                runtimeRemoved = this.legacyObjectAdapter?.removeRuntimeObject(objectId) ?? false;
                if (!runtimeRemoved) {
                    const failureReason = objectData.settings.type === 'player_spawn'
                        ? 'Runtime refused deletion: playerSpawn is protected.'
                        : `Runtime refused deletion for type "${objectData.settings.type}".`;
                    const afterList = this.listObjects();
                    objectDiag('[ObjectAuthoringService:delete]', {
                        phase: 'result',
                        objectIdReceived: objectId,
                        objectFoundInServiceList: true,
                        objectType: objectData.settings.type,
                        objectCategory: objectData.settings.category,
                        runtimeRootIdUsed: objectId,
                        callingRuntimeRemove: true,
                        removeResult: false,
                        serviceListCountBefore: beforeList.length,
                        serviceListCountAfter: afterList.length,
                        objectStillPresentAfterDelete: afterList.some((item) => item.id === objectId),
                        failureReason
                    });
                    return { success: false, reason: failureReason };
                }
            }

            if (this.projectStore.getObject(activeLevel.id, objectId)) {
                this.projectStore.deleteObject(activeLevel.id, objectId);
            }
            this.syncProjectStoreMirror();
            const afterList = this.listObjects();
            objectDiag('[ObjectAuthoringService:delete]', {
                phase: 'result',
                objectIdReceived: objectId,
                objectFoundInServiceList: true,
                objectType: objectData.settings.type,
                objectCategory: objectData.settings.category,
                runtimeRootIdUsed: objectId,
                callingRuntimeRemove: hasRuntimeLink,
                removeResult: hasRuntimeLink ? runtimeRemoved : true,
                serviceListCountBefore: beforeList.length,
                serviceListCountAfter: afterList.length,
                objectStillPresentAfterDelete: afterList.some((item) => item.id === objectId),
                failureReason: null
            });
            return { success: true };
        } catch (error) {
            const asError = error instanceof Error ? error : new Error(String(error));
            objectDiag('[ObjectAuthoringService:delete]', {
                phase: 'exception',
                objectId,
                errorName: asError.name,
                errorMessage: asError.message,
                errorStack: asError.stack ?? null
            });
            return { success: false, reason: `exception: ${asError.message}` };
        }
    }

    public updateObjectBounds(
        objectId: string,
        boundsPatch: Partial<EditorObjectBoundsData>
    ): UpdateObjectBoundsResult {
        try {
            this.syncProjectStoreMirror();
            const beforeList = this.listObjects();
            const activeLevel = this.projectStore.getActiveLevel();
            const current = this.projectStore.getObject(activeLevel.id, objectId);
            if (!current) {
                const reason = 'Object is not present in active runtime level.';
                objectDiag('[ObjectAuthoringService:updateBounds]', {
                    objectId,
                    patch: boundsPatch,
                    success: false,
                    reason
                });
                return { success: false, reason };
            }

            const nextBounds: EditorObjectBoundsData = {
                ...current.bounds,
                ...boundsPatch
            };
            const hasRuntimeLink = this.legacyObjectAdapter?.hasRuntimeLink(objectId) ?? false;
            if (hasRuntimeLink) {
                const moved = this.legacyObjectAdapter?.moveRuntimeObject(objectId, nextBounds) ?? false;
                if (!moved) {
                    const reason = `Runtime refused bounds update for type "${current.settings.type}".`;
                    objectDiag('[ObjectAuthoringService:updateBounds]', {
                        objectId,
                        patch: boundsPatch,
                        success: false,
                        reason
                    });
                    return { success: false, reason };
                }
                this.syncProjectStoreMirror();
                objectDiag('[ObjectAuthoringService:updateBounds]', {
                    objectId,
                    patch: boundsPatch,
                    success: true,
                    reason: null,
                    serviceListCountBefore: beforeList.length,
                    serviceListCountAfter: this.listObjects().length
                });
                return { success: true };
            }

            if (this.isKnownRuntimeType(current.settings.type)) {
                const reason = 'Object has no live runtime link.';
                objectDiag('[ObjectAuthoringService:updateBounds]', {
                    objectId,
                    patch: boundsPatch,
                    success: false,
                    reason
                });
                return { success: false, reason };
            }

            this.projectStore.updateObject(activeLevel.id, objectId, { bounds: boundsPatch });
            objectDiag('[ObjectAuthoringService:updateBounds]', {
                objectId,
                patch: boundsPatch,
                success: true,
                reason: null
            });
            return { success: true };
        } catch (error) {
            const asError = error instanceof Error ? error : new Error(String(error));
            const reason = `exception: ${asError.message}`;
            objectDiag('[ObjectAuthoringService:updateBounds]', {
                objectId,
                patch: boundsPatch,
                success: false,
                reason
            });
            return { success: false, reason };
        }
    }

    public syncProjectStoreMirror(): void {
        if (!this.legacyObjectAdapter) {
            return;
        }

        this.legacyObjectAdapter.syncIntoProjectStore(this.projectStore);
        const activeLevelId = this.projectStore.getActiveLevel().id;
        const objects = this.projectStore.listObjects(activeLevelId);
        objects.forEach((objectData) => {
            if (!this.isKnownRuntimeType(objectData.settings.type)) {
                return;
            }
            if (this.legacyObjectAdapter?.hasRuntimeLink(objectData.id)) {
                return;
            }
            if (this.projectStore.getObject(activeLevelId, objectData.id)) {
                this.projectStore.deleteObject(activeLevelId, objectData.id);
            }
        });
    }

    private isKnownRuntimeType(typeId: string): boolean {
        const resolved = this.objectTypeRegistry.resolveId(typeId) ?? typeId;
        return KNOWN_RUNTIME_OBJECT_TYPES.has(resolved);
    }
}
