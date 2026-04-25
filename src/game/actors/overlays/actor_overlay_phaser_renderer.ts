import type { ActorFocusMarkerRuntime } from './actor_focus_marker_runtime';
import type { ActorFocusMarkerState, ActorFocusMarkerTarget } from './actor_focus_marker_types';
import type { ActorManpuRuntime } from './actor_manpu_runtime';
import type { ActorManpuAnchor, ActorManpuState } from './actor_manpu_types';

export interface ActorOverlayRenderBounds {
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ActorOverlayPoint {
  readonly x: number;
  readonly y: number;
}

export interface ActorOverlayPhaserRendererOptions {
  readonly scene: Phaser.Scene;
  readonly manpuRuntime: ActorManpuRuntime;
  readonly focusMarkerRuntime: ActorFocusMarkerRuntime;
  readonly getActorBounds: (actorId: string) => ActorOverlayRenderBounds | null;
  readonly getMarkerPosition?: (markerId: string) => ActorOverlayPoint | null;
  readonly depth?: number;
  readonly manpuTextResolver?: (manpuId: string) => string;
  readonly focusMarkerStyleResolver?: (styleId: string | undefined) => {
    readonly radius?: number;
    readonly lineWidth?: number;
    readonly alpha?: number;
  };
}

export interface ActorOverlayPhaserRenderer {
  update(): void;
  clear(): void;
  destroy(): void;
}

interface ValidBounds {
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface FocusStyle {
  readonly radius: number;
  readonly lineWidth: number;
  readonly alpha: number;
}

const DEFAULT_BOUNDS_SIZE = 32;
const DEFAULT_FOCUS_RADIUS = 8;
const DEFAULT_FOCUS_LINE_WIDTH = 2;
const DEFAULT_FOCUS_ALPHA = 0.85;
const DEFAULT_MANPU_TEXT = '!';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeSize(size: number): number {
  return isFiniteNumber(size) && size > 0 ? size : DEFAULT_BOUNDS_SIZE;
}

function normalizeBounds(bounds: ActorOverlayRenderBounds | null): ValidBounds | null {
  if (bounds === null) {
    return null;
  }
  if (!isFiniteNumber(bounds.x) || !isFiniteNumber(bounds.y)) {
    return null;
  }

  return {
    actorId: bounds.actorId,
    x: bounds.x,
    y: bounds.y,
    width: normalizeSize(bounds.width),
    height: normalizeSize(bounds.height),
  };
}

function resolveManpuText(
  state: ActorManpuState,
  resolver: ((manpuId: string) => string) | undefined,
): string {
  const resolved = resolver?.(state.manpuId);
  if (typeof resolved === 'string' && resolved.length > 0) {
    return resolved;
  }

  const compact = state.manpuId.trim().slice(0, 2);
  return compact.length > 0 ? compact : DEFAULT_MANPU_TEXT;
}

function resolveManpuAnchorPoint(bounds: ValidBounds, anchor: ActorManpuAnchor): ActorOverlayPoint {
  const halfWidth = bounds.width * 0.5;
  const halfHeight = bounds.height * 0.5;

  switch (anchor) {
    case 'top_right':
      return { x: bounds.x + halfWidth, y: bounds.y - halfHeight };
    case 'top_left':
      return { x: bounds.x - halfWidth, y: bounds.y - halfHeight };
    case 'center_right':
      return { x: bounds.x + halfWidth, y: bounds.y };
    case 'center_left':
      return { x: bounds.x - halfWidth, y: bounds.y };
    default:
      return { x: bounds.x + halfWidth, y: bounds.y - halfHeight };
  }
}

function resolveFocusStyle(
  state: ActorFocusMarkerState,
  resolver: ActorOverlayPhaserRendererOptions['focusMarkerStyleResolver'],
): FocusStyle {
  const resolved = resolver?.(state.styleId);
  const radius = resolved?.radius;
  const lineWidth = resolved?.lineWidth;
  const alpha = resolved?.alpha;

  return {
    radius: isFiniteNumber(radius) && radius > 0 ? radius : DEFAULT_FOCUS_RADIUS,
    lineWidth: isFiniteNumber(lineWidth) && lineWidth > 0 ? lineWidth : DEFAULT_FOCUS_LINE_WIDTH,
    alpha: isFiniteNumber(alpha) && alpha >= 0 ? alpha : DEFAULT_FOCUS_ALPHA,
  };
}

function resolveFocusTargetPoint(
  target: ActorFocusMarkerTarget,
  options: ActorOverlayPhaserRendererOptions,
): ActorOverlayPoint | null {
  if (target.kind === 'point') {
    if (!isFiniteNumber(target.x) || !isFiniteNumber(target.y)) {
      return null;
    }
    return { x: target.x, y: target.y };
  }

  if (target.kind === 'actor') {
    const targetBounds = normalizeBounds(options.getActorBounds(target.actorId));
    if (targetBounds === null) {
      return null;
    }
    return { x: targetBounds.x, y: targetBounds.y };
  }

  if (options.getMarkerPosition === undefined) {
    return null;
  }

  const markerPosition = options.getMarkerPosition(target.markerId);
  if (markerPosition === null || !isFiniteNumber(markerPosition.x) || !isFiniteNumber(markerPosition.y)) {
    return null;
  }
  return { x: markerPosition.x, y: markerPosition.y };
}

function destroyGameObject(
  gameObject: Phaser.GameObjects.GameObject & {
    destroy(fromScene?: boolean): void;
  },
): void {
  gameObject.destroy();
}

export function createActorOverlayPhaserRenderer(
  options: ActorOverlayPhaserRendererOptions,
): ActorOverlayPhaserRenderer {
  const { scene } = options;

  const manpuObjects = new Map<string, Phaser.GameObjects.Text>();
  const focusMarkerObjects = new Map<string, Phaser.GameObjects.Graphics>();
  let disposed = false;

  function applyDepth(gameObject: { setDepth(value: number): unknown }): void {
    if (isFiniteNumber(options.depth)) {
      gameObject.setDepth(options.depth);
    }
  }

  function updateManpu(): void {
    const staleKeys = new Set<string>(manpuObjects.keys());
    const states = options.manpuRuntime.getAllManpu();

    states.forEach((state) => {
      if (!state.visible) {
        return;
      }

      const bounds = normalizeBounds(options.getActorBounds(state.actorId));
      if (bounds === null) {
        return;
      }

      const anchorPoint = resolveManpuAnchorPoint(bounds, state.anchor);
      const x = anchorPoint.x + state.offsetX;
      const y = anchorPoint.y + state.offsetY;
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return;
      }

      const key = `${state.actorId}::${state.manpuId}`;
      staleKeys.delete(key);

      const textValue = resolveManpuText(state, options.manpuTextResolver);
      const existing = manpuObjects.get(key);
      if (existing !== undefined) {
        existing.setText(textValue);
        existing.setPosition(x, y);
        existing.setVisible(true);
        applyDepth(existing);
        return;
      }

      const created = scene.add.text(x, y, textValue, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { left: 2, right: 2, top: 1, bottom: 1 },
      });
      created.setOrigin(0.5, 0.5);
      applyDepth(created);
      manpuObjects.set(key, created);
    });

    staleKeys.forEach((key) => {
      const object = manpuObjects.get(key);
      if (object === undefined) {
        return;
      }
      destroyGameObject(object);
      manpuObjects.delete(key);
    });
  }

  function updateFocusMarkers(): void {
    const staleKeys = new Set<string>(focusMarkerObjects.keys());
    const states = options.focusMarkerRuntime.getAll();

    states.forEach((state) => {
      if (!state.visible) {
        return;
      }

      const actorBounds = normalizeBounds(options.getActorBounds(state.actorId));
      if (actorBounds === null) {
        return;
      }

      const targetPoint = resolveFocusTargetPoint(state.target, options);
      if (targetPoint === null) {
        return;
      }

      staleKeys.delete(state.actorId);
      let graphics = focusMarkerObjects.get(state.actorId);
      if (graphics === undefined) {
        graphics = scene.add.graphics();
        applyDepth(graphics);
        focusMarkerObjects.set(state.actorId, graphics);
      }

      const style = resolveFocusStyle(state, options.focusMarkerStyleResolver);
      graphics.clear();
      graphics.lineStyle(style.lineWidth, 0x00ffff, style.alpha);
      graphics.strokeCircle(targetPoint.x, targetPoint.y, style.radius);
      graphics.beginPath();
      graphics.moveTo(targetPoint.x - style.radius, targetPoint.y);
      graphics.lineTo(targetPoint.x + style.radius, targetPoint.y);
      graphics.moveTo(targetPoint.x, targetPoint.y - style.radius);
      graphics.lineTo(targetPoint.x, targetPoint.y + style.radius);
      graphics.strokePath();

      if (actorBounds.x !== targetPoint.x || actorBounds.y !== targetPoint.y) {
        graphics.beginPath();
        graphics.moveTo(actorBounds.x, actorBounds.y);
        graphics.lineTo(targetPoint.x, targetPoint.y);
        graphics.strokePath();
      }
    });

    staleKeys.forEach((actorId) => {
      const object = focusMarkerObjects.get(actorId);
      if (object === undefined) {
        return;
      }
      destroyGameObject(object);
      focusMarkerObjects.delete(actorId);
    });
  }

  return {
    update(): void {
      if (disposed) {
        return;
      }
      updateManpu();
      updateFocusMarkers();
    },

    clear(): void {
      manpuObjects.forEach((object) => destroyGameObject(object));
      manpuObjects.clear();

      focusMarkerObjects.forEach((object) => destroyGameObject(object));
      focusMarkerObjects.clear();
    },

    destroy(): void {
      if (disposed) {
        return;
      }
      this.clear();
      disposed = true;
    },
  };
}
