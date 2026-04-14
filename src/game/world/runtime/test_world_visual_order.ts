import type { GameObjects } from 'phaser';
import type { TestWorldEditorObjectType } from './test_world_editor_adapters';
import type {
    TestWorldPlayerVisualRelation,
    TestWorldVisualLayer,
    TestWorldVisualOrderConfig
} from './test_world_config';

export const TEST_WORLD_VISUAL_LAYER_OPTIONS: ReadonlyArray<{
    value: 'default' | TestWorldVisualLayer;
    label: string;
}> = [
    { value: 'default', label: 'Default' },
    { value: 'background', label: 'Behind Player' },
    { value: 'gameplay', label: 'Gameplay Default' },
    { value: 'foreground', label: 'Over Player' }
] as const;

export const TEST_WORLD_PLAYER_VISUAL_RELATION_OPTIONS: ReadonlyArray<{
    value: 'default' | TestWorldPlayerVisualRelation;
    label: string;
}> = [
    { value: 'default', label: 'Default' },
    { value: 'behind_player', label: 'Player In Front' },
    { value: 'in_front_of_player', label: 'Player Behind' }
] as const;

const VISUAL_LAYER_BASE_DEPTH: Record<TestWorldVisualLayer, number> = {
    background: 3500,
    gameplay: 4100,
    foreground: 4700
};

const GAMEPLAY_PLAYER_RELATION_BASE_DEPTH: Record<TestWorldPlayerVisualRelation, number> = {
    behind_player: 4100,
    in_front_of_player: 4600
};

const DEFAULT_VISUAL_LAYER_BY_TYPE: Record<TestWorldEditorObjectType, TestWorldVisualLayer> = {
    playerSpawn: 'gameplay',
    finish: 'gameplay',
    surface: 'gameplay',
    hazard: 'gameplay',
    checkpoint: 'background',
    movingPlatform: 'gameplay',
    triggerPlatform: 'gameplay',
    triggerVolume: 'gameplay',
    dragBox: 'gameplay',
    windZone: 'background',
    triangleFlightBreakWall: 'gameplay',
    trianglePickup: 'gameplay'
};

const DEFAULT_RENDER_ORDER_BY_TYPE: Record<TestWorldEditorObjectType, number> = {
    playerSpawn: 40,
    checkpoint: 60,
    finish: 80,
    surface: 100,
    triggerVolume: 120,
    windZone: 140,
    triggerPlatform: 160,
    triangleFlightBreakWall: 180,
    dragBox: 200,
    movingPlatform: 220,
    hazard: 260,
    trianglePickup: 280
};

export interface TestWorldVisualDepthEntry {
    gameObject: GameObjects.GameObject;
    objectType: TestWorldEditorObjectType;
    config: TestWorldVisualOrderConfig;
    partKey: string;
    partOrder?: number;
}

export const resolveTestWorldVisualLayer = (
    objectType: TestWorldEditorObjectType,
    config: Pick<TestWorldVisualOrderConfig, 'visualLayer'>
): TestWorldVisualLayer => {
    return config.visualLayer ?? DEFAULT_VISUAL_LAYER_BY_TYPE[objectType];
};

export const resolveTestWorldRenderOrder = (
    objectType: TestWorldEditorObjectType,
    config: Pick<TestWorldVisualOrderConfig, 'renderOrder'>
): number => {
    return config.renderOrder ?? DEFAULT_RENDER_ORDER_BY_TYPE[objectType];
};

export const resolveTestWorldPlayerVisualRelation = (
    objectType: TestWorldEditorObjectType,
    config: Pick<TestWorldVisualOrderConfig, 'visualLayer' | 'playerVisualRelation'>
): TestWorldPlayerVisualRelation => {
    const layer = resolveTestWorldVisualLayer(objectType, config);
    if (layer === 'background') {
        return 'behind_player';
    }
    if (layer === 'foreground') {
        return 'in_front_of_player';
    }
    return config.playerVisualRelation ?? 'behind_player';
};

export const applyTestWorldVisualDepthEntries = (
    entries: readonly TestWorldVisualDepthEntry[]
): void => {
    const groupedEntries = new Map<string, TestWorldVisualDepthEntry[]>();

    entries.forEach((entry) => {
        const layer = resolveTestWorldVisualLayer(entry.objectType, entry.config);
        const relation = resolveTestWorldPlayerVisualRelation(entry.objectType, entry.config);
        const groupKey = layer === 'gameplay' ? `${layer}:${relation}` : layer;
        const bucket = groupedEntries.get(groupKey);
        if (bucket) {
            bucket.push(entry);
            return;
        }
        groupedEntries.set(groupKey, [entry]);
    });

    [
        'background',
        'gameplay:behind_player',
        'gameplay:in_front_of_player',
        'foreground'
    ].forEach((groupKey) => {
            const layerEntries = groupedEntries.get(groupKey) ?? [];
            const baseDepth = groupKey === 'background'
                ? VISUAL_LAYER_BASE_DEPTH.background
                : groupKey === 'foreground'
                    ? VISUAL_LAYER_BASE_DEPTH.foreground
                    : groupKey === 'gameplay:in_front_of_player'
                        ? GAMEPLAY_PLAYER_RELATION_BASE_DEPTH.in_front_of_player
                        : GAMEPLAY_PLAYER_RELATION_BASE_DEPTH.behind_player;
            layerEntries
                .slice()
                .sort((left, right) => {
                    const leftRenderOrder = resolveTestWorldRenderOrder(left.objectType, left.config);
                    const rightRenderOrder = resolveTestWorldRenderOrder(right.objectType, right.config);
                    if (leftRenderOrder !== rightRenderOrder) {
                        return leftRenderOrder - rightRenderOrder;
                    }

                    const leftId = left.config.id.toLowerCase();
                    const rightId = right.config.id.toLowerCase();
                    if (leftId !== rightId) {
                        return leftId.localeCompare(rightId);
                    }

                    const leftPartOrder = left.partOrder ?? 0;
                    const rightPartOrder = right.partOrder ?? 0;
                    if (leftPartOrder !== rightPartOrder) {
                        return leftPartOrder - rightPartOrder;
                    }

                    return left.partKey.localeCompare(right.partKey);
                })
                .forEach((entry, index) => {
                    entry.gameObject.setDepth(baseDepth + index);
                });
        });
};
