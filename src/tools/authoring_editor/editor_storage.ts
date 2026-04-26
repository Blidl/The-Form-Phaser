const DEFAULT_STORAGE_KEY_PREFIX = 'theform.authoring_editor.autosave.';
const AUTOSAVE_SCHEMA_VERSION = 1 as const;

export interface AuthoringEditorAutosaveDraft {
  readonly schemaVersion: 1;
  readonly savedAtMs: number;
  readonly workspaceId: string;
  readonly payload: unknown;
}

export interface AuthoringEditorStorage {
  hasDraft(workspaceId: string): boolean;
  loadDraft(workspaceId: string): AuthoringEditorAutosaveDraft | null;
  saveDraft(workspaceId: string, payload: unknown): AuthoringEditorAutosaveDraft;
  clearDraft(workspaceId: string): boolean;
  getDraftStatus(workspaceId: string): {
    readonly hasLocalDraft: boolean;
    readonly lastAutosaveAtMs?: number;
  };
}

interface CreateAuthoringEditorStorageOptions {
  readonly storageKeyPrefix?: string;
  readonly nowMs?: () => number;
  readonly storage?: Storage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDraft(rawJson: string): AuthoringEditorAutosaveDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const schemaVersion = parsed.schemaVersion;
  const savedAtMs = parsed.savedAtMs;
  const workspaceId = parsed.workspaceId;

  if (schemaVersion !== AUTOSAVE_SCHEMA_VERSION) {
    return null;
  }

  if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) {
    return null;
  }

  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return null;
  }

  return {
    schemaVersion: AUTOSAVE_SCHEMA_VERSION,
    savedAtMs,
    workspaceId,
    payload: parsed.payload,
  };
}

function getDefaultStorage(): Storage | undefined {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return undefined;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function buildStorageKey(prefix: string, workspaceId: string): string {
  return `${prefix}${workspaceId}`;
}

export function createAuthoringEditorStorage(
  options?: CreateAuthoringEditorStorageOptions,
): AuthoringEditorStorage {
  const storageKeyPrefix = options?.storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const nowMs = options?.nowMs ?? (() => Date.now());
  const storage = options?.storage ?? getDefaultStorage();

  const loadDraftInternal = (workspaceId: string): AuthoringEditorAutosaveDraft | null => {
    if (!storage) {
      return null;
    }

    let rawJson: string | null;
    try {
      rawJson = storage.getItem(buildStorageKey(storageKeyPrefix, workspaceId));
    } catch {
      return null;
    }

    if (rawJson === null) {
      return null;
    }

    const draft = parseDraft(rawJson);
    if (!draft || draft.workspaceId !== workspaceId) {
      return null;
    }

    return draft;
  };

  return {
    hasDraft(workspaceId: string): boolean {
      return loadDraftInternal(workspaceId) !== null;
    },

    loadDraft(workspaceId: string): AuthoringEditorAutosaveDraft | null {
      return loadDraftInternal(workspaceId);
    },

    saveDraft(workspaceId: string, payload: unknown): AuthoringEditorAutosaveDraft {
      const draft: AuthoringEditorAutosaveDraft = {
        schemaVersion: AUTOSAVE_SCHEMA_VERSION,
        savedAtMs: nowMs(),
        workspaceId,
        payload,
      };

      if (!storage) {
        return draft;
      }

      try {
        storage.setItem(buildStorageKey(storageKeyPrefix, workspaceId), JSON.stringify(draft));
      } catch {
        return draft;
      }

      return draft;
    },

    clearDraft(workspaceId: string): boolean {
      if (!storage) {
        return false;
      }

      const key = buildStorageKey(storageKeyPrefix, workspaceId);
      try {
        const hasExistingValue = storage.getItem(key) !== null;
        if (!hasExistingValue) {
          return false;
        }

        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },

    getDraftStatus(workspaceId: string): {
      readonly hasLocalDraft: boolean;
      readonly lastAutosaveAtMs?: number;
    } {
      const draft = loadDraftInternal(workspaceId);
      if (!draft) {
        return {
          hasLocalDraft: false,
        };
      }

      return {
        hasLocalDraft: true,
        lastAutosaveAtMs: draft.savedAtMs,
      };
    },
  };
}
