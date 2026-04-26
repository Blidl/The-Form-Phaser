export type ActorMarkerKind =
  | 'spawn'
  | 'patrol'
  | 'look_at'
  | 'interaction'
  | 'cutscene'
  | 'custom';

export interface ActorMarker {
  readonly id: string;
  readonly kind: ActorMarkerKind;
  readonly actorId?: string;
  readonly x: number;
  readonly y: number;
  readonly rotationDeg?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
