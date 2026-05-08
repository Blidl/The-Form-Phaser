import type { EditorObjectBoundsData, EditorObjectCategory } from '../data/EditorObjectData';
import type { ObjectTypeRegistry } from '../data/ObjectTypeRegistry';
import type { ProjectStore } from '../data/ProjectStore';
import { objectDiag } from '../debug/ObjectEditorDiagnostics';

export interface LegacyObjectBounds {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
}

export interface LegacyObjectSummary {
    id?: string | null;
    type: string;
    label?: string;
    locked?: boolean;
    onlyDebugView?: boolean;
    runtimeVisual?: {
        fillColor?: string;
        strokeColor?: string;
        alpha?: number;
        layer?: number;
        shaderKey?: string | null;
        textureKey?: string | null;
    };
}

export interface LegacyObjectHandle {
    id: string;
    rootId: string;
    type: string;
    part: string;
    getBounds: () => LegacyObjectBounds;
    containsPoint: (worldX: number, worldY: number) => boolean;
}

export interface LegacyWorldBounds {
    width: number;
    height: number;
}

export interface LegacyObjectSource {
    getLevelId: () => string;
    getLevelDisplayName?: () => string;
    getWorldBounds?: () => LegacyWorldBounds;
    getRuntimeConfig?: () => unknown;
    getWorldOnStartLogicTrace?: () => unknown;
    getRuntimeWorldFlagsSnapshot?: () => Record<string, boolean>;
    getLastObjectInteractionTrace?: () => unknown;
    getLastNpcInteractionTrace?: () => unknown;
    getLastCutsceneLogicTrace?: () => unknown;
    getLastTriggerOnEnterLogicTrace?: () => unknown;
    getSurfaceMoveRuntimeDebugSnapshot?: () => unknown;
    getGameplayTimeState?: () => { stopped: boolean; speed: number };
    setGameplayStopped?: (stopped: boolean) => void;
    setGameplaySpeed?: (speed: number) => void;
    saveRuntimeConfig?: () => {
        success: boolean;
        source: 'runtimeConfig' | 'legacySave' | 'exportJson' | 'localStorage';
        reason?: string;
        levelId?: string;
        objectCounts?: Record<string, number>;
    };
    importRuntimeConfig?: (
        config: unknown,
        options?: { mode?: 'runtime_patch' | 'full_import' }
    ) => {
        success: boolean;
        source: 'runtimeConfig';
        reason?: string;
        levelId?: string;
        objectCounts?: Record<string, number>;
    };
    listObjects: () => readonly LegacyObjectSummary[];
    listHandles: () => readonly LegacyObjectHandle[];
    patchHandleBounds: (handleId: string, bounds: LegacyObjectBounds) => boolean;
    patchObjectFields?: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectColors?: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectDebugVisibility?: (rootId: string, onlyDebugView: boolean) => boolean;
    setObjectLocked?: (rootId: string, locked: boolean) => boolean;
    setEditorDebugViewActive?: (active: boolean) => void;
    setSurfaceMoveRuntimeEditingActive?: (rootId: string, active: boolean) => boolean;
    createObject: (type: string, worldX: number, worldY: number) => string | null;
    removeObject?: (id: string) => boolean;
}

export interface RuntimeCatalogCreateResult {
    requestedEditorTypeId: string;
    resolvedEditorTypeId: string;
    legacyType: string | null;
    legacyId: string | null;
    success: boolean;
    error?: string;
}

interface LegacyObjectLink {
    legacyId: string;
    legacyType: string;
    primaryHandleId: string | null;
}

const LEGACY_TO_EDITOR_TYPE_ID: Record<string, string> = {
    surface: 'platform_default',
    movingPlatform: 'moving_platform',
    triggerPlatform: 'trigger_platform',
    checkpoint: 'checkpoint',
    playerSpawn: 'player_spawn',
    finish: 'finish',
    windZone: 'wind_zone',
    triggerVolume: 'trigger_volume',
    trianglePickup: 'triangle_pickup',
    dragBox: 'drag_box',
    hazard: 'hazard',
    triangleFlightBreakWall: 'break_wall'
};

const EDITOR_TO_LEGACY_TYPE: Record<string, string> = {
    platform_default: 'surface',
    moving_platform: 'movingPlatform',
    trigger_platform: 'triggerPlatform',
    checkpoint: 'checkpoint',
    player_spawn: 'playerSpawn',
    finish: 'finish',
    wind_zone: 'windZone',
    trigger_volume: 'triggerVolume',
    triangle_pickup: 'trianglePickup',
    drag_box: 'dragBox',
    hazard: 'hazard',
    break_wall: 'triangleFlightBreakWall'
};

const isExcludedLegacyType = (legacyType: string): boolean => {
    return legacyType === 'npc';
};

const createLegacyTypeCategory = (legacyType: string): EditorObjectCategory => {
    if (legacyType === 'surface' || legacyType === 'movingPlatform' || legacyType === 'triggerPlatform') {
        return 'platforms';
    }
    if (
        legacyType === 'playerSpawn'
        || legacyType === 'checkpoint'
        || legacyType === 'finish'
        || legacyType === 'windZone'
        || legacyType === 'triggerVolume'
    ) {
        return 'special';
    }
    return 'objects';
};

const boundsCenterToTopLeft = (bounds: LegacyObjectBounds, fallbackRotation = 0): EditorObjectBoundsData => {
    const resolvedRotation = Number.isFinite(bounds.rotation) ? bounds.rotation : fallbackRotation;
    return {
        x: bounds.x - (bounds.width * 0.5),
        y: bounds.y - (bounds.height * 0.5),
        width: bounds.width,
        height: bounds.height,
        rotation: resolvedRotation
    };
};

const boundsTopLeftToCenter = (bounds: EditorObjectBoundsData): LegacyObjectBounds => {
    return {
        x: bounds.x + (bounds.width * 0.5),
        y: bounds.y + (bounds.height * 0.5),
        width: bounds.width,
        height: bounds.height,
        rotation: bounds.rotation
    };
};

const selectPrimaryHandle = (handles: readonly LegacyObjectHandle[]): LegacyObjectHandle | null => {
    if (handles.length === 0) {
        return null;
    }

    const rankPart = (part: string): number => {
        if (part === 'main') {
            return 0;
        }
        if (part === 'platform') {
            return 1;
        }
        if (part === 'trigger') {
            return 2;
        }
        if (part === 'body') {
            return 3;
        }
        if (part === 'visual') {
            return 4;
        }
        if (part === 'deactivateTrigger') {
            return 5;
        }
        return 6;
    };

    const sorted = [...handles].sort((left, right) => rankPart(left.part) - rankPart(right.part));
    return sorted[0] ?? null;
};

const areBoundsEqual = (left: EditorObjectBoundsData, right: EditorObjectBoundsData): boolean => {
    return left.x === right.x
        && left.y === right.y
        && left.width === right.width
        && left.height === right.height
        && left.rotation === right.rotation;
};

export class LegacyObjectAdapter {
    private readonly source: LegacyObjectSource;
    private readonly objectTypeRegistry: ObjectTypeRegistry;
    private readonly linksByEditorObjectId = new Map<string, LegacyObjectLink>();
    private readonly generatedLegacyIdsByKey = new Map<string, string>();
    private readonly ignoredLegacyIds = new Set<string>();
    private readonly runtimeVisualByEditorObjectId = new Map<string, {
        fillColor?: string;
        strokeColor?: string;
        alpha?: number;
        layer?: number;
        shaderKey?: string | null;
        textureKey?: string | null;
    }>();
    private nextGeneratedLegacyId = 1;

    public constructor(source: LegacyObjectSource, objectTypeRegistry: ObjectTypeRegistry) {
        this.source = source;
        this.objectTypeRegistry = objectTypeRegistry;
    }

    public getLevelId(): string {
        return this.source.getLevelId();
    }

    public getRuntimeConfig(): unknown | null {
        return this.source.getRuntimeConfig?.() ?? null;
    }

    public getWorldOnStartLogicTrace(): unknown | null {
        return this.source.getWorldOnStartLogicTrace?.() ?? null;
    }

    public getRuntimeWorldFlagsSnapshot(): Record<string, boolean> | null {
        const snapshot = this.source.getRuntimeWorldFlagsSnapshot?.();
        if (!snapshot || typeof snapshot !== 'object') {
            return null;
        }
        return { ...snapshot };
    }

    public getLastObjectInteractionTrace(): unknown | null {
        const trace = this.source.getLastObjectInteractionTrace?.();
        if (!trace || typeof trace !== 'object') {
            return null;
        }
        return JSON.parse(JSON.stringify(trace));
    }

    public getLastNpcInteractionTrace(): unknown | null {
        const trace = this.source.getLastNpcInteractionTrace?.();
        if (!trace || typeof trace !== 'object') {
            return null;
        }
        return JSON.parse(JSON.stringify(trace));
    }

    public getLastCutsceneLogicTrace(): unknown | null {
        const trace = this.source.getLastCutsceneLogicTrace?.();
        if (!trace || typeof trace !== 'object') {
            return null;
        }
        return JSON.parse(JSON.stringify(trace));
    }

    public getLastTriggerOnEnterLogicTrace(): unknown | null {
        const trace = this.source.getLastTriggerOnEnterLogicTrace?.();
        if (!trace || typeof trace !== 'object') {
            return null;
        }
        return JSON.parse(JSON.stringify(trace));
    }

    public getSurfaceMoveRuntimeDebugSnapshot(): unknown | null {
        const snapshot = this.source.getSurfaceMoveRuntimeDebugSnapshot?.();
        if (!snapshot || typeof snapshot !== 'object') {
            return null;
        }
        return JSON.parse(JSON.stringify(snapshot));
    }

    public getGameplayTimeState(): { stopped: boolean; speed: number } | null {
        const state = this.source.getGameplayTimeState?.();
        if (!state || typeof state !== 'object') {
            return null;
        }
        if (typeof state.stopped !== 'boolean' || typeof state.speed !== 'number' || !Number.isFinite(state.speed)) {
            return null;
        }
        return {
            stopped: state.stopped,
            speed: state.speed
        };
    }

    public setGameplayStopped(stopped: boolean): void {
        this.source.setGameplayStopped?.(stopped);
    }

    public setGameplaySpeed(speed: number): void {
        this.source.setGameplaySpeed?.(speed);
    }

    public saveRuntimeConfig(): {
        success: boolean;
        source: 'runtimeConfig' | 'legacySave' | 'exportJson' | 'localStorage';
        reason?: string;
        levelId?: string;
        objectCounts?: Record<string, number>;
    } | null {
        return this.source.saveRuntimeConfig?.() ?? null;
    }

    public importRuntimeConfig(
        config: unknown,
        options?: { mode?: 'runtime_patch' | 'full_import' }
    ): {
        success: boolean;
        source: 'runtimeConfig';
        reason?: string;
        levelId?: string;
        objectCounts?: Record<string, number>;
    } | null {
        return this.source.importRuntimeConfig?.(config, options) ?? null;
    }

    public syncIntoProjectStore(projectStore: ProjectStore): void {
        const levelId = this.normalizeLevelId(this.source.getLevelId());
        const worldBounds = this.source.getWorldBounds?.();
        projectStore.ensureLevel({
            id: levelId,
            name: this.source.getLevelDisplayName?.() ?? levelId,
            width: worldBounds?.width,
            height: worldBounds?.height
        });
        if (projectStore.getActiveLevel().id !== levelId) {
            projectStore.setActiveLevel(levelId);
        }

        const handlesByRootId = this.groupHandlesByRootId(this.source.listHandles());
        const activeEditorIds = new Set<string>();
        const summaries = this.source.listObjects();

        summaries.forEach((summary, index) => {
            if (isExcludedLegacyType(summary.type)) {
                return;
            }

            const legacyId = this.resolveLegacyId(summary, index);
            if (this.ignoredLegacyIds.has(legacyId)) {
                return;
            }
            const editorObjectId = legacyId;
            const handles = handlesByRootId.get(legacyId) ?? [];
            const primaryHandle = selectPrimaryHandle(handles);
            const current = projectStore.getObject(levelId, editorObjectId);
            const fallbackBounds: EditorObjectBoundsData = {
                x: 0,
                y: 0,
                width: 64,
                height: 64,
                rotation: 0
            };
            const bounds = primaryHandle
                ? boundsCenterToTopLeft(primaryHandle.getBounds(), current?.bounds.rotation ?? 0)
                : fallbackBounds;
            const resolvedTypeId = this.resolveEditorTypeId(summary.type);
            const typeDefinition = this.objectTypeRegistry.getDefinition(resolvedTypeId);
            const category = typeDefinition?.category ?? createLegacyTypeCategory(summary.type);
            const name = summary.label?.trim() || legacyId;
            const nextLocked = summary.locked ?? current?.editor?.locked ?? false;
            const summaryVisual = summary.runtimeVisual ?? {};
            const nextVisual = {
                shaderKey: summaryVisual.shaderKey ?? current?.visual.shaderKey ?? null,
                textureKey: summaryVisual.textureKey ?? current?.visual.textureKey ?? null,
                fillColor: summaryVisual.fillColor ?? current?.visual.fillColor ?? '#ffffff',
                strokeColor: summaryVisual.strokeColor ?? current?.visual.strokeColor ?? '#000000',
                alpha: Number.isFinite(summaryVisual.alpha) ? Number(summaryVisual.alpha) : (current?.visual.alpha ?? 1),
                layer: Number.isInteger(summaryVisual.layer) ? Number(summaryVisual.layer) : (current?.visual.layer ?? 3),
                onlyDebugView: summary.onlyDebugView ?? current?.visual.onlyDebugView ?? false
            };
            if (!current) {
                projectStore.addObject(levelId, {
                    id: editorObjectId,
                    name,
                    bounds,
                    settings: {
                        type: resolvedTypeId,
                        category
                    },
                    editor: {
                        locked: nextLocked
                    },
                    visual: nextVisual
                });
            } else {
                objectDiag('[ObjectVisualSync]', {
                    phase: 'sync',
                    objectId: editorObjectId,
                    sourceVisual: summaryVisual,
                    projectStoreVisualBefore: current.visual,
                    configVisual: summaryVisual,
                    usedDefault: !summaryVisual.fillColor && !summaryVisual.strokeColor && !summaryVisual.alpha && !summaryVisual.layer,
                    reason: 'syncIntoProjectStore'
                });
                const needsSync = current.name !== name
                    || current.settings.type !== resolvedTypeId
                    || current.settings.category !== category
                    || current.editor?.locked !== nextLocked
                    || current.visual.onlyDebugView !== nextVisual.onlyDebugView
                    || current.visual.fillColor !== nextVisual.fillColor
                    || current.visual.strokeColor !== nextVisual.strokeColor
                    || current.visual.alpha !== nextVisual.alpha
                    || current.visual.layer !== nextVisual.layer
                    || current.visual.shaderKey !== nextVisual.shaderKey
                    || current.visual.textureKey !== nextVisual.textureKey
                    || !areBoundsEqual(current.bounds, bounds);

                if (needsSync) {
                    projectStore.updateObject(levelId, editorObjectId, {
                        name,
                        bounds,
                        settings: {
                            type: resolvedTypeId,
                            category
                        },
                        editor: {
                            locked: nextLocked
                        },
                        visual: nextVisual
                    });
                    objectDiag('[ObjectVisualSync]', {
                        phase: 'sync',
                        objectId: editorObjectId,
                        sourceVisual: summaryVisual,
                        projectStoreVisualBefore: current.visual,
                        projectStoreVisualAfter: nextVisual,
                        configVisual: summaryVisual,
                        usedDefault: false,
                        reason: 'projectStore visual updated'
                    });
                }
            }

            this.linksByEditorObjectId.set(editorObjectId, {
                legacyId,
                legacyType: summary.type,
                primaryHandleId: primaryHandle?.id ?? null
            });
            if (summary.runtimeVisual) {
                this.runtimeVisualByEditorObjectId.set(editorObjectId, { ...summary.runtimeVisual });
            } else {
                this.runtimeVisualByEditorObjectId.delete(editorObjectId);
            }
            activeEditorIds.add(editorObjectId);
        });

        [...this.linksByEditorObjectId.keys()].forEach((editorObjectId) => {
            if (activeEditorIds.has(editorObjectId)) {
                return;
            }
            if (projectStore.getObject(levelId, editorObjectId)) {
                projectStore.deleteObject(levelId, editorObjectId);
            }
            this.linksByEditorObjectId.delete(editorObjectId);
            this.runtimeVisualByEditorObjectId.delete(editorObjectId);
        });
    }

    public getRuntimeVisual(editorObjectId: string): {
        fillColor?: string;
        strokeColor?: string;
        alpha?: number;
        layer?: number;
        shaderKey?: string | null;
        textureKey?: string | null;
    } | null {
        const visual = this.runtimeVisualByEditorObjectId.get(editorObjectId);
        return visual ? { ...visual } : null;
    }

    public hasRuntimeLink(editorObjectId: string): boolean {
        return this.linksByEditorObjectId.has(editorObjectId);
    }

    public findObjectIdAtPoint(worldX: number, worldY: number): string | null {
        const handles = this.source.listHandles();
        for (let index = handles.length - 1; index >= 0; index -= 1) {
            const handle = handles[index];
            const editorObjectId = this.findEditorObjectIdByLegacyRootId(handle.rootId);
            if (!editorObjectId) {
                continue;
            }
            if (handle.containsPoint(worldX, worldY)) {
                return editorObjectId;
            }
        }
        return null;
    }

    public moveRuntimeObject(editorObjectId: string, boundsTopLeft: EditorObjectBoundsData): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !link.primaryHandleId) {
            return false;
        }
        const nextBounds = boundsTopLeftToCenter(boundsTopLeft);
        return this.source.patchHandleBounds(link.primaryHandleId, nextBounds);
    }

    public createLegacyObjectForType(editorTypeId: string, worldX: number, worldY: number): string | null {
        return this.createRuntimeObjectFromCatalog(editorTypeId, worldX, worldY).legacyId;
    }

    public createRuntimeObjectFromCatalog(
        editorTypeId: string,
        worldX: number,
        worldY: number
    ): RuntimeCatalogCreateResult {
        const resolvedEditorTypeId = this.objectTypeRegistry.resolveId(editorTypeId) ?? editorTypeId;
        const typeDefinition = this.objectTypeRegistry.getDefinition(resolvedEditorTypeId);
        const legacyType = typeDefinition?.runtimeType ?? EDITOR_TO_LEGACY_TYPE[resolvedEditorTypeId] ?? null;
        if (!legacyType) {
            return {
                requestedEditorTypeId: editorTypeId,
                resolvedEditorTypeId,
                legacyType: null,
                legacyId: null,
                success: false,
                error: `No runtime type mapping for editor type "${resolvedEditorTypeId}".`
            };
        }

        try {
            const legacyId = this.source.createObject(legacyType, worldX, worldY);
            return {
                requestedEditorTypeId: editorTypeId,
                resolvedEditorTypeId,
                legacyType,
                legacyId,
                success: !!legacyId,
                error: legacyId ? undefined : `Runtime createObject returned null for "${legacyType}".`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                requestedEditorTypeId: editorTypeId,
                resolvedEditorTypeId,
                legacyType,
                legacyId: null,
                success: false,
                error: `Runtime createObject threw for "${legacyType}": ${message}`
            };
        }
    }

    public removeRuntimeObject(editorObjectId: string): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !this.source.removeObject) {
            objectDiag('[LegacyAdapter:delete]', {
                editorObjectId,
                linkExists: !!link,
                legacyId: link?.legacyId ?? null,
                legacyType: link?.legacyType ?? null,
                primaryHandleId: link?.primaryHandleId ?? null,
                removeResult: false,
                ignoredLegacyIdsUpdated: false
            });
            return false;
        }
        const removed = this.source.removeObject(link.legacyId);
        let ignoredLegacyIdsUpdated = false;
        if (removed) {
            this.ignoredLegacyIds.add(link.legacyId);
            this.linksByEditorObjectId.delete(editorObjectId);
            ignoredLegacyIdsUpdated = true;
        }
        objectDiag('[LegacyAdapter:delete]', {
            editorObjectId,
            linkExists: true,
            legacyId: link.legacyId,
            legacyType: link.legacyType,
            primaryHandleId: link.primaryHandleId,
            removeResult: removed,
            ignoredLegacyIdsUpdated
        });
        return removed;
    }

    public patchRuntimeObjectFields(editorObjectId: string, patch: Record<string, unknown>): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !this.source.patchObjectFields) {
            return false;
        }
        return this.source.patchObjectFields(link.legacyId, patch);
    }

    public patchRuntimeObjectColors(editorObjectId: string, patch: Record<string, unknown>): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !this.source.patchObjectColors) {
            return false;
        }
        return this.source.patchObjectColors(link.legacyId, patch);
    }

    public patchRuntimeObjectDebugVisibility(editorObjectId: string, onlyDebugView: boolean): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !this.source.patchObjectDebugVisibility) {
            return false;
        }
        return this.source.patchObjectDebugVisibility(link.legacyId, onlyDebugView);
    }

    public setRuntimeObjectLocked(editorObjectId: string, locked: boolean): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !this.source.setObjectLocked) {
            return false;
        }
        return this.source.setObjectLocked(link.legacyId, locked);
    }

    public setEditorDebugViewActive(active: boolean): void {
        this.source.setEditorDebugViewActive?.(active);
    }

    public setSurfaceMoveRuntimeEditingActive(editorObjectId: string, active: boolean): boolean {
        const link = this.linksByEditorObjectId.get(editorObjectId);
        if (!link || !this.source.setSurfaceMoveRuntimeEditingActive) {
            return false;
        }
        return this.source.setSurfaceMoveRuntimeEditingActive(link.legacyId, active);
    }

    private resolveEditorTypeId(legacyType: string): string {
        const mappedType = LEGACY_TO_EDITOR_TYPE_ID[legacyType] ?? legacyType;
        const resolvedAlias = this.objectTypeRegistry.resolveId(mappedType);
        if (resolvedAlias) {
            return resolvedAlias;
        }
        return this.objectTypeRegistry.has('platform_default') ? 'platform_default' : mappedType;
    }

    private normalizeLevelId(levelId: string): string {
        const trimmed = levelId.trim();
        return trimmed.length > 0 ? trimmed : 'level_legacy';
    }

    private groupHandlesByRootId(handles: readonly LegacyObjectHandle[]): Map<string, LegacyObjectHandle[]> {
        const grouped = new Map<string, LegacyObjectHandle[]>();
        handles.forEach((handle) => {
            const rootId = handle.rootId?.trim();
            if (!rootId) {
                return;
            }
            const bucket = grouped.get(rootId) ?? [];
            bucket.push(handle);
            grouped.set(rootId, bucket);
        });
        return grouped;
    }

    private resolveLegacyId(summary: LegacyObjectSummary, index: number): string {
        const normalizedId = summary.id?.trim();
        if (normalizedId) {
            return normalizedId;
        }

        const key = `${summary.type}:${summary.label ?? ''}:${index}`;
        const existing = this.generatedLegacyIdsByKey.get(key);
        if (existing) {
            return existing;
        }

        const generatedId = `${summary.type || 'legacy_object'}_${String(this.nextGeneratedLegacyId).padStart(4, '0')}`;
        this.nextGeneratedLegacyId += 1;
        this.generatedLegacyIdsByKey.set(key, generatedId);
        return generatedId;
    }

    private findEditorObjectIdByLegacyRootId(rootId: string): string | null {
        for (const [editorObjectId, link] of this.linksByEditorObjectId.entries()) {
            if (link.legacyId === rootId) {
                return editorObjectId;
            }
        }
        return null;
    }
}
