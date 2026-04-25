import type {
  ActorFocusMarkerClearRequest,
  ActorFocusMarkerRuntimeOptions,
  ActorFocusMarkerSetRequest,
  ActorFocusMarkerState,
  ActorFocusMarkerTarget,
} from './actor_focus_marker_types';

export interface ActorFocusMarkerRuntime {
  set(request: ActorFocusMarkerSetRequest): ActorFocusMarkerState;
  clear(request: ActorFocusMarkerClearRequest): ActorFocusMarkerState | null;
  update(deltaMs: number): void;
  get(actorId: string): ActorFocusMarkerState | null;
  getAll(): readonly ActorFocusMarkerState[];
}

function cloneTarget(target: ActorFocusMarkerTarget): ActorFocusMarkerTarget {
  if (target.kind === 'actor') {
    return { kind: 'actor', actorId: target.actorId };
  }
  if (target.kind === 'point') {
    return { kind: 'point', x: target.x, y: target.y };
  }
  return { kind: 'marker', markerId: target.markerId };
}

function cloneState(state: ActorFocusMarkerState): ActorFocusMarkerState {
  return {
    ...state,
    target: cloneTarget(state.target),
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeAndValidateTarget(target: ActorFocusMarkerTarget): ActorFocusMarkerTarget {
  if (target.kind === 'actor') {
    const actorId = target.actorId.trim();
    if (actorId.length === 0) {
      throw new Error('invalid_actor_focus_marker_request');
    }
    return { kind: 'actor', actorId };
  }

  if (target.kind === 'marker') {
    const markerId = target.markerId.trim();
    if (markerId.length === 0) {
      throw new Error('invalid_actor_focus_marker_request');
    }
    return { kind: 'marker', markerId };
  }

  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    throw new Error('invalid_actor_focus_marker_request');
  }

  return { kind: 'point', x: target.x, y: target.y };
}

export function createActorFocusMarkerRuntime(
  options?: ActorFocusMarkerRuntimeOptions,
): ActorFocusMarkerRuntime {
  const getNowMs = options?.nowMs ?? Date.now;
  const stateByActorId = new Map<string, ActorFocusMarkerState>();

  function removeExpiredAt(nowMs: number): void {
    for (const [actorId, state] of stateByActorId) {
      if (state.durationMs !== undefined && nowMs >= state.startedAtMs + state.durationMs) {
        stateByActorId.delete(actorId);
      }
    }
  }

  return {
    set(request: ActorFocusMarkerSetRequest): ActorFocusMarkerState {
      const actorId = request.actorId.trim();
      if (actorId.length === 0) {
        throw new Error('invalid_actor_focus_marker_request');
      }

      const target = sanitizeAndValidateTarget(request.target);
      const styleIdValue = request.styleId?.trim();

      const state: ActorFocusMarkerState = {
        actorId,
        target,
        visible: request.visible ?? true,
        styleId: styleIdValue && styleIdValue.length > 0 ? styleIdValue : undefined,
        startedAtMs: request.startedAtMs ?? getNowMs(),
        durationMs: request.durationMs,
      };

      stateByActorId.set(actorId, state);
      return cloneState(state);
    },

    clear(request: ActorFocusMarkerClearRequest): ActorFocusMarkerState | null {
      const actorId = request.actorId.trim();
      if (actorId.length === 0) {
        return null;
      }

      const existing = stateByActorId.get(actorId);
      if (existing === undefined) {
        return null;
      }
      stateByActorId.delete(actorId);
      return cloneState(existing);
    },

    update(deltaMs: number): void {
      const clampedDeltaMs = isFiniteNumber(deltaMs) ? Math.max(0, deltaMs) : 0;
      if (clampedDeltaMs === 0 && stateByActorId.size === 0) {
        return;
      }
      removeExpiredAt(getNowMs());
    },

    get(actorId: string): ActorFocusMarkerState | null {
      const trimmedActorId = actorId.trim();
      if (trimmedActorId.length === 0) {
        return null;
      }

      const existing = stateByActorId.get(trimmedActorId);
      return existing === undefined ? null : cloneState(existing);
    },

    getAll(): readonly ActorFocusMarkerState[] {
      return Array.from(stateByActorId.values(), cloneState);
    },
  };
}
