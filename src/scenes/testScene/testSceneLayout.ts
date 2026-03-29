import { GameObjects, Scene } from 'phaser';
import { GAME_HEIGHT } from '../../config/game/gameConfigValues';
import type { TestSceneLayoutConfig, TestScenePoint, TestSceneSpawnId } from './testSceneTypes';

interface BuiltTestSceneLayout {
    staticBodies: GameObjects.Rectangle[];
}

const WORLD_WIDTH = 4608;
const WORLD_HEIGHT = GAME_HEIGHT;
const FLOOR_HEIGHT = 48;
const FLOOR_Y = WORLD_HEIGHT - (FLOOR_HEIGHT * 0.5);

export const TEST_SCENE_LAYOUT: TestSceneLayoutConfig = {
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    spawnPoints: {
        spawn_baseline: { x: 180, y: FLOOR_Y - 72 }
    },
    platforms: [
        {
            id: 'floor',
            x: WORLD_WIDTH * 0.5,
            y: FLOOR_Y,
            width: WORLD_WIDTH,
            height: FLOOR_HEIGHT,
            color: 0x4c566a
        },
        {
            id: 'baseline_step',
            x: 380,
            y: FLOOR_Y - 64,
            width: 160,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'ball_mobility_platform',
            x: 900,
            y: FLOOR_Y - 92,
            width: 190,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'triangle_platform',
            x: 1360,
            y: FLOOR_Y - 132,
            width: 160,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'breakable_platform',
            x: 1820,
            y: FLOOR_Y - 108,
            width: 140,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'square_attach_platform',
            x: 2340,
            y: FLOOR_Y - 128,
            width: 180,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'square_trail_platform',
            x: 2760,
            y: FLOOR_Y - 156,
            width: 160,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'square_jump_platform',
            x: 3180,
            y: FLOOR_Y - 116,
            width: 170,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'square_rollover_platform',
            x: 3620,
            y: FLOOR_Y - 96,
            width: 160,
            height: 20,
            color: 0x5f6e85
        },
        {
            id: 'world_objects_platform',
            x: 4130,
            y: FLOOR_Y - 136,
            width: 180,
            height: 20,
            color: 0x5f6e85
        }
    ],
    sections: [
        { id: 'spawn_baseline_movement', label: 'Spawn / Baseline Movement', labelX: 64, labelY: 56 },
        { id: 'ball_mobility', label: 'Ball Mobility', labelX: 620, labelY: 56 },
        { id: 'triangle', label: 'Triangle', labelX: 1100, labelY: 56 },
        { id: 'breakable', label: 'Breakable', labelX: 1570, labelY: 56 },
        { id: 'square_attach', label: 'Square Attach', labelX: 2010, labelY: 56 },
        { id: 'square_trail', label: 'Square Trail', labelX: 2480, labelY: 56 },
        { id: 'square_jump', label: 'Square Jump', labelX: 2920, labelY: 56 },
        { id: 'square_rollover', label: 'Square Rollover', labelX: 3370, labelY: 56 },
        { id: 'world_objects', label: 'World Objects', labelX: 3880, labelY: 56 }
    ],
    movingPlatforms: [
        {
            id: 'moving_platform_baseline',
            width: 140,
            height: 20,
            startX: 560,
            startY: FLOOR_Y - 170,
            endX: 760,
            endY: FLOOR_Y - 170,
            speedPxPerSec: 70,
            fillColor: 0xf59e0b,
            strokeColor: 0x92400e
        }
    ],
    triggerPlatforms: [
        {
            id: 'trigger_platform_baseline',
            x: 1120,
            y: FLOOR_Y - 190,
            width: 140,
            height: 20,
            trigger: {
                x: 980,
                y: FLOOR_Y - 80,
                width: 52,
                height: 72
            },
            inactivePlatformColor: 0x64748b,
            activePlatformColor: 0x22c55e,
            triggerColor: 0xfacc15,
            triggerActivatedColor: 0x86efac
        }
    ],
    hazards: [
        {
            x: 4030,
            y: FLOOR_Y - 18,
            width: 220,
            height: 24
        }
    ],
    checkpoints: [
        {
            x: 900,
            y: FLOOR_Y - 150,
            width: 56,
            height: 84,
            respawnX: 900,
            respawnY: FLOOR_Y - 128
        }
    ]
};

export const getTestSceneSpawnPoint = (spawnId: TestSceneSpawnId): TestScenePoint => {
    return TEST_SCENE_LAYOUT.spawnPoints[spawnId];
};

export const buildTestSceneLayout = (scene: Scene): BuiltTestSceneLayout => {
    const staticBodies: GameObjects.Rectangle[] = [];

    for (const platform of TEST_SCENE_LAYOUT.platforms) {
        const platformRect = scene.add
            .rectangle(platform.x, platform.y, platform.width, platform.height, platform.color)
            .setName(platform.id);
        scene.physics.add.existing(platformRect, true);
        staticBodies.push(platformRect);
    }

    for (const section of TEST_SCENE_LAYOUT.sections) {
        scene.add.text(section.labelX, section.labelY, section.label, {
            color: '#cbd5e1',
            fontFamily: 'monospace',
            fontSize: '14px'
        });
    }

    return { staticBodies };
};
