import {
    createDefaultTestWorldConfig,
    parseTestWorldConfigJson,
    type ParseTestWorldConfigResult
} from './test_world_config_validation';
import type { TestWorldConfig } from './test_world_config';

export const TEST_WORLD_EDITOR_DRAFT_STORAGE_KEY = 'the-form:test-world:editor-draft:v1';

const canUseStorage = (): boolean => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export interface LoadTestWorldDraftResult {
    config: TestWorldConfig;
    source: 'draft' | 'default';
    error: string | null;
}

const getLevelDraftStorageKey = (levelId: string): string => {
    return `${TEST_WORLD_EDITOR_DRAFT_STORAGE_KEY}:${levelId}`;
};

export const loadTestWorldEditorDraft = (
    levelId: string,
    fallbackConfig: TestWorldConfig
): LoadTestWorldDraftResult => {
    if (!canUseStorage()) {
        return {
            config: createDefaultTestWorldConfig(fallbackConfig),
            source: 'default',
            error: null
        };
    }

    const raw = window.localStorage.getItem(getLevelDraftStorageKey(levelId));
    if (raw === null) {
        return {
            config: createDefaultTestWorldConfig(fallbackConfig),
            source: 'default',
            error: null
        };
    }

    const parsed = parseTestWorldConfigJson(raw, { fallbackConfig });
    if (parsed.config === null) {
        return {
            config: createDefaultTestWorldConfig(fallbackConfig),
            source: 'default',
            error: parsed.error
        };
    }

    return {
        config: parsed.config,
        source: 'draft',
        error: null
    };
};

export const saveTestWorldEditorDraft = (levelId: string, config: TestWorldConfig): ParseTestWorldConfigResult => {
    const safeConfig = JSON.stringify(config, null, 2);
    if (canUseStorage()) {
        window.localStorage.setItem(getLevelDraftStorageKey(levelId), safeConfig);
    }

    return {
        config,
        error: null
    };
};

export const clearTestWorldEditorDraft = (levelId: string): void => {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.removeItem(getLevelDraftStorageKey(levelId));
};

export const readSavedTestWorldEditorDraft = (
    levelId: string,
    fallbackConfig: TestWorldConfig
): TestWorldConfig | null => {
    if (!canUseStorage()) {
        return null;
    }

    const raw = window.localStorage.getItem(getLevelDraftStorageKey(levelId));
    if (raw === null) {
        return null;
    }

    const parsed = parseTestWorldConfigJson(raw, { fallbackConfig });
    return parsed.config;
};
