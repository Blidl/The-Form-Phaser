import type {
    PfCheckpointConfig,
    PfHazardConfig,
    PfMovingPlatformConfig,
    PfTriggerPlatformConfig
} from '../../game/world';

export type TestSceneSpawnId = 'spawn_baseline';

export interface TestScenePoint {
    x: number;
    y: number;
}

export interface TestScenePlatformConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: number;
}

export interface TestSceneSectionConfig {
    id: string;
    label: string;
    labelX: number;
    labelY: number;
}

export interface TestSceneLayoutConfig {
    worldWidth: number;
    worldHeight: number;
    spawnPoints: Record<TestSceneSpawnId, TestScenePoint>;
    platforms: readonly TestScenePlatformConfig[];
    sections: readonly TestSceneSectionConfig[];
    movingPlatforms: readonly PfMovingPlatformConfig[];
    triggerPlatforms: readonly PfTriggerPlatformConfig[];
    hazards: readonly PfHazardConfig[];
    checkpoints: readonly PfCheckpointConfig[];
}
