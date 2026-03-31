import {
    TEST_WORLD_CONFIG,
    cloneTestWorldConfig,
    type TestWorldCheckpointConfig,
    type TestWorldConfig,
    type TestWorldDragBoxConfig,
    type TestWorldHazardConfig,
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
    const sourceItems = asArray(rawItems);
    const safeLength = Math.max(sourceItems.length, defaults.length);
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

export const normalizeTestWorldConfig = (input: unknown): TestWorldConfig => {
    const defaults = cloneTestWorldConfig(TEST_WORLD_CONFIG);
    const root = asObject(input);
    const usedIds = new Set<string>();
    const normalized: TestWorldConfig = {
        playerSpawn: normalizePlayerSpawn(asObject(root?.playerSpawn)),
        surfaces: normalizeArray(root?.surfaces, defaults.surfaces, normalizeSurface, usedIds),
        hazards: normalizeArray(root?.hazards, defaults.hazards, normalizeHazard, usedIds),
        checkpoints: normalizeArray(root?.checkpoints, defaults.checkpoints, normalizeCheckpoint, usedIds),
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
        trianglePickups: normalizeArray(root?.trianglePickups, defaults.trianglePickups, normalizePickup, usedIds)
    };
    fixDanglingDragBoxTargets(normalized);
    return normalized;
};

export const parseTestWorldConfigJson = (jsonText: string): ParseTestWorldConfigResult => {
    try {
        const parsed = JSON.parse(jsonText) as unknown;
        return {
            config: normalizeTestWorldConfig(parsed),
            error: null
        };
    } catch (error) {
        return {
            config: null,
            error: error instanceof Error ? error.message : 'Invalid JSON.'
        };
    }
};

export const createDefaultTestWorldConfig = (): TestWorldConfig => {
    return cloneTestWorldConfig(TEST_WORLD_CONFIG);
};
