import { GameObjects, type Scene } from 'phaser';
import type {
    TestWorldBackgroundConfig,
    TestWorldConfig,
    TestWorldParallaxLayerConfig
} from '../../game/world/runtime/test_world_config';

const FALLBACK_BACKGROUND_COLOR = 0x263238;
const BACKGROUND_FILL_ALPHA = 0.38;
const BACKGROUND_DEPTH = -1000;
const BACKGROUND_PADDING_MULTIPLIER = 2;

interface PendingTextureRequest {
    key: string;
    asset: string;
}

export interface TestSceneBackgroundRuntime {
    applyConfig: (config: TestWorldConfig) => void;
    destroy: () => void;
}

const clampBackgroundColor = (value: number | undefined): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return FALLBACK_BACKGROUND_COLOR;
    }

    return Math.max(0, Math.min(0xffffff, Math.round(value)));
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

const createStaticImageBackdrop = (
    scene: Scene,
    worldConfig: TestWorldConfig,
    backgroundConfig: TestWorldBackgroundConfig
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

    if (staticImage.repeat) {
        const tile = scene.add.tileSprite(centerX, centerY, width, height, staticImage.textureKey)
            .setDepth(BACKGROUND_DEPTH + 1)
            .setScrollFactor(1, 1)
            .setAlpha(staticImage.alpha ?? 1)
            .setTint(staticImage.tintColor ?? 0xffffff);
        tile.tileScaleX = scale;
        tile.tileScaleY = scale;
        return tile;
    }

    return scene.add.image(centerX, centerY, staticImage.textureKey)
        .setDepth(BACKGROUND_DEPTH + 1)
        .setScrollFactor(1, 1)
        .setDisplaySize(width * scale, height * scale)
        .setAlpha(staticImage.alpha ?? 1)
        .setTint(staticImage.tintColor ?? 0xffffff);
};

const createParallaxLayerBackdrop = (
    scene: Scene,
    worldConfig: TestWorldConfig,
    layer: TestWorldParallaxLayerConfig
): GameObjects.GameObject[] => {
    const objects: GameObjects.GameObject[] = [];
    if (layer.fillColor !== undefined) {
        const fill = scene.add.rectangle(
            getBackgroundCenterX(worldConfig, layer.x),
            getBackgroundCenterY(worldConfig, layer.y),
            getBackgroundWidth(scene, worldConfig, layer.width),
            getBackgroundHeight(worldConfig, layer.height),
            layer.fillColor,
            BACKGROUND_FILL_ALPHA
        )
            .setDepth(BACKGROUND_DEPTH)
            .setScrollFactor(layer.scrollFactorX, layer.scrollFactorY ?? layer.scrollFactorX);
        objects.push(fill);
    }

    if (!scene.textures.exists(layer.textureKey)) {
        return objects;
    }

    const width = getBackgroundWidth(scene, worldConfig, layer.width);
    const height = getBackgroundHeight(worldConfig, layer.height);
    const centerX = getBackgroundCenterX(worldConfig, layer.x);
    const centerY = getBackgroundCenterY(worldConfig, layer.y);
    const scale = layer.scale ?? 1;

    if (layer.repeat ?? true) {
        const tile = scene.add.tileSprite(centerX, centerY, width, height, layer.textureKey)
            .setDepth(BACKGROUND_DEPTH + 1)
            .setScrollFactor(layer.scrollFactorX, layer.scrollFactorY ?? layer.scrollFactorX)
            .setAlpha(layer.alpha ?? 1)
            .setTint(layer.tintColor ?? 0xffffff);
        tile.tileScaleX = scale;
        tile.tileScaleY = scale;
        objects.push(tile);
    } else {
        const image = scene.add.image(centerX, centerY, layer.textureKey)
            .setDepth(BACKGROUND_DEPTH + 1)
            .setScrollFactor(layer.scrollFactorX, layer.scrollFactorY ?? layer.scrollFactorX)
            .setDisplaySize(width * scale, height * scale)
            .setAlpha(layer.alpha ?? 1)
            .setTint(layer.tintColor ?? 0xffffff);
        objects.push(image);
    }
    return objects;
};

const collectTextureRequests = (background: TestWorldBackgroundConfig | null): PendingTextureRequest[] => {
    if (!background) {
        return [];
    }

    const requests: PendingTextureRequest[] = [];
    const tryAddRequest = (textureKey: string, textureAsset: string | undefined): void => {
        if (!textureKey || !textureAsset) {
            return;
        }
        requests.push({ key: textureKey, asset: textureAsset });
    };

    tryAddRequest(background.staticImage?.textureKey ?? '', background.staticImage?.textureAsset);
    background.layers?.forEach((layer) => {
        tryAddRequest(layer.textureKey, layer.textureAsset);
    });
    return requests;
};

export const createTestSceneBackgroundRuntime = (
    scene: Scene,
    initialConfig: TestWorldConfig
): TestSceneBackgroundRuntime => {
    let currentConfig = initialConfig;
    let destroyed = false;
    let objects: GameObjects.GameObject[] = [];
    let pendingTextureKeys = new Set<string>();
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

        const staticFillColor = background.staticImage?.fillColor;
        if (staticFillColor !== undefined) {
            objects.push(createFillBackdrop(
                scene,
                currentConfig.worldBounds.width,
                currentConfig.worldBounds.height,
                staticFillColor,
                1,
                1
            ));
        }

        const staticImage = createStaticImageBackdrop(scene, currentConfig, background);
        if (staticImage) {
            objects.push(staticImage);
        }

        background.layers?.forEach((layer) => {
            objects.push(...createParallaxLayerBackdrop(scene, currentConfig, layer));
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
