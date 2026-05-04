import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import {
    cloneTestWorldConfig,
    type TestWorldBackgroundConfig,
    type TestWorldBackgroundLayerScrollFactorConfig,
    type TestWorldBackgroundLayerSettingsConfig,
    type TestWorldBackgroundObjectBoundsConfig,
    type TestWorldBackgroundObjectConfig,
    type TestWorldBackgroundObjectVisualConfig,
    type TestWorldConfig
} from '../../game/world/runtime/test_world_config';

export type BackgroundObjectLayerId = 'static' | 'parallax1' | 'parallax2';

export interface BackgroundObjectSnapshot {
    levelId: string;
    levelName: string;
    backgroundColor?: number;
    objects: TestWorldBackgroundObjectConfig[];
    layerSettings: RequiredBackgroundLayerSettings;
}

export interface RequiredBackgroundLayerSettings {
    static: TestWorldBackgroundLayerScrollFactorConfig;
    parallax1: TestWorldBackgroundLayerScrollFactorConfig;
    parallax2: TestWorldBackgroundLayerScrollFactorConfig;
}

export interface BackgroundObjectMutationResult {
    success: boolean;
    reason?: string;
    object?: TestWorldBackgroundObjectConfig;
    snapshot?: BackgroundObjectSnapshot;
}

export interface CreateBackgroundObjectInput {
    layer: BackgroundObjectLayerId;
    name?: string;
    textureKey?: string;
    textureAsset?: string;
    fillColor?: number;
    bounds?: Partial<TestWorldBackgroundObjectBoundsConfig>;
}

export interface UpdateBackgroundObjectBoundsPatch {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
}

export interface UpdateBackgroundObjectVisualPatch {
    shaderKey?: string;
    textureKey?: string;
    textureAsset?: string;
    fillColor?: number;
    strokeColor?: number;
    alpha?: number;
    tileHorizontalRepeat?: boolean;
    tileVerticalRepeat?: boolean;
}

export interface UpdateBackgroundObjectMetaPatch {
    name?: string;
    layer?: BackgroundObjectLayerId;
    editor?: {
        locked?: boolean;
        hidden?: boolean;
    };
}

export interface DeleteBackgroundObjectOptions {
    force?: boolean;
}

export interface UpdateBackgroundLayerSettingsPatch {
    scrollFactorX?: number;
    scrollFactorY?: number;
}

const DEFAULT_FILL_COLOR = 0x1f2a30;
const DEFAULT_LAYER_SETTINGS: RequiredBackgroundLayerSettings = {
    static: { scrollFactorX: 0, scrollFactorY: 0 },
    parallax1: { scrollFactorX: 0.45, scrollFactorY: 0.45 },
    parallax2: { scrollFactorX: 0.2, scrollFactorY: 0.2 }
};
const LAYER_IDS: readonly BackgroundObjectLayerId[] = ['static', 'parallax1', 'parallax2'];

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const sanitizeColor = (value: unknown): number | undefined => {
    if (!isFiniteNumber(value)) {
        return undefined;
    }
    return clamp(Math.round(value), 0, 0xffffff);
};

const sanitizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const cloneBackgroundObject = (entry: TestWorldBackgroundObjectConfig): TestWorldBackgroundObjectConfig => ({
    id: entry.id,
    name: entry.name,
    layer: entry.layer,
    bounds: {
        x: entry.bounds.x,
        y: entry.bounds.y,
        width: entry.bounds.width,
        height: entry.bounds.height,
        rotation: entry.bounds.rotation
    },
    visual: {
        shaderKey: entry.visual.shaderKey,
        textureKey: entry.visual.textureKey,
        textureAsset: entry.visual.textureAsset,
        fillColor: entry.visual.fillColor,
        strokeColor: entry.visual.strokeColor,
        alpha: entry.visual.alpha,
        tileHorizontalRepeat: entry.visual.tileHorizontalRepeat,
        tileVerticalRepeat: entry.visual.tileVerticalRepeat
    },
    editor: entry.editor
        ? {
            locked: entry.editor.locked,
            hidden: entry.editor.hidden
        }
        : undefined
});

const cloneBackgroundObjects = (
    entries: TestWorldBackgroundObjectConfig[] | undefined
): TestWorldBackgroundObjectConfig[] => {
    return Array.isArray(entries) ? entries.map((entry) => cloneBackgroundObject(entry)) : [];
};

const normalizeLayer = (value: unknown, fallback: BackgroundObjectLayerId): BackgroundObjectLayerId => {
    return value === 'static' || value === 'parallax1' || value === 'parallax2'
        ? value
        : fallback;
};

const normalizeLayerSettings = (
    settings: TestWorldBackgroundLayerSettingsConfig | undefined
): RequiredBackgroundLayerSettings => {
    const normalizeLayerScroll = (
        layer: BackgroundObjectLayerId,
        value: TestWorldBackgroundLayerScrollFactorConfig | undefined
    ): TestWorldBackgroundLayerScrollFactorConfig => {
        const defaults = DEFAULT_LAYER_SETTINGS[layer];
        const scrollFactorX = clamp(
            isFiniteNumber(value?.scrollFactorX) ? value.scrollFactorX : defaults.scrollFactorX,
            0,
            2
        );
        const scrollFactorY = clamp(
            isFiniteNumber(value?.scrollFactorY) ? value.scrollFactorY : defaults.scrollFactorY,
            0,
            2
        );
        if (layer === 'static') {
            return { scrollFactorX: 0, scrollFactorY: 0 };
        }
        return { scrollFactorX, scrollFactorY };
    };

    return {
        static: normalizeLayerScroll('static', settings?.static),
        parallax1: normalizeLayerScroll('parallax1', settings?.parallax1),
        parallax2: normalizeLayerScroll('parallax2', settings?.parallax2)
    };
};

const cloneLayerSettings = (settings: RequiredBackgroundLayerSettings): RequiredBackgroundLayerSettings => ({
    static: { ...settings.static },
    parallax1: { ...settings.parallax1 },
    parallax2: { ...settings.parallax2 }
});

const isRenderableVisual = (visual: TestWorldBackgroundObjectVisualConfig): boolean => {
    const hasTexture = (visual.textureKey?.trim().length ?? 0) > 0
        || (visual.textureAsset?.trim().length ?? 0) > 0;
    const hasFill = isFiniteNumber(visual.fillColor);
    return hasTexture || hasFill;
};

export class BackgroundObjectAuthoringService {
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private nextIdSuffix = 1;

    public constructor(legacyObjectAdapter: LegacyObjectAdapter | null) {
        this.legacyObjectAdapter = legacyObjectAdapter;
    }

    public getSnapshot(): BackgroundObjectSnapshot | null {
        const config = this.getRuntimeConfig();
        if (!config) {
            return null;
        }
        return {
            levelId: config.meta.id,
            levelName: config.meta.displayName,
            backgroundColor: sanitizeColor(config.background?.color),
            objects: cloneBackgroundObjects(config.background?.backgroundObjects),
            layerSettings: cloneLayerSettings(
                normalizeLayerSettings(config.background?.backgroundLayerSettings)
            )
        };
    }

    public listObjects(layer?: BackgroundObjectLayerId): TestWorldBackgroundObjectConfig[] {
        const snapshot = this.getSnapshot();
        if (!snapshot) {
            return [];
        }
        return layer
            ? snapshot.objects.filter((entry) => entry.layer === layer)
            : snapshot.objects;
    }

    public getObject(id: string): TestWorldBackgroundObjectConfig | null {
        const targetId = id.trim();
        if (!targetId) {
            return null;
        }
        const objects = this.listObjects();
        const found = objects.find((entry) => entry.id === targetId);
        return found ? cloneBackgroundObject(found) : null;
    }

    public getLayerSettings(): RequiredBackgroundLayerSettings {
        const config = this.getRuntimeConfig();
        if (!config) {
            return cloneLayerSettings(DEFAULT_LAYER_SETTINGS);
        }
        return cloneLayerSettings(
            normalizeLayerSettings(config.background?.backgroundLayerSettings)
        );
    }

    public getBackgroundColor(): number | undefined {
        const config = this.getRuntimeConfig();
        return sanitizeColor(config?.background?.color);
    }

    public updateBackgroundColor(color: number): BackgroundObjectMutationResult {
        const nextColor = sanitizeColor(color);
        if (nextColor === undefined) {
            return {
                success: false,
                reason: 'Invalid background color.'
            };
        }
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            background.color = nextColor;
            return { success: true };
        });
    }

    public createObject(input: CreateBackgroundObjectInput): BackgroundObjectMutationResult {
        const layer = normalizeLayer(input.layer, 'static');
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            const objects = cloneBackgroundObjects(background.backgroundObjects);
            const id = this.generateObjectId(layer, objects);
            const object = this.createDefaultObject(nextConfig, layer, id, input);
            objects.push(object);
            background.backgroundObjects = objects;
            return {
                success: true,
                object
            };
        });
    }

    public updateObjectBounds(
        id: string,
        patch: UpdateBackgroundObjectBoundsPatch
    ): BackgroundObjectMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            const objects = cloneBackgroundObjects(background.backgroundObjects);
            const objectIndex = this.findObjectIndex(objects, id);
            if (objectIndex < 0) {
                return { success: false, reason: 'Background object not found.' };
            }
            const current = objects[objectIndex];
            if (current.editor?.locked) {
                return { success: false, reason: 'Background object is locked.' };
            }

            const nextBounds = { ...current.bounds };
            let changed = false;
            if (isFiniteNumber(patch.x)) {
                nextBounds.x = patch.x;
                changed = true;
            }
            if (isFiniteNumber(patch.y)) {
                nextBounds.y = patch.y;
                changed = true;
            }
            if (isFiniteNumber(patch.width)) {
                nextBounds.width = Math.max(8, Math.round(patch.width));
                changed = true;
            }
            if (isFiniteNumber(patch.height)) {
                nextBounds.height = Math.max(8, Math.round(patch.height));
                changed = true;
            }
            if (isFiniteNumber(patch.rotation)) {
                nextBounds.rotation = patch.rotation;
                changed = true;
            }
            if (!changed) {
                return { success: false, reason: 'No valid bounds fields to update.' };
            }

            const nextObject = cloneBackgroundObject(current);
            nextObject.bounds = {
                x: nextBounds.x,
                y: nextBounds.y,
                width: nextBounds.width,
                height: nextBounds.height,
                rotation: isFiniteNumber(nextBounds.rotation) ? nextBounds.rotation : 0
            };
            objects[objectIndex] = nextObject;
            background.backgroundObjects = objects;
            return {
                success: true,
                object: nextObject
            };
        });
    }

    public updateObjectVisual(
        id: string,
        patch: UpdateBackgroundObjectVisualPatch
    ): BackgroundObjectMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            const objects = cloneBackgroundObjects(background.backgroundObjects);
            const objectIndex = this.findObjectIndex(objects, id);
            if (objectIndex < 0) {
                return { success: false, reason: 'Background object not found.' };
            }
            const current = objects[objectIndex];
            if (current.editor?.locked) {
                return { success: false, reason: 'Background object is locked.' };
            }

            const candidateVisual: TestWorldBackgroundObjectVisualConfig = {
                ...current.visual
            };
            let changed = false;
            if (Object.prototype.hasOwnProperty.call(patch, 'shaderKey')) {
                candidateVisual.shaderKey = sanitizeOptionalString(patch.shaderKey);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'textureKey')) {
                candidateVisual.textureKey = sanitizeOptionalString(patch.textureKey);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'textureAsset')) {
                candidateVisual.textureAsset = sanitizeOptionalString(patch.textureAsset);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'fillColor')) {
                candidateVisual.fillColor = sanitizeColor(patch.fillColor);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'strokeColor')) {
                candidateVisual.strokeColor = sanitizeColor(patch.strokeColor);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'alpha')) {
                if (isFiniteNumber(patch.alpha)) {
                    candidateVisual.alpha = clamp(patch.alpha, 0, 1);
                    changed = true;
                }
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'tileHorizontalRepeat')) {
                if (typeof patch.tileHorizontalRepeat === 'boolean') {
                    candidateVisual.tileHorizontalRepeat = patch.tileHorizontalRepeat;
                    changed = true;
                }
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'tileVerticalRepeat')) {
                if (typeof patch.tileVerticalRepeat === 'boolean') {
                    candidateVisual.tileVerticalRepeat = patch.tileVerticalRepeat;
                    changed = true;
                }
            }
            if (!changed) {
                return { success: false, reason: 'No valid visual fields to update.' };
            }
            if (!isRenderableVisual(candidateVisual)) {
                return {
                    success: false,
                    reason: 'Background object must keep textureKey, textureAsset, or fillColor.'
                };
            }

            const nextObject = cloneBackgroundObject(current);
            nextObject.visual = candidateVisual;
            objects[objectIndex] = nextObject;
            background.backgroundObjects = objects;
            return {
                success: true,
                object: nextObject
            };
        });
    }

    public updateObjectMeta(
        id: string,
        patch: UpdateBackgroundObjectMetaPatch
    ): BackgroundObjectMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            const objects = cloneBackgroundObjects(background.backgroundObjects);
            const objectIndex = this.findObjectIndex(objects, id);
            if (objectIndex < 0) {
                return { success: false, reason: 'Background object not found.' };
            }
            const current = objects[objectIndex];
            const nextObject = cloneBackgroundObject(current);
            let changed = false;

            if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
                nextObject.name = sanitizeOptionalString(patch.name);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'layer')) {
                if (patch.layer && LAYER_IDS.includes(patch.layer)) {
                    nextObject.layer = patch.layer;
                    changed = true;
                }
            }
            if (patch.editor) {
                const nextEditor = {
                    locked: nextObject.editor?.locked ?? false,
                    hidden: nextObject.editor?.hidden ?? false
                };
                if (Object.prototype.hasOwnProperty.call(patch.editor, 'locked')) {
                    nextEditor.locked = Boolean(patch.editor.locked);
                    changed = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch.editor, 'hidden')) {
                    nextEditor.hidden = Boolean(patch.editor.hidden);
                    changed = true;
                }
                nextObject.editor = nextEditor;
            }

            if (!changed) {
                return { success: false, reason: 'No valid metadata fields to update.' };
            }

            objects[objectIndex] = nextObject;
            background.backgroundObjects = objects;
            return {
                success: true,
                object: nextObject
            };
        });
    }

    public deleteObject(
        id: string,
        options?: DeleteBackgroundObjectOptions
    ): BackgroundObjectMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            const objects = cloneBackgroundObjects(background.backgroundObjects);
            const objectIndex = this.findObjectIndex(objects, id);
            if (objectIndex < 0) {
                return { success: false, reason: 'Background object not found.' };
            }
            const current = objects[objectIndex];
            if (current.editor?.locked && !options?.force) {
                return { success: false, reason: 'Background object is locked.' };
            }
            objects.splice(objectIndex, 1);
            background.backgroundObjects = objects;
            return { success: true };
        });
    }

    public duplicateObject(id: string): BackgroundObjectMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const background = this.ensureBackground(nextConfig);
            const objects = cloneBackgroundObjects(background.backgroundObjects);
            const objectIndex = this.findObjectIndex(objects, id);
            if (objectIndex < 0) {
                return { success: false, reason: 'Background object not found.' };
            }

            const source = objects[objectIndex];
            const duplicate = cloneBackgroundObject(source);
            duplicate.id = this.generateObjectId(source.layer, objects);
            duplicate.bounds = {
                ...duplicate.bounds,
                x: duplicate.bounds.x + 24,
                y: duplicate.bounds.y + 24
            };
            duplicate.editor = {
                locked: false,
                hidden: duplicate.editor?.hidden ?? false
            };
            objects.push(duplicate);
            background.backgroundObjects = objects;
            return {
                success: true,
                object: duplicate
            };
        });
    }

    public updateLayerSettings(
        layer: BackgroundObjectLayerId,
        patch: UpdateBackgroundLayerSettingsPatch
    ): BackgroundObjectMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const normalizedLayer = normalizeLayer(layer, 'static');
            const background = this.ensureBackground(nextConfig);
            const currentLayerSettings = normalizeLayerSettings(background.backgroundLayerSettings);
            const nextLayerSettings: RequiredBackgroundLayerSettings = cloneLayerSettings(currentLayerSettings);

            if (normalizedLayer === 'static') {
                nextLayerSettings.static = { scrollFactorX: 0, scrollFactorY: 0 };
            } else {
                const target = nextLayerSettings[normalizedLayer];
                let changed = false;
                if (isFiniteNumber(patch.scrollFactorX)) {
                    target.scrollFactorX = clamp(patch.scrollFactorX, 0, 2);
                    changed = true;
                }
                if (isFiniteNumber(patch.scrollFactorY)) {
                    target.scrollFactorY = clamp(patch.scrollFactorY, 0, 2);
                    changed = true;
                }
                if (!changed) {
                    return { success: false, reason: 'No valid layer setting fields to update.' };
                }
            }

            background.backgroundLayerSettings = this.toBackgroundLayerSettings(nextLayerSettings);
            return { success: true };
        });
    }

    private getRuntimeConfig(): TestWorldConfig | null {
        const config = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!config || typeof config !== 'object') {
            return null;
        }
        if (!config.meta || !config.worldBounds) {
            return null;
        }
        return config;
    }

    private applyConfigEdit(
        edit: (config: TestWorldConfig) => BackgroundObjectMutationResult
    ): BackgroundObjectMutationResult {
        if (!this.legacyObjectAdapter) {
            return {
                success: false,
                reason: 'Runtime adapter unavailable.'
            };
        }
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig) {
            return {
                success: false,
                reason: 'Runtime config unavailable.'
            };
        }

        const nextConfig = cloneTestWorldConfig(runtimeConfig);
        let editResult: BackgroundObjectMutationResult;
        try {
            editResult = edit(nextConfig);
        } catch (error) {
            return {
                success: false,
                reason: error instanceof Error
                    ? error.message
                    : 'Failed to apply background object edit.'
            };
        }
        if (!editResult.success) {
            return editResult;
        }

        const importResult = this.legacyObjectAdapter.importRuntimeConfig(nextConfig);
        if (!importResult?.success) {
            return {
                success: false,
                reason: importResult?.reason ?? 'Failed to apply background object edit.'
            };
        }

        const snapshot = this.getSnapshot();
        const safeObject = editResult.object ? cloneBackgroundObject(editResult.object) : undefined;
        return {
            success: true,
            object: safeObject,
            snapshot: snapshot ?? this.createSnapshotFromConfig(nextConfig)
        };
    }

    private createSnapshotFromConfig(config: TestWorldConfig): BackgroundObjectSnapshot {
        return {
            levelId: config.meta.id,
            levelName: config.meta.displayName,
            backgroundColor: sanitizeColor(config.background?.color),
            objects: cloneBackgroundObjects(config.background?.backgroundObjects),
            layerSettings: cloneLayerSettings(
                normalizeLayerSettings(config.background?.backgroundLayerSettings)
            )
        };
    }

    private ensureBackground(config: TestWorldConfig): TestWorldBackgroundConfig {
        if (!config.background) {
            config.background = {};
        }
        if (!Array.isArray(config.background.backgroundObjects)) {
            config.background.backgroundObjects = [];
        }
        return config.background;
    }

    private toBackgroundLayerSettings(
        settings: RequiredBackgroundLayerSettings
    ): TestWorldBackgroundLayerSettingsConfig {
        return {
            static: { ...settings.static },
            parallax1: { ...settings.parallax1 },
            parallax2: { ...settings.parallax2 }
        };
    }

    private findObjectIndex(objects: TestWorldBackgroundObjectConfig[], id: string): number {
        const targetId = id.trim();
        if (!targetId) {
            return -1;
        }
        return objects.findIndex((entry) => entry.id === targetId);
    }

    private generateObjectId(
        layer: BackgroundObjectLayerId,
        objects: TestWorldBackgroundObjectConfig[]
    ): string {
        const prefix = layer === 'static'
            ? 'bg_static'
            : layer === 'parallax1'
                ? 'bg_parallax1'
                : 'bg_parallax2';
        const existing = new Set(objects.map((entry) => entry.id));
        let suffix = `${Date.now()}`;
        let candidate = `${prefix}_${suffix}`;
        while (existing.has(candidate)) {
            suffix = `${Date.now()}_${this.nextIdSuffix}`;
            this.nextIdSuffix += 1;
            candidate = `${prefix}_${suffix}`;
        }
        return candidate;
    }

    private createDefaultObject(
        config: TestWorldConfig,
        layer: BackgroundObjectLayerId,
        id: string,
        input: CreateBackgroundObjectInput
    ): TestWorldBackgroundObjectConfig {
        const bounds = this.createDefaultBounds(config, input.bounds);
        const textureKey = sanitizeOptionalString(input.textureKey);
        const textureAsset = sanitizeOptionalString(input.textureAsset);
        const fillColor = sanitizeColor(input.fillColor);
        const visualFill = textureKey || textureAsset ? fillColor : (fillColor ?? DEFAULT_FILL_COLOR);

        return {
            id,
            name: sanitizeOptionalString(input.name) ?? this.getDefaultNameForLayer(layer),
            layer,
            bounds,
            visual: {
                textureKey,
                textureAsset,
                fillColor: visualFill,
                alpha: 1,
                tileHorizontalRepeat: false,
                tileVerticalRepeat: false
            },
            editor: {
                locked: false,
                hidden: false
            }
        };
    }

    private createDefaultBounds(
        config: TestWorldConfig,
        patch: Partial<TestWorldBackgroundObjectBoundsConfig> | undefined
    ): TestWorldBackgroundObjectBoundsConfig {
        const width = isFiniteNumber(config.worldBounds?.width) ? config.worldBounds.width : 1600;
        const height = isFiniteNumber(config.worldBounds?.height) ? config.worldBounds.height : 900;
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const defaultSize = Math.max(256, Math.round(Math.min(width, height) * 0.25));
        const nextWidth = isFiniteNumber(patch?.width) ? Math.max(8, Math.round(patch.width)) : defaultSize;
        const nextHeight = isFiniteNumber(patch?.height) ? Math.max(8, Math.round(patch.height)) : defaultSize;

        return {
            x: isFiniteNumber(patch?.x) ? patch.x : centerX,
            y: isFiniteNumber(patch?.y) ? patch.y : centerY,
            width: nextWidth,
            height: nextHeight,
            rotation: isFiniteNumber(patch?.rotation) ? patch.rotation : 0
        };
    }

    private getDefaultNameForLayer(layer: BackgroundObjectLayerId): string {
        if (layer === 'parallax1') {
            return 'Parallax 1 Background';
        }
        if (layer === 'parallax2') {
            return 'Parallax 2 Background';
        }
        return 'Static Background';
    }
}
