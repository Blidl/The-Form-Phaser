import {
    getDefaultTestNpcScriptedSequenceDefinitions,
    normalizeTestNpcScriptedSequenceDefinitions,
    parseTestNpcScriptedSequenceDefinitionsJson,
    type ParseTestNpcScriptedSequenceDefinitionsResult,
    type TestNpcScriptedSequenceDefinition
} from './npc_scripted_sequences';

export const TEST_NPC_SCRIPTED_SEQUENCE_DRAFT_STORAGE_KEY = 'the-form:npc-scripted-sequences:editor-draft:v1';

const canUseStorage = (): boolean => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export type TestNpcScriptedSequenceDraftStorageAction =
    | 'none'
    | 'loaded_draft'
    | 'cleared_draft'
    | 'saved_draft'
    | 'restored_default';

export interface TestNpcScriptedSequenceDraftStorageAuditSnapshot {
    storageKey: string;
    draftPresent: boolean;
    draftEntryCount: number;
    lastStorageAction: TestNpcScriptedSequenceDraftStorageAction;
}

let lastStorageAction: TestNpcScriptedSequenceDraftStorageAction = 'none';

const readDraftRawFromStorage = (): string | null => {
    if (!canUseStorage()) {
        return null;
    }

    return window.localStorage.getItem(TEST_NPC_SCRIPTED_SEQUENCE_DRAFT_STORAGE_KEY);
};

const writeDraftRawToStorage = (raw: string): void => {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.setItem(TEST_NPC_SCRIPTED_SEQUENCE_DRAFT_STORAGE_KEY, raw);
};

const clearDraftRawFromStorage = (): void => {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.removeItem(TEST_NPC_SCRIPTED_SEQUENCE_DRAFT_STORAGE_KEY);
};

export interface LoadTestNpcScriptedSequenceDraftResult {
    definitions: readonly TestNpcScriptedSequenceDefinition[];
    source: 'draft' | 'default';
    error: string | null;
}

export const loadTestNpcScriptedSequenceDraft = (): LoadTestNpcScriptedSequenceDraftResult => {
    const fallbackDefinitions = getDefaultTestNpcScriptedSequenceDefinitions();
    const raw = readDraftRawFromStorage();
    if (raw === null) {
        return {
            definitions: fallbackDefinitions,
            source: 'default',
            error: null
        };
    }

    const parsed = parseTestNpcScriptedSequenceDefinitionsJson(raw);
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

export const saveTestNpcScriptedSequenceDraft = (
    definitions: readonly TestNpcScriptedSequenceDefinition[]
): ParseTestNpcScriptedSequenceDefinitionsResult => {
    const normalized = normalizeTestNpcScriptedSequenceDefinitions(definitions);
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

export const clearTestNpcScriptedSequenceDraft = (): void => {
    clearDraftRawFromStorage();
    lastStorageAction = 'cleared_draft';
};

export const markTestNpcScriptedSequenceDraftRestoredDefault = (): void => {
    lastStorageAction = 'restored_default';
};

export const getTestNpcScriptedSequenceDraftStorageAuditSnapshot = (): TestNpcScriptedSequenceDraftStorageAuditSnapshot => {
    const raw = readDraftRawFromStorage();
    if (raw === null) {
        return {
            storageKey: TEST_NPC_SCRIPTED_SEQUENCE_DRAFT_STORAGE_KEY,
            draftPresent: false,
            draftEntryCount: 0,
            lastStorageAction
        };
    }

    const parsed = parseTestNpcScriptedSequenceDefinitionsJson(raw);
    return {
        storageKey: TEST_NPC_SCRIPTED_SEQUENCE_DRAFT_STORAGE_KEY,
        draftPresent: parsed.definitions !== null,
        draftEntryCount: parsed.definitions?.length ?? 0,
        lastStorageAction
    };
};
