import type { AuthoringEditorWorldBounds } from './authoring_editor_runtime_bridge';

interface CreateAuthoringEditorPhaserOverlayOptions {
  readonly scene: Phaser.Scene;
  readonly gridSize?: number;
  readonly rulerThicknessPx?: number;
}

export interface AuthoringEditorPhaserOverlay {
  setEnabled(enabled: boolean): void;
  update(camera: Phaser.Cameras.Scene2D.Camera, bounds: AuthoringEditorWorldBounds): void;
  destroy(): void;
}

const DEFAULT_GRID_SIZE = 16;
const DEFAULT_RULER_THICKNESS_PX = 20;
const GRID_DEPTH = 4986;
const RULER_DEPTH = 4989;

const computeRulerStep = (camera: Phaser.Cameras.Scene2D.Camera, gridSize: number): number => {
  const minWorldStep = 72 / Math.max(camera.zoom, 0.0001);
  let step = gridSize > 1 ? gridSize : 8;
  while (step < minWorldStep) {
    step *= 2;
  }
  return step;
};

export const createAuthoringEditorPhaserOverlay = (
  options: CreateAuthoringEditorPhaserOverlayOptions,
): AuthoringEditorPhaserOverlay => {
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const rulerThicknessPx = options.rulerThicknessPx ?? DEFAULT_RULER_THICKNESS_PX;
  const gridGraphics = options.scene.add.graphics().setDepth(GRID_DEPTH);
  const rulerGraphics = options.scene.add.graphics().setDepth(RULER_DEPTH).setScrollFactor(0);
  const rulerLabels: Phaser.GameObjects.Text[] = [];
  let enabled = false;
  let destroyed = false;

  const clear = (): void => {
    gridGraphics.clear();
    rulerGraphics.clear();
    rulerLabels.forEach((label) => label.setVisible(false));
  };

  const ensureLabel = (index: number): Phaser.GameObjects.Text => {
    if (rulerLabels[index]) {
      return rulerLabels[index];
    }
    const label = options.scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#d7f6ff',
    })
      .setDepth(RULER_DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
    rulerLabels[index] = label;
    return label;
  };

  const drawGrid = (camera: Phaser.Cameras.Scene2D.Camera, bounds: AuthoringEditorWorldBounds): void => {
    gridGraphics.clear();
    if (gridSize <= 1) {
      return;
    }
    const left = bounds.x;
    const top = bounds.y;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const drawLeft = Math.max(left, Math.floor(camera.worldView.left / gridSize) * gridSize);
    const drawRight = Math.min(right, Math.ceil(camera.worldView.right / gridSize) * gridSize);
    const drawTop = Math.max(top, Math.floor(camera.worldView.top / gridSize) * gridSize);
    const drawBottom = Math.min(bottom, Math.ceil(camera.worldView.bottom / gridSize) * gridSize);
    if (drawRight <= drawLeft || drawBottom <= drawTop) {
      return;
    }
    gridGraphics.lineStyle(1, 0xffffff, 0.08);
    for (let x = drawLeft; x <= drawRight; x += gridSize) {
      gridGraphics.lineBetween(x, drawTop, x, drawBottom);
    }
    for (let y = drawTop; y <= drawBottom; y += gridSize) {
      gridGraphics.lineBetween(drawLeft, y, drawRight, y);
    }
  };

  const drawRuler = (camera: Phaser.Cameras.Scene2D.Camera, bounds: AuthoringEditorWorldBounds): void => {
    rulerGraphics.clear();
    const viewportWidth = camera.width;
    const viewportHeight = camera.height;
    rulerGraphics.fillStyle(0x07131a, 0.88);
    rulerGraphics.fillRect(0, 0, viewportWidth, rulerThicknessPx);
    rulerGraphics.fillRect(0, 0, rulerThicknessPx, viewportHeight);
    rulerGraphics.fillStyle(0x10212b, 0.95);
    rulerGraphics.fillRect(0, 0, rulerThicknessPx, rulerThicknessPx);
    rulerGraphics.lineStyle(1, 0xb8ecff, 0.22);
    rulerGraphics.lineBetween(0, rulerThicknessPx + 0.5, viewportWidth, rulerThicknessPx + 0.5);
    rulerGraphics.lineBetween(rulerThicknessPx + 0.5, 0, rulerThicknessPx + 0.5, viewportHeight);

    const left = bounds.x;
    const top = bounds.y;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const worldLeft = Math.max(left, camera.worldView.left);
    const worldRight = Math.min(right, camera.worldView.right);
    const worldTop = Math.max(top, camera.worldView.top);
    const worldBottom = Math.min(bottom, camera.worldView.bottom);
    if (worldRight <= worldLeft || worldBottom <= worldTop) {
      rulerLabels.forEach((label) => label.setVisible(false));
      return;
    }

    const step = computeRulerStep(camera, gridSize);
    let labelIndex = 0;
    rulerGraphics.lineStyle(1, 0xb8ecff, 0.55);

    const drawLabel = (text: string, x: number, y: number): void => {
      const label = ensureLabel(labelIndex);
      label.setText(text);
      label.setPosition(x, y);
      label.setVisible(true);
      labelIndex += 1;
    };

    for (let x = Math.floor(worldLeft / step) * step; x <= worldRight; x += step) {
      const screenX = (x - camera.worldView.left) * camera.zoom;
      if (x < left || x > right || screenX < rulerThicknessPx - 2 || screenX > viewportWidth) {
        continue;
      }
      const isMajor = Math.round(x / step) % 2 === 0;
      rulerGraphics.lineBetween(screenX + 0.5, rulerThicknessPx, screenX + 0.5, rulerThicknessPx - (isMajor ? 9 : 5));
      if (isMajor) {
        drawLabel(`${Math.round(x)}`, screenX + 3, 3);
      }
    }

    for (let y = Math.floor(worldTop / step) * step; y <= worldBottom; y += step) {
      const screenY = (y - camera.worldView.top) * camera.zoom;
      if (y < top || y > bottom || screenY < rulerThicknessPx - 2 || screenY > viewportHeight) {
        continue;
      }
      const isMajor = Math.round(y / step) % 2 === 0;
      rulerGraphics.lineBetween(rulerThicknessPx, screenY + 0.5, rulerThicknessPx - (isMajor ? 9 : 5), screenY + 0.5);
      if (isMajor) {
        drawLabel(`${Math.round(y)}`, 3, screenY + 1);
      }
    }

    for (let index = labelIndex; index < rulerLabels.length; index += 1) {
      rulerLabels[index].setVisible(false);
    }
  };

  return {
    setEnabled(nextEnabled: boolean): void {
      if (destroyed || enabled === nextEnabled) {
        return;
      }
      enabled = nextEnabled;
      if (!enabled) {
        clear();
      }
    },
    update(camera: Phaser.Cameras.Scene2D.Camera, bounds: AuthoringEditorWorldBounds): void {
      if (destroyed) {
        return;
      }
      if (!enabled) {
        clear();
        return;
      }
      drawGrid(camera, bounds);
      drawRuler(camera, bounds);
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      gridGraphics.destroy();
      rulerGraphics.destroy();
      rulerLabels.forEach((label) => label.destroy());
      rulerLabels.length = 0;
    },
  };
};
