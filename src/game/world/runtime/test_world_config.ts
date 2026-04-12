import defaultLevelJson from './data/levels/test_world_level_01.json';

export interface TestWorldEditorLockable {
    editorLocked?: boolean;
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

export interface TestWorldSurfaceConfig extends TestWorldEditorLockable {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor: number;
    strokeColor: number;
}

export interface TestWorldHazardConfig extends TestWorldEditorLockable {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldCheckpointConfig extends TestWorldEditorLockable {
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

export interface TestWorldFinishConfig extends TestWorldEditorLockable {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldMovingPlatformConfig extends TestWorldEditorLockable {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    axis: 'horizontal' | 'vertical';
    travelDistance: number;
    speed: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldTriggerPlatformConfig extends TestWorldEditorLockable {
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
    activator?: 'player' | 'drag_box';
    triggerAction?: 'activate' | 'deactivate';
    deactivateTriggerAction?: 'activate' | 'deactivate';
    initiallyActive?: boolean;
    triggerFillColor?: number;
    triggerStrokeColor?: number;
    deactivateTriggerFillColor?: number;
    deactivateTriggerStrokeColor?: number;
    platformFillColor?: number;
    platformStrokeColor?: number;
}

export interface TestWorldDragBoxConfig extends TestWorldEditorLockable {
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

export interface TestWorldWindZoneConfig extends TestWorldEditorLockable {
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

export interface TestWorldTriangleFlightBreakWallConfig extends TestWorldEditorLockable {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface TestWorldTrianglePickupConfig extends TestWorldEditorLockable {
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
    surfaces: TestWorldSurfaceConfig[];
    hazards: TestWorldHazardConfig[];
    checkpoints: TestWorldCheckpointConfig[];
    finish: TestWorldFinishConfig | null;
    movingPlatforms: TestWorldMovingPlatformConfig[];
    triggerPlatforms: TestWorldTriggerPlatformConfig[];
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
