import type { GameObjects } from 'phaser';
import type { TestWorldEditorObjectType } from './test_world_editor_adapters';
import type {
    TestWorldVisualLayer,
    TestWorldVisualOrderConfig
} from './test_world_config';

export const TEST_WORLD_VISUAL_LAYER_OPTIONS: ReadonlyArray<{
    value: 'default' | TestWorldVisualLayer;
    label: string;
}> = [
    { value: 'default', label: 'Default' },
    { value: 'layer_1', label: 'Layer 1' },
    { value: 'layer_2', label: 'Layer 2' },
    { value: 'layer_3', label: 'Layer 3 (Player Base)' },
    { value: 'layer_4', label: 'Layer 4' },
    { value: 'layer_5', label: 'Layer 5' }
] as const;

const VISUAL_LAYER_BASE_DEPTH: Record<TestWorldVisualLayer, number> = {
    layer_1: 3500,
    layer_2: 3950,
    layer_3: 4380,
    layer_4: 4600,
    layer_5: 4800
};

const VISUAL_LAYER_DEPTH_STEP = 0.01;

const DEFAULT_VISUAL_LAYER_BY_TYPE: Record<TestWorldEditorObjectType, TestWorldVisualLayer> = {
    playerSpawn: 'layer_3',
    finish: 'layer_4',
    surface: 'layer_3',
    npc: 'layer_3',
    hazard: 'layer_4',
    checkpoint: 'layer_2',
    movingPlatform: 'layer_3',
    triggerPlatform: 'layer_3',
    triggerVolume: 'layer_2',
    dragBox: 'layer_3',
    windZone: 'layer_2',
    triangleFlightBreakWall: 'layer_3',
    trianglePickup: 'layer_4'
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
    npc: 240,
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

export const applyTestWorldVisualDepthEntries = (
    entries: readonly TestWorldVisualDepthEntry[]
): void => {
    const groupedEntries = new Map<TestWorldVisualLayer, TestWorldVisualDepthEntry[]>();

    entries.forEach((entry) => {
        const layer = resolveTestWorldVisualLayer(entry.objectType, entry.config);
        const bucket = groupedEntries.get(layer);
        if (bucket) {
            bucket.push(entry);
            return;
        }
        groupedEntries.set(layer, [entry]);
    });

    ([
        'layer_1',
        'layer_2',
        'layer_3',
        'layer_4',
        'layer_5'
    ] as const).forEach((layer) => {
            const layerEntries = groupedEntries.get(layer) ?? [];
            const baseDepth = VISUAL_LAYER_BASE_DEPTH[layer];
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
                    entry.gameObject.setDepth(baseDepth + (index * VISUAL_LAYER_DEPTH_STEP));
                });
        });
};
