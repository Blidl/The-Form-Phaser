import type {
  NpcPerceptionActorSnapshot,
  NpcPerceptionConfig,
  NpcPerceptionDebugCone,
  NpcPerceptionDebugData,
  NpcPerceptionDebugRay,
  NpcPerceptionPoint,
  NpcPerceptionResult
} from './npc_perception_types';

function sanitizeFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function createPoint(x: number, y: number): NpcPerceptionPoint {
  return {
    x: sanitizeFinite(x, 0),
    y: sanitizeFinite(y, 0)
  };
}

function createRayStatus(result: NpcPerceptionResult): NpcPerceptionDebugRay['status'] {
  if (!result.inRadius) {
    return 'out_of_radius';
  }
  if (!result.inAngle) {
    return 'out_of_angle';
  }
  if (!result.lineOfSightClear) {
    return 'blocked';
  }
  if (result.visible) {
    return 'clear';
  }
  return 'invalid_input';
}

export function createNpcLineOfSightDebugData(input: {
  readonly observer: NpcPerceptionActorSnapshot;
  readonly config: NpcPerceptionConfig;
  readonly results: readonly NpcPerceptionResult[];
  readonly targetPositions: ReadonlyMap<string, NpcPerceptionPoint>;
}): NpcPerceptionDebugData {
  const observerPoint = createPoint(input.observer.x, input.observer.y);
  const radiusPx = Math.max(0, sanitizeFinite(input.config.radiusPx, 0));
  const angleDeg = clamp(sanitizeFinite(input.config.angleDeg, 0), 0, 360);
  const facingDeg = sanitizeFinite(input.observer.facingDeg, 0);

  const cone: NpcPerceptionDebugCone = {
    origin: observerPoint,
    facingDeg,
    radiusPx,
    angleDeg
  };

  const rays: NpcPerceptionDebugRay[] = [];
  const sortedResults = [...input.results].sort((a, b) => a.targetActorId.localeCompare(b.targetActorId));
  for (const result of sortedResults) {
    const endPoint = input.targetPositions.get(result.targetActorId);
    if (!endPoint) {
      rays.push({
        targetActorId: result.targetActorId,
        start: observerPoint,
        end: observerPoint,
        status: 'invalid_input'
      });
      continue;
    }

    rays.push({
      targetActorId: result.targetActorId,
      start: observerPoint,
      end: createPoint(endPoint.x, endPoint.y),
      blockedByObjectId: result.blockedByObjectId,
      status: createRayStatus(result)
    });
  }

  return {
    observerActorId: input.observer.actorId,
    radiusPx,
    cone,
    rays
  };
}
