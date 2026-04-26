import type { TestCutsceneDefinition, TestCutsceneStep } from '../../cutscene/cutscene_types';
import type {
    CutsceneAsset,
    CutsceneAssetMode,
    CutsceneAssetSettings,
    DirectorTimelineClip,
    DirectorTimelineMigrationIssue,
    DirectorTimelineMigrationResult,
    DirectorTimelineTrack,
    DirectorTimelineTrackType
} from './director_timeline_types';

const FALLBACK_ASSET_ID = 'legacy_cutscene';
const DEFAULT_CAMERA_DURATION_MS = 500;

const LEGACY_TRACK_IDS: Record<DirectorTimelineTrackType, string> = {
    camera: 'legacy.camera',
    actor: 'legacy.actor',
    player: 'legacy.player',
    platform: 'legacy.platform',
    world: 'legacy.world',
    event: 'legacy.event',
    flag: 'legacy.flag',
    manpu: 'legacy.manpu',
    focus_marker: 'legacy.focus_marker',
    audio: 'legacy.audio',
    vfx: 'legacy.vfx',
    screen: 'legacy.screen'
};

const DEFAULT_SETTINGS: CutsceneAssetSettings = {
    lockPlayerInput: true,
    pauseGameUnderOverlay: false,
    restoreCameraAfterEnd: true,
    replayOnce: true
};

type LegacyTrackBuilder = {
    readonly id: string;
    readonly type: DirectorTimelineTrackType;
    title?: string;
    targetId?: string;
    clips: DirectorTimelineClip[];
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const asFiniteNonNegativeNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : undefined;

const normalizeAssetId = (id: unknown): string => asNonEmptyString(id) ?? FALLBACK_ASSET_ID;

const mapLegacyMode = (mode: unknown): CutsceneAssetMode => (mode === 'overlay' ? 'overlay_replay' : 'in_level');

const tryResolveDisplayName = (cutscene: TestCutsceneDefinition): string | undefined => {
    const raw = cutscene as unknown;
    if (!isRecord(raw)) {
        return undefined;
    }
    return asNonEmptyString(raw.displayName) ?? asNonEmptyString(raw.name) ?? asNonEmptyString(raw.title);
};

const tryResolveMarkSeenFlagId = (cutscene: TestCutsceneDefinition): string | undefined => {
    const raw = cutscene as unknown;
    if (!isRecord(raw)) {
        return undefined;
    }
    return (
        asNonEmptyString(raw.markSeenFlagId)
        ?? asNonEmptyString(raw.mark_seen_flag_id)
        ?? asNonEmptyString(raw.seenFlagId)
        ?? asNonEmptyString(raw.seen_flag_id)
    );
};

const tryResolveLegacyDurationMs = (cutscene: TestCutsceneDefinition): number | undefined => {
    const raw = cutscene as unknown;
    if (!isRecord(raw)) {
        return undefined;
    }
    return asFiniteNonNegativeNumber(raw.durationMs) ?? asFiniteNonNegativeNumber(raw.duration_ms);
};

const describeLegacyStep = (step: unknown): string => {
    if (!isRecord(step)) {
        return 'non_object_step';
    }
    const kind = asNonEmptyString(step.kind);
    if (kind === undefined) {
        return 'missing_kind';
    }
    return `kind:${kind}`;
};

const createClip = (args: {
    assetId: string;
    index: number;
    startMs: number;
    durationMs: number;
    actionType: string;
    params: Readonly<Record<string, unknown>>;
}): DirectorTimelineClip => ({
    id: `${args.assetId}.clip.${args.index}`,
    startMs: args.startMs,
    durationMs: args.durationMs,
    actionType: args.actionType,
    params: { ...args.params }
});

const pushClipToTrack = (
    tracksByType: Map<DirectorTimelineTrackType, LegacyTrackBuilder>,
    trackType: DirectorTimelineTrackType,
    clip: DirectorTimelineClip,
    title?: string,
    targetId?: string
): void => {
    const existing = tracksByType.get(trackType);
    if (existing !== undefined) {
        existing.clips.push(clip);
        if (existing.title === undefined && title !== undefined) {
            existing.title = title;
        }
        if (existing.targetId === undefined && targetId !== undefined) {
            existing.targetId = targetId;
        }
        return;
    }

    tracksByType.set(trackType, {
        id: LEGACY_TRACK_IDS[trackType],
        type: trackType,
        ...(title !== undefined ? { title } : {}),
        ...(targetId !== undefined ? { targetId } : {}),
        clips: [clip]
    });
};

const mapKnownLegacyStep = (
    step: TestCutsceneStep,
    assetId: string,
    clipIndex: number,
    startMs: number
):
    | {
          trackType: DirectorTimelineTrackType;
          clip: DirectorTimelineClip;
          trackTitle?: string;
          trackTargetId?: string;
      }
    | null => {
    switch (step.kind) {
        case 'camera_focus_actor': {
            const durationMs = asFiniteNonNegativeNumber(step.durationMs) ?? DEFAULT_CAMERA_DURATION_MS;
            return {
                trackType: 'camera',
                trackTitle: 'Legacy Camera',
                trackTargetId: asNonEmptyString(step.actorId),
                clip: createClip({
                    assetId,
                    index: clipIndex,
                    startMs,
                    durationMs,
                    actionType: 'camera.focus_actor',
                    params: {
                        actorId: step.actorId,
                        durationMs,
                        ...(asNonEmptyString(step.ease) !== undefined ? { ease: step.ease } : {}),
                        ...(asFiniteNonNegativeNumber(step.tolerancePx) !== undefined ? { tolerancePx: step.tolerancePx } : {})
                    }
                })
            };
        }
        case 'camera_pan_to': {
            return {
                trackType: 'camera',
                trackTitle: 'Legacy Camera',
                clip: createClip({
                    assetId,
                    index: clipIndex,
                    startMs,
                    durationMs: step.durationMs,
                    actionType: 'camera.pan_to',
                    params: {
                        point: { x: step.x, y: step.y },
                        durationMs: step.durationMs,
                        ...(asNonEmptyString(step.ease) !== undefined ? { ease: step.ease } : {})
                    }
                })
            };
        }
        case 'play_sfx': {
            return {
                trackType: 'audio',
                trackTitle: 'Legacy Audio',
                clip: createClip({
                    assetId,
                    index: clipIndex,
                    startMs,
                    durationMs: 0,
                    actionType: 'audio.play_sfx',
                    params: {
                        sfxId: step.sfxId
                    }
                })
            };
        }
        case 'spawn_vfx': {
            return {
                trackType: 'vfx',
                trackTitle: 'Legacy VFX',
                trackTargetId: asNonEmptyString(step.actorId),
                clip: createClip({
                    assetId,
                    index: clipIndex,
                    startMs,
                    durationMs: 0,
                    actionType: 'vfx.spawn',
                    params: {
                        vfxId: step.vfxId,
                        ...(asNonEmptyString(step.actorId) !== undefined ? { actorId: step.actorId } : {}),
                        ...(typeof step.x === 'number' ? { x: step.x } : {}),
                        ...(typeof step.y === 'number' ? { y: step.y } : {})
                    }
                })
            };
        }
        default:
            return null;
    }
};

const createEventBridgeClip = (args: {
    assetId: string;
    clipIndex: number;
    startMs: number;
    durationMs: number;
    eventId: string;
    payload: Readonly<Record<string, unknown>>;
}): DirectorTimelineClip =>
    createClip({
        assetId: args.assetId,
        index: args.clipIndex,
        startMs: args.startMs,
        durationMs: args.durationMs,
        actionType: 'world.emit_event',
        params: {
            eventId: args.eventId,
            ...args.payload
        }
    });

const mapLegacyStepWithFallback = (
    step: TestCutsceneStep,
    assetId: string,
    clipIndex: number,
    startMs: number,
    issues: DirectorTimelineMigrationIssue[]
): {
    trackType: DirectorTimelineTrackType;
    clip: DirectorTimelineClip;
    trackTitle?: string;
    trackTargetId?: string;
} => {
    const known = mapKnownLegacyStep(step, assetId, clipIndex, startMs);
    if (known !== null) {
        return known;
    }

    if (step.kind === 'wait') {
        return {
            trackType: 'world',
            trackTitle: 'Legacy World',
            clip: createEventBridgeClip({
                assetId,
                clipIndex,
                startMs,
                durationMs: step.durationMs,
                eventId: 'legacy.wait',
                payload: { description: 'kind:wait' }
            })
        };
    }

    if (step.kind === 'lock_input' || step.kind === 'unlock_input') {
        return {
            trackType: 'event',
            trackTitle: 'Legacy Events',
            clip: createEventBridgeClip({
                assetId,
                clipIndex,
                startMs,
                durationMs: 0,
                eventId: `legacy.${step.kind}`,
                payload: { description: `kind:${step.kind}` }
            })
        };
    }

    if (step.kind === 'subtitle') {
        return {
            trackType: 'screen',
            trackTitle: 'Legacy Screen',
            clip: createEventBridgeClip({
                assetId,
                clipIndex,
                startMs,
                durationMs: asFiniteNonNegativeNumber(step.durationMs) ?? 0,
                eventId: 'legacy.subtitle',
                payload: {
                    description: 'kind:subtitle',
                    text: step.text
                }
            })
        };
    }

    if (step.kind === 'actor_sequence_ref') {
        return {
            trackType: 'actor',
            trackTitle: 'Legacy Actor',
            trackTargetId: step.actorId,
            clip: createEventBridgeClip({
                assetId,
                clipIndex,
                startMs,
                durationMs: 0,
                eventId: 'legacy.actor_sequence_ref',
                payload: {
                    description: 'kind:actor_sequence_ref',
                    actorId: step.actorId,
                    sequenceRef: step.sequenceRef
                }
            })
        };
    }

    if (step.kind === 'set_emotion') {
        return {
            trackType: 'manpu',
            trackTitle: 'Legacy Emotion',
            trackTargetId: step.actorId,
            clip: createEventBridgeClip({
                assetId,
                clipIndex,
                startMs,
                durationMs: 0,
                eventId: 'legacy.set_emotion',
                payload: {
                    description: 'kind:set_emotion',
                    actorId: step.actorId,
                    emotionId: step.emotionId
                }
            })
        };
    }

    const description = describeLegacyStep(step);
    issues.push({
        severity: 'warning',
        code: 'unsupported_legacy_cutscene_step',
        message: `Unsupported legacy cutscene step at steps[${clipIndex}]: ${description}.`,
        path: `steps[${clipIndex}]`
    });

    return {
        trackType: 'event',
        trackTitle: 'Legacy Events',
        clip: createEventBridgeClip({
            assetId,
            clipIndex,
            startMs,
            durationMs: 0,
            eventId: 'legacy.unsupported_cutscene_step',
            payload: {
                description
            }
        })
    };
};

const toReadonlyTracks = (tracksByType: ReadonlyMap<DirectorTimelineTrackType, LegacyTrackBuilder>): readonly DirectorTimelineTrack[] =>
    [...tracksByType.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((track) => ({
            id: track.id,
            type: track.type,
            ...(track.title !== undefined ? { title: track.title } : {}),
            ...(track.targetId !== undefined ? { targetId: track.targetId } : {}),
            clips: track.clips.map((clip) => ({
                ...clip,
                params: { ...(clip.params ?? {}) }
            }))
        }));

export const migrateTestCutsceneToTimelineAsset = (
    cutscene: TestCutsceneDefinition
): DirectorTimelineMigrationResult => {
    const issues: DirectorTimelineMigrationIssue[] = [];
    const assetId = normalizeAssetId(cutscene.id);
    const tracksByType = new Map<DirectorTimelineTrackType, LegacyTrackBuilder>();
    let accumulatedStartMs = 0;

    cutscene.steps.forEach((step, index) => {
        const mapped = mapLegacyStepWithFallback(step, assetId, index, accumulatedStartMs, issues);
        pushClipToTrack(tracksByType, mapped.trackType, mapped.clip, mapped.trackTitle, mapped.trackTargetId);
        accumulatedStartMs += mapped.clip.durationMs;
    });

    const legacyDurationMs = tryResolveLegacyDurationMs(cutscene);
    const durationMs = legacyDurationMs !== undefined && legacyDurationMs > accumulatedStartMs
        ? legacyDurationMs
        : accumulatedStartMs;

    const markSeenFlagId = tryResolveMarkSeenFlagId(cutscene);
    const settings: CutsceneAssetSettings = {
        ...DEFAULT_SETTINGS,
        ...(markSeenFlagId !== undefined ? { markSeenFlagId } : {})
    };

    const asset: CutsceneAsset = {
        schemaVersion: 2,
        id: assetId,
        ...(tryResolveDisplayName(cutscene) !== undefined ? { displayName: tryResolveDisplayName(cutscene) } : {}),
        mode: mapLegacyMode(cutscene.mode),
        durationMs,
        settings,
        tracks: toReadonlyTracks(tracksByType)
    };

    return {
        asset,
        issues
    };
};

export const migrateTestCutscenesToTimelineAssets = (
    cutscenes: readonly TestCutsceneDefinition[]
): readonly DirectorTimelineMigrationResult[] => {
    return cutscenes.map((cutscene) => migrateTestCutsceneToTimelineAsset(cutscene));
};
