import { LevelAssetSchemaVersion } from './level_asset_types';
import type { LevelAsset, LevelAssetBounds, LevelObject } from './level_asset_types';
import type { BackgroundAuthoring } from './background_authoring_types';
import type { MotionPath } from './motion_path_types';
import type { TestWorldConfig } from '../world/runtime/test_world_config';

export interface TestWorldToLevelAssetAdapterIssue {
    readonly severity: 'warning' | 'info';
    readonly code: string;
    readonly message: string;
    readonly path?: string;
}

export interface TestWorldToLevelAssetAdapterResult {
    readonly asset: LevelAsset;
    readonly issues: readonly TestWorldToLevelAssetAdapterIssue[];
}

interface BoundsTracker {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    hasData: boolean;
}

const DEFAULT_BOUNDS: LevelAssetBounds = {
    x: 0,
    y: 0,
    width: 1280,
    height: 720
};

const DEFAULT_LAYERS: LevelAsset['layers'] = [
    { id: 'collision', type: 'collision', displayName: 'Collision', visible: true, order: 0 },
    { id: 'gameplay', type: 'gameplay', displayName: 'Gameplay', visible: true, order: 1 },
    { id: 'actors', type: 'actors', displayName: 'Actors', visible: true, order: 2 },
    { id: 'triggers', type: 'triggers', displayName: 'Triggers', visible: true, order: 3 },
    { id: 'platforms', type: 'platforms', displayName: 'Platforms', visible: true, order: 4 },
    { id: 'paths', type: 'paths', displayName: 'Paths', visible: true, order: 5 },
    { id: 'camera', type: 'camera', displayName: 'Camera', visible: true, order: 6 },
    { id: 'background', type: 'background', displayName: 'Background', visible: true, order: 7 },
    { id: 'decor', type: 'decor', displayName: 'Decor', visible: true, order: 8 },
    { id: 'debug', type: 'debug', displayName: 'Debug', visible: false, order: 9 }
];

const createIssue = (
    severity: TestWorldToLevelAssetAdapterIssue['severity'],
    code: string,
    message: string,
    path?: string
): TestWorldToLevelAssetAdapterIssue => ({
    severity,
    code,
    message,
    ...(path !== undefined ? { path } : {})
});

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isFinitePositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Readonly<Record<string, unknown>>)
        : null;

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const createBoundsTracker = (): BoundsTracker => ({
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    hasData: false
});

const includeRect = (tracker: BoundsTracker, x: unknown, y: unknown, width: unknown, height: unknown): void => {
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFinitePositive(width) || !isFinitePositive(height)) {
        return;
    }

    tracker.minX = Math.min(tracker.minX, x);
    tracker.minY = Math.min(tracker.minY, y);
    tracker.maxX = Math.max(tracker.maxX, x + width);
    tracker.maxY = Math.max(tracker.maxY, y + height);
    tracker.hasData = true;
};

const includePoint = (tracker: BoundsTracker, x: unknown, y: unknown): void => {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return;
    }

    tracker.minX = Math.min(tracker.minX, x);
    tracker.minY = Math.min(tracker.minY, y);
    tracker.maxX = Math.max(tracker.maxX, x);
    tracker.maxY = Math.max(tracker.maxY, y);
    tracker.hasData = true;
};

const colorNumberToCssHex = (value: unknown): string | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    const clamped = Math.max(0, Math.min(0xffffff, Math.floor(value)));
    return `#${clamped.toString(16).padStart(6, '0')}`;
};

const pickDisplayName = (config: TestWorldConfig): string | undefined => {
    const meta = asRecord(config.meta) ?? {};
    return asNonEmptyString(meta.displayName) ?? asNonEmptyString(meta.title) ?? asNonEmptyString(meta.name);
};

const pickLevelId = (config: TestWorldConfig): string => {
    const meta = asRecord(config.meta) ?? {};
    return asNonEmptyString(meta.id) ?? 'legacy_test_world';
};

const pickGrid = (config: TestWorldConfig): LevelAsset['grid'] => {
    const root = asRecord(config) ?? {};
    const editor = asRecord(root.editor);
    const grid = editor ? asRecord(editor.grid) : null;

    if (grid !== null) {
        const enabled = typeof grid.enabled === 'boolean' ? grid.enabled : true;
        const sizePx = isFinitePositive(grid.sizePx) ? grid.sizePx : 16;
        const snap = typeof grid.snap === 'boolean' ? grid.snap : false;
        return { enabled, sizePx, snap };
    }

    return { enabled: true, sizePx: 16, snap: false };
};

const createStableId = (
    raw: unknown,
    fallbackPrefix: string,
    index: number,
    issues: TestWorldToLevelAssetAdapterIssue[],
    path: string
): string => {
    const id = asNonEmptyString(raw);
    if (id !== undefined) {
        return id;
    }

    const generated = `${fallbackPrefix}.${index}`;
    issues.push(
        createIssue('warning', 'generated_level_object_id', `Generated fallback object id "${generated}".`, path)
    );
    return generated;
};

const mapBackground = (config: TestWorldConfig): BackgroundAuthoring => {
    const background = config.background;
    if (background === null) {
        return { layers: [] };
    }

    const layers: Array<BackgroundAuthoring['layers'][number]> = [];
    let order = 0;

    const color = colorNumberToCssHex(background.color);
    if (color !== undefined) {
        layers.push({
            id: 'background.color',
            kind: 'solid_color',
            visible: true,
            order: order++,
            color
        });
    }

    if (background.staticImage !== undefined) {
        layers.push({
            id: 'background.static_image',
            kind: 'image',
            visible: true,
            order: order++,
            assetId: asNonEmptyString(background.staticImage.textureAsset) ?? background.staticImage.textureKey,
            x: background.staticImage.x,
            y: background.staticImage.y,
            scaleX: background.staticImage.scale,
            scaleY: background.staticImage.scale,
            repeatX: background.staticImage.repeat,
            repeatY: background.staticImage.repeat
        });
    }

    background.layers?.forEach((layer, index) => {
        layers.push({
            id: asNonEmptyString(layer.id) ?? `background.parallax.${index}`,
            kind: 'parallax',
            visible: true,
            order: order++,
            assetId: asNonEmptyString(layer.textureAsset) ?? layer.textureKey,
            x: layer.x,
            y: layer.y,
            scrollFactorX: layer.scrollFactorX,
            scrollFactorY: layer.scrollFactorY,
            scaleX: layer.scale,
            scaleY: layer.scale,
            repeatX: layer.repeat,
            repeatY: layer.repeat
        });
    });

    return { layers };
};

const deriveBounds = (
    config: TestWorldConfig,
    tracker: BoundsTracker,
    issues: TestWorldToLevelAssetAdapterIssue[]
): LevelAssetBounds => {
    if (isFinitePositive(config.worldBounds?.width) && isFinitePositive(config.worldBounds?.height)) {
        return {
            x: 0,
            y: 0,
            width: config.worldBounds.width,
            height: config.worldBounds.height
        };
    }

    if (tracker.hasData) {
        const width = tracker.maxX - tracker.minX;
        const height = tracker.maxY - tracker.minY;
        if (isFinitePositive(width) && isFinitePositive(height)) {
            return {
                x: tracker.minX,
                y: tracker.minY,
                width,
                height
            };
        }
    }

    issues.push(
        createIssue(
            'info',
            'fallback_level_bounds_used',
            'World bounds were unavailable; using default fallback bounds.',
            'worldBounds'
        )
    );
    return DEFAULT_BOUNDS;
};

const pushUnsupportedFieldWarning = (
    issues: TestWorldToLevelAssetAdapterIssue[],
    fieldPath: string,
    detail: string
): void => {
    issues.push(createIssue('warning', 'unsupported_test_world_field', detail, fieldPath));
};

export const adaptTestWorldConfigToLevelAsset = (config: TestWorldConfig): TestWorldToLevelAssetAdapterResult => {
    const issues: TestWorldToLevelAssetAdapterIssue[] = [];
    const tracker = createBoundsTracker();

    const objects: LevelObject[] = [];
    const paths: MotionPath[] = [];

    const initialFlags: Record<string, boolean> = {};
    if (config.worldFlags !== undefined) {
        const flags = config.worldFlags as Readonly<Record<string, unknown>>;
        Object.entries(flags).forEach(([flagName, flagValue]) => {
            if (flagName.trim().length === 0) {
                issues.push(
                    createIssue(
                        'warning',
                        'invalid_initial_flag',
                        'Skipped world flag with empty key.',
                        'worldFlags'
                    )
                );
                return;
            }
            if (typeof flagValue !== 'boolean') {
                issues.push(
                    createIssue(
                        'warning',
                        'invalid_initial_flag',
                        `Skipped world flag "${flagName}" because value is not boolean.`,
                        `worldFlags.${flagName}`
                    )
                );
                return;
            }
            initialFlags[flagName] = flagValue;
        });
    }

    if (config.worldLogicRules !== undefined && config.worldLogicRules.length > 0) {
        pushUnsupportedFieldWarning(
            issues,
            'worldLogicRules',
            'worldLogicRules are not represented in LevelAsset and were not converted.'
        );
    }

    if (config.nextLevelId !== null) {
        pushUnsupportedFieldWarning(
            issues,
            'nextLevelId',
            'nextLevelId is not represented in LevelAsset and was not converted.'
        );
    }

    includeRect(tracker, config.playerSpawn?.x, config.playerSpawn?.y, config.playerSpawn?.width, config.playerSpawn?.height);
    objects.push({
        id: 'player_spawn',
        type: 'player_spawn',
        layerId: 'actors',
        transform: {
            x: config.playerSpawn.x,
            y: config.playerSpawn.y
        }
    });

    config.surfaces.forEach((surface, index) => {
        includeRect(tracker, surface.x, surface.y, surface.width, surface.height);
        objects.push({
            id: createStableId(surface.id, 'surface', index, issues, `surfaces[${index}].id`),
            type: 'surface',
            layerId: 'collision',
            transform: { x: surface.x, y: surface.y },
            width: surface.width,
            height: surface.height
        });
    });

    config.hazards.forEach((hazard, index) => {
        includeRect(tracker, hazard.x, hazard.y, hazard.width, hazard.height);
        objects.push({
            id: createStableId(hazard.id, 'hazard', index, issues, `hazards[${index}].id`),
            type: 'hazard',
            layerId: 'gameplay',
            transform: { x: hazard.x, y: hazard.y },
            width: hazard.width,
            height: hazard.height
        });
    });

    config.checkpoints.forEach((checkpoint, index) => {
        includeRect(tracker, checkpoint.x, checkpoint.y, checkpoint.width, checkpoint.height);
        const checkpointId = createStableId(checkpoint.id, 'checkpoint', index, issues, `checkpoints[${index}].id`);
        objects.push({
            id: checkpointId,
            type: 'checkpoint',
            layerId: 'gameplay',
            transform: { x: checkpoint.x, y: checkpoint.y },
            width: checkpoint.width,
            height: checkpoint.height,
            checkpointId
        });
    });

    if (config.finish !== null) {
        includeRect(tracker, config.finish.x, config.finish.y, config.finish.width, config.finish.height);
        objects.push({
            id: createStableId(config.finish.id, 'finish', 0, issues, 'finish.id'),
            type: 'finish',
            layerId: 'gameplay',
            transform: { x: config.finish.x, y: config.finish.y },
            width: config.finish.width,
            height: config.finish.height
        });
    }

    config.npcs.forEach((npc, index) => {
        includePoint(tracker, npc.x, npc.y);
        const npcId = createStableId(npc.id, 'npc', index, issues, `npcs[${index}].id`);
        objects.push({
            id: npcId,
            type: 'npc',
            layerId: 'actors',
            transform: { x: npc.x, y: npc.y },
            npcInstanceId: npcId,
            npcProfileId: npc.profileId
        });
    });

    config.triggerVolumes.forEach((trigger, index) => {
        includeRect(tracker, trigger.triggerX, trigger.triggerY, trigger.triggerWidth, trigger.triggerHeight);
        const triggerId = createStableId(trigger.id, 'trigger', index, issues, `triggerVolumes[${index}].id`);
        objects.push({
            id: triggerId,
            type: 'trigger',
            layerId: 'triggers',
            transform: { x: trigger.triggerX, y: trigger.triggerY },
            triggerId,
            width: trigger.triggerWidth,
            height: trigger.triggerHeight
        });

        if (
            trigger.deactivateTriggerX !== undefined ||
            trigger.deactivateTriggerY !== undefined ||
            trigger.deactivateTriggerWidth !== undefined ||
            trigger.deactivateTriggerHeight !== undefined
        ) {
            pushUnsupportedFieldWarning(
                issues,
                `triggerVolumes[${index}].deactivateTrigger*`,
                'Deactivate trigger volumes are not represented in LevelAsset trigger objects and were skipped.'
            );
        }
        if ((trigger.sourceIds?.length ?? 0) > 0 || trigger.enterCommand !== null || trigger.exitCommand !== null) {
            pushUnsupportedFieldWarning(
                issues,
                `triggerVolumes[${index}]`,
                'Trigger command/source mappings are not represented in LevelAsset trigger objects and were skipped.'
            );
        }
        if ((trigger.onEnter?.length ?? 0) > 0 || (trigger.onExit?.length ?? 0) > 0 || (trigger.onStay?.length ?? 0) > 0) {
            pushUnsupportedFieldWarning(
                issues,
                `triggerVolumes[${index}]`,
                'Trigger event blocks are not represented in LevelAsset trigger objects and were skipped.'
            );
        }
    });

    config.movingPlatforms.forEach((platform, index) => {
        includeRect(tracker, platform.x, platform.y, platform.width, platform.height);

        const platformId = createStableId(platform.id, 'moving_platform', index, issues, `movingPlatforms[${index}].id`);
        const pathId = `motion_path.${platformId}`;

        const distance = isFiniteNumber(platform.travelDistance) ? platform.travelDistance : 0;
        const speed = isFinitePositive(platform.speed) ? platform.speed : 1;
        const endX = platform.axis === 'horizontal' ? platform.x + distance : platform.x;
        const endY = platform.axis === 'vertical' ? platform.y + distance : platform.y;

        paths.push({
            id: pathId,
            displayName: `Legacy ${platformId} path`,
            playbackMode: platform.initialMotionState === 'run_once' ? 'once' : 'loop',
            timingMode: 'speed',
            speedPxPerSec: speed,
            points: [
                { id: `${pathId}.p0`, x: platform.x, y: platform.y },
                { id: `${pathId}.p1`, x: endX, y: endY }
            ]
        });
        issues.push(
            createIssue(
                'info',
                'legacy_platform_axis_converted_to_motion_path',
                `Converted legacy moving platform "${platformId}" axis/travelDistance into a 2-point motion path.`,
                `movingPlatforms[${index}]`
            )
        );

        objects.push({
            id: platformId,
            type: 'moving_platform',
            layerId: 'platforms',
            transform: { x: platform.x, y: platform.y },
            platformId,
            width: platform.width,
            height: platform.height,
            motionPathRef: pathId,
            motionStateId: platform.initialMotionState
        });
    });

    config.triggerPlatforms.forEach((platform, index) => {
        includeRect(tracker, platform.platformX, platform.platformY, platform.platformWidth, platform.platformHeight);
        includeRect(tracker, platform.triggerX, platform.triggerY, platform.triggerWidth, platform.triggerHeight);

        const platformId = createStableId(platform.id, 'trigger_platform', index, issues, `triggerPlatforms[${index}].id`);
        objects.push({
            id: platformId,
            type: 'trigger_platform',
            layerId: 'platforms',
            transform: { x: platform.platformX, y: platform.platformY },
            platformId,
            width: platform.platformWidth,
            height: platform.platformHeight,
            triggerId: platformId
        });

        if (
            platform.deactivateTriggerX !== undefined ||
            platform.deactivateTriggerY !== undefined ||
            platform.deactivateTriggerWidth !== undefined ||
            platform.deactivateTriggerHeight !== undefined
        ) {
            pushUnsupportedFieldWarning(
                issues,
                `triggerPlatforms[${index}].deactivateTrigger*`,
                'Deactivate trigger area for trigger_platform is not represented in LevelAsset and was skipped.'
            );
        }
    });

    config.dragBoxes.forEach((dragBox, index) => {
        includeRect(tracker, dragBox.x, dragBox.y, dragBox.width, dragBox.height);
        objects.push({
            id: createStableId(dragBox.id, 'drag_box', index, issues, `dragBoxes[${index}].id`),
            type: 'drag_box',
            layerId: 'gameplay',
            transform: { x: dragBox.x, y: dragBox.y },
            width: dragBox.width,
            height: dragBox.height
        });
    });

    config.windZones.forEach((windZone, index) => {
        includeRect(tracker, windZone.x, windZone.y, windZone.width, windZone.height);
        objects.push({
            id: createStableId(windZone.id, 'wind_zone', index, issues, `windZones[${index}].id`),
            type: 'wind_zone',
            layerId: 'gameplay',
            transform: { x: windZone.x, y: windZone.y },
            width: windZone.width,
            height: windZone.height,
            forceX: windZone.directionX * windZone.force,
            forceY: 0
        });
    });

    config.triangleFlightBreakWalls.forEach((wall, index) => {
        includeRect(tracker, wall.x, wall.y, wall.width, wall.height);
        objects.push({
            id: createStableId(
                wall.id,
                'triangle_flight_break_wall',
                index,
                issues,
                `triangleFlightBreakWalls[${index}].id`
            ),
            type: 'triangle_flight_break_wall',
            layerId: 'gameplay',
            transform: { x: wall.x, y: wall.y },
            width: wall.width,
            height: wall.height
        });
    });

    config.trianglePickups.forEach((pickup, index) => {
        includePoint(tracker, pickup.x, pickup.y);
        const pickupId = createStableId(pickup.id, 'triangle_pickup', index, issues, `trianglePickups[${index}].id`);
        objects.push({
            id: pickupId,
            type: 'triangle_pickup',
            layerId: 'gameplay',
            transform: { x: pickup.x, y: pickup.y },
            pickupId
        });
    });

    const actorMarkers: LevelAsset['actorMarkers'] = [
        {
            id: 'marker.player_spawn',
            kind: 'spawn',
            x: config.playerSpawn.x,
            y: config.playerSpawn.y
        },
        ...config.npcs.map((npc, index) => ({
            id: `marker.npc_spawn.${asNonEmptyString(npc.id) ?? index}`,
            kind: 'spawn' as const,
            actorId: asNonEmptyString(npc.id),
            x: npc.x,
            y: npc.y
        }))
    ];

    const rawConfig = asRecord(config) ?? {};
    const explicitCameraZones = Array.isArray(rawConfig.cameraZones) ? rawConfig.cameraZones : [];
    const cameraZones: LevelAsset['cameraZones'] = explicitCameraZones
        .map((zone, index) => {
            const zoneRecord = asRecord(zone);
            if (zoneRecord === null) {
                return null;
            }

            const id = asNonEmptyString(zoneRecord.id) ?? `camera_zone.${index}`;
            const x = isFiniteNumber(zoneRecord.x) ? zoneRecord.x : 0;
            const y = isFiniteNumber(zoneRecord.y) ? zoneRecord.y : 0;
            const width = isFinitePositive(zoneRecord.width) ? zoneRecord.width : 1;
            const height = isFinitePositive(zoneRecord.height) ? zoneRecord.height : 1;
            return {
                id,
                mode: 'bounds' as const,
                x,
                y,
                width,
                height
            };
        })
        .filter((zone): zone is NonNullable<typeof zone> => zone !== null);

    const knownTopLevelKeys = new Set<string>([
        'meta',
        'worldBounds',
        'background',
        'worldFlags',
        'worldLogicRules',
        'playerSpawn',
        'npcs',
        'surfaces',
        'hazards',
        'checkpoints',
        'finish',
        'movingPlatforms',
        'triggerPlatforms',
        'triggerVolumes',
        'dragBoxes',
        'windZones',
        'triangleFlightBreakWalls',
        'trianglePickups',
        'nextLevelId',
        'cameraZones',
        'editor'
    ]);

    Object.keys(rawConfig).forEach((key) => {
        if (!knownTopLevelKeys.has(key)) {
            pushUnsupportedFieldWarning(
                issues,
                key,
                `Top-level field "${key}" is not represented in LevelAsset and was not converted.`
            );
        }
    });

    const asset: LevelAsset = {
        schemaVersion: LevelAssetSchemaVersion,
        id: pickLevelId(config),
        displayName: pickDisplayName(config),
        bounds: deriveBounds(config, tracker, issues),
        grid: pickGrid(config),
        layers: DEFAULT_LAYERS,
        objects,
        prefabs: [],
        paths,
        actorMarkers,
        cameraZones,
        background: mapBackground(config),
        initialFlags
    };

    return {
        asset,
        issues
    };
};
