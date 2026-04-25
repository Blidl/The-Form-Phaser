import type { ActorFocusMarkerState, ActorFocusMarkerTarget } from './actor_focus_marker_types';
import type { ActorManpuAnchor, ActorManpuState } from './actor_manpu_types';

export interface ActorManpuDebugSnapshot {
  readonly actorId: string;
  readonly manpuId: string;
  readonly visible: boolean;
  readonly anchor: ActorManpuAnchor;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly startedAtMs: number;
  readonly durationMs?: number;
  readonly expired: boolean;
}

export interface ActorFocusMarkerDebugSnapshot {
  readonly actorId: string;
  readonly target: ActorFocusMarkerTarget;
  readonly visible: boolean;
  readonly styleId?: string;
  readonly startedAtMs: number;
  readonly durationMs?: number;
  readonly expired: boolean;
}

export interface ActorOverlayDebugActorSnapshot {
  readonly actorId: string;
  readonly manpu: readonly ActorManpuDebugSnapshot[];
  readonly focusMarker: ActorFocusMarkerDebugSnapshot | null;
}

export interface ActorOverlayDebugSnapshot {
  readonly actors: readonly ActorOverlayDebugActorSnapshot[];
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

export function createActorOverlayDebugSnapshot(input: {
  readonly manpu: readonly ActorManpuState[];
  readonly focusMarkers: readonly ActorFocusMarkerState[];
  readonly nowMs: number;
}): ActorOverlayDebugSnapshot {
  const actorIds = new Set<string>();
  const manpuByActorId = new Map<string, ActorManpuDebugSnapshot[]>();
  const focusByActorId = new Map<string, ActorFocusMarkerDebugSnapshot>();

  for (const manpu of input.manpu) {
    const expired =
      manpu.durationMs !== undefined && input.nowMs >= manpu.startedAtMs + manpu.durationMs;

    const snapshot: ActorManpuDebugSnapshot = {
      actorId: manpu.actorId,
      manpuId: manpu.manpuId,
      visible: manpu.visible,
      anchor: manpu.anchor,
      offsetX: manpu.offsetX,
      offsetY: manpu.offsetY,
      startedAtMs: manpu.startedAtMs,
      durationMs: manpu.durationMs,
      expired,
    };

    actorIds.add(manpu.actorId);
    const bucket = manpuByActorId.get(manpu.actorId);
    if (bucket === undefined) {
      manpuByActorId.set(manpu.actorId, [snapshot]);
    } else {
      bucket.push(snapshot);
    }
  }

  for (const marker of input.focusMarkers) {
    const expired =
      marker.durationMs !== undefined && input.nowMs >= marker.startedAtMs + marker.durationMs;

    const snapshot: ActorFocusMarkerDebugSnapshot = {
      actorId: marker.actorId,
      target: cloneTarget(marker.target),
      visible: marker.visible,
      styleId: marker.styleId,
      startedAtMs: marker.startedAtMs,
      durationMs: marker.durationMs,
      expired,
    };

    actorIds.add(marker.actorId);
    focusByActorId.set(marker.actorId, snapshot);
  }

  const actors = Array.from(actorIds)
    .sort((a, b) => a.localeCompare(b))
    .map((actorId): ActorOverlayDebugActorSnapshot => {
      const manpu = (manpuByActorId.get(actorId) ?? [])
        .slice()
        .sort((a, b) => a.manpuId.localeCompare(b.manpuId));
      const focusMarker = focusByActorId.get(actorId) ?? null;

      return {
        actorId,
        manpu,
        focusMarker,
      };
    });

  return { actors };
}
