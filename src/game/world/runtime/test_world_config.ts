export interface TestWorldEditorLockable {
    editorLocked?: boolean;
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
    playerSpawn: TestWorldPlayerSpawnConfig;
    surfaces: TestWorldSurfaceConfig[];
    hazards: TestWorldHazardConfig[];
    checkpoints: TestWorldCheckpointConfig[];
    movingPlatforms: TestWorldMovingPlatformConfig[];
    triggerPlatforms: TestWorldTriggerPlatformConfig[];
    dragBoxes: TestWorldDragBoxConfig[];
    windZones: TestWorldWindZoneConfig[];
    triangleFlightBreakWalls: TestWorldTriangleFlightBreakWallConfig[];
    trianglePickups: TestWorldTrianglePickupConfig[];
}

export const TEST_WORLD_CONFIG: TestWorldConfig = {
    playerSpawn: {
        x: 220,
        y: 620,
        width: 36,
        height: 56,
        fillColor: 0x81d4fa,
        strokeColor: 0x0277bd
    },
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
            height: 20,
            fillColor: 0xef5350,
            strokeColor: 0xb71c1c
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
            respawnY: 620,
            fillColor: 0x90caf9,
            strokeColor: 0x64b5f6
        },
        {
            id: 'checkpoint_mid',
            x: 1320,
            y: 676,
            width: 68,
            height: 88,
            respawnX: 1320,
            respawnY: 620,
            fillColor: 0x90caf9,
            strokeColor: 0x64b5f6
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
            speed: 120,
            fillColor: 0xffcc80,
            strokeColor: 0xef6c00
        }
    ],
    triggerPlatforms: [
        {
            id: 'trigger_platform_main',
            triggerX: 560,
            triggerY: 692,
            triggerWidth: 110,
            triggerHeight: 84,
            deactivateTriggerX: 980,
            deactivateTriggerY: 692,
            deactivateTriggerWidth: 110,
            deactivateTriggerHeight: 84,
            platformX: 760,
            platformY: 470,
            platformWidth: 180,
            platformHeight: 22,
            activator: 'player',
            triggerFillColor: 0xfff59d,
            triggerStrokeColor: 0xf9a825,
            deactivateTriggerFillColor: 0xffccbc,
            deactivateTriggerStrokeColor: 0xe64a19,
            platformFillColor: 0x616161,
            platformStrokeColor: 0xb0bec5
        },
        {
            id: 'trigger_platform_drag_box',
            triggerX: 1460,
            triggerY: 720,
            triggerWidth: 96,
            triggerHeight: 84,
            platformX: 1700,
            platformY: 560,
            platformWidth: 180,
            platformHeight: 22,
            activator: 'drag_box',
            triggerFillColor: 0xfff59d,
            triggerStrokeColor: 0xf9a825,
            platformFillColor: 0x616161,
            platformStrokeColor: 0xb0bec5
        }
    ],
    dragBoxes: [
        {
            id: 'drag_box_main',
            x: 1290,
            y: 710,
            width: 44,
            height: 44,
            targetTriggerPlatformId: 'trigger_platform_drag_box',
            gravityY: 2200,
            mass: 10,
            pullAcceleration: 1400,
            pullMaxSpeed: 150,
            dragX: 900,
            fillColor: 0xfff59d,
            strokeColor: 0xf9a825
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
            force: 160,
            fillColor: 0x80deea,
            strokeColor: 0x00838f
        }
    ],
    triangleFlightBreakWalls: [
        {
            id: 'triangle_flight_break_wall_main',
            x: 1560,
            y: 668,
            width: 40,
            height: 184,
            fillColor: 0xa1887f,
            strokeColor: 0x4e342e
        }
    ],
    trianglePickups: [
        {
            id: 'triangle_pickup_a',
            x: 640,
            y: 530,
            radius: 10,
            fillColor: 0xfff59d,
            strokeColor: 0xffca28
        },
        {
            id: 'triangle_pickup_b',
            x: 1040,
            y: 430,
            radius: 10,
            fillColor: 0xfff59d,
            strokeColor: 0xffca28
        },
        {
            id: 'triangle_pickup_c',
            x: 1480,
            y: 340,
            radius: 10,
            fillColor: 0xfff59d,
            strokeColor: 0xffca28
        }
    ]
};

export const cloneTestWorldConfig = (config: TestWorldConfig): TestWorldConfig => {
    return JSON.parse(JSON.stringify(config)) as TestWorldConfig;
};
