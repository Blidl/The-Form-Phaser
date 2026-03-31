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

export const loadTestWorldEditorDraft = (): LoadTestWorldDraftResult => {
    if (!canUseStorage()) {
        return {
            config: createDefaultTestWorldConfig(),
            source: 'default',
            error: null
        };
    }

    const raw = window.localStorage.getItem(TEST_WORLD_EDITOR_DRAFT_STORAGE_KEY);
    if (raw === null) {
        return {
            config: createDefaultTestWorldConfig(),
            source: 'default',
            error: null
        };
    }

    const parsed = parseTestWorldConfigJson(raw);
    if (parsed.config === null) {
        return {
            config: createDefaultTestWorldConfig(),
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

export const saveTestWorldEditorDraft = (config: TestWorldConfig): ParseTestWorldConfigResult => {
    const safeConfig = JSON.stringify(config, null, 2);
    if (canUseStorage()) {
        window.localStorage.setItem(TEST_WORLD_EDITOR_DRAFT_STORAGE_KEY, safeConfig);
    }

    return {
        config,
        error: null
    };
};

export const clearTestWorldEditorDraft = (): void => {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.removeItem(TEST_WORLD_EDITOR_DRAFT_STORAGE_KEY);
};
