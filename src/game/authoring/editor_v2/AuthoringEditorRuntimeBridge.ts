import type {
  AuthoringEditorGridSize,
  AuthoringEditorState,
  AuthoringEditorTimeMode,
} from './AuthoringEditorTypes';

export interface AuthoringEditorRuntimeObjectSnapshot {
  readonly id: string;
  readonly type?: string;
  readonly label?: string;
}

export interface AuthoringEditorRuntimeSnapshot {
  readonly levelId: string;
  readonly objects: readonly AuthoringEditorRuntimeObjectSnapshot[];
}

export interface AuthoringEditorRuntimeBridge {
  onEditorOpened?(state: AuthoringEditorState): void;
  onEditorClosed?(): void;
  readSnapshot(): AuthoringEditorRuntimeSnapshot;
  setTimeMode(mode: AuthoringEditorTimeMode): void;
  setSelectedObjectId(objectId: string | null): void;
  setGridSettings(
    gridVisible: boolean,
    snapEnabled: boolean,
    gridSize: AuthoringEditorGridSize,
  ): void;
}

const EMPTY_RUNTIME_SNAPSHOT: AuthoringEditorRuntimeSnapshot = {
  levelId: 'unknown_level',
  objects: [],
};

export function createNoopAuthoringEditorRuntimeBridge(): AuthoringEditorRuntimeBridge {
  return {
    readSnapshot: (): AuthoringEditorRuntimeSnapshot => EMPTY_RUNTIME_SNAPSHOT,
    setTimeMode: (mode: AuthoringEditorTimeMode): void => {
      void mode;
    },
    setSelectedObjectId: (objectId: string | null): void => {
      void objectId;
    },
    setGridSettings: (
      gridVisible: boolean,
      snapEnabled: boolean,
      gridSize: AuthoringEditorGridSize,
    ): void => {
      void gridVisible;
      void snapEnabled;
      void gridSize;
    },
  };
}
