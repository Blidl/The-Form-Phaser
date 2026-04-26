import { createNpcLineOfSightDebugData } from './npc_line_of_sight_debug';
import type {
  NpcPerceptionActorSnapshot,
  NpcPerceptionBlockerSnapshot,
  NpcPerceptionConfig,
  NpcPerceptionDebugData,
  NpcPerceptionDebugRay,
  NpcPerceptionEvaluation,
  NpcPerceptionEvaluationInput,
  NpcPerceptionPoint,
  NpcPerceptionResult
} from './npc_perception_types';

const EPSILON = 1e-9;

interface NpcPerceptionRuntimeInternalResult {
  readonly evaluation: NpcPerceptionEvaluation;
  readonly targetPositions: ReadonlyMap<string, NpcPerceptionPoint>;
  readonly blockedPointsByTargetId: ReadonlyMap<string, NpcPerceptionPoint>;
  readonly ignoredTagTargetIds: readonly string[];
}

interface NormalizedPerceptionConfig {
  readonly radiusPx: number;
  readonly angleDeg: number;
  readonly requireLineOfSight: boolean;
  readonly blockedByLayerTypes: ReadonlySet<string>;
  readonly blockedByObjectTags: ReadonlySet<string>;
  readonly targetActorTags: ReadonlySet<string>;
}

interface RayIntersection {
  readonly point: NpcPerceptionPoint;
  readonly distanceSq: number;
}

interface LineOfSightResult {
  readonly clear: boolean;
  readonly blockedByObjectId?: string;
  readonly blockedPoint?: NpcPerceptionPoint;
}

export interface NpcPerceptionRuntime {
  evaluate(input: NpcPerceptionEvaluationInput): NpcPerceptionEvaluation;
  evaluateWithDebug(input: NpcPerceptionEvaluationInput): {
    readonly evaluation: NpcPerceptionEvaluation;
    readonly debug: NpcPerceptionDebugData;
  };
}

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

function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function degreesBetween(observer: NpcPerceptionPoint, target: NpcPerceptionPoint): number {
  const radians = Math.atan2(target.y - observer.y, target.x - observer.x);
  return normalizeDegrees((radians * 180) / Math.PI);
}

function smallestAngularDeltaDeg(a: number, b: number): number {
  const delta = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(delta, 360 - delta);
}

function isValidPoint(point: NpcPerceptionPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function createPoint(x: number, y: number): NpcPerceptionPoint {
  return { x, y };
}

function distanceSquared(a: NpcPerceptionPoint, b: NpcPerceptionPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function intersectSegments(
  p1: NpcPerceptionPoint,
  p2: NpcPerceptionPoint,
  q1: NpcPerceptionPoint,
  q2: NpcPerceptionPoint
): RayIntersection | null {
  if (!isValidPoint(p1) || !isValidPoint(p2) || !isValidPoint(q1) || !isValidPoint(q2)) {
    return null;
  }

  const rX = p2.x - p1.x;
  const rY = p2.y - p1.y;
  const sX = q2.x - q1.x;
  const sY = q2.y - q1.y;

  const rCrossS = cross(rX, rY, sX, sY);
  const qMinusPX = q1.x - p1.x;
  const qMinusPY = q1.y - p1.y;
  const qMinusPCrossR = cross(qMinusPX, qMinusPY, rX, rY);

  if (Math.abs(rCrossS) <= EPSILON && Math.abs(qMinusPCrossR) <= EPSILON) {
    const rLenSq = rX * rX + rY * rY;
    if (rLenSq <= EPSILON) {
      return null;
    }

    const t0 = ((q1.x - p1.x) * rX + (q1.y - p1.y) * rY) / rLenSq;
    const t1 = ((q2.x - p1.x) * rX + (q2.y - p1.y) * rY) / rLenSq;
    const tMin = Math.max(0, Math.min(t0, t1));
    const tMax = Math.min(1, Math.max(t0, t1));
    if (tMin > tMax + EPSILON) {
      return null;
    }

    const clampedT = clamp(tMin, 0, 1);
    const point = createPoint(p1.x + clampedT * rX, p1.y + clampedT * rY);
    return {
      point,
      distanceSq: distanceSquared(p1, point)
    };
  }

  if (Math.abs(rCrossS) <= EPSILON) {
    return null;
  }

  const t = cross(qMinusPX, qMinusPY, sX, sY) / rCrossS;
  const u = cross(qMinusPX, qMinusPY, rX, rY) / rCrossS;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null;
  }

  const clampedT = clamp(t, 0, 1);
  const point = createPoint(p1.x + clampedT * rX, p1.y + clampedT * rY);
  return {
    point,
    distanceSq: distanceSquared(p1, point)
  };
}

function toTagSet(values: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }
    set.add(normalized);
  }
  return set;
}

function normalizeConfig(config: NpcPerceptionConfig): NormalizedPerceptionConfig {
  return {
    radiusPx: Math.max(0, sanitizeFinite(config.radiusPx, 0)),
    angleDeg: clamp(sanitizeFinite(config.angleDeg, 0), 0, 360),
    requireLineOfSight: Boolean(config.requireLineOfSight),
    blockedByLayerTypes: toTagSet(config.blockedByLayerTypes),
    blockedByObjectTags: toTagSet(config.blockedByObjectTags),
    targetActorTags: toTagSet(config.targetActorTags)
  };
}

function blockerHasMatchingTag(blocker: NpcPerceptionBlockerSnapshot, requiredTags: ReadonlySet<string>): boolean {
  if (requiredTags.size === 0) {
    return true;
  }
  const tags = blocker.tags ?? [];
  for (const tag of tags) {
    if (requiredTags.has(tag)) {
      return true;
    }
  }
  return false;
}

function actorHasMatchingTag(actor: NpcPerceptionActorSnapshot, requiredTags: ReadonlySet<string>): boolean {
  if (requiredTags.size === 0) {
    return true;
  }
  const tags = actor.tags ?? [];
  for (const tag of tags) {
    if (requiredTags.has(tag)) {
      return true;
    }
  }
  return false;
}

function isRelevantBlocker(blocker: NpcPerceptionBlockerSnapshot, config: NormalizedPerceptionConfig): boolean {
  if (!Array.isArray(blocker.segments) || blocker.segments.length === 0) {
    return false;
  }

  const requiresLayerMatch = config.blockedByLayerTypes.size > 0;
  const requiresTagMatch = config.blockedByObjectTags.size > 0;

  if (!requiresLayerMatch && !requiresTagMatch) {
    return true;
  }

  if (requiresLayerMatch) {
    if (!blocker.layerType || !config.blockedByLayerTypes.has(blocker.layerType)) {
      return false;
    }
  }

  if (requiresTagMatch && !blockerHasMatchingTag(blocker, config.blockedByObjectTags)) {
    return false;
  }

  return true;
}

function findNearestLineBlocker(
  observerPoint: NpcPerceptionPoint,
  targetPoint: NpcPerceptionPoint,
  blockers: readonly NpcPerceptionBlockerSnapshot[],
  config: NormalizedPerceptionConfig
): LineOfSightResult {
  let nearestObjectId: string | undefined;
  let nearestPoint: NpcPerceptionPoint | undefined;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const blocker of blockers) {
    if (!isRelevantBlocker(blocker, config)) {
      continue;
    }

    for (const segment of blocker.segments) {
      const intersection = intersectSegments(observerPoint, targetPoint, segment.start, segment.end);
      if (!intersection) {
        continue;
      }
      if (intersection.distanceSq < nearestDistanceSq) {
        nearestDistanceSq = intersection.distanceSq;
        nearestObjectId = blocker.objectId;
        nearestPoint = intersection.point;
      }
    }
  }

  if (!nearestObjectId) {
    return { clear: true };
  }

  return {
    clear: false,
    blockedByObjectId: nearestObjectId,
    blockedPoint: nearestPoint
  };
}

function sanitizeObserverActorId(actorId: string): string {
  if (typeof actorId !== 'string') {
    return '';
  }
  return actorId;
}

function createInvisibleResult(targetActorId: string): NpcPerceptionResult {
  return {
    targetActorId,
    inRadius: false,
    inAngle: false,
    lineOfSightClear: false,
    visible: false
  };
}

function evaluateInternal(input: NpcPerceptionEvaluationInput): NpcPerceptionRuntimeInternalResult {
  const config = normalizeConfig(input.config);
  const observerActorId = sanitizeObserverActorId(input.observer.actorId);
  const observerPoint = createPoint(input.observer.x, input.observer.y);
  const observerFacingDeg = sanitizeFinite(input.observer.facingDeg, 0);
  const blockers = input.blockers ?? [];
  const radiusSq = config.radiusPx * config.radiusPx;

  const results: NpcPerceptionResult[] = [];
  const targetPositions = new Map<string, NpcPerceptionPoint>();
  const blockedPointsByTargetId = new Map<string, NpcPerceptionPoint>();
  const ignoredTagTargetIds: string[] = [];

  for (const target of input.targets) {
    const targetActorId = target.actorId;
    if (typeof targetActorId !== 'string' || targetActorId.length === 0) {
      continue;
    }

    targetPositions.set(targetActorId, createPoint(target.x, target.y));

    if (!actorHasMatchingTag(target, config.targetActorTags)) {
      ignoredTagTargetIds.push(targetActorId);
      continue;
    }

    const targetPoint = createPoint(target.x, target.y);
    if (!isValidPoint(observerPoint) || !isValidPoint(targetPoint)) {
      results.push(createInvisibleResult(targetActorId));
      continue;
    }

    const distSq = distanceSquared(observerPoint, targetPoint);
    const inRadius = distSq <= radiusSq;
    let inAngle = false;
    if (config.angleDeg >= 360) {
      inAngle = true;
    } else {
      const directionToTargetDeg = degreesBetween(observerPoint, targetPoint);
      const halfAngleDeg = config.angleDeg * 0.5;
      inAngle = smallestAngularDeltaDeg(directionToTargetDeg, observerFacingDeg) <= halfAngleDeg + EPSILON;
    }

    let lineOfSightClear = true;
    let blockedByObjectId: string | undefined;
    if (config.requireLineOfSight) {
      if (observerPoint.x === targetPoint.x && observerPoint.y === targetPoint.y) {
        lineOfSightClear = true;
      } else {
        const lineOfSight = findNearestLineBlocker(observerPoint, targetPoint, blockers, config);
        lineOfSightClear = lineOfSight.clear;
        blockedByObjectId = lineOfSight.blockedByObjectId;
        if (lineOfSight.blockedPoint) {
          blockedPointsByTargetId.set(targetActorId, lineOfSight.blockedPoint);
        }
      }
    }

    const visible = inRadius && inAngle && lineOfSightClear;
    results.push({
      targetActorId,
      inRadius,
      inAngle,
      lineOfSightClear,
      blockedByObjectId,
      visible
    });
  }

  results.sort((a, b) => a.targetActorId.localeCompare(b.targetActorId));
  ignoredTagTargetIds.sort((a, b) => a.localeCompare(b));

  return {
    evaluation: {
      observerActorId,
      results
    },
    targetPositions,
    blockedPointsByTargetId,
    ignoredTagTargetIds
  };
}

function compareRaysByTargetId(a: NpcPerceptionDebugRay, b: NpcPerceptionDebugRay): number {
  return a.targetActorId.localeCompare(b.targetActorId);
}

export function createNpcPerceptionRuntime(): NpcPerceptionRuntime {
  return {
    evaluate(input: NpcPerceptionEvaluationInput): NpcPerceptionEvaluation {
      const internal = evaluateInternal(input);
      return {
        observerActorId: internal.evaluation.observerActorId,
        results: [...internal.evaluation.results]
      };
    },

    evaluateWithDebug(input: NpcPerceptionEvaluationInput): {
      readonly evaluation: NpcPerceptionEvaluation;
      readonly debug: NpcPerceptionDebugData;
    } {
      const internal = evaluateInternal(input);
      const debug = createNpcLineOfSightDebugData({
        observer: input.observer,
        config: input.config,
        results: internal.evaluation.results,
        targetPositions: internal.targetPositions
      });

      const observerPoint = createPoint(
        sanitizeFinite(input.observer.x, 0),
        sanitizeFinite(input.observer.y, 0)
      );
      const rays: NpcPerceptionDebugRay[] = [];
      for (const ray of debug.rays) {
        const blockedPoint = internal.blockedPointsByTargetId.get(ray.targetActorId);
        rays.push(
          blockedPoint
            ? {
                ...ray,
                blockedPoint: { x: blockedPoint.x, y: blockedPoint.y }
              }
            : ray
        );
      }

      for (const ignoredTargetActorId of internal.ignoredTagTargetIds) {
        const endPoint = internal.targetPositions.get(ignoredTargetActorId);
        rays.push({
          targetActorId: ignoredTargetActorId,
          start: observerPoint,
          end: endPoint ? { x: endPoint.x, y: endPoint.y } : observerPoint,
          status: 'ignored_tag'
        });
      }

      rays.sort(compareRaysByTargetId);

      return {
        evaluation: {
          observerActorId: internal.evaluation.observerActorId,
          results: [...internal.evaluation.results]
        },
        debug: {
          observerActorId: debug.observerActorId,
          radiusPx: debug.radiusPx,
          cone: {
            origin: { x: debug.cone.origin.x, y: debug.cone.origin.y },
            facingDeg: debug.cone.facingDeg,
            radiusPx: debug.cone.radiusPx,
            angleDeg: debug.cone.angleDeg
          },
          rays
        }
      };
    }
  };
}
