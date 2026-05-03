import type { AuthoringEditorGridSize, AuthoringEditorLayoutInsets } from './AuthoringEditorTypes';

export interface AuthoringEditorPhaserOverlay {
  setVisible(visible: boolean): void;
  setGridVisible(gridVisible: boolean): void;
  setGridSize(gridSize: AuthoringEditorGridSize): void;
  setSelectedObjectId(objectId: string | null): void;
  setLayoutInsets(insets: AuthoringEditorLayoutInsets): void;
  update(deltaMs: number): void;
  destroy(): void;
}

export function createAuthoringEditorPhaserOverlay(): AuthoringEditorPhaserOverlay {
  let visible = false;
  let gridVisible = true;
  let gridSize: AuthoringEditorGridSize = 16;
  let selectedObjectId: string | null = null;
  let layoutInsets: AuthoringEditorLayoutInsets = {
    toolbarHeight: 44,
    topRulerBandHeight: 22,
    leftPanelWidth: 320,
    rightPanelWidth: 340,
    bottomStatusBarHeight: 28,
  };
  let destroyed = false;

  return {
    setVisible(nextVisible: boolean): void {
      if (destroyed) {
        return;
      }
      visible = nextVisible;
    },
    setGridVisible(nextGridVisible: boolean): void {
      if (destroyed) {
        return;
      }
      gridVisible = nextGridVisible;
    },
    setGridSize(nextGridSize: AuthoringEditorGridSize): void {
      if (destroyed) {
        return;
      }
      gridSize = nextGridSize;
    },
    setSelectedObjectId(nextSelectedObjectId: string | null): void {
      if (destroyed) {
        return;
      }
      selectedObjectId = nextSelectedObjectId;
    },
    setLayoutInsets(nextInsets: AuthoringEditorLayoutInsets): void {
      if (destroyed) {
        return;
      }
      layoutInsets = nextInsets;
    },
    update(deltaMs: number): void {
      if (destroyed) {
        return;
      }
      void visible;
      void gridVisible;
      void gridSize;
      void selectedObjectId;
      void layoutInsets;
      void deltaMs;
    },
    destroy(): void {
      destroyed = true;
    },
  };
}
