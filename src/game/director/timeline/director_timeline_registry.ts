import type { CutsceneAsset } from './director_timeline_types';

export interface DirectorTimelineRegistry {
    register(asset: CutsceneAsset): void;
    get(id: string): CutsceneAsset | null;
    has(id: string): boolean;
    list(): readonly CutsceneAsset[];
}

const normalizeAssetId = (id: string): string => id.trim();

const cloneAsset = (asset: CutsceneAsset): CutsceneAsset => {
    return {
        ...asset,
        settings: { ...asset.settings },
        tracks: asset.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) => ({
                ...clip,
                ...(clip.params !== undefined ? { params: { ...clip.params } } : {})
            }))
        }))
    };
};

export const createDirectorTimelineRegistry = (
    initialAssets: readonly CutsceneAsset[] = []
): DirectorTimelineRegistry => {
    const assetsById = new Map<string, CutsceneAsset>();

    const register = (asset: CutsceneAsset): void => {
        const normalizedId = normalizeAssetId(asset.id);
        if (normalizedId.length === 0) {
            throw new Error('invalid_cutscene_asset_id: cutscene asset id must not be empty');
        }
        if (assetsById.has(normalizedId)) {
            throw new Error(`duplicate_cutscene_asset_id: cutscene asset "${normalizedId}" is already registered`);
        }

        assetsById.set(normalizedId, cloneAsset(asset));
    };

    const get = (id: string): CutsceneAsset | null => {
        const normalizedId = normalizeAssetId(id);
        if (normalizedId.length === 0) {
            return null;
        }
        const asset = assetsById.get(normalizedId);
        return asset !== undefined ? cloneAsset(asset) : null;
    };

    const has = (id: string): boolean => {
        const normalizedId = normalizeAssetId(id);
        if (normalizedId.length === 0) {
            return false;
        }
        return assetsById.has(normalizedId);
    };

    const list = (): readonly CutsceneAsset[] => {
        return [...assetsById.entries()]
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([, asset]) => cloneAsset(asset));
    };

    const registry: DirectorTimelineRegistry = {
        register,
        get,
        has,
        list
    };

    registerDirectorTimelineAssets(registry, initialAssets);

    return registry;
};

export const registerDirectorTimelineAssets = (
    registry: DirectorTimelineRegistry,
    assets: readonly CutsceneAsset[]
): void => {
    assets.forEach((asset) => {
        registry.register(asset);
    });
};
