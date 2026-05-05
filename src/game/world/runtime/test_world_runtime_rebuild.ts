import type { TestWorldConfig } from './test_world_config';
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
        const nextConfig = normalizeTestWorldConfig(config, {
            fallbackConfig: currentConfig,
            preserveMissingBackgroundObjectFields: mode !== 'full_import',
            preserveMissingLogicFields: mode !== 'full_import'
        });
        return {
            success: true,
            nextConfig
        };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { success: false, reason };
    }
};
