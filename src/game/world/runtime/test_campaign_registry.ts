import campaignJson from './data/campaign.json';
import level01Json from './data/levels/test_world_level_01.json';
import level02Json from './data/levels/test_world_level_02.json';
import level03Json from './data/levels/test_world_level_03.json';
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

export type CampaignManifestDiagnosticSeverity = 'warning' | 'error';

export interface CampaignManifestDiagnostic {
    code: string;
    severity: CampaignManifestDiagnosticSeverity;
    message: string;
}

export type CampaignLevelConfigSource =
    | 'bundled'
    | 'campaign_registry_override'
    | 'campaign_registry_custom';

interface TestCampaignConfig {
    initialLevelId: string;
    levels: TestCampaignLevelReference[];
}

interface RawLevelConfigEntry {
    sourceId: string;
    raw: unknown;
}

const CAMPAIGN_EDITOR_STORAGE_KEY = 'the-form:test-world:campaign-registry:v1';

const rawLevelConfigs: readonly RawLevelConfigEntry[] = [
    {
        sourceId: 'test-world-01',
        raw: level01Json
    },
    {
        sourceId: 'test-world-02',
        raw: level02Json
    },
    {
        sourceId: 'test-world-03',
        raw: level03Json
    }
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

const buildLevelRegistry = (
    rawLevels: readonly RawLevelConfigEntry[],
    diagnostics: CampaignManifestDiagnostic[] = []
): Map<string, TestWorldConfig> => {
    const registry = new Map<string, TestWorldConfig>();

    rawLevels.forEach((entry, index) => {
        const normalized = normalizeTestWorldConfig(entry.raw);
        const levelId = normalized.meta.id.trim();
        if (!levelId) {
            throw new Error(`Level at index ${index} is missing meta.id.`);
        }
        if (entry.sourceId.trim() !== levelId) {
            diagnostics.push({
                code: 'bundled_level_meta_id_mismatch',
                severity: 'warning',
                message: `Bundled level source '${entry.sourceId}' has meta.id '${levelId}'.`
            });
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
const initialCampaignManifestDiagnostics: CampaignManifestDiagnostic[] = [];
const bundledLevelRegistry = buildLevelRegistry(rawLevelConfigs, initialCampaignManifestDiagnostics);
const levelRegistry = new Map<string, TestWorldConfig>(bundledLevelRegistry);
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

        const persistedLevelEntries: RawLevelConfigEntry[] = persistedLevels.map((level, index) => ({
            sourceId: `persisted_level_${index}`,
            raw: level
        }));
        const nextRegistry = buildLevelRegistry(
            usesFullSnapshot
                ? persistedLevelEntries
                : [
                    ...rawLevelConfigs,
                    ...persistedLevelEntries
                ]
        );
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

const collectCampaignManifestDiagnostics = (): CampaignManifestDiagnostic[] => {
    const diagnostics: CampaignManifestDiagnostic[] = [...initialCampaignManifestDiagnostics];
    const levelIds = [...campaignLevelOrder];
    const levelIdSet = new Set(levelIds);

    const initialLevelId = campaignConfig.initialLevelId.trim();
    if (!initialLevelId) {
        diagnostics.push({
            code: 'initial_level_missing',
            severity: 'error',
            message: 'Campaign initialLevelId is missing or empty.'
        });
    } else {
        if (!levelIdSet.has(initialLevelId)) {
            diagnostics.push({
                code: 'initial_level_not_listed',
                severity: 'error',
                message: `Campaign initialLevelId '${initialLevelId}' is not listed in campaign levels.`
            });
        }
        if (!levelRegistry.has(initialLevelId)) {
            diagnostics.push({
                code: 'initial_level_not_loadable',
                severity: 'error',
                message: `Campaign initialLevelId '${initialLevelId}' is not loadable.`
            });
        }
    }

    const duplicateIds = new Set<string>();
    levelIds.forEach((levelId, index) => {
        if (levelIds.indexOf(levelId) !== index) {
            duplicateIds.add(levelId);
        }
        if (!levelRegistry.has(levelId)) {
            diagnostics.push({
                code: 'campaign_level_not_loadable',
                severity: 'error',
                message: `Campaign level '${levelId}' is not loadable or resolvable.`
            });
            return;
        }
        const config = levelRegistry.get(levelId);
        if (config && config.meta.id.trim() !== levelId) {
            diagnostics.push({
                code: 'campaign_level_meta_id_mismatch',
                severity: 'warning',
                message: `Campaign level '${levelId}' resolved config meta.id '${config.meta.id}'.`
            });
        }
    });
    duplicateIds.forEach((levelId) => {
        diagnostics.push({
            code: 'duplicate_campaign_level_id',
            severity: 'error',
            message: `Campaign level id '${levelId}' is duplicated in level order.`
        });
    });

    levelIds.forEach((levelId) => {
        const config = levelRegistry.get(levelId);
        if (!config || config.nextLevelId === null) {
            return;
        }
        if (config.nextLevelId === levelId) {
            diagnostics.push({
                code: 'level_next_self_loop',
                severity: 'warning',
                message: `Level '${levelId}' nextLevelId points to itself.`
            });
            return;
        }
        if (!levelIdSet.has(config.nextLevelId)) {
            diagnostics.push({
                code: 'level_next_missing_campaign_ref',
                severity: 'warning',
                message: `Level '${levelId}' nextLevelId '${config.nextLevelId}' is not in campaign levels.`
            });
        }
    });

    return diagnostics;
};

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

export const getBundledCampaignLevelConfig = (levelId: string): TestWorldConfig | null => {
    const bundledConfig = bundledLevelRegistry.get(levelId);
    return bundledConfig ? cloneTestWorldConfig(bundledConfig) : null;
};

export const getCampaignLevelConfigSource = (levelId: string): CampaignLevelConfigSource => {
    const liveConfig = levelRegistry.get(levelId);
    if (!liveConfig) {
        throw new Error(`Unknown campaign level '${levelId}'.`);
    }

    const bundledConfig = bundledLevelRegistry.get(levelId);
    if (!bundledConfig) {
        return 'campaign_registry_custom';
    }

    const liveSignature = JSON.stringify(liveConfig);
    const bundledSignature = JSON.stringify(bundledConfig);
    return liveSignature === bundledSignature
        ? 'bundled'
        : 'campaign_registry_override';
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

export const getCampaignManifestDiagnostics = (): CampaignManifestDiagnostic[] => {
    return collectCampaignManifestDiagnostics().map((entry) => ({ ...entry }));
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

export const updateCampaignLevelConfig = (
    levelId: string,
    edit: (draft: TestWorldConfig) => void
): TestWorldConfig | null => {
    const existing = levelRegistry.get(levelId);
    if (!existing) {
        return null;
    }

    const draft = cloneTestWorldConfig(existing);
    edit(draft);
    draft.meta.id = existing.meta.id;
    const normalized = normalizeTestWorldConfig(draft, {
        fallbackConfig: existing
    });
    normalized.meta.id = existing.meta.id;
    levelRegistry.set(levelId, normalized);
    persistEditorCampaignRegistry();
    return cloneTestWorldConfig(normalized);
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
