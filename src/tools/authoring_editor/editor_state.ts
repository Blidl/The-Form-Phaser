export type AuthoringEditorTab =
  | 'level'
  | 'npc'
  | 'director'
  | 'events'
  | 'debug';

export type AuthoringEditorStorageSource =
  | 'bundled_json'
  | 'local_autosave_draft';

export interface AuthoringEditorStorageStatus {
  readonly source: AuthoringEditorStorageSource;
  readonly hasLocalDraft: boolean;
  readonly localDraftActive: boolean;
  readonly unsavedChanges: boolean;
  readonly lastAutosaveAtMs?: number;
  readonly message?: string;
}

export interface AuthoringEditorState {
  readonly activeTab: AuthoringEditorTab;
  readonly storageStatus: AuthoringEditorStorageStatus;
  readonly selectedReferenceId?: string;
  readonly selectedLevelObjectId?: string;
  readonly validationIssueCount?: number;
  readonly lastRefreshAtMs?: number;
}

export function createInitialAuthoringEditorState(): AuthoringEditorState {
  return {
    activeTab: 'level',
    storageStatus: {
      source: 'bundled_json',
      hasLocalDraft: false,
      localDraftActive: false,
      unsavedChanges: false,
      message: 'Bundled JSON is active',
    },
  };
}

export function setAuthoringEditorTab(
  state: AuthoringEditorState,
  tab: AuthoringEditorTab,
): AuthoringEditorState {
  return {
    ...state,
    activeTab: tab,
  };
}

export function setAuthoringEditorStorageStatus(
  state: AuthoringEditorState,
  storageStatus: AuthoringEditorStorageStatus,
): AuthoringEditorState {
  return {
    ...state,
    storageStatus,
  };
}

export function setSelectedLevelObjectId(
  state: AuthoringEditorState,
  selectedLevelObjectId: string | undefined,
): AuthoringEditorState {
  return {
    ...state,
    selectedLevelObjectId,
  };
}

export function setSelectedReferenceId(
  state: AuthoringEditorState,
  selectedReferenceId: string | undefined,
): AuthoringEditorState {
  return {
    ...state,
    selectedReferenceId,
  };
}

export function setValidationIssueCount(
  state: AuthoringEditorState,
  validationIssueCount: number | undefined,
): AuthoringEditorState {
  return {
    ...state,
    validationIssueCount,
  };
}

export function setLastRefreshAtMs(
  state: AuthoringEditorState,
  lastRefreshAtMs: number | undefined,
): AuthoringEditorState {
  return {
    ...state,
    lastRefreshAtMs,
  };
}
