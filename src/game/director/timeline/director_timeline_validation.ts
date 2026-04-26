import type { ActionCatalog } from '../../authoring/actions/action_catalog';
import { validateFlagRef } from '../../authoring/validation/validation_service';
import type { AuthoringValidationContext, ValidationIssue } from '../../authoring/validation/validation_types';
import type {
    CutsceneAsset,
    CutsceneAssetMode,
    DirectorTimelineTrackType
} from './director_timeline_types';

export interface DirectorTimelineValidationContext {
    readonly actionCatalog: ActionCatalog;
    readonly authoringContext: AuthoringValidationContext;
}

const TRACK_TYPES: ReadonlySet<DirectorTimelineTrackType> = new Set<DirectorTimelineTrackType>([
    'camera',
    'actor',
    'player',
    'platform',
    'world',
    'event',
    'flag',
    'manpu',
    'focus_marker',
    'audio',
    'vfx',
    'screen'
]);

const MODES: ReadonlySet<CutsceneAssetMode> = new Set<CutsceneAssetMode>(['in_level', 'overlay_replay']);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isTrackType = (value: unknown): value is DirectorTimelineTrackType =>
    typeof value === 'string' && TRACK_TYPES.has(value as DirectorTimelineTrackType);

const isMode = (value: unknown): value is CutsceneAssetMode => typeof value === 'string' && MODES.has(value as CutsceneAssetMode);

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Readonly<Record<string, unknown>>)
        : null;

const appendPath = (issue: ValidationIssue, parentPath: string, source?: string): ValidationIssue => {
    if (!issue.path || issue.path.length === 0) {
        return {
            ...issue,
            path: parentPath,
            source: issue.source ?? source
        };
    }

    return {
        ...issue,
        path: `${parentPath}.${issue.path}`,
        source: issue.source ?? source
    };
};

const createIssue = (
    severity: ValidationIssue['severity'],
    code: string,
    message: string,
    source?: string,
    path?: string
): ValidationIssue => ({
    severity,
    code,
    message,
    path,
    ...(source !== undefined ? { source } : {})
});

export const validateCutsceneAsset = (
    asset: CutsceneAsset,
    context: DirectorTimelineValidationContext
): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const source = context.authoringContext.source;

    if (!isNonEmptyString(asset.id)) {
        issues.push(
            createIssue(
                'error',
                'missing_cutscene_asset_id',
                'Cutscene asset id is missing or empty.',
                source,
                'id'
            )
        );
    }

    if (asset.schemaVersion !== 2) {
        issues.push(
            createIssue(
                'error',
                'invalid_cutscene_schema_version',
                `Cutscene schemaVersion must be 2, received "${String(asset.schemaVersion)}".`,
                source,
                'schemaVersion'
            )
        );
    }

    if (!isMode(asset.mode)) {
        issues.push(
            createIssue(
                'error',
                'invalid_cutscene_mode',
                `Cutscene mode "${String(asset.mode)}" is invalid.`,
                source,
                'mode'
            )
        );
    }

    if (!Number.isFinite(asset.durationMs) || asset.durationMs < 0) {
        issues.push(
            createIssue(
                'error',
                'invalid_cutscene_duration',
                'Cutscene durationMs must be a finite number >= 0.',
                source,
                'durationMs'
            )
        );
    }

    const markSeenFlagId = asset.settings.markSeenFlagId;
    if (typeof markSeenFlagId === 'string' && markSeenFlagId.trim().length > 0) {
        issues.push(
            ...validateFlagRef(context.authoringContext, markSeenFlagId, 'settings.markSeenFlagId').map((issue) => ({
                ...issue,
                source: issue.source ?? source
            }))
        );
    }

    if (asset.mode === 'overlay_replay' && asset.settings.pauseGameUnderOverlay === false) {
        issues.push(
            createIssue(
                'warning',
                'overlay_replay_should_pause_game',
                'overlay_replay cutscenes should generally pause game simulation under the overlay.',
                source,
                'settings.pauseGameUnderOverlay'
            )
        );
    }

    if (asset.tracks.length === 0) {
        issues.push(
            createIssue(
                'warning',
                'cutscene_has_no_tracks',
                'Cutscene asset has no timeline tracks.',
                source,
                'tracks'
            )
        );
    }

    const seenTrackIds = new Set<string>();
    const seenClipIds = new Set<string>();

    asset.tracks.forEach((track, trackIndex) => {
        const trackPath = `tracks[${trackIndex}]`;
        const trackId = typeof track.id === 'string' ? track.id.trim() : '';
        if (trackId.length === 0) {
            issues.push(
                createIssue(
                    'error',
                    'missing_cutscene_track_id',
                    'Timeline track id is missing or empty.',
                    source,
                    `${trackPath}.id`
                )
            );
        } else if (seenTrackIds.has(trackId)) {
            issues.push(
                createIssue(
                    'error',
                    'duplicate_cutscene_track_id',
                    `Duplicate timeline track id "${trackId}".`,
                    source,
                    `${trackPath}.id`
                )
            );
        } else {
            seenTrackIds.add(trackId);
        }

        if (!isTrackType(track.type)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_cutscene_track_type',
                    `Timeline track type "${String(track.type)}" is invalid.`,
                    source,
                    `${trackPath}.type`
                )
            );
        }

        if (track.clips.length === 0) {
            issues.push(
                createIssue(
                    'info',
                    'empty_timeline_track',
                    'Timeline track has no clips.',
                    source,
                    `${trackPath}.clips`
                )
            );
        }

        track.clips.forEach((clip, clipIndex) => {
            const clipPath = `${trackPath}.clips[${clipIndex}]`;
            const clipId = typeof clip.id === 'string' ? clip.id.trim() : '';

            if (clipId.length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'missing_timeline_clip_id',
                        'Timeline clip id is missing or empty.',
                        source,
                        `${clipPath}.id`
                    )
                );
            } else if (seenClipIds.has(clipId)) {
                issues.push(
                    createIssue(
                        'error',
                        'duplicate_timeline_clip_id',
                        `Duplicate timeline clip id "${clipId}".`,
                        source,
                        `${clipPath}.id`
                    )
                );
            } else {
                seenClipIds.add(clipId);
            }

            const hasValidStart = Number.isFinite(clip.startMs) && clip.startMs >= 0;
            const hasValidDuration = Number.isFinite(clip.durationMs) && clip.durationMs >= 0;
            if (!hasValidStart) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_cutscene_duration',
                        'Timeline clip startMs must be a finite number >= 0.',
                        source,
                        `${clipPath}.startMs`
                    )
                );
            }
            if (!hasValidDuration) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_cutscene_duration',
                        'Timeline clip durationMs must be a finite number >= 0.',
                        source,
                        `${clipPath}.durationMs`
                    )
                );
            }
            if (hasValidStart && hasValidDuration && (clip.startMs + clip.durationMs) > asset.durationMs) {
                issues.push(
                    createIssue(
                        'warning',
                        'timeline_clip_exceeds_cutscene_duration',
                        'Timeline clip ends past cutscene durationMs.',
                        source,
                        clipPath
                    )
                );
            }

            const actionType = typeof clip.actionType === 'string' ? clip.actionType.trim() : '';
            const actionDefinition = context.actionCatalog.get(actionType);
            if (actionDefinition === null) {
                issues.push(
                    createIssue(
                        'error',
                        'unknown_timeline_action_type',
                        `Unknown timeline action type "${actionType}".`,
                        source,
                        `${clipPath}.actionType`
                    )
                );
                return;
            }

            const params = asRecord(clip.params) ?? {};
            const paramIssues = actionDefinition.validate(params, context.authoringContext);
            paramIssues.forEach((issue) => {
                issues.push(appendPath(issue, `${clipPath}.params`, source));
            });
        });
    });

    return issues;
};
