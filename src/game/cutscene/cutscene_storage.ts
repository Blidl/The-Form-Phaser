import {
    getDefaultTestCutsceneDefinitions,
    normalizeTestCutsceneDefinitions,
    parseTestCutsceneDefinitionsJson,
    type ParseTestCutsceneDefinitionsResult
} from './test_cutscene_registry';
import type { TestCutsceneDefinition } from './cutscene_types';

export const TEST_CUTSCENE_DRAFT_STORAGE_KEY = 'the-form:cutscenes:editor-draft:v1';

const canUseStorage = (): boolean => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export type TestCutsceneDraftStorageAction =
    | 'none'
    | 'loaded_draft'
    | 'cleared_draft'
    | 'saved_draft'
    | 'restored_default';

export interface TestCutsceneDraftStorageAuditSnapshot {
    storageKey: string;
    draftPresent: boolean;
    draftEntryCount: number;
    lastStorageAction: TestCutsceneDraftStorageAction;
}

let lastStorageAction: TestCutsceneDraftStorageAction = 'none';

const readDraftRawFromStorage = (): string | null => {
    if (!canUseStorage()) {
        return null;
    }

    return window.localStorage.getItem(TEST_CUTSCENE_DRAFT_STORAGE_KEY);
};

const writeDraftRawToStorage = (raw: string): void => {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.setItem(TEST_CUTSCENE_DRAFT_STORAGE_KEY, raw);
};

const clearDraftRawFromStorage = (): void => {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.removeItem(TEST_CUTSCENE_DRAFT_STORAGE_KEY);
};

export interface LoadTestCutsceneDraftResult {
    definitions: readonly TestCutsceneDefinition[];
    source: 'draft' | 'default';
    error: string | null;
}

export const loadTestCutsceneDraft = (): LoadTestCutsceneDraftResult => {
    const fallbackDefinitions = getDefaultTestCutsceneDefinitions();
    const raw = readDraftRawFromStorage();
    if (raw === null) {
        return {
            definitions: fallbackDefinitions,
            source: 'default',
            error: null
        };
    }

    const parsed = parseTestCutsceneDefinitionsJson(raw);
    if (parsed.definitions === null) {
        return {
            definitions: fallbackDefinitions,
            source: 'default',
            error: parsed.error
        };
    }

    lastStorageAction = 'loaded_draft';
    return {
        definitions: parsed.definitions,
        source: 'draft',
        error: null
    };
};

export const saveTestCutsceneDraft = (
    definitions: readonly TestCutsceneDefinition[]
): ParseTestCutsceneDefinitionsResult => {
    const normalized = normalizeTestCutsceneDefinitions(definitions);
    if (normalized.definitions === null) {
        return {
            definitions: null,
            issues: normalized.issues,
            error: normalized.issues.map((issue) => `${issue.path || 'root'}: ${issue.message}`).join('; ')
        };
    }

    writeDraftRawToStorage(JSON.stringify(normalized.definitions, null, 2));
    lastStorageAction = 'saved_draft';

    return {
        definitions: normalized.definitions,
        issues: [],
        error: null
    };
};

export const clearTestCutsceneDraft = (): void => {
    clearDraftRawFromStorage();
    lastStorageAction = 'cleared_draft';
};

export const markTestCutsceneDraftRestoredDefault = (): void => {
    lastStorageAction = 'restored_default';
};

export const getTestCutsceneDraftStorageAuditSnapshot = (): TestCutsceneDraftStorageAuditSnapshot => {
    const raw = readDraftRawFromStorage();
    if (raw === null) {
        return {
            storageKey: TEST_CUTSCENE_DRAFT_STORAGE_KEY,
            draftPresent: false,
            draftEntryCount: 0,
            lastStorageAction
        };
    }

    const parsed = parseTestCutsceneDefinitionsJson(raw);
    return {
        storageKey: TEST_CUTSCENE_DRAFT_STORAGE_KEY,
        draftPresent: parsed.definitions !== null,
        draftEntryCount: parsed.definitions?.length ?? 0,
        lastStorageAction
    };
};
