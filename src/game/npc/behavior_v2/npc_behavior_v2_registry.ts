import type { NpcBehaviorAsset } from './npc_behavior_v2_types';

export interface NpcBehaviorRegistry {
    register(asset: NpcBehaviorAsset): void;
    get(id: string): NpcBehaviorAsset | null;
    has(id: string): boolean;
    list(): readonly NpcBehaviorAsset[];
}

const normalizeAssetId = (id: string): string => id.trim();

const cloneAssetShallow = (asset: NpcBehaviorAsset, idOverride?: string): NpcBehaviorAsset => {
    return {
        ...asset,
        id: idOverride ?? asset.id,
        pages: [...asset.pages],
        eventReactions: [...asset.eventReactions],
        programs: [...asset.programs]
    };
};

const toStoredAsset = (asset: NpcBehaviorAsset, normalizedId: string): NpcBehaviorAsset => {
    const cloned = cloneAssetShallow(asset, normalizedId);
    return Object.freeze(cloned);
};

export const createNpcBehaviorRegistry = (
    initialAssets: readonly NpcBehaviorAsset[] = []
): NpcBehaviorRegistry => {
    const assetsById = new Map<string, NpcBehaviorAsset>();

    const register = (asset: NpcBehaviorAsset): void => {
        const normalizedId = normalizeAssetId(asset.id);
        if (normalizedId.length === 0) {
            throw new Error('invalid_npc_behavior_asset_id: asset id must not be empty');
        }
        if (assetsById.has(normalizedId)) {
            throw new Error(`duplicate_npc_behavior_asset_id: "${normalizedId}"`);
        }
        assetsById.set(normalizedId, toStoredAsset(asset, normalizedId));
    };

    const get = (id: string): NpcBehaviorAsset | null => {
        const normalizedId = normalizeAssetId(id);
        if (normalizedId.length === 0) {
            return null;
        }
        const asset = assetsById.get(normalizedId);
        return asset ? cloneAssetShallow(asset) : null;
    };

    const has = (id: string): boolean => {
        const normalizedId = normalizeAssetId(id);
        if (normalizedId.length === 0) {
            return false;
        }
        return assetsById.has(normalizedId);
    };

    const list = (): readonly NpcBehaviorAsset[] => {
        return [...assetsById.entries()]
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([, asset]) => cloneAssetShallow(asset));
    };

    const registry: NpcBehaviorRegistry = {
        register,
        get,
        has,
        list
    };

    registerNpcBehaviorAssets(registry, initialAssets);

    return registry;
};

export const registerNpcBehaviorAssets = (
    registry: NpcBehaviorRegistry,
    assets: readonly NpcBehaviorAsset[]
): void => {
    assets.forEach((asset) => {
        registry.register(asset);
    });
};
