import type { AuthoringEditorGridSize } from './AuthoringEditorTypes';

export interface AuthoringEditorPhaserOverlay {
  setVisible(visible: boolean): void;
  setGridVisible(gridVisible: boolean): void;
  setGridSize(gridSize: AuthoringEditorGridSize): void;
  setSelectedObjectId(objectId: string | null): void;
  update(deltaMs: number): void;
  destroy(): void;
}

export function createAuthoringEditorPhaserOverlay(): AuthoringEditorPhaserOverlay {
  let visible = false;
  let gridVisible = true;
  let gridSize: AuthoringEditorGridSize = 16;
  let selectedObjectId: string | null = null;
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
    update(deltaMs: number): void {
      if (destroyed) {
        return;
      }
      void visible;
      void gridVisible;
      void gridSize;
      void selectedObjectId;
      void deltaMs;
    },
    destroy(): void {
      destroyed = true;
    },
  };
}
