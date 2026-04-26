import type { ActorMarker } from './actor_marker_types';
import type { BackgroundAuthoring } from './background_authoring_types';
import type { CameraZone } from './camera_zone_types';
import type { LevelAuthoringPoint, LevelAuthoringTransform, MotionPath } from './motion_path_types';
import type { ObjectPrefab } from './object_prefab_types';

export const LevelAssetSchemaVersion = 2 as const;
export type LevelAssetSchemaVersion = typeof LevelAssetSchemaVersion;

export interface LevelAssetBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LevelAssetGrid {
  readonly enabled: boolean;
  readonly sizePx: number;
  readonly snap: boolean;
}

export type LevelAssetLayerType =
  | 'collision'
  | 'gameplay'
  | 'actors'
  | 'triggers'
  | 'platforms'
  | 'paths'
  | 'camera'
  | 'background'
  | 'decor'
  | 'debug';

export interface LevelAssetLayer {
  readonly id: string;
  readonly type: LevelAssetLayerType;
  readonly displayName?: string;
  readonly visible: boolean;
  readonly locked?: boolean;
  readonly order: number;
}

export type LevelObjectType =
  | 'player_spawn'
  | 'surface'
  | 'polygon_surface'
  | 'hazard'
  | 'checkpoint'
  | 'finish'
  | 'npc'
  | 'trigger'
  | 'moving_platform'
  | 'trigger_platform'
  | 'drag_box'
  | 'wind_zone'
  | 'triangle_flight_break_wall'
  | 'triangle_pickup'
  | 'camera_zone';

export interface LevelObjectBase {
  readonly id: string;
  readonly type: LevelObjectType;
  readonly layerId: string;
  readonly transform: LevelAuthoringTransform;
  readonly tags?: readonly string[];
  readonly prefabRef?: string;
  readonly prefabVariantRef?: string;
  readonly editorMetadata?: Readonly<Record<string, unknown>>;
}

export interface LevelPolygon {
  readonly points: readonly LevelAuthoringPoint[];
}

export interface PlayerSpawnLevelObject extends LevelObjectBase {
  readonly type: 'player_spawn';
}

export interface SurfaceLevelObject extends LevelObjectBase {
  readonly type: 'surface';
  readonly width: number;
  readonly height: number;
  readonly oneWay?: boolean;
}

export interface PolygonSurfaceLevelObject extends LevelObjectBase {
  readonly type: 'polygon_surface';
  readonly polygon: LevelPolygon;
  readonly oneWay?: boolean;
}

export interface HazardLevelObject extends LevelObjectBase {
  readonly type: 'hazard';
  readonly width?: number;
  readonly height?: number;
  readonly polygon?: LevelPolygon;
  readonly damage?: number;
}

export interface CheckpointLevelObject extends LevelObjectBase {
  readonly type: 'checkpoint';
  readonly width?: number;
  readonly height?: number;
  readonly checkpointId?: string;
}

export interface FinishLevelObject extends LevelObjectBase {
  readonly type: 'finish';
  readonly width?: number;
  readonly height?: number;
}

export interface NpcLevelObject extends LevelObjectBase {
  readonly type: 'npc';
  readonly npcInstanceId: string;
  readonly npcProfileId?: string;
  readonly behaviorAssetId?: string;
  readonly physicsMode?: 'dynamic' | 'kinematic' | 'static' | 'ghost';
}

export interface TriggerLevelObject extends LevelObjectBase {
  readonly type: 'trigger';
  readonly triggerId: string;
  readonly width?: number;
  readonly height?: number;
  readonly polygon?: LevelPolygon;
  readonly eventId?: string;
}

export interface MovingPlatformLevelObject extends LevelObjectBase {
  readonly type: 'moving_platform';
  readonly platformId: string;
  readonly width: number;
  readonly height: number;
  readonly motionPathRef?: string;
  readonly motionStateId?: string;
}

export interface TriggerPlatformLevelObject extends LevelObjectBase {
  readonly type: 'trigger_platform';
  readonly platformId: string;
  readonly width: number;
  readonly height: number;
  readonly triggerId?: string;
  readonly motionPathRef?: string;
}

export interface DragBoxLevelObject extends LevelObjectBase {
  readonly type: 'drag_box';
  readonly width: number;
  readonly height: number;
}

export interface WindZoneLevelObject extends LevelObjectBase {
  readonly type: 'wind_zone';
  readonly width: number;
  readonly height: number;
  readonly forceX?: number;
  readonly forceY?: number;
}

export interface TriangleFlightBreakWallLevelObject extends LevelObjectBase {
  readonly type: 'triangle_flight_break_wall';
  readonly width?: number;
  readonly height?: number;
  readonly polygon?: LevelPolygon;
}

export interface TrianglePickupLevelObject extends LevelObjectBase {
  readonly type: 'triangle_pickup';
  readonly pickupId?: string;
}

export interface CameraZoneLevelObject extends LevelObjectBase {
  readonly type: 'camera_zone';
  readonly cameraZoneId: string;
}

export type LevelObject =
  | PlayerSpawnLevelObject
  | SurfaceLevelObject
  | PolygonSurfaceLevelObject
  | HazardLevelObject
  | CheckpointLevelObject
  | FinishLevelObject
  | NpcLevelObject
  | TriggerLevelObject
  | MovingPlatformLevelObject
  | TriggerPlatformLevelObject
  | DragBoxLevelObject
  | WindZoneLevelObject
  | TriangleFlightBreakWallLevelObject
  | TrianglePickupLevelObject
  | CameraZoneLevelObject;

export interface LevelAsset {
  readonly schemaVersion: 2;
  readonly id: string;
  readonly displayName?: string;
  readonly bounds: LevelAssetBounds;
  readonly grid: LevelAssetGrid;
  readonly layers: readonly LevelAssetLayer[];
  readonly objects: readonly LevelObject[];
  readonly prefabs: readonly ObjectPrefab[];
  readonly paths: readonly MotionPath[];
  readonly actorMarkers: readonly ActorMarker[];
  readonly cameraZones: readonly CameraZone[];
  readonly background: BackgroundAuthoring;
  readonly initialFlags: Readonly<Record<string, boolean>>;
}
