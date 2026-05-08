import { TEST_WORLD_CONFIG, type TestWorldConfig } from './test_world_config';
import { normalizeTestWorldConfig } from './test_world_config_validation';

export interface TestWorldRuntimeReplaceConfigOptions {
    mode?: 'runtime_patch' | 'full_import';
}

export type TestWorldRuntimeReplaceConfigResult =
    | {
        success: true;
        nextConfig: TestWorldConfig;
    }
    | {
        success: false;
        reason: string;
    };

export const normalizeRuntimeSetConfig = (
    config: TestWorldConfig,
    currentConfig: TestWorldConfig
): TestWorldConfig => {
    return normalizeTestWorldConfig(config, {
        fallbackConfig: currentConfig
    });
};

export const normalizeRuntimeReplaceConfig = (
    config: unknown,
    currentConfig: TestWorldConfig,
    options?: TestWorldRuntimeReplaceConfigOptions
): TestWorldRuntimeReplaceConfigResult => {
    try {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return { success: false, reason: 'Config must be a JSON object.' };
        }
        const mode = options?.mode ?? 'runtime_patch';
        const fallbackConfig = mode === 'full_import'
            ? TEST_WORLD_CONFIG
            : currentConfig;
        const nextConfig = normalizeTestWorldConfig(config, {
            fallbackConfig,
            preserveMissingBackgroundObjectFields: mode !== 'full_import',
            preserveMissingLogicFields: mode !== 'full_import',
            preserveMissingBehaviorScriptFields: mode !== 'full_import'
        });
        if (mode === 'full_import') {
            const root = config as Record<string, unknown>;
            const rawSurfaces = Array.isArray(root.surfaces) ? root.surfaces : [];
            const rawSurfaceById = new Map<string, Record<string, unknown>>();
            rawSurfaces.forEach((entry) => {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                    return;
                }
                const rawSurface = entry as Record<string, unknown>;
                const rawId = typeof rawSurface.id === 'string' ? rawSurface.id.trim() : '';
                if (rawId.length <= 0) {
                    return;
                }
                rawSurfaceById.set(rawId, rawSurface);
            });
            nextConfig.surfaces.forEach((surface, surfaceIndex) => {
                const rawSurface = rawSurfaceById.get(surface.id)
                    ?? (
                        rawSurfaces[surfaceIndex]
                        && typeof rawSurfaces[surfaceIndex] === 'object'
                        && !Array.isArray(rawSurfaces[surfaceIndex])
                            ? rawSurfaces[surfaceIndex] as Record<string, unknown>
                            : null
                    );
                const rawBehaviorScripts = rawSurface?.behaviorScripts;
                if (!rawBehaviorScripts || typeof rawBehaviorScripts !== 'object' || Array.isArray(rawBehaviorScripts)) {
                    surface.behaviorScripts = undefined;
                    return;
                }
                const source = rawBehaviorScripts as Record<string, unknown>;
                const move = typeof source.move === 'string' && source.move.trim().length > 0
                    ? source.move.trim()
                    : undefined;
                const rotate = typeof source.rotate === 'string' && source.rotate.trim().length > 0
                    ? source.rotate.trim()
                    : undefined;
                const defaultAction = typeof source.defaultAction === 'string' && source.defaultAction.trim().length > 0
                    ? source.defaultAction.trim()
                    : undefined;
                const actions = Array.isArray(source.actions)
                    ? source.actions
                        .filter((entry): entry is string => typeof entry === 'string')
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0)
                    : undefined;
                if (!move && !rotate && !defaultAction && (!actions || actions.length <= 0)) {
                    surface.behaviorScripts = undefined;
                    return;
                }
                surface.behaviorScripts = {
                    move,
                    rotate,
                    defaultAction,
                    actions: actions && actions.length > 0 ? actions : undefined
                };
            });
        }
        return {
            success: true,
            nextConfig
        };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { success: false, reason };
    }
};
