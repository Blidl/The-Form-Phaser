import type { EditorObjectCategory, EditorObjectCollisionType } from './EditorObjectData';

export interface ObjectTypeDefinition {
    id: string;
    label: string;
    category: EditorObjectCategory;
    defaultCollision: EditorObjectCollisionType;
    runtimeType?: string;
    aliases?: readonly string[];
}

export const DEFAULT_OBJECT_TYPE_DEFINITIONS: readonly ObjectTypeDefinition[] = [
    {
        id: 'platform_default',
        label: 'Platform Default',
        category: 'platforms',
        defaultCollision: 'solid',
        runtimeType: 'surface',
        aliases: ['platform', 'surface']
    },
    {
        id: 'moving_platform',
        label: 'Moving Platform',
        category: 'platforms',
        defaultCollision: 'solid',
        runtimeType: 'movingPlatform',
        aliases: ['movingPlatform', 'moving_platform']
    },
    {
        id: 'trigger_platform',
        label: 'Trigger Platform',
        category: 'platforms',
        defaultCollision: 'solid',
        runtimeType: 'triggerPlatform',
        aliases: ['triggerPlatform', 'trigger_platform']
    },
    {
        id: 'checkpoint',
        label: 'Checkpoint',
        category: 'special',
        defaultCollision: 'visual_only',
        runtimeType: 'checkpoint'
    },
    {
        id: 'player_spawn',
        label: 'Player Spawn',
        category: 'special',
        defaultCollision: 'visual_only',
        runtimeType: 'playerSpawn',
        aliases: ['playerSpawn']
    },
    {
        id: 'finish',
        label: 'Finish',
        category: 'special',
        defaultCollision: 'visual_only',
        runtimeType: 'finish'
    },
    {
        id: 'wind_zone',
        label: 'Wind Zone',
        category: 'special',
        defaultCollision: 'visual_only',
        runtimeType: 'windZone',
        aliases: ['windZone']
    },
    {
        id: 'trigger_volume',
        label: 'Trigger Volume',
        category: 'special',
        defaultCollision: 'visual_only',
        runtimeType: 'triggerVolume',
        aliases: ['triggerVolume']
    },
    {
        id: 'hazard',
        label: 'Hazard',
        category: 'objects',
        defaultCollision: 'visual_only',
        runtimeType: 'hazard'
    },
    {
        id: 'triangle_pickup',
        label: 'Triangle Pickup',
        category: 'objects',
        defaultCollision: 'visual_only',
        runtimeType: 'trianglePickup',
        aliases: ['trianglePickup']
    },
    {
        id: 'drag_box',
        label: 'Drag Box',
        category: 'objects',
        defaultCollision: 'solid',
        runtimeType: 'dragBox',
        aliases: ['dragBox']
    },
    {
        id: 'break_wall',
        label: 'Break Wall',
        category: 'objects',
        defaultCollision: 'solid',
        runtimeType: 'triangleFlightBreakWall',
        aliases: ['triangleFlightBreakWall']
    }
];

export class ObjectTypeRegistry {
    private readonly definitionsById: Map<string, ObjectTypeDefinition>;
    private readonly aliases: Map<string, string>;

    public constructor(definitions: readonly ObjectTypeDefinition[]) {
        this.definitionsById = new Map<string, ObjectTypeDefinition>();
        this.aliases = new Map<string, string>();

        definitions.forEach((definition) => {
            this.definitionsById.set(definition.id, {
                ...definition,
                aliases: definition.aliases ? [...definition.aliases] : undefined
            });
            this.aliases.set(this.normalizeTypeKey(definition.id), definition.id);
            definition.aliases?.forEach((alias) => {
                this.aliases.set(this.normalizeTypeKey(alias), definition.id);
            });
        });
    }

    public listAll(): ObjectTypeDefinition[] {
        return [...this.definitionsById.values()].map((definition) => ({
            ...definition,
            aliases: definition.aliases ? [...definition.aliases] : undefined
        }));
    }

    public listByCategory(category: EditorObjectCategory): ObjectTypeDefinition[] {
        return this.listAll().filter((definition) => definition.category === category);
    }

    public getDefinition(typeId: string): ObjectTypeDefinition | undefined {
        const resolvedId = this.resolveId(typeId);
        if (!resolvedId) {
            return undefined;
        }
        const definition = this.definitionsById.get(resolvedId);
        return definition ? { ...definition } : undefined;
    }

    public has(typeId: string): boolean {
        return this.resolveId(typeId) !== undefined;
    }

    public resolveId(typeId: string): string | undefined {
        const key = this.normalizeTypeKey(typeId);
        if (!key) {
            return undefined;
        }
        return this.aliases.get(key);
    }

    private normalizeTypeKey(typeId: string): string {
        return typeId.trim().toLowerCase();
    }
}

export const createDefaultObjectTypeRegistry = (): ObjectTypeRegistry => {
    return new ObjectTypeRegistry(DEFAULT_OBJECT_TYPE_DEFINITIONS);
};
