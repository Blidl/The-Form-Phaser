export interface NpcPerceptionPoint {
  readonly x: number;
  readonly y: number;
}

export interface NpcPerceptionSegment {
  readonly start: NpcPerceptionPoint;
  readonly end: NpcPerceptionPoint;
}

export interface NpcPerceptionConfig {
  readonly radiusPx: number;
  readonly angleDeg: number;
  readonly requireLineOfSight: boolean;
  readonly blockedByLayerTypes: readonly string[];
  readonly blockedByObjectTags: readonly string[];
  readonly targetActorTags: readonly string[];
}

export interface NpcPerceptionActorSnapshot {
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
  readonly facingDeg: number;
  readonly tags?: readonly string[];
}

export interface NpcPerceptionBlockerSnapshot {
  readonly objectId: string;
  readonly layerType?: string;
  readonly tags?: readonly string[];
  readonly segments: readonly NpcPerceptionSegment[];
}

export interface NpcPerceptionEvaluationInput {
  readonly observer: NpcPerceptionActorSnapshot;
  readonly targets: readonly NpcPerceptionActorSnapshot[];
  readonly blockers?: readonly NpcPerceptionBlockerSnapshot[];
  readonly config: NpcPerceptionConfig;
}

export interface NpcPerceptionResult {
  readonly targetActorId: string;
  readonly inRadius: boolean;
  readonly inAngle: boolean;
  readonly lineOfSightClear: boolean;
  readonly blockedByObjectId?: string;
  readonly visible: boolean;
}

export interface NpcPerceptionEvaluation {
  readonly observerActorId: string;
  readonly results: readonly NpcPerceptionResult[];
}

export type NpcPerceptionDebugRayStatus =
  | 'clear'
  | 'blocked'
  | 'out_of_radius'
  | 'out_of_angle'
  | 'ignored_tag'
  | 'invalid_input';

export interface NpcPerceptionDebugRay {
  readonly targetActorId: string;
  readonly start: NpcPerceptionPoint;
  readonly end: NpcPerceptionPoint;
  readonly blockedPoint?: NpcPerceptionPoint;
  readonly blockedByObjectId?: string;
  readonly status: NpcPerceptionDebugRayStatus;
}

export interface NpcPerceptionDebugCone {
  readonly origin: NpcPerceptionPoint;
  readonly facingDeg: number;
  readonly radiusPx: number;
  readonly angleDeg: number;
}

export interface NpcPerceptionDebugData {
  readonly observerActorId: string;
  readonly radiusPx: number;
  readonly cone: NpcPerceptionDebugCone;
  readonly rays: readonly NpcPerceptionDebugRay[];
}
