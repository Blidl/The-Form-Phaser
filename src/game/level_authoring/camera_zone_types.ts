export type CameraZoneMode = 'bounds' | 'focus' | 'lock_axis' | 'triggered';

export interface CameraZone {
  readonly id: string;
  readonly mode: CameraZoneMode;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly priority?: number;
  readonly targetActorId?: string;
  readonly zoom?: number;
  readonly lockX?: boolean;
  readonly lockY?: boolean;
  readonly restoreOnExit?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
