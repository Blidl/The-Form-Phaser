import type { TestCutsceneDefinition } from '../../cutscene/cutscene_types';
import type { TestNpcScriptedSequenceDefinition } from '../../npc/npc_scripted_sequences';
import type { TestNpcProfile } from '../../npc/npc_types';
import type { TestWorldConfig } from '../../world/runtime/test_world_config';
import type { ContentReferenceKind } from '../validation/validation_types';

export interface ReferenceIndex {
    readonly levelIds: ReadonlySet<string>;
    readonly levelObjectIds: ReadonlySet<string>;
    readonly actorIds: ReadonlySet<string>;
    readonly npcInstanceIds: ReadonlySet<string>;
    readonly npcProfileIds: ReadonlySet<string>;
    readonly npcScriptedSequenceIds: ReadonlySet<string>;
    readonly cutsceneIds: ReadonlySet<string>;
    readonly worldFlagIds: ReadonlySet<string>;
    readonly triggerVolumeIds: ReadonlySet<string>;
    readonly movingPlatformIds: ReadonlySet<string>;
    readonly triggerPlatformIds: ReadonlySet<string>;
}

interface MutableReferenceIndex {
    levelIds: Set<string>;
    levelObjectIds: Set<string>;
    actorIds: Set<string>;
    npcInstanceIds: Set<string>;
    npcProfileIds: Set<string>;
    npcScriptedSequenceIds: Set<string>;
    cutsceneIds: Set<string>;
    worldFlagIds: Set<string>;
    triggerVolumeIds: Set<string>;
    movingPlatformIds: Set<string>;
    triggerPlatformIds: Set<string>;
}

type ReferenceKey = keyof ReferenceIndex;

const REFERENCE_KEYS: readonly ReferenceKey[] = [
    'levelIds',
    'levelObjectIds',
    'actorIds',
    'npcInstanceIds',
    'npcProfileIds',
    'npcScriptedSequenceIds',
    'cutsceneIds',
    'worldFlagIds',
    'triggerVolumeIds',
    'movingPlatformIds',
    'triggerPlatformIds'
] as const;

const KIND_TO_KEY: Record<ContentReferenceKind, ReferenceKey> = {
    level: 'levelIds',
    level_object: 'levelObjectIds',
    actor: 'actorIds',
    npc_instance: 'npcInstanceIds',
    npc_profile: 'npcProfileIds',
    npc_scripted_sequence: 'npcScriptedSequenceIds',
    cutscene: 'cutsceneIds',
    world_flag: 'worldFlagIds',
    trigger_volume: 'triggerVolumeIds',
    moving_platform: 'movingPlatformIds',
    trigger_platform: 'triggerPlatformIds'
};

const normalizeId = (id: string | null | undefined): string | null => {
    if (typeof id !== 'string') {
        return null;
    }
    const trimmed = id.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const addNormalizedId = (target: Set<string>, id: string | null | undefined): void => {
    const normalized = normalizeId(id);
    if (normalized !== null) {
        target.add(normalized);
    }
};

const createMutableReferenceIndex = (): MutableReferenceIndex => {
    return {
        levelIds: new Set<string>(),
        levelObjectIds: new Set<string>(),
        actorIds: new Set<string>(),
        npcInstanceIds: new Set<string>(),
        npcProfileIds: new Set<string>(),
        npcScriptedSequenceIds: new Set<string>(),
        cutsceneIds: new Set<string>(),
        worldFlagIds: new Set<string>(),
        triggerVolumeIds: new Set<string>(),
        movingPlatformIds: new Set<string>(),
        triggerPlatformIds: new Set<string>()
    };
};

const freezeReferenceIndex = (index: MutableReferenceIndex): ReferenceIndex => {
    return {
        levelIds: index.levelIds,
        levelObjectIds: index.levelObjectIds,
        actorIds: index.actorIds,
        npcInstanceIds: index.npcInstanceIds,
        npcProfileIds: index.npcProfileIds,
        npcScriptedSequenceIds: index.npcScriptedSequenceIds,
        cutsceneIds: index.cutsceneIds,
        worldFlagIds: index.worldFlagIds,
        triggerVolumeIds: index.triggerVolumeIds,
        movingPlatformIds: index.movingPlatformIds,
        triggerPlatformIds: index.triggerPlatformIds
    };
};

const mergeSet = (target: Set<string>, source: ReadonlySet<string>): void => {
    source.forEach((id) => {
        target.add(id);
    });
};

const collectLevelObjectIds = (config: TestWorldConfig, levelObjectIds: Set<string>): void => {
    config.surfaces.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.hazards.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.checkpoints.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    if (config.finish) {
        addNormalizedId(levelObjectIds, config.finish.id);
    }
    config.movingPlatforms.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.triggerPlatforms.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.triggerVolumes.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.dragBoxes.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.windZones.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.triangleFlightBreakWalls.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
    config.trianglePickups.forEach((entry) => addNormalizedId(levelObjectIds, entry.id));
};

export const createEmptyReferenceIndex = (): ReferenceIndex => {
    return freezeReferenceIndex(createMutableReferenceIndex());
};

export const mergeReferenceIndexes = (indexes: readonly ReferenceIndex[]): ReferenceIndex => {
    const merged = createMutableReferenceIndex();

    indexes.forEach((index) => {
        mergeSet(merged.levelIds, index.levelIds);
        mergeSet(merged.levelObjectIds, index.levelObjectIds);
        mergeSet(merged.actorIds, index.actorIds);
        mergeSet(merged.npcInstanceIds, index.npcInstanceIds);
        mergeSet(merged.npcProfileIds, index.npcProfileIds);
        mergeSet(merged.npcScriptedSequenceIds, index.npcScriptedSequenceIds);
        mergeSet(merged.cutsceneIds, index.cutsceneIds);
        mergeSet(merged.worldFlagIds, index.worldFlagIds);
        mergeSet(merged.triggerVolumeIds, index.triggerVolumeIds);
        mergeSet(merged.movingPlatformIds, index.movingPlatformIds);
        mergeSet(merged.triggerPlatformIds, index.triggerPlatformIds);
    });

    return freezeReferenceIndex(merged);
};

export const hasReference = (index: ReferenceIndex, kind: ContentReferenceKind, id: string): boolean => {
    const normalized = normalizeId(id);
    if (normalized === null) {
        return false;
    }
    return index[KIND_TO_KEY[kind]].has(normalized);
};

export const getReferenceIds = (index: ReferenceIndex, kind: ContentReferenceKind): readonly string[] => {
    return Array.from(index[KIND_TO_KEY[kind]]).sort((left, right) => left.localeCompare(right));
};

export const buildReferenceIndexFromTestWorldConfig = (config: TestWorldConfig): ReferenceIndex => {
    const index = createMutableReferenceIndex();

    addNormalizedId(index.levelIds, config.meta.id);
    config.npcs.forEach((entry) => addNormalizedId(index.npcInstanceIds, entry.id));
    config.npcs.forEach((entry) => addNormalizedId(index.actorIds, entry.id));
    addNormalizedId(index.actorIds, 'player');

    Object.keys(config.worldFlags ?? {}).forEach((flagId) => {
        addNormalizedId(index.worldFlagIds, flagId);
    });

    config.triggerVolumes.forEach((entry) => addNormalizedId(index.triggerVolumeIds, entry.id));
    config.movingPlatforms.forEach((entry) => addNormalizedId(index.movingPlatformIds, entry.id));
    config.triggerPlatforms.forEach((entry) => addNormalizedId(index.triggerPlatformIds, entry.id));
    collectLevelObjectIds(config, index.levelObjectIds);

    return freezeReferenceIndex(index);
};

export const buildReferenceIndexFromTestAuthoringContent = (input: {
    levels?: readonly TestWorldConfig[];
    npcProfiles?: readonly TestNpcProfile[];
    npcScriptedSequences?: readonly TestNpcScriptedSequenceDefinition[];
    cutscenes?: readonly TestCutsceneDefinition[];
}): ReferenceIndex => {
    const merged = createMutableReferenceIndex();
    const levels = input.levels ?? [];

    levels.forEach((level) => {
        const levelIndex = buildReferenceIndexFromTestWorldConfig(level);
        REFERENCE_KEYS.forEach((key) => {
            mergeSet(merged[key], levelIndex[key]);
        });
    });

    (input.npcProfiles ?? []).forEach((profile) => addNormalizedId(merged.npcProfileIds, profile.id));
    (input.npcScriptedSequences ?? []).forEach((sequence) => addNormalizedId(merged.npcScriptedSequenceIds, sequence.id));
    (input.cutscenes ?? []).forEach((cutscene) => addNormalizedId(merged.cutsceneIds, cutscene.id));

    return freezeReferenceIndex(merged);
};
