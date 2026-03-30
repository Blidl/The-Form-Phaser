export interface TestWorldSurfaceConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor: number;
    strokeColor: number;
}

export interface TestWorldHazardConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TestWorldCheckpointConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    respawnX: number;
    respawnY: number;
}

export interface TestWorldMovingPlatformConfig {
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

export interface TestWorldTriggerPlatformConfig {
    id: string;
    triggerX: number;
    triggerY: number;
    triggerWidth: number;
    triggerHeight: number;
    platformX: number;
    platformY: number;
    platformWidth: number;
    platformHeight: number;
}

export interface TestWorldWindZoneConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    directionX: -1 | 1;
    force: number;
}

export interface TestWorldTrianglePickupConfig {
    id: string;
    x: number;
    y: number;
    radius: number;
}

export interface TestWorldConfig {
    surfaces: TestWorldSurfaceConfig[];
    hazards: TestWorldHazardConfig[];
    checkpoints: TestWorldCheckpointConfig[];
    movingPlatforms: TestWorldMovingPlatformConfig[];
    triggerPlatforms: TestWorldTriggerPlatformConfig[];
    windZones: TestWorldWindZoneConfig[];
    trianglePickups: TestWorldTrianglePickupConfig[];
}

export const TEST_WORLD_CONFIG: TestWorldConfig = {
    surfaces: [
        {
            id: 'ground',
            x: 1100,
            y: 760,
            width: 2080,
            height: 56,
            fillColor: 0x90a4ae,
            strokeColor: 0xcfd8dc
        },
        {
            id: 'low_platform',
            x: 760,
            y: 610,
            width: 280,
            height: 24,
            fillColor: 0xb0bec5,
            strokeColor: 0xeceff1
        },
        {
            id: 'high_platform',
            x: 1380,
            y: 500,
            width: 240,
            height: 24,
            fillColor: 0xb0bec5,
            strokeColor: 0xeceff1
        },
        {
            id: 'rollover_floor',
            x: 470,
            y: 682,
            width: 220,
            height: 24,
            fillColor: 0xffcc80,
            strokeColor: 0xef6c00
        },
        {
            id: 'rollover_wall',
            x: 592,
            y: 570,
            width: 24,
            height: 200,
            fillColor: 0xffcc80,
            strokeColor: 0xef6c00
        },
        {
            id: 'rollover_ceiling',
            x: 700,
            y: 458,
            width: 216,
            height: 24,
            fillColor: 0xffcc80,
            strokeColor: 0xef6c00
        },
        {
            id: 'rollback_floor',
            x: 1020,
            y: 682,
            width: 180,
            height: 24,
            fillColor: 0xf48fb1,
            strokeColor: 0xad1457
        },
        {
            id: 'rollback_wall',
            x: 1122,
            y: 570,
            width: 24,
            height: 200,
            fillColor: 0xf48fb1,
            strokeColor: 0xad1457
        },
        {
            id: 'rollback_blocker',
            x: 1092,
            y: 690,
            width: 28,
            height: 28,
            fillColor: 0xce93d8,
            strokeColor: 0x6a1b9a
        }
    ],
    hazards: [
        {
            id: 'hazard_main',
            x: 980,
            y: 720,
            width: 180,
            height: 20
        }
    ],
    checkpoints: [
        {
            id: 'checkpoint_start',
            x: 260,
            y: 676,
            width: 68,
            height: 88,
            respawnX: 220,
            respawnY: 620
        },
        {
            id: 'checkpoint_mid',
            x: 1320,
            y: 676,
            width: 68,
            height: 88,
            respawnX: 1320,
            respawnY: 620
        }
    ],
    movingPlatforms: [
        {
            id: 'moving_platform_main',
            x: 980,
            y: 555,
            width: 180,
            height: 20,
            axis: 'horizontal',
            travelDistance: 200,
            speed: 120
        }
    ],
    triggerPlatforms: [
        {
            id: 'trigger_platform_main',
            triggerX: 560,
            triggerY: 692,
            triggerWidth: 110,
            triggerHeight: 84,
            platformX: 760,
            platformY: 470,
            platformWidth: 180,
            platformHeight: 22
        }
    ],
    windZones: [
        {
            id: 'wind_main',
            x: 1080,
            y: 640,
            width: 260,
            height: 170,
            directionX: 1,
            force: 160
        }
    ],
    trianglePickups: [
        {
            id: 'triangle_pickup_a',
            x: 640,
            y: 530,
            radius: 10
        },
        {
            id: 'triangle_pickup_b',
            x: 1040,
            y: 430,
            radius: 10
        },
        {
            id: 'triangle_pickup_c',
            x: 1480,
            y: 340,
            radius: 10
        }
    ]
};

export const cloneTestWorldConfig = (config: TestWorldConfig): TestWorldConfig => {
    return JSON.parse(JSON.stringify(config)) as TestWorldConfig;
};
