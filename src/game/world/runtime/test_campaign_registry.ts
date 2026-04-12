import campaignJson from './data/campaign.json';
import level01Json from './data/levels/test_world_level_01.json';
import level02Json from './data/levels/test_world_level_02.json';
import {
    cloneTestWorldConfig,
    type TestWorldConfig
} from './test_world_config';
import { createMinimalTestWorldConfig, normalizeTestWorldConfig } from './test_world_config_validation';
import {
    clearTestWorldEditorDraft,
    readSavedTestWorldEditorDraft,
    saveTestWorldEditorDraft
} from './test_world_editor_storage';

interface TestCampaignLevelReference {
    id: string;
}

export interface TestCampaignLevelSummary {
    id: string;
    displayName: string;
}

interface TestCampaignConfig {
    initialLevelId: string;
    levels: TestCampaignLevelReference[];
}

const CAMPAIGN_EDITOR_STORAGE_KEY = 'the-form:test-world:campaign-registry:v1';

const rawLevelConfigs: readonly unknown[] = [
    level01Json,
    level02Json
];

const parseCampaignConfig = (raw: unknown): TestCampaignConfig => {
    const root = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : null;
    const levelEntries = Array.isArray(root?.levels) ? root.levels : [];
    const levels = levelEntries
        .map((entry) => (typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : null))
        .map((entry) => ({
            id: typeof entry?.id === 'string' ? entry.id.trim() : ''
        }));

    const initialLevelId = typeof root?.initialLevelId === 'string' ? root.initialLevelId.trim() : '';
    if (!initialLevelId) {
        throw new Error('Campaign initialLevelId is required.');
    }
    if (levels.length === 0) {
        throw new Error('Campaign must contain at least one level.');
    }
    if (levels.some((entry) => entry.id.length === 0)) {
        throw new Error('Campaign level references must use non-empty ids.');
    }
    if (new Set(levels.map((entry) => entry.id)).size !== levels.length) {
        throw new Error('Campaign level ids must be unique.');
    }

    return {
        initialLevelId,
        levels
    };
};

const buildLevelRegistry = (rawLevels: readonly unknown[]): Map<string, TestWorldConfig> => {
    const registry = new Map<string, TestWorldConfig>();

    rawLevels.forEach((rawLevel, index) => {
        const normalized = normalizeTestWorldConfig(rawLevel);
        const levelId = normalized.meta.id.trim();
        if (!levelId) {
            throw new Error(`Level at index ${index} is missing meta.id.`);
        }
        if (registry.has(levelId)) {
            throw new Error(`Duplicate level id '${levelId}' detected.`);
        }
        if (!normalized.finish || normalized.finish.id.trim().length === 0) {
            throw new Error(`Level '${levelId}' is missing finish.`);
        }
        if (normalized.worldBounds.width <= 0 || normalized.worldBounds.height <= 0) {
            throw new Error(`Level '${levelId}' has invalid worldBounds.`);
        }
        registry.set(levelId, normalized);
    });

    registry.forEach((config, levelId) => {
        if (config.nextLevelId !== null && !registry.has(config.nextLevelId)) {
            throw new Error(`Level '${levelId}' references missing nextLevelId '${config.nextLevelId}'.`);
        }
    });

    return registry;
};

const campaignConfig = parseCampaignConfig(campaignJson);
const levelRegistry = buildLevelRegistry(rawLevelConfigs);
const campaignLevelOrder = [...campaignConfig.levels.map((entry) => entry.id)];

const canUseStorage = (): boolean => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const restoreEditorCampaignRegistry = (): void => {
    if (!canUseStorage()) {
        return;
    }

    const raw = window.localStorage.getItem(CAMPAIGN_EDITOR_STORAGE_KEY);
    if (!raw) {
        return;
    }

    try {
        const parsed = JSON.parse(raw) as { levelOrder?: unknown; levels?: unknown };
        const persistedLevels = Array.isArray(parsed.levels) ? parsed.levels : [];
        const persistedOrder = Array.isArray(parsed.levelOrder)
            ? parsed.levelOrder.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
            : [];
        const bundledIds = new Set(campaignConfig.levels.map((entry) => entry.id));
        const usesFullSnapshot = persistedOrder.some((levelId) => bundledIds.has(levelId))
            || persistedLevels.some((entry) => {
                const levelId = typeof entry === 'object' && entry !== null && typeof (entry as { meta?: { id?: unknown } }).meta?.id === 'string'
                    ? (entry as { meta: { id: string } }).meta.id
                    : '';
                return bundledIds.has(levelId);
            });

        const nextRegistry = buildLevelRegistry(usesFullSnapshot
            ? persistedLevels
            : [
                ...rawLevelConfigs,
                ...persistedLevels
            ]);
        const knownIds = new Set(nextRegistry.keys());
        const nextOrder = usesFullSnapshot
            ? persistedOrder.filter((levelId) => knownIds.has(levelId))
            : [
                ...campaignConfig.levels.map((entry) => entry.id),
                ...persistedOrder.filter((levelId) => !campaignConfig.levels.some((entry) => entry.id === levelId) && knownIds.has(levelId))
            ];

        if (nextOrder.length === 0) {
            return;
        }

        levelRegistry.clear();
        nextOrder.forEach((levelId) => {
            const config = nextRegistry.get(levelId);
            if (config) {
                levelRegistry.set(levelId, config);
            }
        });
        campaignLevelOrder.splice(0, campaignLevelOrder.length, ...nextOrder.filter((levelId) => levelRegistry.has(levelId)));
    } catch {
        // Ignore malformed editor-only campaign registry data.
    }
};

campaignConfig.levels.forEach((entry) => {
    if (!levelRegistry.has(entry.id)) {
        throw new Error(`Campaign references missing level '${entry.id}'.`);
    }
});

if (!levelRegistry.has(campaignConfig.initialLevelId)) {
    throw new Error(`Campaign initialLevelId '${campaignConfig.initialLevelId}' is missing.`);
}

restoreEditorCampaignRegistry();

export const getInitialCampaignLevelId = (): string => {
    if (campaignLevelOrder.includes(campaignConfig.initialLevelId)) {
        return campaignConfig.initialLevelId;
    }

    const fallbackLevelId = campaignLevelOrder[0];
    if (!fallbackLevelId) {
        throw new Error('Campaign has no remaining levels.');
    }

    return fallbackLevelId;
};

export const getCampaignLevelConfig = (levelId: string): TestWorldConfig => {
    const config = levelRegistry.get(levelId);
    if (!config) {
        throw new Error(`Unknown campaign level '${levelId}'.`);
    }

    return cloneTestWorldConfig(config);
};

export const getCampaignLevelIds = (): string[] => {
    return [...campaignLevelOrder];
};

export const getCampaignLevelSummaries = (): TestCampaignLevelSummary[] => {
    return campaignLevelOrder.map((levelId) => {
        const config = levelRegistry.get(levelId);
        if (!config) {
            throw new Error(`Campaign references missing level '${levelId}'.`);
        }

        return {
            id: levelId,
            displayName: config.meta.displayName
        };
    });
};

export const getAdjacentCampaignLevelId = (
    levelId: string,
    direction: -1 | 1
): string | null => {
    const currentIndex = campaignLevelOrder.indexOf(levelId);
    if (currentIndex < 0) {
        return null;
    }

    return campaignLevelOrder[currentIndex + direction] ?? null;
};

const persistEditorCampaignRegistry = (): void => {
    if (!canUseStorage()) {
        return;
    }
    const payload = JSON.stringify({
        levelOrder: [...campaignLevelOrder],
        levels: campaignLevelOrder.map((levelId) => {
            const config = levelRegistry.get(levelId);
            return config ? cloneTestWorldConfig(config) : null;
        }).filter((entry) => entry !== null)
    });
    window.localStorage.setItem(CAMPAIGN_EDITOR_STORAGE_KEY, payload);
};

export const createCampaignLevel = (): TestWorldConfig => {
    const existingIds = new Set(getCampaignLevelIds());
    let nextIndex = getCampaignLevelIds()
        .map((candidateId) => /^test-world-(\d+)$/.exec(candidateId)?.[1] ?? null)
        .map((numericPart) => (numericPart ? Number.parseInt(numericPart, 10) : Number.NaN))
        .filter((value) => Number.isFinite(value))
        .reduce((maxValue, value) => Math.max(maxValue, value), 0) + 1;
    let levelId = `test-world-${String(nextIndex).padStart(2, '0')}`;
    while (existingIds.has(levelId)) {
        nextIndex += 1;
        levelId = `test-world-${String(nextIndex).padStart(2, '0')}`;
    }

    const config = createMinimalTestWorldConfig(levelId, `Test World ${String(nextIndex).padStart(2, '0')}`);
    levelRegistry.set(levelId, cloneTestWorldConfig(config));
    campaignLevelOrder.push(levelId);
    persistEditorCampaignRegistry();
    return cloneTestWorldConfig(config);
};

export const syncCampaignLevelHeader = (config: TestWorldConfig): void => {
    const existing = levelRegistry.get(config.meta.id);
    if (!existing) {
        return;
    }

    existing.meta.displayName = config.meta.displayName;
    existing.nextLevelId = config.nextLevelId;
    persistEditorCampaignRegistry();
};

export interface DeleteCampaignLevelResult {
    switchedToLevelId: string;
    clearedNextLevelRefs: string[];
}

export const deleteCampaignLevel = (levelId: string): DeleteCampaignLevelResult | null => {
    if (!campaignLevelOrder.includes(levelId)) {
        return null;
    }
    if (campaignLevelOrder.length <= 1) {
        return null;
    }

    const removedIndex = campaignLevelOrder.indexOf(levelId);
    const nextOrder = campaignLevelOrder.filter((entry) => entry !== levelId);
    const switchedToLevelId = nextOrder[Math.min(removedIndex, nextOrder.length - 1)] ?? nextOrder[0];
    if (!switchedToLevelId) {
        return null;
    }

    const clearedNextLevelRefs: string[] = [];
    nextOrder.forEach((otherLevelId) => {
        const config = levelRegistry.get(otherLevelId);
        if (config && config.nextLevelId === levelId) {
            config.nextLevelId = null;
            clearedNextLevelRefs.push(otherLevelId);
        }

        const fallbackConfig = config ? cloneTestWorldConfig(config) : createMinimalTestWorldConfig(otherLevelId, otherLevelId);
        const draftConfig = readSavedTestWorldEditorDraft(otherLevelId, fallbackConfig);
        if (draftConfig && draftConfig.nextLevelId === levelId) {
            draftConfig.nextLevelId = null;
            saveTestWorldEditorDraft(otherLevelId, draftConfig);
        }
    });

    levelRegistry.delete(levelId);
    campaignLevelOrder.splice(0, campaignLevelOrder.length, ...nextOrder);
    clearTestWorldEditorDraft(levelId);
    persistEditorCampaignRegistry();

    return {
        switchedToLevelId,
        clearedNextLevelRefs
    };
};
