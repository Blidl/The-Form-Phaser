import defaultLevelJson from './data/levels/test_world_level_01.json';
import type { TestNpcInstanceConfig } from '../../npc/npc_types';

export interface TestWorldEditorLockable {
    editorLocked?: boolean;
}

export type TestWorldVisualLayer = 'layer_1' | 'layer_2' | 'layer_3' | 'layer_4' | 'layer_5';

export interface TestWorldVisualOrderConfig {
    id: string;
    visualLayer?: TestWorldVisualLayer;
    renderOrder?: number;
}

export interface TestWorldMetaConfig {
    id: string;
    displayName: string;
}

export interface TestWorldBoundsConfig {
    width: number;
    height: number;
}

export interface TestWorldBackgroundImageConfig {
    textureKey: string;
    textureAsset?: string;
    tintColor?: number;
    alpha?: number;
    scale?: number;
    width?: number;
    height?: number;
    repeat?: boolean;
    fillColor?: number;
    x?: number;
    y?: number;
}

export interface TestWorldParallaxLayerConfig extends TestWorldBackgroundImageConfig {
    id: string;
    height: number;
    scrollFactorX: number;
    scrollFactorY?: number;
}

export interface TestWorldBackgroundConfig {
    color?: number;
    staticImage?: TestWorldBackgroundImageConfig;
    layers?: TestWorldParallaxLayerConfig[];
}

export interface TestWorldPlayerSpawnConfig extends TestWorldEditorLockable {
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldSurfaceConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor: number;
    strokeColor: number;
    alpha?: number;
    collisionMode?: 'solid' | 'visual_only';
}

export interface TestWorldHazardConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldCheckpointConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    respawnX: number;
    respawnY: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldFinishConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldMovingPlatformConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    axis: 'horizontal' | 'vertical';
    travelDistance: number;
    speed: number;
    initialMotionState?: TestWorldMovingPlatformMotionState;
    fillColor?: number;
    strokeColor?: number;
}

export type TestWorldTriggerPlatformActivator = 'player' | 'drag_box';
export type TestWorldTriggerPlatformAction = 'activate' | 'deactivate';
export type TestWorldMovingPlatformMotionState = 'running_loop' | 'stopped' | 'run_once';
export type TestWorldTriggerTargetType = 'trigger_platform' | 'moving_platform' | 'npc';
export type TestWorldTriggerCommandOperation = 'set_active' | 'set_motion_state' | 'set_emotion';

export interface TestWorldTriggerCommandConfig {
    targetType: TestWorldTriggerTargetType;
    targetId: string;
    operation: TestWorldTriggerCommandOperation;
    value: boolean | TestWorldMovingPlatformMotionState | string;
}

export interface TestWorldTriggerPlatformConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    triggerX: number;
    triggerY: number;
    triggerWidth: number;
    triggerHeight: number;
    deactivateTriggerX?: number;
    deactivateTriggerY?: number;
    deactivateTriggerWidth?: number;
    deactivateTriggerHeight?: number;
    platformX: number;
    platformY: number;
    platformWidth: number;
    platformHeight: number;
    activator: TestWorldTriggerPlatformActivator;
    triggerAction: TestWorldTriggerPlatformAction;
    deactivateTriggerAction: TestWorldTriggerPlatformAction;
    initiallyActive: boolean;
    triggerFillColor?: number;
    triggerStrokeColor?: number;
    deactivateTriggerFillColor?: number;
    deactivateTriggerStrokeColor?: number;
    platformFillColor?: number;
    platformStrokeColor?: number;
}

export interface TestWorldTriggerVolumeConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    triggerX: number;
    triggerY: number;
    triggerWidth: number;
    triggerHeight: number;
    deactivateTriggerX?: number;
    deactivateTriggerY?: number;
    deactivateTriggerWidth?: number;
    deactivateTriggerHeight?: number;
    activator: TestWorldTriggerPlatformActivator;
    sourceIds?: string[];
    enterCommand?: TestWorldTriggerCommandConfig | null;
    exitCommand?: TestWorldTriggerCommandConfig | null;
    triggerFillColor?: number;
    triggerStrokeColor?: number;
    deactivateTriggerFillColor?: number;
    deactivateTriggerStrokeColor?: number;
}

export interface TestWorldDragBoxConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    targetTriggerPlatformId?: string;
    gravityY?: number;
    mass?: number;
    pullAcceleration?: number;
    pullMaxSpeed?: number;
    dragX?: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldWindZoneConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    directionX: -1 | 1;
    force: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldTriangleFlightBreakWallConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldTrianglePickupConfig extends TestWorldEditorLockable, TestWorldVisualOrderConfig {
    id: string;
    x: number;
    y: number;
    radius: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldConfig {
    meta: TestWorldMetaConfig;
    worldBounds: TestWorldBoundsConfig;
    background: TestWorldBackgroundConfig | null;
    playerSpawn: TestWorldPlayerSpawnConfig;
    npcs: TestNpcInstanceConfig[];
    surfaces: TestWorldSurfaceConfig[];
    hazards: TestWorldHazardConfig[];
    checkpoints: TestWorldCheckpointConfig[];
    finish: TestWorldFinishConfig | null;
    movingPlatforms: TestWorldMovingPlatformConfig[];
    triggerPlatforms: TestWorldTriggerPlatformConfig[];
    triggerVolumes: TestWorldTriggerVolumeConfig[];
    dragBoxes: TestWorldDragBoxConfig[];
    windZones: TestWorldWindZoneConfig[];
    triangleFlightBreakWalls: TestWorldTriangleFlightBreakWallConfig[];
    trianglePickups: TestWorldTrianglePickupConfig[];
    nextLevelId: string | null;
}

export const TEST_WORLD_CONFIG = defaultLevelJson as TestWorldConfig;

export const cloneTestWorldConfig = (config: TestWorldConfig): TestWorldConfig => {
    return JSON.parse(JSON.stringify(config)) as TestWorldConfig;
};
