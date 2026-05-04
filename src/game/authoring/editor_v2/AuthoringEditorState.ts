import type {
  AuthoringEditorGridSize,
  AuthoringEditorOpenState,
  AuthoringEditorState,
  AuthoringEditorTab,
  AuthoringEditorTimeMode,
} from './AuthoringEditorTypes';

const DEFAULT_EDITOR_STATE: AuthoringEditorState = {
  openState: 'closed',
  activeTab: 'Level',
  timeMode: 'Live',
  selectedObjectId: null,
  dirty: false,
  gridVisible: true,
  snapEnabled: true,
  gridSize: 16,
  saveStatus: 'Saved',
  saveStatusNote: null,
  draftLoaded: false,
};

export function createInitialAuthoringEditorState(
  overrides?: Partial<AuthoringEditorState>,
): AuthoringEditorState {
  return {
    ...DEFAULT_EDITOR_STATE,
    ...overrides,
  };
}

export function setAuthoringEditorOpenState(
  state: AuthoringEditorState,
  openState: AuthoringEditorOpenState,
): AuthoringEditorState {
  return {
    ...state,
    openState,
  };
}

export function setAuthoringEditorActiveTab(
  state: AuthoringEditorState,
  activeTab: AuthoringEditorTab,
): AuthoringEditorState {
  return {
    ...state,
    activeTab,
  };
}

export function setAuthoringEditorTimeMode(
  state: AuthoringEditorState,
  timeMode: AuthoringEditorTimeMode,
): AuthoringEditorState {
  return {
    ...state,
    timeMode,
  };
}

export function setAuthoringEditorSelectedObjectId(
  state: AuthoringEditorState,
  selectedObjectId: string | null,
): AuthoringEditorState {
  return {
    ...state,
    selectedObjectId,
  };
}

export function setAuthoringEditorDirty(
  state: AuthoringEditorState,
  dirty: boolean,
): AuthoringEditorState {
  return {
    ...state,
    dirty,
  };
}

export function setAuthoringEditorGridVisible(
  state: AuthoringEditorState,
  gridVisible: boolean,
): AuthoringEditorState {
  return {
    ...state,
    gridVisible,
  };
}

export function setAuthoringEditorSnapEnabled(
  state: AuthoringEditorState,
  snapEnabled: boolean,
): AuthoringEditorState {
  return {
    ...state,
    snapEnabled,
  };
}

export function setAuthoringEditorGridSize(
  state: AuthoringEditorState,
  gridSize: AuthoringEditorGridSize,
): AuthoringEditorState {
  return {
    ...state,
    gridSize,
  };
}

export function setAuthoringEditorSaveStatus(
  state: AuthoringEditorState,
  saveStatus: string,
  saveStatusNote: string | null = null,
): AuthoringEditorState {
  return {
    ...state,
    saveStatus,
    saveStatusNote,
  };
}

export function setAuthoringEditorDraftLoaded(
  state: AuthoringEditorState,
  draftLoaded: boolean,
): AuthoringEditorState {
  return {
    ...state,
    draftLoaded,
  };
}
