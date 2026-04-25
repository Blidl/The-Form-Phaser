export type ActorFocusMarkerTarget =
  | {
      readonly kind: 'actor';
      readonly actorId: string;
    }
  | {
      readonly kind: 'point';
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: 'marker';
      readonly markerId: string;
    };

export interface ActorFocusMarkerState {
  readonly actorId: string;
  readonly target: ActorFocusMarkerTarget;
  readonly visible: boolean;
  readonly styleId?: string;
  readonly startedAtMs: number;
  readonly durationMs?: number;
}

export interface ActorFocusMarkerSetRequest {
  readonly actorId: string;
  readonly target: ActorFocusMarkerTarget;
  readonly visible?: boolean;
  readonly styleId?: string;
  readonly startedAtMs?: number;
  readonly durationMs?: number;
}

export interface ActorFocusMarkerClearRequest {
  readonly actorId: string;
}

export interface ActorFocusMarkerRuntimeOptions {
  readonly nowMs?: () => number;
}
