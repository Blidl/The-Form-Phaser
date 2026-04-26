export interface LevelAuthoringPoint {
  readonly x: number;
  readonly y: number;
}

export interface LevelAuthoringTransform {
  readonly x: number;
  readonly y: number;
  readonly rotationDeg?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export type MotionPathPlaybackMode = 'loop' | 'ping_pong' | 'once' | 'manual';

export type MotionPathTimingMode = 'speed' | 'duration';

export type MotionPathEasingId = string;

export interface MotionPathPoint {
  readonly id?: string;
  readonly x: number;
  readonly y: number;
  readonly waitMs?: number;
}

export interface MotionPathRotationConfig {
  readonly rotateAroundPivot?: boolean;
  readonly pivot?: LevelAuthoringPoint;
  readonly rotationSpeedDegPerSec?: number;
  readonly facePathDirection?: boolean;
}

export interface MotionPath {
  readonly id: string;
  readonly displayName?: string;
  readonly points: readonly MotionPathPoint[];
  readonly playbackMode: MotionPathPlaybackMode;
  readonly timingMode: MotionPathTimingMode;
  readonly speedPxPerSec?: number;
  readonly durationMs?: number;
  readonly easing?: MotionPathEasingId;
  readonly rotation?: MotionPathRotationConfig;
  readonly editorColor?: string;
}
