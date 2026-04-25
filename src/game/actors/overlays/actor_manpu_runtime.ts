import type {
  ActorManpuClearRequest,
  ActorManpuHideRequest,
  ActorManpuRuntimeOptions,
  ActorManpuShowRequest,
  ActorManpuState,
} from './actor_manpu_types';

export interface ActorManpuRuntime {
  show(request: ActorManpuShowRequest): ActorManpuState;
  hide(request: ActorManpuHideRequest): readonly ActorManpuState[];
  clear(request: ActorManpuClearRequest): readonly ActorManpuState[];
  update(deltaMs: number): void;
  getActorManpu(actorId: string): readonly ActorManpuState[];
  getAllManpu(): readonly ActorManpuState[];
}

type ManpuById = Map<string, ActorManpuState>;
type ManpuByActorId = Map<string, ManpuById>;

function cloneManpuState(state: ActorManpuState): ActorManpuState {
  return { ...state };
}

function cloneManpuStates(states: Iterable<ActorManpuState>): readonly ActorManpuState[] {
  return Array.from(states, cloneManpuState);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function createActorManpuRuntime(options?: ActorManpuRuntimeOptions): ActorManpuRuntime {
  const getNowMs = options?.nowMs ?? Date.now;
  const statesByActorId: ManpuByActorId = new Map<string, ManpuById>();

  function getActorMap(actorId: string): ManpuById {
    const existing = statesByActorId.get(actorId);
    if (existing !== undefined) {
      return existing;
    }

    const created = new Map<string, ActorManpuState>();
    statesByActorId.set(actorId, created);
    return created;
  }

  function removeExpiredAt(nowMs: number): void {
    for (const [actorId, manpuById] of statesByActorId) {
      for (const [manpuId, state] of manpuById) {
        if (state.durationMs !== undefined && nowMs >= state.startedAtMs + state.durationMs) {
          manpuById.delete(manpuId);
        }
      }
      if (manpuById.size === 0) {
        statesByActorId.delete(actorId);
      }
    }
  }

  return {
    show(request: ActorManpuShowRequest): ActorManpuState {
      const actorId = request.actorId.trim();
      const manpuId = request.manpuId.trim();

      if (actorId.length === 0 || manpuId.length === 0) {
        throw new Error('invalid_actor_manpu_request');
      }

      const state: ActorManpuState = {
        actorId,
        manpuId,
        startedAtMs: request.startedAtMs ?? getNowMs(),
        durationMs: request.durationMs,
        anchor: request.anchor ?? 'top_right',
        offsetX: request.offsetX ?? 0,
        offsetY: request.offsetY ?? 0,
        visible: request.visible ?? true,
      };

      const actorMap = getActorMap(actorId);
      actorMap.set(manpuId, state);
      return cloneManpuState(state);
    },

    hide(request: ActorManpuHideRequest): readonly ActorManpuState[] {
      const actorId = request.actorId.trim();
      if (actorId.length === 0) {
        return [];
      }

      const actorMap = statesByActorId.get(actorId);
      if (actorMap === undefined || actorMap.size === 0) {
        return [];
      }

      const hasManpuId = request.manpuId !== undefined;
      const manpuId = hasManpuId ? request.manpuId.trim() : undefined;
      const changed: ActorManpuState[] = [];

      if (hasManpuId) {
        if (manpuId === undefined || manpuId.length === 0) {
          return [];
        }
        const existing = actorMap.get(manpuId);
        if (existing === undefined) {
          return [];
        }
        const next: ActorManpuState = { ...existing, visible: false };
        actorMap.set(manpuId, next);
        changed.push(next);
      } else {
        for (const [currentManpuId, existing] of actorMap) {
          const next: ActorManpuState = { ...existing, visible: false };
          actorMap.set(currentManpuId, next);
          changed.push(next);
        }
      }

      return cloneManpuStates(changed);
    },

    clear(request: ActorManpuClearRequest): readonly ActorManpuState[] {
      const actorId = request.actorId.trim();
      if (actorId.length === 0) {
        return [];
      }

      const actorMap = statesByActorId.get(actorId);
      if (actorMap === undefined) {
        return [];
      }

      const removed = cloneManpuStates(actorMap.values());
      statesByActorId.delete(actorId);
      return removed;
    },

    update(deltaMs: number): void {
      const clampedDeltaMs = isFiniteNumber(deltaMs) ? Math.max(0, deltaMs) : 0;
      if (clampedDeltaMs === 0 && statesByActorId.size === 0) {
        return;
      }
      removeExpiredAt(getNowMs());
    },

    getActorManpu(actorId: string): readonly ActorManpuState[] {
      const trimmedActorId = actorId.trim();
      if (trimmedActorId.length === 0) {
        return [];
      }

      const actorMap = statesByActorId.get(trimmedActorId);
      if (actorMap === undefined) {
        return [];
      }
      return cloneManpuStates(actorMap.values());
    },

    getAllManpu(): readonly ActorManpuState[] {
      const allStates: ActorManpuState[] = [];
      for (const actorMap of statesByActorId.values()) {
        for (const state of actorMap.values()) {
          allStates.push(state);
        }
      }
      return cloneManpuStates(allStates);
    },
  };
}
