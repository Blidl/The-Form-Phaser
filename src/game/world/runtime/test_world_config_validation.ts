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
    type TestWorldMovingPlatformMotionState,
    type TestWorldMovingPlatformConfig,
    type TestWorldPlayerSpawnConfig,
    type TestWorldSurfaceConfig,
    type TestWorldTriggerCommandConfig,
    type TestWorldTriangleFlightBreakWallConfig,
    type TestWorldTrianglePickupConfig,
    type TestWorldVisualLayer,
    type TestWorldVisualOrderConfig,
    type TestWorldTriggerPlatformConfig,
    type TestWorldTriggerVolumeConfig,
    type TestWorldWindZoneConfig
} from './test_world_config';
import type { TestNpcInstanceConfig } from '../../npc/npc_types';
import { isTestNpcScriptedSequenceRef } from '../../npc/npc_scripted_sequences';
import { isTestCutsceneRef } from '../../cutscene/test_cutscene_registry';

const MIN_RECT_SIZE = 8;
const MIN_PICKUP_RADIUS = 4;
const MIN_WORLD_SIZE = 64;
const MAX_BACKGROUND_LAYERS = 6;
const DEFAULT_BACKGROUND_COLOR = 0x263238;
const DEFAULT_TRIGGER_PLATFORM_FILL_COLOR = 0xfff59d;
const DEFAULT_TRIGGER_PLATFORM_STROKE_COLOR = 0xf9a825;
const DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_FILL_COLOR = 0xffccbc;
const DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_STROKE_COLOR = 0xe64a19;
const DEFAULT_TRIGGER_PLATFORM_BODY_FILL_COLOR = 0x616161;
const DEFAULT_TRIGGER_PLATFORM_BODY_STROKE_COLOR = 0xb0bec5;
const DEFAULT_TRIGGER_VOLUME_FILL_COLOR = 0xb3e5fc;
const DEFAULT_TRIGGER_VOLUME_STROKE_COLOR = 0x0277bd;
const DEFAULT_TRIGGER_VOLUME_DEACTIVATE_FILL_COLOR = 0xffccbc;
const DEFAULT_TRIGGER_VOLUME_DEACTIVATE_STROKE_COLOR = 0xe64a19;

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

const asVisualLayer = (
    value: unknown,
    fallback: TestWorldVisualLayer | undefined
): TestWorldVisualLayer | undefined => {
    if (value === 'background') {
        return 'layer_1';
    }
    if (value === 'gameplay') {
        return 'layer_3';
    }
    if (value === 'foreground') {
        return 'layer_5';
    }

    return value === 'layer_1'
        || value === 'layer_2'
        || value === 'layer_3'
        || value === 'layer_4'
        || value === 'layer_5'
        ? value
        : fallback;
};

const asRenderOrder = (value: unknown, fallback: number | undefined): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(-9999, Math.min(9999, Math.round(value)));
};

const normalizeVisualOrder = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldVisualOrderConfig
): Pick<TestWorldVisualOrderConfig, 'visualLayer' | 'renderOrder'> => {
    return {
        visualLayer: asVisualLayer(raw?.visualLayer, fallback.visualLayer),
        renderOrder: asRenderOrder(raw?.renderOrder, fallback.renderOrder)
    };
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

const asMotionState = (
    value: unknown,
    fallback: TestWorldMovingPlatformMotionState
): TestWorldMovingPlatformMotionState => {
    if (value === 'stopped' || value === 'run_once' || value === 'running_loop') {
        return value;
    }
    return fallback;
};

const asTriggerTargetType = (
    value: unknown,
    fallback: TestWorldTriggerCommandConfig['targetType']
): TestWorldTriggerCommandConfig['targetType'] => {
    return value === 'moving_platform' || value === 'trigger_platform' ? value : fallback;
};

const asTriggerOperation = (
    value: unknown,
    fallback: TestWorldTriggerCommandConfig['operation']
): TestWorldTriggerCommandConfig['operation'] => {
    return value === 'set_motion_state' || value === 'set_active' ? value : fallback;
};

const normalizeTriggerCommand = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriggerCommandConfig | null
): TestWorldTriggerCommandConfig | null => {
    if (!raw && !fallback) {
        return null;
    }

    const safeFallback = fallback ?? {
        targetType: 'trigger_platform',
        targetId: '',
        operation: 'set_active',
        value: true
    } satisfies TestWorldTriggerCommandConfig;
    const targetId = asString(raw?.targetId, safeFallback.targetId);
    if (targetId.length === 0) {
        return null;
    }

    const targetType = asTriggerTargetType(raw?.targetType, safeFallback.targetType);
    const operation = asTriggerOperation(raw?.operation, safeFallback.operation);
    const value = operation === 'set_motion_state'
        ? asMotionState(raw?.value, safeFallback.operation === 'set_motion_state' ? safeFallback.value as TestWorldMovingPlatformMotionState : 'running_loop')
        : asBoolean(raw?.value, safeFallback.operation === 'set_active' ? safeFallback.value as boolean : true);

    return {
        targetType,
        targetId,
        operation,
        value
    };
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
        alpha: clampAlpha(raw?.alpha, fallback.alpha ?? 1),
        collisionMode: raw?.collisionMode === 'visual_only' ? 'visual_only' : 'solid',
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, safeFallback)
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
        initialMotionState: asMotionState(raw?.initialMotionState, fallback.initialMotionState ?? 'running_loop'),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        initiallyActive: asBoolean(raw?.initiallyActive, false),
        triggerFillColor: asColor(raw?.triggerFillColor, fallback.triggerFillColor ?? DEFAULT_TRIGGER_PLATFORM_FILL_COLOR),
        triggerStrokeColor: asColor(raw?.triggerStrokeColor, fallback.triggerStrokeColor ?? DEFAULT_TRIGGER_PLATFORM_STROKE_COLOR),
        deactivateTriggerFillColor: asColor(
            raw?.deactivateTriggerFillColor,
            fallback.deactivateTriggerFillColor ?? DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_FILL_COLOR
        ),
        deactivateTriggerStrokeColor: asColor(
            raw?.deactivateTriggerStrokeColor,
            fallback.deactivateTriggerStrokeColor ?? DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_STROKE_COLOR
        ),
        platformFillColor: asColor(raw?.platformFillColor, fallback.platformFillColor ?? DEFAULT_TRIGGER_PLATFORM_BODY_FILL_COLOR),
        platformStrokeColor: asColor(raw?.platformStrokeColor, fallback.platformStrokeColor ?? DEFAULT_TRIGGER_PLATFORM_BODY_STROKE_COLOR),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeTriggerVolume = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriggerVolumeConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTriggerVolumeConfig => {
    const hasDeactivate = typeof raw?.deactivateTriggerX === 'number'
        && typeof raw?.deactivateTriggerY === 'number'
        && typeof raw?.deactivateTriggerWidth === 'number'
        && typeof raw?.deactivateTriggerHeight === 'number';
    const sourceIds = asArray(raw?.sourceIds)
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `trigger_volume_${index + 1}`),
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
        activator: raw?.activator === 'drag_box' ? 'drag_box' : 'player',
        sourceIds: sourceIds.length > 0 ? sourceIds : fallback.sourceIds,
        enterCommand: normalizeTriggerCommand(asObject(raw?.enterCommand), fallback.enterCommand ?? null),
        exitCommand: normalizeTriggerCommand(asObject(raw?.exitCommand), fallback.exitCommand ?? null),
        triggerFillColor: asColor(raw?.triggerFillColor, fallback.triggerFillColor ?? DEFAULT_TRIGGER_VOLUME_FILL_COLOR),
        triggerStrokeColor: asColor(raw?.triggerStrokeColor, fallback.triggerStrokeColor ?? DEFAULT_TRIGGER_VOLUME_STROKE_COLOR),
        deactivateTriggerFillColor: asColor(
            raw?.deactivateTriggerFillColor,
            fallback.deactivateTriggerFillColor ?? DEFAULT_TRIGGER_VOLUME_DEACTIVATE_FILL_COLOR
        ),
        deactivateTriggerStrokeColor: asColor(
            raw?.deactivateTriggerStrokeColor,
            fallback.deactivateTriggerStrokeColor ?? DEFAULT_TRIGGER_VOLUME_DEACTIVATE_STROKE_COLOR
        ),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
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
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeNpcInstance = (
    raw: Record<string, unknown> | null,
    usedIds: Set<string>,
    index: number
): TestNpcInstanceConfig | null => {
    const profileId = asString(raw?.profileId, '');
    if (profileId.length === 0) {
        return null;
    }

    const behaviorSource = asObject(raw?.behavior);
    const behavior = behaviorSource
        ? {
            passiveMode: behaviorSource.passiveMode === 'idle_patrol' || behaviorSource.passiveMode === 'idle'
                ? behaviorSource.passiveMode
                : undefined,
            patrolDistance: typeof behaviorSource.patrolDistance === 'number' && Number.isFinite(behaviorSource.patrolDistance)
                ? Math.max(0, behaviorSource.patrolDistance)
                : undefined,
            moveSpeed: typeof behaviorSource.moveSpeed === 'number' && Number.isFinite(behaviorSource.moveSpeed)
                ? Math.max(0, behaviorSource.moveSpeed)
                : undefined,
            patrolSpeed: typeof behaviorSource.patrolSpeed === 'number' && Number.isFinite(behaviorSource.patrolSpeed)
                ? Math.max(0, behaviorSource.patrolSpeed)
                : undefined,
            idleDurationMs: typeof behaviorSource.idleDurationMs === 'number' && Number.isFinite(behaviorSource.idleDurationMs)
                ? Math.max(0, behaviorSource.idleDurationMs)
                : undefined,
            patrolPauseMs: typeof behaviorSource.patrolPauseMs === 'number' && Number.isFinite(behaviorSource.patrolPauseMs)
                ? Math.max(0, behaviorSource.patrolPauseMs)
                : undefined,
            alertDurationMs: typeof behaviorSource.alertDurationMs === 'number' && Number.isFinite(behaviorSource.alertDurationMs)
                ? Math.max(0, behaviorSource.alertDurationMs)
                : undefined,
            chaseSpeed: typeof behaviorSource.chaseSpeed === 'number' && Number.isFinite(behaviorSource.chaseSpeed)
                ? Math.max(0, behaviorSource.chaseSpeed)
                : undefined,
            senseRadius: typeof behaviorSource.senseRadius === 'number' && Number.isFinite(behaviorSource.senseRadius)
                ? Math.max(0, behaviorSource.senseRadius)
                : undefined,
            chaseReleaseRadius: typeof behaviorSource.chaseReleaseRadius === 'number' && Number.isFinite(behaviorSource.chaseReleaseRadius)
                ? Math.max(0, behaviorSource.chaseReleaseRadius)
                : undefined,
            returnSpeed: typeof behaviorSource.returnSpeed === 'number' && Number.isFinite(behaviorSource.returnSpeed)
                ? Math.max(0, behaviorSource.returnSpeed)
                : undefined,
            postTolerance: typeof behaviorSource.postTolerance === 'number' && Number.isFinite(behaviorSource.postTolerance)
                ? Math.max(1, behaviorSource.postTolerance)
                : undefined
        }
        : undefined;

    const scriptedLoopRef = raw?.scriptedLoopRef === null
        ? null
        : (() => {
            const ref = asOptionalString(raw?.scriptedLoopRef);
            return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
        })();
    const hookOverridesSource = asObject(raw?.sequenceHookOverrides);
    const sequenceHookOverrides = hookOverridesSource
        ? {
            onSpawnSequenceRef: hookOverridesSource.onSpawnSequenceRef === null
                ? null
                : (() => {
                    const ref = asOptionalString(hookOverridesSource.onSpawnSequenceRef);
                    return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
                })(),
            onPlayerNearSequenceRef: hookOverridesSource.onPlayerNearSequenceRef === null
                ? null
                : (() => {
                    const ref = asOptionalString(hookOverridesSource.onPlayerNearSequenceRef);
                    return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
                })(),
            onPlayerFarSequenceRef: hookOverridesSource.onPlayerFarSequenceRef === null
                ? null
                : (() => {
                    const ref = asOptionalString(hookOverridesSource.onPlayerFarSequenceRef);
                    return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
                })()
        }
        : undefined;
    const interactionOverrideSource = asObject(raw?.interactionOverride);
    const interactionOverride = interactionOverrideSource
        ? {
            distancePx: typeof interactionOverrideSource.distancePx === 'number' && Number.isFinite(interactionOverrideSource.distancePx)
                ? Math.max(0, interactionOverrideSource.distancePx)
                : undefined,
            outcome: interactionOverrideSource.outcome === null
                ? null
                : (() => {
                    const outcomeSource = asObject(interactionOverrideSource.outcome);
                    if (!outcomeSource) {
                        return undefined;
                    }
                    if (outcomeSource.kind === 'run_sequence_ref') {
                        const sequenceRef = asOptionalString(outcomeSource.sequenceRef);
                        return sequenceRef && isTestNpcScriptedSequenceRef(sequenceRef)
                            ? {
                                kind: 'run_sequence_ref' as const,
                                sequenceRef
                            }
                            : undefined;
                    }
                    if (outcomeSource.kind === 'trigger_event') {
                        const eventId = asOptionalString(outcomeSource.eventId);
                        return eventId
                            ? {
                                kind: 'trigger_event' as const,
                                eventId
                            }
                            : undefined;
                    }
                    if (outcomeSource.kind === 'request_cutscene_ref') {
                        const cutsceneRef = asOptionalString(outcomeSource.cutsceneRef);
                        return cutsceneRef && isTestCutsceneRef(cutsceneRef)
                            ? {
                                kind: 'request_cutscene_ref' as const,
                                cutsceneRef
                            }
                            : undefined;
                    }
                    return undefined;
                })()
        }
        : undefined;

    return {
        id: ensureUniqueId(asString(raw?.id, `npc_${index + 1}`), usedIds, `npc_${index + 1}`),
        profileId,
        x: asNumber(raw?.x, 0),
        y: asNumber(raw?.y, 0),
        facing: raw?.facing === 'left' ? 'left' : raw?.facing === 'right' ? 'right' : undefined,
        scriptedLoopRef,
        sequenceHookOverrides,
        interactionOverride,
        playerBodyContactMode: raw?.playerBodyContactMode === 'block'
            || raw?.playerBodyContactMode === 'overlap'
            || raw?.playerBodyContactMode === 'ignore'
            ? raw.playerBodyContactMode
            : undefined,
        visualLayer: asVisualLayer(raw?.visualLayer, undefined),
        renderOrder: typeof raw?.renderOrder === 'number' && Number.isFinite(raw.renderOrder)
            ? Math.max(-9999, Math.min(9999, Math.round(raw.renderOrder)))
            : undefined,
        behavior
    };
};

const normalizeNpcInstances = (
    rawItems: unknown,
    defaults: readonly TestNpcInstanceConfig[],
    usedIds: Set<string>
): TestNpcInstanceConfig[] => {
    if (rawItems === undefined) {
        return defaults.map((entry, index) => normalizeNpcInstance({
            id: entry.id,
            profileId: entry.profileId,
            x: entry.x,
            y: entry.y,
            facing: entry.facing,
            scriptedLoopRef: entry.scriptedLoopRef,
            sequenceHookOverrides: entry.sequenceHookOverrides,
            interactionOverride: entry.interactionOverride,
            playerBodyContactMode: entry.playerBodyContactMode,
            behavior: entry.behavior
        }, usedIds, index)).filter((entry): entry is TestNpcInstanceConfig => entry !== null);
    }

    return asArray(rawItems)
        .map((entry, index) => normalizeNpcInstance(asObject(entry), usedIds, index))
        .filter((entry): entry is TestNpcInstanceConfig => entry !== null);
};

const normalizeArray = <T>(
    rawItems: unknown,
    defaults: readonly T[],
    normalizeItem: (raw: Record<string, unknown> | null, fallback: T, usedIds: Set<string>, index: number) => T,
    usedIds: Set<string>,
    getId?: (fallback: T) => string
): T[] => {
    const rawArrayProvided = Array.isArray(rawItems);
    const sourceItems = asArray(rawItems);
    const safeLength = rawArrayProvided ? sourceItems.length : defaults.length;
    const normalized: T[] = [];

    for (let index = 0; index < safeLength; index += 1) {
        const raw = asObject(sourceItems[index]);
        const rawId = typeof raw?.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : null;
        const matchedFallback = rawId && getId
            ? defaults.find((entry) => getId(entry) === rawId)
            : undefined;
        const fallback = matchedFallback ?? defaults[index] ?? defaults[Math.max(0, defaults.length - 1)];
        if (!fallback) {
            break;
        }

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

const fixDanglingTriggerCommandTargets = (config: TestWorldConfig): void => {
    const triggerPlatformIds = new Set(config.triggerPlatforms.map((entry) => entry.id));
    const movingPlatformIds = new Set(config.movingPlatforms.map((entry) => entry.id));
    const dragBoxIds = new Set(config.dragBoxes.map((entry) => entry.id));

    const sanitizeCommand = (command: TestWorldTriggerCommandConfig | null | undefined): TestWorldTriggerCommandConfig | null => {
        if (!command) {
            return null;
        }
        if (command.targetType === 'trigger_platform' && !triggerPlatformIds.has(command.targetId)) {
            return null;
        }
        if (command.targetType === 'moving_platform' && !movingPlatformIds.has(command.targetId)) {
            return null;
        }
        return command;
    };

    config.triggerVolumes.forEach((triggerVolume) => {
        triggerVolume.enterCommand = sanitizeCommand(triggerVolume.enterCommand);
        triggerVolume.exitCommand = sanitizeCommand(triggerVolume.exitCommand);
        if (triggerVolume.activator === 'drag_box' && triggerVolume.sourceIds) {
            triggerVolume.sourceIds = triggerVolume.sourceIds.filter((entry) => dragBoxIds.has(entry));
            if (triggerVolume.sourceIds.length === 0) {
                triggerVolume.sourceIds = undefined;
            }
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
        npcs: normalizeNpcInstances(root?.npcs, defaults.npcs, usedIds),
        surfaces: normalizeArray(root?.surfaces, defaults.surfaces, normalizeSurface, usedIds, (entry) => entry.id),
        hazards: normalizeArray(root?.hazards, defaults.hazards, normalizeHazard, usedIds, (entry) => entry.id),
        checkpoints: normalizeArray(root?.checkpoints, defaults.checkpoints, normalizeCheckpoint, usedIds, (entry) => entry.id),
        finish: normalizeFinish(root?.finish, defaults.finish, usedIds),
        movingPlatforms: normalizeArray(root?.movingPlatforms, defaults.movingPlatforms, normalizeMovingPlatform, usedIds, (entry) => entry.id),
        triggerPlatforms: normalizeArray(root?.triggerPlatforms, defaults.triggerPlatforms, normalizeTriggerPlatform, usedIds, (entry) => entry.id),
        triggerVolumes: normalizeArray(root?.triggerVolumes, defaults.triggerVolumes ?? [], normalizeTriggerVolume, usedIds, (entry) => entry.id),
        dragBoxes: normalizeArray(root?.dragBoxes, defaults.dragBoxes, normalizeDragBox, usedIds, (entry) => entry.id),
        windZones: normalizeArray(root?.windZones, defaults.windZones, normalizeWindZone, usedIds, (entry) => entry.id),
        triangleFlightBreakWalls: normalizeArray(
            root?.triangleFlightBreakWalls,
            defaults.triangleFlightBreakWalls,
            normalizeBreakWall,
            usedIds,
            (entry) => entry.id
        ),
        trianglePickups: normalizeArray(root?.trianglePickups, defaults.trianglePickups, normalizePickup, usedIds, (entry) => entry.id),
        nextLevelId: root?.nextLevelId === null
            ? null
            : typeof root?.nextLevelId === 'string' && root.nextLevelId.trim().length > 0
                ? root.nextLevelId.trim()
                : defaults.nextLevelId
    };
    fixDanglingDragBoxTargets(normalized);
    fixDanglingTriggerCommandTargets(normalized);
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
        npcs: [],
        surfaces: [],
        hazards: [],
        checkpoints: [],
        finish: null,
        movingPlatforms: [],
        triggerPlatforms: [],
        triggerVolumes: [],
        dragBoxes: [],
        windZones: [],
        triangleFlightBreakWalls: [],
        trianglePickups: [],
        nextLevelId: null
    });
};
