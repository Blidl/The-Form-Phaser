import {
    TEST_WORLD_CONFIG,
    type TestWorldBackgroundConfig,
    type TestWorldBackgroundImageConfig,
    type TestWorldParallaxLayerConfig,
    cloneTestWorldConfig,
    type TestWorldBoundsConfig,
    type TestWorldCheckpointConfig,
    type TestWorldConfig,
    type TestWorldDragBoxConfig,
    type TestWorldFinishConfig,
    type TestWorldHazardConfig,
    type TestWorldMetaConfig,
    type TestWorldMovingPlatformConfig,
    type TestWorldPlayerSpawnConfig,
    type TestWorldSurfaceConfig,
    type TestWorldTriangleFlightBreakWallConfig,
    type TestWorldTrianglePickupConfig,
    type TestWorldTriggerPlatformConfig,
    type TestWorldWindZoneConfig
} from './test_world_config';

const MIN_RECT_SIZE = 8;
const MIN_PICKUP_RADIUS = 4;
const MIN_WORLD_SIZE = 64;
const MAX_BACKGROUND_LAYERS = 6;
const DEFAULT_BACKGROUND_COLOR = 0x263238;

const asNumber = (value: unknown, fallback: number): number => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const asColor = (value: unknown, fallback: number | undefined): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(0xffffff, Math.round(value)));
};

const asBoolean = (value: unknown, fallback: boolean = false): boolean => {
    return typeof value === 'boolean' ? value : fallback;
};

const asOptionalString = (value: unknown): string | undefined => {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const asString = (value: unknown, fallback: string): string => {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
};

const asArray = (value: unknown): unknown[] => {
    return Array.isArray(value) ? value : [];
};

const clampRectSize = (value: number): number => {
    return Math.max(MIN_RECT_SIZE, Math.round(value));
};

const clampPickupRadius = (value: number): number => {
    return Math.max(MIN_PICKUP_RADIUS, Math.round(value));
};

const clampAlpha = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(1, value));
};

const clampScale = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0.1, Math.min(8, value));
};

const clampScrollFactor = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(2, value));
};

const ensureUniqueId = (id: string, usedIds: Set<string>, prefix: string): string => {
    let candidate = id.length > 0 ? id : prefix;
    let nextIndex = 1;
    while (usedIds.has(candidate)) {
        candidate = `${prefix}_${nextIndex}`;
        nextIndex += 1;
    }
    usedIds.add(candidate);
    return candidate;
};

const normalizePlayerSpawn = (raw: Record<string, unknown> | null): TestWorldPlayerSpawnConfig => {
    const fallback = TEST_WORLD_CONFIG.playerSpawn;
    return {
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeMeta = (raw: Record<string, unknown> | null, fallback: TestWorldMetaConfig): TestWorldMetaConfig => {
    return {
        id: asString(raw?.id, fallback.id),
        displayName: asString(raw?.displayName, fallback.displayName)
    };
};

const normalizeWorldBounds = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBoundsConfig
): TestWorldBoundsConfig => {
    return {
        width: Math.max(MIN_WORLD_SIZE, Math.round(asNumber(raw?.width, fallback.width))),
        height: Math.max(MIN_WORLD_SIZE, Math.round(asNumber(raw?.height, fallback.height)))
    };
};

const normalizeBackgroundImage = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBackgroundImageConfig | undefined
): TestWorldBackgroundImageConfig | undefined => {
    const textureKey = asString(raw?.textureKey, fallback?.textureKey ?? '');
    const textureAsset = asOptionalString(raw?.textureAsset) ?? fallback?.textureAsset;
    const tintColor = asColor(raw?.tintColor, fallback?.tintColor);
    const fillColor = asColor(raw?.fillColor, fallback?.fillColor);
    const alpha = clampAlpha(raw?.alpha, fallback?.alpha ?? 1);
    const scale = clampScale(raw?.scale, fallback?.scale ?? 1);
    const hasRenderableContent = textureKey.length > 0 || textureAsset !== undefined || fillColor !== undefined;

    if (!hasRenderableContent) {
        return undefined;
    }

    return {
        textureKey,
        textureAsset,
        tintColor,
        alpha,
        scale,
        width: Math.max(MIN_RECT_SIZE, Math.round(asNumber(raw?.width, fallback?.width ?? 256))),
        height: Math.max(MIN_RECT_SIZE, Math.round(asNumber(raw?.height, fallback?.height ?? 256))),
        repeat: asBoolean(raw?.repeat, fallback?.repeat ?? false),
        fillColor,
        x: asNumber(raw?.x, fallback?.x ?? 0),
        y: asNumber(raw?.y, fallback?.y ?? 0)
    };
};

const normalizeParallaxLayer = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldParallaxLayerConfig | undefined,
    index: number
): TestWorldParallaxLayerConfig | null => {
    const image = normalizeBackgroundImage(raw, fallback);
    if (!image) {
        return null;
    }

    return {
        id: asString(raw?.id, fallback?.id ?? `layer_${index + 1}`),
        height: clampRectSize(asNumber(raw?.height, fallback?.height ?? 256)),
        scrollFactorX: clampScrollFactor(raw?.scrollFactorX, fallback?.scrollFactorX ?? 0.4),
        scrollFactorY: clampScrollFactor(raw?.scrollFactorY, fallback?.scrollFactorY ?? fallback?.scrollFactorX ?? 0.4),
        ...image
    };
};

const normalizeBackground = (
    rawValue: unknown,
    fallback: TestWorldBackgroundConfig | null
): TestWorldBackgroundConfig | null => {
    if (rawValue === undefined || rawValue === null) {
        return null;
    }

    const raw = asObject(rawValue);
    if (!raw) {
        return null;
    }

    const color = asColor(raw.color, fallback?.color ?? DEFAULT_BACKGROUND_COLOR);
    const staticImage = normalizeBackgroundImage(asObject(raw.staticImage), fallback?.staticImage);

    const rawLayers = asArray(raw.layers).slice(0, MAX_BACKGROUND_LAYERS);
    const fallbackLayers = fallback?.layers ?? [];
    const normalizedLayers = rawLayers
        .map((entry, index) => normalizeParallaxLayer(asObject(entry), fallbackLayers[index], index))
        .filter((entry): entry is TestWorldParallaxLayerConfig => entry !== null);

    return {
        color,
        staticImage,
        layers: normalizedLayers
    };
};

const normalizeSurface = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldSurfaceConfig,
    usedIds: Set<string>,
    index: number
): TestWorldSurfaceConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `surface_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor) ?? fallback.fillColor,
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor) ?? fallback.strokeColor,
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeHazard = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldHazardConfig,
    usedIds: Set<string>,
    index: number
): TestWorldHazardConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `hazard_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeCheckpoint = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldCheckpointConfig,
    usedIds: Set<string>,
    index: number
): TestWorldCheckpointConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `checkpoint_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        respawnX: asNumber(raw?.respawnX, fallback.respawnX),
        respawnY: asNumber(raw?.respawnY, fallback.respawnY),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeFinish = (
    rawValue: unknown,
    fallback: TestWorldFinishConfig | null,
    usedIds: Set<string>
): TestWorldFinishConfig | null => {
    if (rawValue === null) {
        return null;
    }

    const raw = asObject(rawValue);
    if (raw === null && fallback === null) {
        return null;
    }

    const safeFallback = fallback ?? TEST_WORLD_CONFIG.finish;
    return {
        id: ensureUniqueId(asString(raw?.id, safeFallback.id), usedIds, 'finish'),
        x: asNumber(raw?.x, safeFallback.x),
        y: asNumber(raw?.y, safeFallback.y),
        width: clampRectSize(asNumber(raw?.width, safeFallback.width)),
        height: clampRectSize(asNumber(raw?.height, safeFallback.height)),
        fillColor: asColor(raw?.fillColor, safeFallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, safeFallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeMovingPlatform = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldMovingPlatformConfig,
    usedIds: Set<string>,
    index: number
): TestWorldMovingPlatformConfig => {
    const axis = raw?.axis === 'vertical' ? 'vertical' : 'horizontal';
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `moving_platform_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        axis,
        travelDistance: Math.max(0, asNumber(raw?.travelDistance, fallback.travelDistance)),
        speed: Math.max(0, asNumber(raw?.speed, fallback.speed)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeTriggerPlatform = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriggerPlatformConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTriggerPlatformConfig => {
    const hasDeactivate = typeof raw?.deactivateTriggerX === 'number'
        && typeof raw?.deactivateTriggerY === 'number'
        && typeof raw?.deactivateTriggerWidth === 'number'
        && typeof raw?.deactivateTriggerHeight === 'number';

    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `trigger_platform_${index + 1}`),
        triggerX: asNumber(raw?.triggerX, fallback.triggerX),
        triggerY: asNumber(raw?.triggerY, fallback.triggerY),
        triggerWidth: clampRectSize(asNumber(raw?.triggerWidth, fallback.triggerWidth)),
        triggerHeight: clampRectSize(asNumber(raw?.triggerHeight, fallback.triggerHeight)),
        deactivateTriggerX: hasDeactivate ? asNumber(raw?.deactivateTriggerX, fallback.deactivateTriggerX ?? fallback.triggerX) : undefined,
        deactivateTriggerY: hasDeactivate ? asNumber(raw?.deactivateTriggerY, fallback.deactivateTriggerY ?? fallback.triggerY) : undefined,
        deactivateTriggerWidth: hasDeactivate
            ? clampRectSize(asNumber(raw?.deactivateTriggerWidth, fallback.deactivateTriggerWidth ?? fallback.triggerWidth))
            : undefined,
        deactivateTriggerHeight: hasDeactivate
            ? clampRectSize(asNumber(raw?.deactivateTriggerHeight, fallback.deactivateTriggerHeight ?? fallback.triggerHeight))
            : undefined,
        platformX: asNumber(raw?.platformX, fallback.platformX),
        platformY: asNumber(raw?.platformY, fallback.platformY),
        platformWidth: clampRectSize(asNumber(raw?.platformWidth, fallback.platformWidth)),
        platformHeight: clampRectSize(asNumber(raw?.platformHeight, fallback.platformHeight)),
        activator: raw?.activator === 'drag_box' ? 'drag_box' : 'player',
        triggerAction: raw?.triggerAction === 'deactivate' ? 'deactivate' : 'activate',
        deactivateTriggerAction: raw?.deactivateTriggerAction === 'activate' ? 'activate' : 'deactivate',
        initiallyActive: asBoolean(raw?.initiallyActive, fallback.initiallyActive ?? false),
        triggerFillColor: asColor(raw?.triggerFillColor, fallback.triggerFillColor),
        triggerStrokeColor: asColor(raw?.triggerStrokeColor, fallback.triggerStrokeColor),
        deactivateTriggerFillColor: asColor(raw?.deactivateTriggerFillColor, fallback.deactivateTriggerFillColor),
        deactivateTriggerStrokeColor: asColor(raw?.deactivateTriggerStrokeColor, fallback.deactivateTriggerStrokeColor),
        platformFillColor: asColor(raw?.platformFillColor, fallback.platformFillColor),
        platformStrokeColor: asColor(raw?.platformStrokeColor, fallback.platformStrokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeDragBox = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldDragBoxConfig,
    usedIds: Set<string>,
    index: number
): TestWorldDragBoxConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `drag_box_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        targetTriggerPlatformId: typeof raw?.targetTriggerPlatformId === 'string' ? raw.targetTriggerPlatformId : fallback.targetTriggerPlatformId,
        gravityY: Math.max(0, asNumber(raw?.gravityY, fallback.gravityY ?? 2200)),
        mass: Math.max(1, asNumber(raw?.mass, fallback.mass ?? 10)),
        pullAcceleration: Math.max(0, asNumber(raw?.pullAcceleration, fallback.pullAcceleration ?? 1400)),
        pullMaxSpeed: Math.max(0, asNumber(raw?.pullMaxSpeed, fallback.pullMaxSpeed ?? 150)),
        dragX: Math.max(0, asNumber(raw?.dragX, fallback.dragX ?? 900)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeWindZone = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldWindZoneConfig,
    usedIds: Set<string>,
    index: number
): TestWorldWindZoneConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `wind_zone_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        directionX: raw?.directionX === -1 ? -1 : 1,
        force: Math.max(0, asNumber(raw?.force, fallback.force)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeBreakWall = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriangleFlightBreakWallConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTriangleFlightBreakWallConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `triangle_break_wall_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizePickup = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTrianglePickupConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTrianglePickupConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `triangle_pickup_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        radius: clampPickupRadius(asNumber(raw?.radius, fallback.radius)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeArray = <T>(
    rawItems: unknown,
    defaults: readonly T[],
    normalizeItem: (raw: Record<string, unknown> | null, fallback: T, usedIds: Set<string>, index: number) => T,
    usedIds: Set<string>
): T[] => {
    const rawArrayProvided = Array.isArray(rawItems);
    const sourceItems = asArray(rawItems);
    const safeLength = rawArrayProvided ? sourceItems.length : defaults.length;
    const normalized: T[] = [];

    for (let index = 0; index < safeLength; index += 1) {
        const fallback = defaults[index] ?? defaults[Math.max(0, defaults.length - 1)];
        if (!fallback) {
            break;
        }

        const raw = asObject(sourceItems[index]);
        normalized.push(normalizeItem(raw, fallback, usedIds, index));
    }

    return normalized;
};

const fixDanglingDragBoxTargets = (config: TestWorldConfig): void => {
    const triggerPlatformIds = new Set(config.triggerPlatforms.map((entry) => entry.id));
    config.dragBoxes.forEach((dragBox) => {
        if (dragBox.targetTriggerPlatformId && !triggerPlatformIds.has(dragBox.targetTriggerPlatformId)) {
            dragBox.targetTriggerPlatformId = undefined;
        }
    });
};

export interface ParseTestWorldConfigResult {
    config: TestWorldConfig | null;
    error: string | null;
}

export interface NormalizeTestWorldConfigOptions {
    fallbackConfig?: TestWorldConfig;
}

export const normalizeTestWorldConfig = (
    input: unknown,
    options?: NormalizeTestWorldConfigOptions
): TestWorldConfig => {
    const defaults = cloneTestWorldConfig(options?.fallbackConfig ?? TEST_WORLD_CONFIG);
    const root = asObject(input);
    const usedIds = new Set<string>();
    const normalized: TestWorldConfig = {
        meta: normalizeMeta(asObject(root?.meta), defaults.meta),
        worldBounds: normalizeWorldBounds(asObject(root?.worldBounds), defaults.worldBounds),
        background: normalizeBackground(root?.background, defaults.background),
        playerSpawn: normalizePlayerSpawn(asObject(root?.playerSpawn)),
        surfaces: normalizeArray(root?.surfaces, defaults.surfaces, normalizeSurface, usedIds),
        hazards: normalizeArray(root?.hazards, defaults.hazards, normalizeHazard, usedIds),
        checkpoints: normalizeArray(root?.checkpoints, defaults.checkpoints, normalizeCheckpoint, usedIds),
        finish: normalizeFinish(root?.finish, defaults.finish, usedIds),
        movingPlatforms: normalizeArray(root?.movingPlatforms, defaults.movingPlatforms, normalizeMovingPlatform, usedIds),
        triggerPlatforms: normalizeArray(root?.triggerPlatforms, defaults.triggerPlatforms, normalizeTriggerPlatform, usedIds),
        dragBoxes: normalizeArray(root?.dragBoxes, defaults.dragBoxes, normalizeDragBox, usedIds),
        windZones: normalizeArray(root?.windZones, defaults.windZones, normalizeWindZone, usedIds),
        triangleFlightBreakWalls: normalizeArray(
            root?.triangleFlightBreakWalls,
            defaults.triangleFlightBreakWalls,
            normalizeBreakWall,
            usedIds
        ),
        trianglePickups: normalizeArray(root?.trianglePickups, defaults.trianglePickups, normalizePickup, usedIds),
        nextLevelId: root?.nextLevelId === null
            ? null
            : typeof root?.nextLevelId === 'string' && root.nextLevelId.trim().length > 0
                ? root.nextLevelId.trim()
                : defaults.nextLevelId
    };
    fixDanglingDragBoxTargets(normalized);
    return normalized;
};

export const parseTestWorldConfigJson = (
    jsonText: string,
    options?: NormalizeTestWorldConfigOptions
): ParseTestWorldConfigResult => {
    try {
        const parsed = JSON.parse(jsonText) as unknown;
        return {
            config: normalizeTestWorldConfig(parsed, options),
            error: null
        };
    } catch (error) {
        return {
            config: null,
            error: error instanceof Error ? error.message : 'Invalid JSON.'
        };
    }
};

export const createDefaultTestWorldConfig = (fallbackConfig: TestWorldConfig = TEST_WORLD_CONFIG): TestWorldConfig => {
    return cloneTestWorldConfig(fallbackConfig);
};

export const createMinimalTestWorldConfig = (
    levelId: string,
    displayName: string
): TestWorldConfig => {
    return normalizeTestWorldConfig({
        meta: {
            id: levelId,
            displayName
        },
        worldBounds: {
            width: 1600,
            height: 900
        },
        background: null,
        playerSpawn: {
            x: 128,
            y: 128,
            width: 32,
            height: 64,
            fillColor: 0x81d4fa,
            strokeColor: 0x0277bd
        },
        surfaces: [],
        hazards: [],
        checkpoints: [],
        finish: null,
        movingPlatforms: [],
        triggerPlatforms: [],
        dragBoxes: [],
        windZones: [],
        triangleFlightBreakWalls: [],
        trianglePickups: [],
        nextLevelId: null
    });
};
