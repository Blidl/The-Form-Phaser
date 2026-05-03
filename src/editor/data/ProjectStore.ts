import {
    createDefaultEditorObjectData,
    type EditorObjectData
} from './EditorObjectData';
import { createDefaultLevelData, type LevelData } from './LevelData';
import type { ProjectData } from './ProjectData';
import { createDefaultProjectData } from './defaultProjectData';
import { createNextLevelId, createNextObjectId } from './idFactory';
import {
    createDefaultObjectTypeRegistry,
    type ObjectTypeRegistry
} from './ObjectTypeRegistry';

const cloneSerializable = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data)) as T;
};

export interface ProjectStoreOptions {
    projectData?: ProjectData;
    objectTypeRegistry?: ObjectTypeRegistry;
}

export interface EnsureLevelOptions {
    id: string;
    name?: string;
    width?: number;
    height?: number;
}

export class ProjectStore {
    private readonly objectTypeRegistry: ObjectTypeRegistry;
    private project: ProjectData;
    private dirty = false;

    public constructor(options: ProjectStoreOptions = {}) {
        this.objectTypeRegistry = options.objectTypeRegistry ?? createDefaultObjectTypeRegistry();
        this.project = cloneSerializable(options.projectData ?? createDefaultProjectData());
        this.project.levelSequence = this.project.levelSequence ?? {
            startLevelId: '',
            transitions: []
        };
        this.project.levelSequence.transitions = this.project.levelSequence.transitions ?? [];

        if (this.project.levels.length === 0) {
            const fallbackLevelId = createNextLevelId([]);
            this.project.levels.push(createDefaultLevelData({ id: fallbackLevelId, name: 'Level 1' }));
            this.project.activeLevelId = fallbackLevelId;
            this.project.levelSequence.startLevelId = fallbackLevelId;
        }

        const hasActiveLevel = this.project.levels.some((level) => level.id === this.project.activeLevelId);
        if (!hasActiveLevel) {
            this.project.activeLevelId = this.project.levels[0].id;
        }
        const hasStartLevel = this.project.levels.some(
            (level) => level.id === this.project.levelSequence.startLevelId
        );
        if (!hasStartLevel) {
            this.project.levelSequence.startLevelId = this.project.levels[0].id;
        }
    }

    public getProject(): ProjectData {
        return cloneSerializable(this.project);
    }

    public getObjectTypeRegistry(): ObjectTypeRegistry {
        return this.objectTypeRegistry;
    }

    public getGridSettings() {
        return cloneSerializable(this.project.grid);
    }

    public setGridEnabled(enabled: boolean): void {
        if (this.project.grid.enabled === enabled) {
            return;
        }
        this.project.grid.enabled = enabled;
        this.markDirty();
    }

    public setGridSnapEnabled(enabled: boolean): void {
        if (this.project.grid.snapEnabled === enabled) {
            return;
        }
        this.project.grid.snapEnabled = enabled;
        this.markDirty();
    }

    public setGridSize(size: number): void {
        if (!Number.isFinite(size)) {
            return;
        }
        const nextSize = Math.max(1, Math.round(size));
        if (this.project.grid.size === nextSize) {
            return;
        }
        this.project.grid.size = nextSize;
        this.markDirty();
    }

    public getActiveLevel(): LevelData {
        return cloneSerializable(this.getLevelOrThrow(this.project.activeLevelId));
    }

    public setActiveLevel(levelId: string): void {
        this.getLevelOrThrow(levelId);
        if (this.project.activeLevelId === levelId) {
            return;
        }
        this.project.activeLevelId = levelId;
        this.markDirty();
    }

    public hasLevel(levelId: string): boolean {
        return this.project.levels.some((level) => level.id === levelId);
    }

    public ensureLevel(options: EnsureLevelOptions): LevelData {
        const existing = this.project.levels.find((level) => level.id === options.id);
        if (!existing) {
            const nextLevel = createDefaultLevelData({
                id: options.id,
                name: options.name ?? options.id,
                width: options.width,
                height: options.height
            });
            this.project.levels.push(nextLevel);
            this.markDirty();
            return cloneSerializable(nextLevel);
        }

        let changed = false;
        const nextName = options.name?.trim();
        if (nextName && nextName !== existing.name) {
            existing.name = nextName;
            changed = true;
        }
        if (typeof options.width === 'number' && Number.isFinite(options.width) && options.width > 0) {
            if (existing.width !== options.width) {
                existing.width = options.width;
                changed = true;
            }
        }
        if (typeof options.height === 'number' && Number.isFinite(options.height) && options.height > 0) {
            if (existing.height !== options.height) {
                existing.height = options.height;
                changed = true;
            }
        }
        if (changed) {
            this.markDirty();
        }
        return cloneSerializable(existing);
    }

    public createLevel(): LevelData {
        const levelId = createNextLevelId(this.project.levels.map((level) => level.id));
        const level = createDefaultLevelData({
            id: levelId,
            name: `Level ${this.project.levels.length + 1}`
        });

        this.project.levels.push(level);
        this.project.activeLevelId = level.id;
        this.markDirty();

        return cloneSerializable(level);
    }

    public deleteLevel(levelId: string): void {
        const levelIndex = this.project.levels.findIndex((level) => level.id === levelId);
        if (levelIndex < 0) {
            throw new Error(`Cannot delete unknown level: ${levelId}`);
        }
        if (this.project.levels.length === 1) {
            throw new Error('Cannot delete the last level in the project.');
        }

        this.project.levels.splice(levelIndex, 1);
        this.project.levelSequence.transitions = this.project.levelSequence.transitions.filter((transition) => {
            return transition.targetLevelId !== levelId;
        });

        if (this.project.levelSequence.startLevelId === levelId) {
            this.project.levelSequence.startLevelId = this.project.levels[0].id;
        }
        if (this.project.activeLevelId === levelId) {
            this.project.activeLevelId = this.project.levels[0].id;
        }

        this.markDirty();
    }

    public renameLevel(levelId: string, name: string): void {
        const nextName = name.trim();
        if (!nextName) {
            throw new Error('Level name cannot be empty.');
        }

        const level = this.getLevelOrThrow(levelId);
        level.name = nextName;
        this.markDirty();
    }

    public resizeLevel(levelId: string, width: number, height: number): void {
        if (!Number.isFinite(width) || width <= 0) {
            throw new Error(`Level width must be > 0. Received: ${width}`);
        }
        if (!Number.isFinite(height) || height <= 0) {
            throw new Error(`Level height must be > 0. Received: ${height}`);
        }

        const level = this.getLevelOrThrow(levelId);
        level.width = width;
        level.height = height;
        this.markDirty();
    }

    public addObject(levelId: string, objectData: Partial<EditorObjectData>): EditorObjectData {
        const level = this.getLevelOrThrow(levelId);
        const objectId = objectData.id ?? createNextObjectId(level.objects.map((obj) => obj.id));
        if (level.objects.some((obj) => obj.id === objectId)) {
            throw new Error(`Object id already exists on level ${levelId}: ${objectId}`);
        }

        const typeId = objectData.settings?.type ?? 'platform_default';
        const typeDefinition = this.objectTypeRegistry.getDefinition(typeId);
        if (!typeDefinition) {
            throw new Error(`Unknown object type: ${typeId}`);
        }

        const object = createDefaultEditorObjectData({
            id: objectId,
            name: objectData.name ?? `${typeDefinition.label} ${objectId}`,
            bounds: objectData.bounds,
            visual: objectData.visual,
            settings: {
                ...objectData.settings,
                type: typeId,
                category: objectData.settings?.category ?? typeDefinition.category,
                collision: objectData.settings?.collision ?? typeDefinition.defaultCollision
            },
            actions: objectData.actions,
            editor: objectData.editor
        });

        level.objects.push(object);
        this.markDirty();

        return cloneSerializable(object);
    }

    public updateObject(levelId: string, objectId: string, patch: Partial<EditorObjectData>): EditorObjectData {
        if (patch.id && patch.id !== objectId) {
            throw new Error('Object ids are stable and cannot be changed.');
        }

        const level = this.getLevelOrThrow(levelId);
        const objectIndex = level.objects.findIndex((obj) => obj.id === objectId);
        if (objectIndex < 0) {
            throw new Error(`Cannot update unknown object: ${objectId}`);
        }

        const current = level.objects[objectIndex];
        const nextSettings = {
            ...current.settings,
            ...patch.settings
        };

        if (patch.settings?.type !== undefined) {
            const typeDefinition = this.objectTypeRegistry.getDefinition(nextSettings.type);
            if (!typeDefinition) {
                throw new Error(`Unknown object type: ${nextSettings.type}`);
            }
            if (patch.settings.category === undefined) {
                nextSettings.category = typeDefinition.category;
            }
            if (patch.settings.collision === undefined) {
                nextSettings.collision = typeDefinition.defaultCollision;
            }
        }

        const nextObject: EditorObjectData = {
            id: current.id,
            name: patch.name ?? current.name,
            bounds: {
                ...current.bounds,
                ...patch.bounds
            },
            visual: {
                ...current.visual,
                ...patch.visual
            },
            settings: nextSettings,
            actions: {
                ...current.actions,
                ...patch.actions,
                actionScriptIds: patch.actions?.actionScriptIds
                    ? [...patch.actions.actionScriptIds]
                    : [...current.actions.actionScriptIds]
            },
            editor: patch.editor
                ? {
                      ...(current.editor ?? {}),
                      ...patch.editor
                  }
                : current.editor
        };

        level.objects[objectIndex] = nextObject;
        this.markDirty();

        return cloneSerializable(nextObject);
    }

    public deleteObject(levelId: string, objectId: string): void {
        const level = this.getLevelOrThrow(levelId);
        const objectIndex = level.objects.findIndex((obj) => obj.id === objectId);
        if (objectIndex < 0) {
            throw new Error(`Cannot delete unknown object: ${objectId}`);
        }

        level.objects.splice(objectIndex, 1);
        this.markDirty();
    }

    public getObject(levelId: string, objectId: string): EditorObjectData | undefined {
        const level = this.getLevelOrThrow(levelId);
        const object = level.objects.find((obj) => obj.id === objectId);
        return object ? cloneSerializable(object) : undefined;
    }

    public hasObject(levelId: string, objectId: string): boolean {
        return this.getObject(levelId, objectId) !== undefined;
    }

    public listObjects(levelId: string): EditorObjectData[] {
        const level = this.getLevelOrThrow(levelId);
        return cloneSerializable(level.objects);
    }

    public markDirty(): void {
        this.dirty = true;
    }

    public clearDirty(): void {
        this.dirty = false;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    private getLevelOrThrow(levelId: string): LevelData {
        const level = this.project.levels.find((item) => item.id === levelId);
        if (!level) {
            throw new Error(`Unknown level id: ${levelId}`);
        }
        return level;
    }
}
