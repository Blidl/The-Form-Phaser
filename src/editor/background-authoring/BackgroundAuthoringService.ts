import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import {
    cloneTestWorldConfig,
    type TestWorldBackgroundConfig,
    type TestWorldBackgroundImageConfig,
    type TestWorldConfig,
    type TestWorldParallaxLayerConfig
} from '../../game/world/runtime/test_world_config';

const DEFAULT_BACKGROUND_COLOR = 0x263238;
const DEFAULT_BACKGROUND_FILL = 0x1f2a30;
const DEFAULT_TINT = 0xffffff;
const DEFAULT_STATIC_TEXTURE_KEY = 'demo_bg_static';
const DEFAULT_PARALLAX_1_TEXTURE_KEY = 'demo_bg_layer_far';
const DEFAULT_PARALLAX_2_TEXTURE_KEY = 'demo_bg_layer_near';
const DEFAULT_TEXTURE_ASSET = 'assets/bg.png';

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const clampAlpha = (value: number | undefined, fallback = 1): number => {
    if (!isFiniteNumber(value)) {
        return fallback;
    }
    return clamp(value, 0, 1);
};

const clampScale = (value: number | undefined, fallback = 1): number => {
    if (!isFiniteNumber(value)) {
        return fallback;
    }
    return Math.max(0.1, value);
};

const clampSize = (value: number | undefined, fallback: number): number => {
    if (!isFiniteNumber(value)) {
        return Math.max(8, Math.round(fallback));
    }
    return Math.max(8, Math.round(value));
};

const clampScrollFactor = (value: number | undefined, fallback: number): number => {
    if (!isFiniteNumber(value)) {
        return clamp(fallback, 0, 2);
    }
    return clamp(value, 0, 2);
};

const cloneLayer = (layer: TestWorldParallaxLayerConfig): TestWorldParallaxLayerConfig => ({ ...layer });

export interface BackgroundSnapshot {
    levelId: string;
    levelName: string;
    runtimeConfig: TestWorldConfig;
    background: TestWorldBackgroundConfig | null;
    staticImage: TestWorldBackgroundImageConfig | null;
    parallax1: TestWorldParallaxLayerConfig | null;
    parallax2: TestWorldParallaxLayerConfig | null;
}

export interface BackgroundWriteResult {
    success: boolean;
    reason?: string;
    snapshot?: BackgroundSnapshot;
}

export class BackgroundAuthoringService {
    // Background edits are runtime-backed; runtime config is the canonical source.
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;

    public constructor(legacyObjectAdapter: LegacyObjectAdapter | null) {
        this.legacyObjectAdapter = legacyObjectAdapter;
    }

    public getSnapshot(): BackgroundSnapshot | null {
        const config = this.getRuntimeConfig();
        if (!config) {
            return null;
        }
        return this.toSnapshot(config);
    }

    public ensureStatic(): BackgroundWriteResult {
        return this.applyConfigEdit((config) => {
            const background = this.ensureBackground(config);
            background.staticImage = this.normalizeStaticImage(background.staticImage, config);
        });
    }

    public ensureParallax(slot: 1 | 2): BackgroundWriteResult {
        return this.applyConfigEdit((config) => {
            const background = this.ensureBackground(config);
            const layers = background.layers ?? [];
            const layerIndex = this.findLayerIndex(layers, slot);
            const normalized = this.normalizeParallaxLayer(
                layerIndex >= 0 ? layers[layerIndex] : undefined,
                slot,
                config
            );
            if (layerIndex >= 0) {
                layers[layerIndex] = normalized;
            } else {
                layers.push(normalized);
            }
            background.layers = layers;
        });
    }

    public patchBackgroundColor(color: number): BackgroundWriteResult {
        if (!isFiniteNumber(color)) {
            return {
                success: false,
                reason: 'Invalid color value.'
            };
        }
        return this.applyConfigEdit((config) => {
            const background = this.ensureBackground(config);
            background.color = clamp(Math.round(color), 0, 0xffffff);
        });
    }

    public patchStaticImage(patch: Partial<TestWorldBackgroundImageConfig>): BackgroundWriteResult {
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig) {
            return {
                success: false,
                reason: 'Runtime config unavailable.'
            };
        }
        const candidateConfig = cloneTestWorldConfig(runtimeConfig);
        const background = this.ensureBackground(candidateConfig);
        const current = this.normalizeStaticImage(background.staticImage, candidateConfig);
        const candidate = this.normalizeStaticImage({
            ...current,
            ...patch
        }, candidateConfig);
        if (!this.isRenderableBackgroundImage(candidate)) {
            return {
                success: false,
                reason: 'Texture key/asset can both be empty only when fillColor exists.'
            };
        }
        return this.applyConfigEdit((config) => {
            const background = this.ensureBackground(config);
            const next = this.normalizeStaticImage({
                ...this.normalizeStaticImage(background.staticImage, config),
                ...patch
            }, config);
            if (!this.isRenderableBackgroundImage(next)) {
                throw new Error('Texture key/asset can both be empty only when fillColor exists.');
            }
            background.staticImage = next;
        });
    }

    public patchParallaxLayer(slot: 1 | 2, patch: Partial<TestWorldParallaxLayerConfig>): BackgroundWriteResult {
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig) {
            return {
                success: false,
                reason: 'Runtime config unavailable.'
            };
        }
        const candidateConfig = cloneTestWorldConfig(runtimeConfig);
        const background = this.ensureBackground(candidateConfig);
        const layers = Array.isArray(background.layers) ? background.layers : [];
        const layerIndex = this.findLayerIndex(layers, slot);
        const current = this.normalizeParallaxLayer(
            layerIndex >= 0 ? layers[layerIndex] : undefined,
            slot,
            candidateConfig
        );
        const candidate = this.normalizeParallaxLayer({
            ...current,
            ...patch
        }, slot, candidateConfig);
        if (!this.isRenderableBackgroundImage(candidate)) {
            return {
                success: false,
                reason: 'Texture key/asset can both be empty only when fillColor exists.'
            };
        }
        return this.applyConfigEdit((config) => {
            const background = this.ensureBackground(config);
            const layers = Array.isArray(background.layers) ? background.layers : [];
            const layerIndex = this.findLayerIndex(layers, slot);
            const next = this.normalizeParallaxLayer({
                ...this.normalizeParallaxLayer(
                layerIndex >= 0 ? layers[layerIndex] : undefined,
                slot,
                config
                ),
                ...patch
            }, slot, config);
            if (!this.isRenderableBackgroundImage(next)) {
                throw new Error('Texture key/asset can both be empty only when fillColor exists.');
            }
            if (layerIndex >= 0) {
                layers[layerIndex] = next;
            } else {
                layers.push(next);
            }
            background.layers = layers;
        });
    }

    private applyConfigEdit(edit: (config: TestWorldConfig) => void): BackgroundWriteResult {
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
        try {
            edit(nextConfig);
        } catch (error) {
            return {
                success: false,
                reason: error instanceof Error ? error.message : 'Failed to apply background config.'
            };
        }
        // Use runtime import path so Save/Export/Import stay aligned with one config pipeline.
        const importResult = this.legacyObjectAdapter.importRuntimeConfig(nextConfig);
        if (!importResult?.success) {
            return {
                success: false,
                reason: importResult?.reason ?? 'Failed to apply background config.'
            };
        }

        // Background edits update runtime preview only; save remains an explicit action.
        const snapshot = this.getSnapshot();
        return {
            success: true,
            snapshot: snapshot ?? this.toSnapshot(nextConfig)
        };
    }

    private toSnapshot(config: TestWorldConfig): BackgroundSnapshot {
        const background = config.background;
        const layers = Array.isArray(background?.layers) ? background.layers : [];
        const parallax1Index = this.findLayerIndex(layers, 1);
        const parallax2Index = this.findLayerIndex(layers, 2);
        return {
            levelId: config.meta.id,
            levelName: config.meta.displayName,
            runtimeConfig: config,
            background,
            staticImage: background?.staticImage ? { ...background.staticImage } : null,
            parallax1: parallax1Index >= 0 ? cloneLayer(layers[parallax1Index]) : null,
            parallax2: parallax2Index >= 0 ? cloneLayer(layers[parallax2Index]) : null
        };
    }

    private getRuntimeConfig(): TestWorldConfig | null {
        // ProjectStore mirrors editor UI state; background source of truth stays in runtime config.
        const config = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!config || typeof config !== 'object') {
            return null;
        }
        if (!config.meta || !config.worldBounds) {
            return null;
        }
        return config;
    }

    private ensureBackground(config: TestWorldConfig): TestWorldBackgroundConfig {
        if (!config.background) {
            config.background = {
                color: DEFAULT_BACKGROUND_COLOR,
                layers: []
            };
            return config.background;
        }

        config.background.color = isFiniteNumber(config.background.color)
            ? clamp(Math.round(config.background.color), 0, 0xffffff)
            : DEFAULT_BACKGROUND_COLOR;
        if (!Array.isArray(config.background.layers)) {
            config.background.layers = [];
        }
        return config.background;
    }

    private isRenderableBackgroundImage(image: {
        textureKey?: string;
        textureAsset?: string;
        fillColor?: number;
    }): boolean {
        const hasTexture = (image.textureKey?.trim().length ?? 0) > 0
            || (image.textureAsset?.trim().length ?? 0) > 0;
        return hasTexture || isFiniteNumber(image.fillColor);
    }

    private normalizeStaticImage(
        current: TestWorldBackgroundImageConfig | undefined,
        config: TestWorldConfig
    ): TestWorldBackgroundImageConfig {
        const width = config.worldBounds?.width ?? 1600;
        const height = config.worldBounds?.height ?? 900;
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        return {
            textureKey: current?.textureKey?.trim() ?? DEFAULT_STATIC_TEXTURE_KEY,
            textureAsset: current?.textureAsset?.trim() || DEFAULT_TEXTURE_ASSET,
            fillColor: isFiniteNumber(current?.fillColor)
                ? clamp(Math.round(current.fillColor), 0, 0xffffff)
                : DEFAULT_BACKGROUND_FILL,
            tintColor: isFiniteNumber(current?.tintColor)
                ? clamp(Math.round(current.tintColor), 0, 0xffffff)
                : DEFAULT_TINT,
            alpha: clampAlpha(current?.alpha, 1),
            scale: clampScale(current?.scale, 1),
            width: clampSize(current?.width, width || 1600),
            height: clampSize(current?.height, height || 900),
            repeat: current?.repeat ?? false,
            x: isFiniteNumber(current?.x) ? current.x : centerX,
            y: isFiniteNumber(current?.y) ? current.y : centerY
        };
    }

    private normalizeParallaxLayer(
        current: TestWorldParallaxLayerConfig | undefined,
        slot: 1 | 2,
        config: TestWorldConfig
    ): TestWorldParallaxLayerConfig {
        const width = config.worldBounds?.width ?? 1600;
        const height = config.worldBounds?.height ?? 900;
        const targetId = slot === 1 ? 'parallax_1' : 'parallax_2';
        const centerX = width * 0.5;
        const defaultY = slot === 1 ? Math.round(height * 0.45) : Math.round(height * 0.58);
        return {
            id: current?.id?.trim() || targetId,
            textureKey: current?.textureKey?.trim() || (slot === 1 ? DEFAULT_PARALLAX_1_TEXTURE_KEY : DEFAULT_PARALLAX_2_TEXTURE_KEY),
            textureAsset: current?.textureAsset?.trim() || DEFAULT_TEXTURE_ASSET,
            fillColor: isFiniteNumber(current?.fillColor)
                ? clamp(Math.round(current.fillColor), 0, 0xffffff)
                : DEFAULT_BACKGROUND_FILL,
            tintColor: isFiniteNumber(current?.tintColor)
                ? clamp(Math.round(current.tintColor), 0, 0xffffff)
                : DEFAULT_TINT,
            alpha: clampAlpha(current?.alpha, slot === 1 ? 0.35 : 0.55),
            scale: clampScale(current?.scale, 1),
            width: clampSize(current?.width, width || 1920),
            height: clampSize(current?.height, Math.round(Math.max(256, height * 0.6))),
            repeat: current?.repeat ?? true,
            x: isFiniteNumber(current?.x) ? current.x : centerX,
            y: isFiniteNumber(current?.y) ? current.y : defaultY,
            scrollFactorX: clampScrollFactor(current?.scrollFactorX, slot === 1 ? 0.2 : 0.45),
            scrollFactorY: clampScrollFactor(current?.scrollFactorY, slot === 1 ? 0.2 : 0.45)
        };
    }

    private findLayerIndex(layers: TestWorldParallaxLayerConfig[], slot: 1 | 2): number {
        const expectedId = slot === 1 ? 'parallax_1' : 'parallax_2';
        const byIdIndex = layers.findIndex((layer) => layer.id === expectedId);
        if (byIdIndex >= 0) {
            return byIdIndex;
        }
        const byIndex = slot - 1;
        return byIndex < layers.length ? byIndex : -1;
    }
}
