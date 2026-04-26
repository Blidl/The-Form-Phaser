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
  readonly validationIssueCount?: number;
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
