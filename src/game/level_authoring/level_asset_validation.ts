import { validateNpcProfileRef } from '../authoring/validation/validation_service';
import type { AuthoringValidationContext, ValidationIssue } from '../authoring/validation/validation_types';
import { LevelAssetSchemaVersion } from './level_asset_types';
import type {
    LevelAsset,
    LevelAssetLayerType,
    LevelObject,
    LevelObjectType,
    NpcLevelObject
} from './level_asset_types';
import type { BackgroundLayerKind } from './background_authoring_types';
import type { CameraZone } from './camera_zone_types';
import type { MotionPath, MotionPathPlaybackMode, MotionPathTimingMode } from './motion_path_types';
import type { ObjectPrefab } from './object_prefab_types';

export interface LevelAssetValidationContext {
    readonly authoringContext: AuthoringValidationContext;
}

const LAYER_TYPES: ReadonlySet<LevelAssetLayerType> = new Set<LevelAssetLayerType>([
    'collision',
    'gameplay',
    'actors',
    'triggers',
    'platforms',
    'paths',
    'camera',
    'background',
    'decor',
    'debug'
]);

const OBJECT_TYPES: ReadonlySet<LevelObjectType> = new Set<LevelObjectType>([
    'player_spawn',
    'surface',
    'polygon_surface',
    'hazard',
    'checkpoint',
    'finish',
    'npc',
    'trigger',
    'moving_platform',
    'trigger_platform',
    'drag_box',
    'wind_zone',
    'triangle_flight_break_wall',
    'triangle_pickup',
    'camera_zone'
]);

const BACKGROUND_KINDS: ReadonlySet<BackgroundLayerKind> = new Set<BackgroundLayerKind>([
    'solid_color',
    'image',
    'tile_sprite',
    'parallax',
    'decor'
]);

const PLAYBACK_MODES_REQUIRING_POINTS: ReadonlySet<MotionPathPlaybackMode> = new Set<MotionPathPlaybackMode>([
    'loop',
    'ping_pong',
    'once'
]);

const TIMING_MODES: ReadonlySet<MotionPathTimingMode> = new Set<MotionPathTimingMode>(['speed', 'duration']);

const NPC_PHYSICS_MODES: ReadonlySet<NonNullable<NpcLevelObject['physicsMode']>> = new Set<
    NonNullable<NpcLevelObject['physicsMode']>
>(['dynamic', 'kinematic', 'static', 'ghost']);

const createIssue = (
    context: LevelAssetValidationContext,
    severity: ValidationIssue['severity'],
    code: string,
    message: string,
    path?: string
): ValidationIssue => ({
    severity,
    code,
    message,
    path,
    ...(context.authoringContext.source !== undefined ? { source: context.authoringContext.source } : {})
});

const isFinitePositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const isFiniteNonNegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const validateRectSize = (
    issues: ValidationIssue[],
    context: LevelAssetValidationContext,
    value: unknown,
    path: string
): void => {
    if (!isFinitePositive(value)) {
        issues.push(createIssue(context, 'error', 'invalid_level_object_size', 'Object size must be a finite number > 0.', path));
    }
};

const validateOptionalRectSize = (
    issues: ValidationIssue[],
    context: LevelAssetValidationContext,
    value: unknown,
    path: string
): void => {
    if (value !== undefined) {
        validateRectSize(issues, context, value, path);
    }
};

const validatePolygonPointCount = (
    issues: ValidationIssue[],
    context: LevelAssetValidationContext,
    points: unknown,
    path: string
): void => {
    if (!Array.isArray(points) || points.length < 3) {
        issues.push(
            createIssue(
                context,
                'error',
                'invalid_level_polygon',
                'Polygon must contain at least 3 points.',
                path
            )
        );
    }
};

const collectPrefabIds = (
    prefabs: readonly ObjectPrefab[],
    issues: ValidationIssue[],
    context: LevelAssetValidationContext
): ReadonlyMap<string, ReadonlySet<string>> => {
    const variantsByPrefab = new Map<string, ReadonlySet<string>>();
    const seenPrefabIds = new Set<string>();

    prefabs.forEach((prefab, prefabIndex) => {
        const prefabIdPath = `prefabs[${prefabIndex}].id`;
        const prefabId = typeof prefab.id === 'string' ? prefab.id.trim() : '';
        if (prefabId.length === 0) {
            issues.push(createIssue(context, 'error', 'missing_object_prefab_id', 'Prefab id is missing or empty.', prefabIdPath));
            return;
        }

        if (seenPrefabIds.has(prefabId)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'duplicate_object_prefab_id',
                    `Duplicate prefab id "${prefabId}".`,
                    prefabIdPath
                )
            );
            return;
        }

        seenPrefabIds.add(prefabId);

        const variantIds = new Set<string>();
        prefab.variants.forEach((variant, variantIndex) => {
            const variantPath = `prefabs[${prefabIndex}].variants[${variantIndex}].id`;
            const variantId = typeof variant.id === 'string' ? variant.id.trim() : '';
            if (variantId.length === 0) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'duplicate_object_prefab_variant_id',
                        `Prefab "${prefabId}" has an empty variant id.`,
                        variantPath
                    )
                );
                return;
            }

            if (variantIds.has(variantId)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'duplicate_object_prefab_variant_id',
                        `Duplicate prefab variant id "${variantId}" in prefab "${prefabId}".`,
                        variantPath
                    )
                );
                return;
            }

            variantIds.add(variantId);
        });

        variantsByPrefab.set(prefabId, variantIds);
    });

    return variantsByPrefab;
};

const validatePaths = (
    asset: LevelAsset,
    issues: ValidationIssue[],
    context: LevelAssetValidationContext
): ReadonlySet<string> => {
    const seenPathIds = new Set<string>();
    const pathIds = new Set<string>();

    asset.paths.forEach((path: MotionPath, pathIndex) => {
        const pathBase = `paths[${pathIndex}]`;
        const pathId = typeof path.id === 'string' ? path.id.trim() : '';
        if (pathId.length === 0) {
            issues.push(createIssue(context, 'error', 'missing_motion_path_id', 'Motion path id is missing or empty.', `${pathBase}.id`));
        } else if (seenPathIds.has(pathId)) {
            issues.push(
                createIssue(context, 'error', 'duplicate_motion_path_id', `Duplicate motion path id "${pathId}".`, `${pathBase}.id`)
            );
        } else {
            seenPathIds.add(pathId);
            pathIds.add(pathId);
        }

        if (PLAYBACK_MODES_REQUIRING_POINTS.has(path.playbackMode) && path.points.length < 2) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_motion_path',
                    'Motion paths in loop/ping_pong/once modes require at least 2 points.',
                    `${pathBase}.points`
                )
            );
        }

        if (path.playbackMode === 'manual' && path.points.length === 0) {
            issues.push(
                createIssue(
                    context,
                    'warning',
                    'empty_manual_motion_path',
                    'Manual motion path has no points.',
                    `${pathBase}.points`
                )
            );
        }

        if (!TIMING_MODES.has(path.timingMode)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_motion_path',
                    `Unsupported motion path timingMode "${String(path.timingMode)}".`,
                    `${pathBase}.timingMode`
                )
            );
        } else if (path.timingMode === 'speed') {
            if (!isFinitePositive(path.speedPxPerSec)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_motion_path',
                        'speedPxPerSec must be a finite number > 0 when timingMode is "speed".',
                        `${pathBase}.speedPxPerSec`
                    )
                );
            }
        } else if (!isFinitePositive(path.durationMs)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_motion_path',
                    'durationMs must be a finite number > 0 when timingMode is "duration".',
                    `${pathBase}.durationMs`
                )
            );
        }

        path.points.forEach((point, pointIndex) => {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_motion_path',
                        'Motion path point coordinates must be finite.',
                        `${pathBase}.points[${pointIndex}]`
                    )
                );
            }

            if (point.waitMs !== undefined && !isFiniteNonNegative(point.waitMs)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_motion_path',
                        'waitMs must be a finite number >= 0.',
                        `${pathBase}.points[${pointIndex}].waitMs`
                    )
                );
            }
        });
    });

    return pathIds;
};

const validateActorMarkers = (
    asset: LevelAsset,
    issues: ValidationIssue[],
    context: LevelAssetValidationContext
): void => {
    const seenMarkerIds = new Set<string>();

    asset.actorMarkers.forEach((marker, markerIndex) => {
        const markerBase = `actorMarkers[${markerIndex}]`;
        const markerId = typeof marker.id === 'string' ? marker.id.trim() : '';
        if (markerId.length === 0) {
            issues.push(createIssue(context, 'error', 'missing_actor_marker_id', 'Actor marker id is missing or empty.', `${markerBase}.id`));
        } else if (seenMarkerIds.has(markerId)) {
            issues.push(
                createIssue(context, 'error', 'duplicate_actor_marker_id', `Duplicate actor marker id "${markerId}".`, `${markerBase}.id`)
            );
        } else {
            seenMarkerIds.add(markerId);
        }

        if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_actor_marker',
                    'Actor marker x/y must be finite.',
                    markerBase
                )
            );
        }
    });
};

const validateCameraZones = (
    asset: LevelAsset,
    issues: ValidationIssue[],
    context: LevelAssetValidationContext
): ReadonlySet<string> => {
    const seenZoneIds = new Set<string>();
    const zoneIds = new Set<string>();

    asset.cameraZones.forEach((zone: CameraZone, zoneIndex) => {
        const zoneBase = `cameraZones[${zoneIndex}]`;
        const zoneId = typeof zone.id === 'string' ? zone.id.trim() : '';
        if (zoneId.length === 0) {
            issues.push(createIssue(context, 'error', 'missing_camera_zone_id', 'Camera zone id is missing or empty.', `${zoneBase}.id`));
        } else if (seenZoneIds.has(zoneId)) {
            issues.push(createIssue(context, 'error', 'duplicate_camera_zone_id', `Duplicate camera zone id "${zoneId}".`, `${zoneBase}.id`));
        } else {
            seenZoneIds.add(zoneId);
            zoneIds.add(zoneId);
        }

        if (!isFinitePositive(zone.width) || !isFinitePositive(zone.height)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_camera_zone',
                    'Camera zone width/height must be finite numbers > 0.',
                    zoneBase
                )
            );
        }
    });

    return zoneIds;
};

const validateBackground = (
    asset: LevelAsset,
    issues: ValidationIssue[],
    context: LevelAssetValidationContext
): void => {
    const seenLayerIds = new Set<string>();

    asset.background.layers.forEach((layer, layerIndex) => {
        const layerBase = `background.layers[${layerIndex}]`;
        const layerId = typeof layer.id === 'string' ? layer.id.trim() : '';
        if (layerId.length === 0) {
            issues.push(
                createIssue(context, 'error', 'missing_background_layer_id', 'Background layer id is missing or empty.', `${layerBase}.id`)
            );
        } else if (seenLayerIds.has(layerId)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'duplicate_background_layer_id',
                    `Duplicate background layer id "${layerId}".`,
                    `${layerBase}.id`
                )
            );
        } else {
            seenLayerIds.add(layerId);
        }

        if (!BACKGROUND_KINDS.has(layer.kind)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_background_layer_kind',
                    `Background layer kind "${String(layer.kind)}" is invalid.`,
                    `${layerBase}.kind`
                )
            );
        }
    });
};

const validateInitialFlags = (
    asset: LevelAsset,
    issues: ValidationIssue[],
    context: LevelAssetValidationContext
): void => {
    const rawFlags = asset.initialFlags as Readonly<Record<string, unknown>>;
    Object.entries(rawFlags).forEach(([key, value]) => {
        if (key.trim().length === 0 || typeof value !== 'boolean') {
            const path = key.length > 0 ? `initialFlags.${key}` : 'initialFlags';
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_initial_flag',
                    'Initial flags must have non-empty string keys and boolean values.',
                    path
                )
            );
        }
    });
};

const validateObjectSpecificShape = (
    object: LevelObject,
    objectBase: string,
    issues: ValidationIssue[],
    context: LevelAssetValidationContext,
    pathIds: ReadonlySet<string>,
    cameraZoneIds: ReadonlySet<string>
): void => {
    switch (object.type) {
        case 'surface':
            validateRectSize(issues, context, object.width, `${objectBase}.width`);
            validateRectSize(issues, context, object.height, `${objectBase}.height`);
            return;
        case 'polygon_surface':
            validatePolygonPointCount(issues, context, object.polygon?.points, `${objectBase}.polygon.points`);
            return;
        case 'hazard':
            validateOptionalRectSize(issues, context, object.width, `${objectBase}.width`);
            validateOptionalRectSize(issues, context, object.height, `${objectBase}.height`);
            if (object.polygon !== undefined) {
                validatePolygonPointCount(issues, context, object.polygon.points, `${objectBase}.polygon.points`);
            }
            return;
        case 'checkpoint':
            validateOptionalRectSize(issues, context, object.width, `${objectBase}.width`);
            validateOptionalRectSize(issues, context, object.height, `${objectBase}.height`);
            return;
        case 'finish':
            validateOptionalRectSize(issues, context, object.width, `${objectBase}.width`);
            validateOptionalRectSize(issues, context, object.height, `${objectBase}.height`);
            return;
        case 'npc': {
            if (!isNonEmptyString(object.npcInstanceId)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_level_npc_object',
                        'NPC object requires npcInstanceId.',
                        `${objectBase}.npcInstanceId`
                    )
                );
            }
            if (object.npcProfileId !== undefined) {
                issues.push(
                    ...validateNpcProfileRef(context.authoringContext, object.npcProfileId, `${objectBase}.npcProfileId`).map((issue) => ({
                        ...issue,
                        source: issue.source ?? context.authoringContext.source
                    }))
                );
            }
            if (object.physicsMode !== undefined && !NPC_PHYSICS_MODES.has(object.physicsMode)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_level_npc_object',
                        `Invalid npc physicsMode "${String(object.physicsMode)}".`,
                        `${objectBase}.physicsMode`
                    )
                );
            }
            return;
        }
        case 'trigger':
            if (!isNonEmptyString(object.triggerId)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_level_trigger_object',
                        'Trigger object requires triggerId.',
                        `${objectBase}.triggerId`
                    )
                );
            }
            validateOptionalRectSize(issues, context, object.width, `${objectBase}.width`);
            validateOptionalRectSize(issues, context, object.height, `${objectBase}.height`);
            if (object.polygon !== undefined) {
                validatePolygonPointCount(issues, context, object.polygon.points, `${objectBase}.polygon.points`);
            }
            return;
        case 'moving_platform':
            if (!isNonEmptyString(object.platformId)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_level_object_size',
                        'Moving platform object requires platformId.',
                        `${objectBase}.platformId`
                    )
                );
            }
            validateRectSize(issues, context, object.width, `${objectBase}.width`);
            validateRectSize(issues, context, object.height, `${objectBase}.height`);
            if (object.motionPathRef !== undefined && !pathIds.has(object.motionPathRef.trim())) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'unknown_level_motion_path_ref',
                        `Unknown motion path ref "${String(object.motionPathRef)}".`,
                        `${objectBase}.motionPathRef`
                    )
                );
            }
            return;
        case 'trigger_platform':
            if (!isNonEmptyString(object.platformId)) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'invalid_level_object_size',
                        'Trigger platform object requires platformId.',
                        `${objectBase}.platformId`
                    )
                );
            }
            validateRectSize(issues, context, object.width, `${objectBase}.width`);
            validateRectSize(issues, context, object.height, `${objectBase}.height`);
            if (object.motionPathRef !== undefined && !pathIds.has(object.motionPathRef.trim())) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'unknown_level_motion_path_ref',
                        `Unknown motion path ref "${String(object.motionPathRef)}".`,
                        `${objectBase}.motionPathRef`
                    )
                );
            }
            return;
        case 'drag_box':
            validateRectSize(issues, context, object.width, `${objectBase}.width`);
            validateRectSize(issues, context, object.height, `${objectBase}.height`);
            return;
        case 'wind_zone':
            validateRectSize(issues, context, object.width, `${objectBase}.width`);
            validateRectSize(issues, context, object.height, `${objectBase}.height`);
            return;
        case 'triangle_flight_break_wall':
            validateOptionalRectSize(issues, context, object.width, `${objectBase}.width`);
            validateOptionalRectSize(issues, context, object.height, `${objectBase}.height`);
            if (object.polygon !== undefined) {
                validatePolygonPointCount(issues, context, object.polygon.points, `${objectBase}.polygon.points`);
            }
            return;
        case 'camera_zone':
            if (!isNonEmptyString(object.cameraZoneId) || !cameraZoneIds.has(object.cameraZoneId.trim())) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'unknown_camera_zone_ref',
                        `Unknown camera zone ref "${String(object.cameraZoneId)}".`,
                        `${objectBase}.cameraZoneId`
                    )
                );
            }
            return;
        case 'player_spawn':
        case 'triangle_pickup':
            return;
        default:
            return;
    }
};

export const validateLevelAsset = (
    asset: LevelAsset,
    context: LevelAssetValidationContext
): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    if (!isNonEmptyString(asset.id)) {
        issues.push(createIssue(context, 'error', 'missing_level_asset_id', 'Level asset id is missing or empty.', 'id'));
    }

    if (asset.schemaVersion !== LevelAssetSchemaVersion) {
        issues.push(
            createIssue(
                context,
                'error',
                'invalid_level_asset_schema_version',
                `Level asset schemaVersion must be ${LevelAssetSchemaVersion}.`,
                'schemaVersion'
            )
        );
    }

    if (!isFinitePositive(asset.bounds.width) || !isFinitePositive(asset.bounds.height)) {
        issues.push(
            createIssue(
                context,
                'error',
                'invalid_level_asset_bounds',
                'Level bounds width/height must be finite numbers > 0.',
                'bounds'
            )
        );
    }

    if (asset.grid.enabled && !isFinitePositive(asset.grid.sizePx)) {
        issues.push(
            createIssue(
                context,
                'error',
                'invalid_level_asset_grid',
                'Grid sizePx must be a finite number > 0 when grid is enabled.',
                'grid.sizePx'
            )
        );
    }

    const seenLayerIds = new Set<string>();
    const layerIds = new Set<string>();
    asset.layers.forEach((layer, layerIndex) => {
        const layerBase = `layers[${layerIndex}]`;
        const layerId = typeof layer.id === 'string' ? layer.id.trim() : '';
        if (layerId.length === 0) {
            issues.push(createIssue(context, 'error', 'missing_level_layer_id', 'Layer id is missing or empty.', `${layerBase}.id`));
        } else if (seenLayerIds.has(layerId)) {
            issues.push(
                createIssue(context, 'error', 'duplicate_level_layer_id', `Duplicate layer id "${layerId}".`, `${layerBase}.id`)
            );
        } else {
            seenLayerIds.add(layerId);
            layerIds.add(layerId);
        }

        if (!LAYER_TYPES.has(layer.type)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_level_layer_type',
                    `Layer type "${String(layer.type)}" is invalid.`,
                    `${layerBase}.type`
                )
            );
        }
    });

    const prefabVariantsByPrefab = collectPrefabIds(asset.prefabs, issues, context);
    const pathIds = validatePaths(asset, issues, context);
    const cameraZoneIds = validateCameraZones(asset, issues, context);
    validateActorMarkers(asset, issues, context);
    validateBackground(asset, issues, context);
    validateInitialFlags(asset, issues, context);

    const seenObjectIds = new Set<string>();
    asset.objects.forEach((object: LevelObject, objectIndex) => {
        const objectBase = `objects[${objectIndex}]`;
        const objectId = typeof object.id === 'string' ? object.id.trim() : '';
        if (objectId.length === 0) {
            issues.push(createIssue(context, 'error', 'missing_level_object_id', 'Object id is missing or empty.', `${objectBase}.id`));
        } else if (seenObjectIds.has(objectId)) {
            issues.push(
                createIssue(context, 'error', 'duplicate_level_object_id', `Duplicate object id "${objectId}".`, `${objectBase}.id`)
            );
        } else {
            seenObjectIds.add(objectId);
        }

        const layerId = typeof object.layerId === 'string' ? object.layerId.trim() : '';
        if (!layerIds.has(layerId)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'unknown_level_object_layer',
                    `Object layerId "${String(object.layerId)}" does not reference an existing layer.`,
                    `${objectBase}.layerId`
                )
            );
        }

        if (!OBJECT_TYPES.has(object.type)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_level_object_type',
                    `Object type "${String(object.type)}" is invalid.`,
                    `${objectBase}.type`
                )
            );
        }

        if (!Number.isFinite(object.transform?.x) || !Number.isFinite(object.transform?.y)) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'invalid_level_object_transform',
                    'Object transform x/y must be finite.',
                    `${objectBase}.transform`
                )
            );
        }

        if (object.prefabRef !== undefined) {
            const prefabId = object.prefabRef.trim();
            const variantIds = prefabVariantsByPrefab.get(prefabId);
            if (!isNonEmptyString(prefabId) || variantIds === undefined) {
                issues.push(
                    createIssue(
                        context,
                        'error',
                        'unknown_object_prefab_ref',
                        `Object prefabRef "${String(object.prefabRef)}" does not reference an existing prefab.`,
                        `${objectBase}.prefabRef`
                    )
                );
            } else if (object.prefabVariantRef !== undefined) {
                const variantId = object.prefabVariantRef.trim();
                if (!isNonEmptyString(variantId) || !variantIds.has(variantId)) {
                    issues.push(
                        createIssue(
                            context,
                            'error',
                            'unknown_object_prefab_variant_ref',
                            `Object prefabVariantRef "${String(object.prefabVariantRef)}" is unknown for prefab "${prefabId}".`,
                            `${objectBase}.prefabVariantRef`
                        )
                    );
                }
            }
        } else if (object.prefabVariantRef !== undefined) {
            issues.push(
                createIssue(
                    context,
                    'error',
                    'unknown_object_prefab_variant_ref',
                    'prefabVariantRef requires prefabRef.',
                    `${objectBase}.prefabVariantRef`
                )
            );
        }

        validateObjectSpecificShape(object, objectBase, issues, context, pathIds, cameraZoneIds);
    });

    return issues;
};
