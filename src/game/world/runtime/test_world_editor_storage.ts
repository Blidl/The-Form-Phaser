import {
    createDefaultTestWorldConfig,
    normalizeTestWorldConfig,
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
    draftPresent: boolean;
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
            draftPresent: false,
            error: null
        };
    }

    const raw = window.localStorage.getItem(getLevelDraftStorageKey(levelId));
    if (raw === null) {
        return {
            config: createDefaultTestWorldConfig(fallbackConfig),
            source: 'default',
            draftPresent: false,
            error: null
        };
    }

    const parsed = parseTestWorldConfigJson(raw, { fallbackConfig });
    if (parsed.config === null) {
        return {
            config: createDefaultTestWorldConfig(fallbackConfig),
            source: 'default',
            draftPresent: true,
            error: parsed.error
        };
    }

    return {
        config: parsed.config,
        source: 'draft',
        draftPresent: true,
        error: null
    };
};

export const saveTestWorldEditorDraft = (levelId: string, config: TestWorldConfig): ParseTestWorldConfigResult => {
    const normalizedConfig = normalizeTestWorldConfig(config, { fallbackConfig: config });
    const safeConfig = JSON.stringify(normalizedConfig, null, 2);
    if (canUseStorage()) {
        window.localStorage.setItem(getLevelDraftStorageKey(levelId), safeConfig);
    }

    return {
        config: normalizedConfig,
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

export interface TestWorldEditorDraftStorageAuditSnapshot {
    storageKey: string;
    draftPresent: boolean;
    draftValid: boolean;
    draftNpcCount: number;
    draftNpcIds: string[];
    parseError: string | null;
    draftConfigSignature: string | null;
}

export const getTestWorldEditorDraftStorageAuditSnapshot = (
    levelId: string,
    fallbackConfig: TestWorldConfig
): TestWorldEditorDraftStorageAuditSnapshot => {
    const storageKey = getLevelDraftStorageKey(levelId);
    if (!canUseStorage()) {
        return {
            storageKey,
            draftPresent: false,
            draftValid: false,
            draftNpcCount: 0,
            draftNpcIds: [],
            parseError: null,
            draftConfigSignature: null
        };
    }

    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
        return {
            storageKey,
            draftPresent: false,
            draftValid: false,
            draftNpcCount: 0,
            draftNpcIds: [],
            parseError: null,
            draftConfigSignature: null
        };
    }

    const parsed = parseTestWorldConfigJson(raw, { fallbackConfig });
    if (parsed.config === null) {
        return {
            storageKey,
            draftPresent: true,
            draftValid: false,
            draftNpcCount: 0,
            draftNpcIds: [],
            parseError: parsed.error ?? 'invalid json',
            draftConfigSignature: null
        };
    }

    return {
        storageKey,
        draftPresent: true,
        draftValid: true,
        draftNpcCount: parsed.config.npcs.length,
        draftNpcIds: parsed.config.npcs.map((npc) => npc.id),
        parseError: null,
        draftConfigSignature: JSON.stringify(parsed.config)
    };
};
