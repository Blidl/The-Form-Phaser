import { GameObjects, type Scene } from 'phaser';
import type {
    TestWorldBackgroundConfig,
    TestWorldBackgroundLayerSettingsConfig,
    TestWorldBackgroundObjectConfig,
    TestWorldBackgroundObjectLayerId,
    TestWorldConfig,
    TestWorldParallaxLayerConfig
} from '../../game/world/runtime/test_world_config';

const FALLBACK_BACKGROUND_COLOR = 0x263238;
const BACKGROUND_FILL_ALPHA = 0.38;
const BACKGROUND_DEPTH = -1000;
const BACKGROUND_PADDING_MULTIPLIER = 2;
const MIN_BACKGROUND_OBJECT_SIZE = 8;
const BACKGROUND_OBJECT_STROKE_WIDTH = 2;
const BACKGROUND_OBJECT_DEPTH_BASE = BACKGROUND_DEPTH + 2;
const BACKGROUND_OBJECT_LAYER_DEPTH_STEP = 1;
const BACKGROUND_OBJECT_ENTRY_DEPTH_STEP = 0.001;
const DEFAULT_OBJECT_LAYER_SCROLL: Record<TestWorldBackgroundObjectLayerId, { scrollFactorX: number; scrollFactorY: number }> = {
    static: { scrollFactorX: 1, scrollFactorY: 1 },
    parallax1: { scrollFactorX: 0.45, scrollFactorY: 0.45 },
    parallax2: { scrollFactorX: 0.2, scrollFactorY: 0.2 }
};
const BACKGROUND_OBJECT_RENDER_LAYER_ORDER: readonly TestWorldBackgroundObjectLayerId[] = ['parallax1', 'parallax2', 'static'];

interface PendingTextureRequest {
    key: string;
    asset: string;
}

interface EditorPreviewCameraBasis {
    scrollX: number;
    scrollY: number;
    zoom: number;
}

export interface TestSceneBackgroundRuntime {
    applyConfig: (config: TestWorldConfig) => void;
    setEditorPreviewCameraBasis: (basis: EditorPreviewCameraBasis | null) => void;
    destroy: () => void;
}

const clampBackgroundColor = (value: number | undefined): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return FALLBACK_BACKGROUND_COLOR;
    }

    return Math.max(0, Math.min(0xffffff, Math.round(value)));
};

const clampAlpha = (value: number | undefined, fallback = 1): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return Math.max(0, Math.min(1, fallback));
    }
    return Math.max(0, Math.min(1, value));
};

const clampSize = (value: number | undefined, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return Math.max(MIN_BACKGROUND_OBJECT_SIZE, Math.round(fallback));
    }
    return Math.max(MIN_BACKGROUND_OBJECT_SIZE, Math.round(value));
};

const clampScrollFactor = (value: number | undefined, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return Math.max(0, Math.min(2, fallback));
    }
    return Math.max(0, Math.min(2, value));
};

const sanitizeOptionalColor = (value: number | undefined): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(0, Math.min(0xffffff, Math.round(value)));
};

const asOptionalTextureKey = (value: string | undefined): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const asOptionalTextureAsset = (value: string | undefined): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const resolveBackgroundObjectLayer = (value: unknown): TestWorldBackgroundObjectLayerId => {
    if (value === 'parallax1' || value === 'parallax2' || value === 'static') {
        return value;
    }
    return 'static';
};

const getBackdropWidth = (scene: Scene, worldWidth: number): number => {
    return Math.max(worldWidth + (scene.scale.width * BACKGROUND_PADDING_MULTIPLIER), scene.scale.width * 2);
};

const getBackgroundCenterX = (config: TestWorldConfig, x: number | undefined): number => {
    return Number.isFinite(x) ? (x as number) : config.worldBounds.width * 0.5;
};

const getBackgroundCenterY = (config: TestWorldConfig, y: number | undefined): number => {
    return Number.isFinite(y) ? (y as number) : config.worldBounds.height * 0.5;
};

const getBackgroundWidth = (scene: Scene, config: TestWorldConfig, width: number | undefined): number => {
    return Number.isFinite(width) ? Math.max(8, width as number) : getBackdropWidth(scene, config.worldBounds.width);
};

const getBackgroundHeight = (config: TestWorldConfig, height: number | undefined): number => {
    return Number.isFinite(height) ? Math.max(8, height as number) : config.worldBounds.height;
};

const createFillBackdrop = (
    scene: Scene,
    worldWidth: number,
    worldHeight: number,
    fillColor: number,
    scrollFactorX: number,
    scrollFactorY: number
): GameObjects.Rectangle => {
    return scene.add.rectangle(worldWidth * 0.5, worldHeight * 0.5, worldWidth, worldHeight, fillColor, BACKGROUND_FILL_ALPHA)
        .setDepth(BACKGROUND_DEPTH)
        .setScrollFactor(scrollFactorX, scrollFactorY);
};

const resolveEditorPreviewOffset = (
    basisValue: number | undefined,
    scrollFactor: number,
    editorPreviewBasis: EditorPreviewCameraBasis | null
): number => {
    if (!editorPreviewBasis || typeof basisValue !== 'number' || !Number.isFinite(basisValue)) {
        return 0;
    }

    return basisValue * (1 - scrollFactor);
};

const createStaticImageBackdrop = (
    scene: Scene,
    worldConfig: TestWorldConfig,
    backgroundConfig: TestWorldBackgroundConfig,
    editorPreviewBasis: EditorPreviewCameraBasis | null
): GameObjects.GameObject | null => {
    const staticImage = backgroundConfig.staticImage;
    if (!staticImage || !scene.textures.exists(staticImage.textureKey)) {
        return null;
    }

    const scale = staticImage.scale ?? 1;
    const width = getBackgroundWidth(scene, worldConfig, staticImage.width);
    const height = getBackgroundHeight(worldConfig, staticImage.height);
    const centerX = getBackgroundCenterX(worldConfig, staticImage.x);
    const centerY = getBackgroundCenterY(worldConfig, staticImage.y);
    const previewScrollFactorX = 1;
    const previewScrollFactorY = 1;

    if (staticImage.repeat) {
        const tile = scene.add.tileSprite(centerX, centerY, width, height, staticImage.textureKey)
            .setDepth(BACKGROUND_DEPTH + 1)
            .setScrollFactor(previewScrollFactorX, previewScrollFactorY)
            .setAlpha(staticImage.alpha ?? 1)
            .setTint(staticImage.tintColor ?? 0xffffff);
        tile.tileScaleX = scale;
        tile.tileScaleY = scale;
        return tile;
    }

    return scene.add.image(centerX, centerY, staticImage.textureKey)
        .setDepth(BACKGROUND_DEPTH + 1)
        .setScrollFactor(previewScrollFactorX, previewScrollFactorY)
        .setDisplaySize(width * scale, height * scale)
        .setAlpha(staticImage.alpha ?? 1)
        .setTint(staticImage.tintColor ?? 0xffffff);
};

const createParallaxLayerBackdrop = (
    scene: Scene,
    worldConfig: TestWorldConfig,
    layer: TestWorldParallaxLayerConfig,
    editorPreviewBasis: EditorPreviewCameraBasis | null
): GameObjects.GameObject[] => {
    const objects: GameObjects.GameObject[] = [];
    const layerScrollFactorX = layer.scrollFactorX;
    const layerScrollFactorY = layer.scrollFactorY ?? layer.scrollFactorX;
    const renderScrollFactorX = editorPreviewBasis ? 1 : layerScrollFactorX;
    const renderScrollFactorY = editorPreviewBasis ? 1 : layerScrollFactorY;
    const centerX = getBackgroundCenterX(worldConfig, layer.x)
        + resolveEditorPreviewOffset(editorPreviewBasis?.scrollX, layerScrollFactorX, editorPreviewBasis);
    const centerY = getBackgroundCenterY(worldConfig, layer.y)
        + resolveEditorPreviewOffset(editorPreviewBasis?.scrollY, layerScrollFactorY, editorPreviewBasis);
    const width = getBackgroundWidth(scene, worldConfig, layer.width);
    const height = getBackgroundHeight(worldConfig, layer.height);
    const scale = layer.scale ?? 1;

    if (layer.fillColor !== undefined) {
        const fill = scene.add.rectangle(
            centerX,
            centerY,
            width,
            height,
            layer.fillColor,
            BACKGROUND_FILL_ALPHA
        )
            .setDepth(BACKGROUND_DEPTH)
            .setScrollFactor(renderScrollFactorX, renderScrollFactorY);
        objects.push(fill);
    }

    if (!scene.textures.exists(layer.textureKey)) {
        return objects;
    }

    if (layer.repeat ?? true) {
        const tile = scene.add.tileSprite(centerX, centerY, width, height, layer.textureKey)
            .setDepth(BACKGROUND_DEPTH + 1)
            .setScrollFactor(renderScrollFactorX, renderScrollFactorY)
            .setAlpha(layer.alpha ?? 1)
            .setTint(layer.tintColor ?? 0xffffff);
        tile.tileScaleX = scale;
        tile.tileScaleY = scale;
        objects.push(tile);
    } else {
        const image = scene.add.image(centerX, centerY, layer.textureKey)
            .setDepth(BACKGROUND_DEPTH + 1)
            .setScrollFactor(renderScrollFactorX, renderScrollFactorY)
            .setDisplaySize(width * scale, height * scale)
            .setAlpha(layer.alpha ?? 1)
            .setTint(layer.tintColor ?? 0xffffff);
        objects.push(image);
    }
    return objects;
};

const resolveObjectLayerScrollFactors = (
    layer: TestWorldBackgroundObjectLayerId,
    backgroundLayerSettings: TestWorldBackgroundLayerSettingsConfig | undefined
): { scrollFactorX: number; scrollFactorY: number } => {
    if (layer === 'static') {
        return { ...DEFAULT_OBJECT_LAYER_SCROLL.static };
    }

    const fallback = DEFAULT_OBJECT_LAYER_SCROLL[layer];
    const layerSettings = layer === 'parallax1'
        ? backgroundLayerSettings?.parallax1
        : backgroundLayerSettings?.parallax2;
    return {
        scrollFactorX: clampScrollFactor(layerSettings?.scrollFactorX, fallback.scrollFactorX),
        scrollFactorY: clampScrollFactor(layerSettings?.scrollFactorY, fallback.scrollFactorY)
    };
};

const resolveObjectLayerRenderState = (
    layer: TestWorldBackgroundObjectLayerId,
    background: TestWorldBackgroundConfig,
    editorPreviewBasis: EditorPreviewCameraBasis | null
): { scrollFactorX: number; scrollFactorY: number; offsetX: number; offsetY: number } => {
    if (layer === 'static') {
        return {
            scrollFactorX: 1,
            scrollFactorY: 1,
            offsetX: 0,
            offsetY: 0
        };
    }

    const layerScroll = resolveObjectLayerScrollFactors(layer, background.backgroundLayerSettings);
    if (!editorPreviewBasis) {
        return {
            scrollFactorX: layerScroll.scrollFactorX,
            scrollFactorY: layerScroll.scrollFactorY,
            offsetX: 0,
            offsetY: 0
        };
    }

    return {
        scrollFactorX: 1,
        scrollFactorY: 1,
        offsetX: resolveEditorPreviewOffset(editorPreviewBasis.scrollX, layerScroll.scrollFactorX, editorPreviewBasis),
        offsetY: resolveEditorPreviewOffset(editorPreviewBasis.scrollY, layerScroll.scrollFactorY, editorPreviewBasis)
    };
};

const createBackgroundObjectBackdrop = (
    scene: Scene,
    worldConfig: TestWorldConfig,
    background: TestWorldBackgroundConfig,
    backgroundObject: TestWorldBackgroundObjectConfig,
    editorPreviewBasis: EditorPreviewCameraBasis | null,
    depth: number
): GameObjects.GameObject[] => {
    if (backgroundObject.editor?.hidden) {
        return [];
    }

    const layer = resolveBackgroundObjectLayer(backgroundObject.layer);
    const renderState = resolveObjectLayerRenderState(layer, background, editorPreviewBasis);
    const width = clampSize(backgroundObject.bounds.width, MIN_BACKGROUND_OBJECT_SIZE);
    const height = clampSize(backgroundObject.bounds.height, MIN_BACKGROUND_OBJECT_SIZE);
    const centerX = getBackgroundCenterX(worldConfig, backgroundObject.bounds.x) + renderState.offsetX;
    const centerY = getBackgroundCenterY(worldConfig, backgroundObject.bounds.y) + renderState.offsetY;
    const rotationDeg = Number.isFinite(backgroundObject.bounds.rotation) ? backgroundObject.bounds.rotation as number : 0;
    const rotationRad = (rotationDeg * Math.PI) / 180;
    const textureKey = asOptionalTextureKey(backgroundObject.visual.textureKey);
    const fillColor = sanitizeOptionalColor(backgroundObject.visual.fillColor);
    const strokeColor = sanitizeOptionalColor(backgroundObject.visual.strokeColor);
    const alpha = clampAlpha(backgroundObject.visual.alpha, 1);
    const hasTexture = textureKey ? scene.textures.exists(textureKey) : false;

    if (hasTexture && textureKey) {
        const repeatX = backgroundObject.visual.tileHorizontalRepeat ?? false;
        const repeatY = backgroundObject.visual.tileVerticalRepeat ?? false;
        if (repeatX || repeatY) {
            const tile = scene.add.tileSprite(centerX, centerY, width, height, textureKey)
                .setDepth(depth)
                .setScrollFactor(renderState.scrollFactorX, renderState.scrollFactorY)
                .setAlpha(alpha)
                .setRotation(rotationRad);
            const sourceImage = scene.textures.get(textureKey).getSourceImage() as { width?: number; height?: number } | null;
            const sourceWidth = typeof sourceImage?.width === 'number' && sourceImage.width > 0 ? sourceImage.width : width;
            const sourceHeight = typeof sourceImage?.height === 'number' && sourceImage.height > 0 ? sourceImage.height : height;
            tile.tileScaleX = repeatX ? 1 : Math.max(0.0001, width / sourceWidth);
            tile.tileScaleY = repeatY ? 1 : Math.max(0.0001, height / sourceHeight);
            return [tile];
        }

        const image = scene.add.image(centerX, centerY, textureKey)
            .setDepth(depth)
            .setScrollFactor(renderState.scrollFactorX, renderState.scrollFactorY)
            .setDisplaySize(width, height)
            .setAlpha(alpha)
            .setRotation(rotationRad);
        return [image];
    }

    if (fillColor === undefined && strokeColor === undefined) {
        return [];
    }

    const fallbackFillColor = fillColor ?? 0xffffff;
    const fallbackFillAlpha = fillColor !== undefined ? alpha : 0;
    const rectangle = scene.add.rectangle(centerX, centerY, width, height, fallbackFillColor, fallbackFillAlpha)
        .setDepth(depth)
        .setScrollFactor(renderState.scrollFactorX, renderState.scrollFactorY)
        .setRotation(rotationRad);
    if (strokeColor !== undefined) {
        rectangle.setStrokeStyle(BACKGROUND_OBJECT_STROKE_WIDTH, strokeColor, alpha);
    }
    return [rectangle];
};

const collectTextureRequests = (background: TestWorldBackgroundConfig | null): PendingTextureRequest[] => {
    if (!background) {
        return [];
    }

    const requests: PendingTextureRequest[] = [];
    const tryAddRequest = (textureKey: string | undefined, textureAsset: string | undefined): void => {
        const key = asOptionalTextureKey(textureKey);
        const asset = asOptionalTextureAsset(textureAsset);
        if (!key || !asset) {
            return;
        }
        requests.push({ key, asset });
    };

    tryAddRequest(background.staticImage?.textureKey, background.staticImage?.textureAsset);
    background.layers?.forEach((layer) => {
        tryAddRequest(layer.textureKey, layer.textureAsset);
    });
    background.backgroundObjects?.forEach((backgroundObject) => {
        tryAddRequest(backgroundObject.visual?.textureKey, backgroundObject.visual?.textureAsset);
    });
    return requests;
};

const collectBackgroundObjectsForRenderOrder = (
    backgroundObjects: readonly TestWorldBackgroundObjectConfig[] | undefined
): TestWorldBackgroundObjectConfig[] => {
    if (!Array.isArray(backgroundObjects) || backgroundObjects.length <= 0) {
        return [];
    }

    const ordered: TestWorldBackgroundObjectConfig[] = [];
    BACKGROUND_OBJECT_RENDER_LAYER_ORDER.forEach((layer) => {
        backgroundObjects.forEach((entry) => {
            if (resolveBackgroundObjectLayer(entry.layer) === layer) {
                ordered.push(entry);
            }
        });
    });
    return ordered;
};

export const createTestSceneBackgroundRuntime = (
    scene: Scene,
    initialConfig: TestWorldConfig
): TestSceneBackgroundRuntime => {
    let currentConfig = initialConfig;
    let destroyed = false;
    let objects: GameObjects.GameObject[] = [];
    let pendingTextureKeys = new Set<string>();
    let editorPreviewBasis: EditorPreviewCameraBasis | null = null;
    const loadedTextureAssets = new Map<string, string>();

    const clearObjects = (): void => {
        objects.forEach((entry) => entry.destroy());
        objects = [];
    };

    const applyCurrentConfig = (): void => {
        clearObjects();
        const background = currentConfig.background;
        scene.cameras.main.setBackgroundColor(clampBackgroundColor(background?.color));

        if (!background) {
            return;
        }

        const orderedBackgroundObjects = collectBackgroundObjectsForRenderOrder(background.backgroundObjects);
        if (orderedBackgroundObjects.length <= 0) {
            const staticFillColor = background.staticImage?.fillColor;
            if (staticFillColor !== undefined) {
                const fill = createFillBackdrop(
                    scene,
                    currentConfig.worldBounds.width,
                    currentConfig.worldBounds.height,
                    staticFillColor,
                    1,
                    1
                );
                objects.push(fill);
            }

            const staticImage = createStaticImageBackdrop(scene, currentConfig, background, editorPreviewBasis);
            if (staticImage) {
                objects.push(staticImage);
            }

            background.layers?.forEach((layer) => {
                objects.push(...createParallaxLayerBackdrop(scene, currentConfig, layer, editorPreviewBasis));
            });
            return;
        }

        const perLayerEntryCount: Record<TestWorldBackgroundObjectLayerId, number> = {
            parallax1: 0,
            parallax2: 0,
            static: 0
        };
        orderedBackgroundObjects.forEach((backgroundObject) => {
            const layer = resolveBackgroundObjectLayer(backgroundObject.layer);
            const layerDepthOffset = layer === 'parallax1'
                ? 0
                : layer === 'parallax2'
                    ? BACKGROUND_OBJECT_LAYER_DEPTH_STEP
                    : BACKGROUND_OBJECT_LAYER_DEPTH_STEP * 2;
            const layerEntryIndex = perLayerEntryCount[layer];
            perLayerEntryCount[layer] += 1;
            const depth = BACKGROUND_OBJECT_DEPTH_BASE
                + layerDepthOffset
                + (layerEntryIndex * BACKGROUND_OBJECT_ENTRY_DEPTH_STEP);
            objects.push(...createBackgroundObjectBackdrop(
                scene,
                currentConfig,
                background,
                backgroundObject,
                editorPreviewBasis,
                depth
            ));
        });
    };

    const queueTextureRequests = (background: TestWorldBackgroundConfig | null): void => {
        const requests = collectTextureRequests(background);
        let shouldStartLoader = false;

        requests.forEach((request) => {
            const loadedAsset = loadedTextureAssets.get(request.key);
            const shouldReloadExistingTexture = loadedAsset !== undefined && loadedAsset !== request.asset;
            if (shouldReloadExistingTexture && scene.textures.exists(request.key)) {
                scene.textures.remove(request.key);
            }
            if (shouldReloadExistingTexture) {
                loadedTextureAssets.delete(request.key);
            }
            if ((scene.textures.exists(request.key) && loadedTextureAssets.get(request.key) === request.asset) || pendingTextureKeys.has(request.key)) {
                return;
            }
            pendingTextureKeys.add(request.key);
            loadedTextureAssets.set(request.key, request.asset);
            scene.load.image(request.key, request.asset);
            shouldStartLoader = true;
        });

        if (shouldStartLoader && !scene.load.isLoading()) {
            scene.load.start();
        }
    };

    const handleLoaderComplete = (): void => {
        if (destroyed || pendingTextureKeys.size === 0) {
            return;
        }
        pendingTextureKeys.clear();
        applyCurrentConfig();
    };

    const handleLoaderError = (file: { key?: string } | undefined): void => {
        const failedKey = typeof file?.key === 'string' ? file.key : null;
        if (failedKey) {
            pendingTextureKeys.delete(failedKey);
            loadedTextureAssets.delete(failedKey);
        }
    };

    scene.load.on('complete', handleLoaderComplete);
    scene.load.on('loaderror', handleLoaderError);
    scene.events.once('shutdown', () => {
        runtime.destroy();
    });
    scene.events.once('destroy', () => {
        runtime.destroy();
    });

    queueTextureRequests(initialConfig.background);
    applyCurrentConfig();

    const runtime: TestSceneBackgroundRuntime = {
        applyConfig: (config: TestWorldConfig): void => {
            if (destroyed) {
                return;
            }
            currentConfig = config;
            queueTextureRequests(config.background);
            applyCurrentConfig();
        },
        setEditorPreviewCameraBasis: (basis: EditorPreviewCameraBasis | null): void => {
            if (destroyed) {
                return;
            }
            editorPreviewBasis = basis;
            applyCurrentConfig();
        },
        destroy: (): void => {
            if (destroyed) {
                return;
            }
            destroyed = true;
            scene.load.off('complete', handleLoaderComplete);
            scene.load.off('loaderror', handleLoaderError);
            clearObjects();
        }
    };
    return runtime;
};
