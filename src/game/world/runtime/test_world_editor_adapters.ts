import type {
    TestWorldCheckpointConfig,
    TestWorldConfig,
    TestWorldDragBoxConfig,
    TestWorldHazardConfig,
    TestWorldMovingPlatformConfig,
    TestWorldPlayerSpawnConfig,
    TestWorldSurfaceConfig,
    TestWorldTriangleFlightBreakWallConfig,
    TestWorldTrianglePickupConfig,
    TestWorldTriggerPlatformConfig,
    TestWorldWindZoneConfig
} from './test_world_config';

export type TestWorldEditorObjectType =
    | 'playerSpawn'
    | 'surface'
    | 'hazard'
    | 'checkpoint'
    | 'movingPlatform'
    | 'triggerPlatform'
    | 'dragBox'
    | 'windZone'
    | 'triangleFlightBreakWall'
    | 'trianglePickup';

export type TestWorldEditorSelectionPart = 'main' | 'trigger' | 'deactivateTrigger' | 'platform';

export interface TestWorldEditorBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TestWorldEditorHandleDefinition<TConfig> {
    id: string;
    rootId: string;
    type: TestWorldEditorObjectType;
    part: TestWorldEditorSelectionPart;
    label: string;
    getBounds: (config: TConfig) => TestWorldEditorBounds;
    setBounds: (config: TConfig, bounds: TestWorldEditorBounds) => void;
    containsPoint: (config: TConfig, worldX: number, worldY: number) => boolean;
}

export interface TestWorldEditorAdapter<TConfig> {
    type: TestWorldEditorObjectType;
    createDefault: (context: { id: string; x: number; y: number }) => TConfig | null;
    duplicate: (config: TConfig, id: string) => TConfig;
    getId: (config: TConfig) => string;
    setId: (config: TConfig, id: string) => void;
    getLocked: (config: TConfig) => boolean;
    setLocked: (config: TConfig, locked: boolean) => void;
    getHandles: (config: TConfig) => TestWorldEditorHandleDefinition<TConfig>[];
    patchFields: (config: TConfig, patch: Record<string, unknown>) => void;
    patchColors: (config: TConfig, patch: Record<string, unknown>) => void;
    serialize: (config: TConfig) => TConfig;
}

const containsRectPoint = (bounds: TestWorldEditorBounds, worldX: number, worldY: number): boolean => {
    return Math.abs(worldX - bounds.x) <= (bounds.width * 0.5)
        && Math.abs(worldY - bounds.y) <= (bounds.height * 0.5);
};

const setRectBounds = (
    target: { x: number; y: number; width: number; height: number },
    bounds: TestWorldEditorBounds
): void => {
    target.x = bounds.x;
    target.y = bounds.y;
    target.width = Math.max(8, bounds.width);
    target.height = Math.max(8, bounds.height);
};

const patchRectFields = (
    target: { x: number; y: number; width: number; height: number },
    patch: Record<string, unknown>
): void => {
    if (typeof patch.x === 'number') {
        target.x = patch.x;
    }
    if (typeof patch.y === 'number') {
        target.y = patch.y;
    }
    if (typeof patch.width === 'number') {
        target.width = Math.max(8, patch.width);
    }
    if (typeof patch.height === 'number') {
        target.height = Math.max(8, patch.height);
    }
};

const createRectHandle = <TConfig>(
    options: {
        id: string;
        rootId: string;
        type: TestWorldEditorObjectType;
        part?: TestWorldEditorSelectionPart;
        label: string;
        getBounds: (config: TConfig) => TestWorldEditorBounds;
        setBounds: (config: TConfig, bounds: TestWorldEditorBounds) => void;
    }
): TestWorldEditorHandleDefinition<TConfig> => {
    return {
        id: options.id,
        rootId: options.rootId,
        type: options.type,
        part: options.part ?? 'main',
        label: options.label,
        getBounds: options.getBounds,
        setBounds: options.setBounds,
        containsPoint: (config, worldX, worldY) => containsRectPoint(options.getBounds(config), worldX, worldY)
    };
};

const createCircleHandle = (
    config: TestWorldTrianglePickupConfig
): TestWorldEditorHandleDefinition<TestWorldTrianglePickupConfig> => {
    return {
        id: config.id,
        rootId: config.id,
        type: 'trianglePickup',
        part: 'main',
        label: config.id,
        getBounds: (entry) => ({
            x: entry.x,
            y: entry.y,
            width: entry.radius * 2,
            height: entry.radius * 2
        }),
        setBounds: (entry, bounds) => {
            entry.x = bounds.x;
            entry.y = bounds.y;
            entry.radius = Math.max(4, Math.round(Math.max(bounds.width, bounds.height) * 0.5));
        },
        containsPoint: (entry, worldX, worldY) => Math.hypot(worldX - entry.x, worldY - entry.y) <= entry.radius
    };
};

const playerSpawnAdapter: TestWorldEditorAdapter<TestWorldPlayerSpawnConfig> = {
    type: 'playerSpawn',
    createDefault: (_context) => {
        return null;
    },
    duplicate: (config) => ({ ...config }),
    getId: () => 'player_spawn',
    setId: () => undefined,
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (_config) => [
        createRectHandle({
            id: 'player_spawn',
            rootId: 'player_spawn',
            type: 'playerSpawn',
            label: 'player_spawn',
            getBounds: (entry) => ({
                x: entry.x,
                y: entry.y,
                width: entry.width,
                height: entry.height
            }),
            setBounds: (entry, bounds) => {
                entry.x = bounds.x;
                entry.y = bounds.y;
                entry.width = Math.max(8, bounds.width);
                entry.height = Math.max(8, bounds.height);
            }
        })
    ],
    patchFields: (config, patch) => {
        patchRectFields(config, patch);
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const surfaceAdapter: TestWorldEditorAdapter<TestWorldSurfaceConfig> = {
    type: 'surface',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 160,
        height: 24,
        fillColor: 0xb0bec5,
        strokeColor: 0xeceff1
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'surface',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => setRectBounds(entry, bounds)
        })
    ],
    patchFields: (config, patch) => {
        if (typeof patch.x === 'number') {
            config.x = patch.x;
        }
        if (typeof patch.y === 'number') {
            config.y = patch.y;
        }
        if (typeof patch.width === 'number') {
            config.width = Math.max(8, patch.width);
        }
        if (typeof patch.height === 'number') {
            config.height = Math.max(8, patch.height);
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const hazardAdapter: TestWorldEditorAdapter<TestWorldHazardConfig> = {
    type: 'hazard',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 140,
        height: 20,
        fillColor: 0xef5350,
        strokeColor: 0xb71c1c
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'hazard',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => setRectBounds(entry, bounds)
        })
    ],
    patchFields: (config, patch) => {
        patchRectFields(config, patch);
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const checkpointAdapter: TestWorldEditorAdapter<TestWorldCheckpointConfig> = {
    type: 'checkpoint',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 68,
        height: 88,
        respawnX: x,
        respawnY: y - 56,
        fillColor: 0x90caf9,
        strokeColor: 0x64b5f6
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'checkpoint',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => {
                const dx = bounds.x - entry.x;
                const dy = bounds.y - entry.y;
                setRectBounds(entry, bounds);
                entry.respawnX += dx;
                entry.respawnY += dy;
            }
        })
    ],
    patchFields: (config, patch) => {
        if (typeof patch.x === 'number') {
            config.respawnX += patch.x - config.x;
            config.x = patch.x;
        }
        if (typeof patch.y === 'number') {
            config.respawnY += patch.y - config.y;
            config.y = patch.y;
        }
        if (typeof patch.width === 'number') {
            config.width = Math.max(8, patch.width);
        }
        if (typeof patch.height === 'number') {
            config.height = Math.max(8, patch.height);
        }
        if (typeof patch.respawnX === 'number') {
            config.respawnX = patch.respawnX;
        }
        if (typeof patch.respawnY === 'number') {
            config.respawnY = patch.respawnY;
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const movingPlatformAdapter: TestWorldEditorAdapter<TestWorldMovingPlatformConfig> = {
    type: 'movingPlatform',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 180,
        height: 20,
        axis: 'horizontal',
        travelDistance: 200,
        speed: 120,
        fillColor: 0xffcc80,
        strokeColor: 0xef6c00
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'movingPlatform',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => setRectBounds(entry, bounds)
        })
    ],
    patchFields: (config, patch) => {
        patchRectFields(config, patch);
        if (patch.axis === 'vertical' || patch.axis === 'horizontal') {
            config.axis = patch.axis;
        }
        if (typeof patch.travelDistance === 'number') {
            config.travelDistance = Math.max(0, patch.travelDistance);
        }
        if (typeof patch.speed === 'number') {
            config.speed = Math.max(0, patch.speed);
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const triggerPlatformAdapter: TestWorldEditorAdapter<TestWorldTriggerPlatformConfig> = {
    type: 'triggerPlatform',
    createDefault: ({ id, x, y }) => ({
        id,
        triggerX: x - 120,
        triggerY: y + 80,
        triggerWidth: 110,
        triggerHeight: 84,
        deactivateTriggerX: x + 120,
        deactivateTriggerY: y + 80,
        deactivateTriggerWidth: 110,
        deactivateTriggerHeight: 84,
        platformX: x,
        platformY: y,
        platformWidth: 180,
        platformHeight: 22,
        activator: 'player',
        triggerAction: 'activate',
        deactivateTriggerAction: 'deactivate',
        initiallyActive: false,
        triggerFillColor: 0xfff59d,
        triggerStrokeColor: 0xf9a825,
        deactivateTriggerFillColor: 0xffccbc,
        deactivateTriggerStrokeColor: 0xe64a19,
        platformFillColor: 0x616161,
        platformStrokeColor: 0xb0bec5
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => {
        const handles: TestWorldEditorHandleDefinition<TestWorldTriggerPlatformConfig>[] = [
            createRectHandle({
                id: `${config.id}:trigger`,
                rootId: config.id,
                type: 'triggerPlatform',
                part: 'trigger',
                label: `${config.id}:trigger`,
                getBounds: (entry) => ({
                    x: entry.triggerX,
                    y: entry.triggerY,
                    width: entry.triggerWidth,
                    height: entry.triggerHeight
                }),
                setBounds: (entry, bounds) => {
                    entry.triggerX = bounds.x;
                    entry.triggerY = bounds.y;
                    entry.triggerWidth = Math.max(8, bounds.width);
                    entry.triggerHeight = Math.max(8, bounds.height);
                }
            }),
            createRectHandle({
                id: `${config.id}:platform`,
                rootId: config.id,
                type: 'triggerPlatform',
                part: 'platform',
                label: `${config.id}:platform`,
                getBounds: (entry) => ({
                    x: entry.platformX,
                    y: entry.platformY,
                    width: entry.platformWidth,
                    height: entry.platformHeight
                }),
                setBounds: (entry, bounds) => {
                    entry.platformX = bounds.x;
                    entry.platformY = bounds.y;
                    entry.platformWidth = Math.max(8, bounds.width);
                    entry.platformHeight = Math.max(8, bounds.height);
                }
            })
        ];

        if (
            typeof config.deactivateTriggerX === 'number'
            && typeof config.deactivateTriggerY === 'number'
            && typeof config.deactivateTriggerWidth === 'number'
            && typeof config.deactivateTriggerHeight === 'number'
        ) {
            handles.push(createRectHandle({
                id: `${config.id}:deactivate`,
                rootId: config.id,
                type: 'triggerPlatform',
                part: 'deactivateTrigger',
                label: `${config.id}:deactivate`,
                getBounds: (entry) => ({
                    x: entry.deactivateTriggerX ?? entry.triggerX,
                    y: entry.deactivateTriggerY ?? entry.triggerY,
                    width: entry.deactivateTriggerWidth ?? entry.triggerWidth,
                    height: entry.deactivateTriggerHeight ?? entry.triggerHeight
                }),
                setBounds: (entry, bounds) => {
                    entry.deactivateTriggerX = bounds.x;
                    entry.deactivateTriggerY = bounds.y;
                    entry.deactivateTriggerWidth = Math.max(8, bounds.width);
                    entry.deactivateTriggerHeight = Math.max(8, bounds.height);
                }
            }));
        }

        return handles;
    },
    patchFields: (config, patch) => {
        if (typeof patch.triggerX === 'number') {
            config.triggerX = patch.triggerX;
        }
        if (typeof patch.triggerY === 'number') {
            config.triggerY = patch.triggerY;
        }
        if (typeof patch.triggerWidth === 'number') {
            config.triggerWidth = Math.max(8, patch.triggerWidth);
        }
        if (typeof patch.triggerHeight === 'number') {
            config.triggerHeight = Math.max(8, patch.triggerHeight);
        }
        if (typeof patch.platformX === 'number') {
            config.platformX = patch.platformX;
        }
        if (typeof patch.platformY === 'number') {
            config.platformY = patch.platformY;
        }
        if (typeof patch.platformWidth === 'number') {
            config.platformWidth = Math.max(8, patch.platformWidth);
        }
        if (typeof patch.platformHeight === 'number') {
            config.platformHeight = Math.max(8, patch.platformHeight);
        }
        if (patch.activator === 'player' || patch.activator === 'drag_box') {
            config.activator = patch.activator;
        }
        if (patch.triggerAction === 'activate' || patch.triggerAction === 'deactivate') {
            config.triggerAction = patch.triggerAction;
        }
        if (patch.deactivateTriggerAction === 'activate' || patch.deactivateTriggerAction === 'deactivate') {
            config.deactivateTriggerAction = patch.deactivateTriggerAction;
        }
        if (typeof patch.initiallyActive === 'boolean') {
            config.initiallyActive = patch.initiallyActive;
        }
        if (typeof patch.deactivateTriggerX === 'number') {
            config.deactivateTriggerX = patch.deactivateTriggerX;
        }
        if (typeof patch.deactivateTriggerY === 'number') {
            config.deactivateTriggerY = patch.deactivateTriggerY;
        }
        if (typeof patch.deactivateTriggerWidth === 'number') {
            config.deactivateTriggerWidth = Math.max(8, patch.deactivateTriggerWidth);
        }
        if (typeof patch.deactivateTriggerHeight === 'number') {
            config.deactivateTriggerHeight = Math.max(8, patch.deactivateTriggerHeight);
        }
        if (patch.hasDeactivateTrigger === false) {
            config.deactivateTriggerX = undefined;
            config.deactivateTriggerY = undefined;
            config.deactivateTriggerWidth = undefined;
            config.deactivateTriggerHeight = undefined;
        }
        if (
            patch.hasDeactivateTrigger === true
            && typeof config.deactivateTriggerX !== 'number'
            && typeof config.deactivateTriggerY !== 'number'
        ) {
            config.deactivateTriggerX = config.triggerX + 120;
            config.deactivateTriggerY = config.triggerY;
            config.deactivateTriggerWidth = config.triggerWidth;
            config.deactivateTriggerHeight = config.triggerHeight;
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.triggerFillColor === 'number') {
            config.triggerFillColor = patch.triggerFillColor;
        }
        if (typeof patch.triggerStrokeColor === 'number') {
            config.triggerStrokeColor = patch.triggerStrokeColor;
        }
        if (typeof patch.deactivateTriggerFillColor === 'number') {
            config.deactivateTriggerFillColor = patch.deactivateTriggerFillColor;
        }
        if (typeof patch.deactivateTriggerStrokeColor === 'number') {
            config.deactivateTriggerStrokeColor = patch.deactivateTriggerStrokeColor;
        }
        if (typeof patch.platformFillColor === 'number') {
            config.platformFillColor = patch.platformFillColor;
        }
        if (typeof patch.platformStrokeColor === 'number') {
            config.platformStrokeColor = patch.platformStrokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const dragBoxAdapter: TestWorldEditorAdapter<TestWorldDragBoxConfig> = {
    type: 'dragBox',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 44,
        height: 44,
        gravityY: 2200,
        mass: 10,
        pullAcceleration: 1400,
        pullMaxSpeed: 150,
        dragX: 900,
        fillColor: 0xfff59d,
        strokeColor: 0xf9a825
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'dragBox',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => setRectBounds(entry, bounds)
        })
    ],
    patchFields: (config, patch) => {
        patchRectFields(config, patch);
        if (typeof patch.targetTriggerPlatformId === 'string' || patch.targetTriggerPlatformId === '') {
            config.targetTriggerPlatformId = patch.targetTriggerPlatformId || undefined;
        }
        if (typeof patch.gravityY === 'number') {
            config.gravityY = Math.max(0, patch.gravityY);
        }
        if (typeof patch.mass === 'number') {
            config.mass = Math.max(1, patch.mass);
        }
        if (typeof patch.pullAcceleration === 'number') {
            config.pullAcceleration = Math.max(0, patch.pullAcceleration);
        }
        if (typeof patch.pullMaxSpeed === 'number') {
            config.pullMaxSpeed = Math.max(0, patch.pullMaxSpeed);
        }
        if (typeof patch.dragX === 'number') {
            config.dragX = Math.max(0, patch.dragX);
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const windZoneAdapter: TestWorldEditorAdapter<TestWorldWindZoneConfig> = {
    type: 'windZone',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 260,
        height: 170,
        directionX: 1,
        force: 160,
        fillColor: 0x80deea,
        strokeColor: 0x00838f
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'windZone',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => setRectBounds(entry, bounds)
        })
    ],
    patchFields: (config, patch) => {
        patchRectFields(config, patch);
        if (patch.directionX === -1 || patch.directionX === 1) {
            config.directionX = patch.directionX;
        }
        if (typeof patch.force === 'number') {
            config.force = Math.max(0, patch.force);
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const breakWallAdapter: TestWorldEditorAdapter<TestWorldTriangleFlightBreakWallConfig> = {
    type: 'triangleFlightBreakWall',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        width: 40,
        height: 184,
        fillColor: 0xa1887f,
        strokeColor: 0x4e342e
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [
        createRectHandle({
            id: config.id,
            rootId: config.id,
            type: 'triangleFlightBreakWall',
            label: config.id,
            getBounds: (entry) => ({ x: entry.x, y: entry.y, width: entry.width, height: entry.height }),
            setBounds: (entry, bounds) => setRectBounds(entry, bounds)
        })
    ],
    patchFields: (config, patch) => {
        patchRectFields(config, patch);
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

const pickupAdapter: TestWorldEditorAdapter<TestWorldTrianglePickupConfig> = {
    type: 'trianglePickup',
    createDefault: ({ id, x, y }) => ({
        id,
        x,
        y,
        radius: 10,
        fillColor: 0xfff59d,
        strokeColor: 0xffca28
    }),
    duplicate: (config, id) => ({ ...config, id }),
    getId: (config) => config.id,
    setId: (config, id) => {
        config.id = id;
    },
    getLocked: (config) => config.editorLocked ?? false,
    setLocked: (config, locked) => {
        config.editorLocked = locked;
    },
    getHandles: (config) => [createCircleHandle(config)],
    patchFields: (config, patch) => {
        if (typeof patch.x === 'number') {
            config.x = patch.x;
        }
        if (typeof patch.y === 'number') {
            config.y = patch.y;
        }
        if (typeof patch.radius === 'number') {
            config.radius = Math.max(4, patch.radius);
        }
    },
    patchColors: (config, patch) => {
        if (typeof patch.fillColor === 'number') {
            config.fillColor = patch.fillColor;
        }
        if (typeof patch.strokeColor === 'number') {
            config.strokeColor = patch.strokeColor;
        }
    },
    serialize: (config) => ({ ...config })
};

export const TEST_WORLD_EDITOR_ADAPTERS = {
    playerSpawn: playerSpawnAdapter,
    surface: surfaceAdapter,
    hazard: hazardAdapter,
    checkpoint: checkpointAdapter,
    movingPlatform: movingPlatformAdapter,
    triggerPlatform: triggerPlatformAdapter,
    dragBox: dragBoxAdapter,
    windZone: windZoneAdapter,
    triangleFlightBreakWall: breakWallAdapter,
    trianglePickup: pickupAdapter
} as const;

export const TEST_WORLD_EDITOR_PALETTE: ReadonlyArray<{
    type: TestWorldEditorObjectType;
    label: string;
}> = [
    { type: 'playerSpawn', label: 'Player Spawn' },
    { type: 'surface', label: 'Surface' },
    { type: 'hazard', label: 'Hazard' },
    { type: 'checkpoint', label: 'Checkpoint' },
    { type: 'movingPlatform', label: 'Moving Platform' },
    { type: 'triggerPlatform', label: 'Trigger Platform' },
    { type: 'dragBox', label: 'Drag Box' },
    { type: 'windZone', label: 'Wind Zone' },
    { type: 'triangleFlightBreakWall', label: 'Break Wall' },
    { type: 'trianglePickup', label: 'Triangle Pickup' }
];

export const getAllWorldObjectIds = (config: TestWorldConfig): string[] => {
    return [
        ...config.surfaces,
        ...config.hazards,
        ...config.checkpoints,
        ...config.movingPlatforms,
        ...config.triggerPlatforms,
        ...config.dragBoxes,
        ...config.windZones,
        ...config.triangleFlightBreakWalls,
        ...config.trianglePickups
    ].map((entry) => entry.id);
};

export const createNextWorldObjectId = (type: TestWorldEditorObjectType, config: TestWorldConfig): string => {
    if (type === 'playerSpawn') {
        return 'player_spawn';
    }

    const allIds = new Set(getAllWorldObjectIds(config));
    const prefix = type.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    let nextIndex = 1;
    let candidate = `${prefix}_${nextIndex}`;
    while (allIds.has(candidate)) {
        nextIndex += 1;
        candidate = `${prefix}_${nextIndex}`;
    }
    return candidate;
};
