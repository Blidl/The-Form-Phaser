export type ActorManpuAnchor =
  | 'top_right'
  | 'top_left'
  | 'center_right'
  | 'center_left';

export interface ActorManpuState {
  readonly actorId: string;
  readonly manpuId: string;
  readonly startedAtMs: number;
  readonly durationMs?: number;
  readonly anchor: ActorManpuAnchor;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly visible: boolean;
}

export interface ActorManpuShowRequest {
  readonly actorId: string;
  readonly manpuId: string;
  readonly startedAtMs?: number;
  readonly durationMs?: number;
  readonly anchor?: ActorManpuAnchor;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly visible?: boolean;
}

export interface ActorManpuHideRequest {
  readonly actorId: string;
  readonly manpuId?: string;
}

export interface ActorManpuClearRequest {
  readonly actorId: string;
}

export interface ActorManpuRuntimeOptions {
  readonly nowMs?: () => number;
}
