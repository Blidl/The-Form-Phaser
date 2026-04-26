import { hasReference } from '../../authoring/registry/reference_index';
import type { AuthoringValidationContext, ValidationIssue } from '../../authoring/validation/validation_types';
import type {
    OverlayReplayActorFrame,
    OverlayReplayAsset,
    OverlayReplayFocusMarkerFrame,
    OverlayReplayPlatformFrame,
    OverlayReplayScaleMode,
    OverlayReplayScreenFrame,
    OverlayReplayVfxFrame
} from './overlay_replay_types';

export interface OverlayReplayValidationContext {
    readonly authoringContext: AuthoringValidationContext;
}

const SCALE_MODES: ReadonlySet<OverlayReplayScaleMode> = new Set<OverlayReplayScaleMode>([
    'contain',
    'cover',
    'stretch',
    'pixel_perfect'
]);

const FOCUS_MARKER_KINDS: ReadonlySet<OverlayReplayFocusMarkerFrame['kind']> =
    new Set<OverlayReplayFocusMarkerFrame['kind']>(['actor', 'point', 'marker']);

const FACINGS: ReadonlySet<NonNullable<OverlayReplayActorFrame['facing']>> = new Set([
    'left',
    'right',
    'up',
    'down'
]);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

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

const validateTimelinePosition = (
    t: unknown,
    durationMs: number,
    issues: ValidationIssue[],
    source: string | undefined,
    code: string,
    path: string
): t is number => {
    if (!isFiniteNumber(t) || t < 0 || t > durationMs) {
        issues.push(
            createIssue(
                'error',
                code,
                `Frame time must be a finite number in [0, durationMs], received "${String(t)}".`,
                source,
                path
            )
        );
        return false;
    }
    return true;
};

const validateFrameOrder = (
    t: number,
    previousT: number,
    issues: ValidationIssue[],
    source: string | undefined,
    code: string,
    path: string
): boolean => {
    if (t < previousT) {
        issues.push(
            createIssue(
                'error',
                code,
                'Frames must be sorted by ascending t.',
                source,
                path
            )
        );
        return false;
    }
    return true;
};

const validateFocusMarker = (
    marker: OverlayReplayFocusMarkerFrame,
    issues: ValidationIssue[],
    source: string | undefined,
    path: string
): void => {
    if (!FOCUS_MARKER_KINDS.has(marker.kind)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                `focusMarker.kind must be one of actor|point|marker, received "${String(marker.kind)}".`,
                source,
                `${path}.kind`
            )
        );
        return;
    }

    if (marker.kind === 'actor' && !isNonEmptyString(marker.actorId)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'focusMarker.actorId is required when focusMarker.kind is "actor".',
                source,
                `${path}.actorId`
            )
        );
    }

    if (marker.kind === 'marker' && !isNonEmptyString(marker.markerId)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'focusMarker.markerId is required when focusMarker.kind is "marker".',
                source,
                `${path}.markerId`
            )
        );
    }

    if (marker.kind === 'point') {
        if (!isFiniteNumber(marker.x)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_overlay_replay_actor_frame',
                    'focusMarker.x must be a finite number when focusMarker.kind is "point".',
                    source,
                    `${path}.x`
                )
            );
        }
        if (!isFiniteNumber(marker.y)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_overlay_replay_actor_frame',
                    'focusMarker.y must be a finite number when focusMarker.kind is "point".',
                    source,
                    `${path}.y`
                )
            );
        }
    }
};

const validateCameraFrames = (
    asset: OverlayReplayAsset,
    issues: ValidationIssue[],
    source: string | undefined
): void => {
    const frames = asset.cameraTrack.frames;
    if (frames.length === 0) {
        issues.push(
            createIssue(
                'warning',
                'overlay_replay_missing_camera_frames',
                'Overlay replay cameraTrack has no frames.',
                source,
                'cameraTrack.frames'
            )
        );
        return;
    }

    let previousT = -Infinity;
    frames.forEach((frame, frameIndex) => {
        const basePath = `cameraTrack.frames[${frameIndex}]`;
        const hasValidT = validateTimelinePosition(
            frame.t,
            asset.durationMs,
            issues,
            source,
            'invalid_overlay_replay_camera_frame',
            `${basePath}.t`
        );

        if (hasValidT) {
            validateFrameOrder(
                frame.t,
                previousT,
                issues,
                source,
                'invalid_overlay_replay_camera_frame',
                `${basePath}.t`
            );
            previousT = frame.t;
        }

        if (!isFiniteNumber(frame.x)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_overlay_replay_camera_frame',
                    'Camera frame x must be a finite number.',
                    source,
                    `${basePath}.x`
                )
            );
        }

        if (!isFiniteNumber(frame.y)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_overlay_replay_camera_frame',
                    'Camera frame y must be a finite number.',
                    source,
                    `${basePath}.y`
                )
            );
        }
    });
};

const validateActorFrame = (
    frame: OverlayReplayActorFrame,
    basePath: string,
    durationMs: number,
    previousT: number,
    issues: ValidationIssue[],
    source: string | undefined
): number => {
    const hasValidT = validateTimelinePosition(
        frame.t,
        durationMs,
        issues,
        source,
        'invalid_overlay_replay_actor_frame',
        `${basePath}.t`
    );

    let nextPreviousT = previousT;
    if (hasValidT) {
        validateFrameOrder(
            frame.t,
            previousT,
            issues,
            source,
            'invalid_overlay_replay_actor_frame',
            `${basePath}.t`
        );
        nextPreviousT = frame.t;
    }

    if (!isFiniteNumber(frame.x)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'Actor frame x must be a finite number.',
                source,
                `${basePath}.x`
            )
        );
    }

    if (!isFiniteNumber(frame.y)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'Actor frame y must be a finite number.',
                source,
                `${basePath}.y`
            )
        );
    }

    if (frame.rotation !== undefined && !isFiniteNumber(frame.rotation)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'Actor frame rotation must be a finite number when provided.',
                source,
                `${basePath}.rotation`
            )
        );
    }

    if (frame.scaleX !== undefined && !isFiniteNumber(frame.scaleX)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'Actor frame scaleX must be a finite number when provided.',
                source,
                `${basePath}.scaleX`
            )
        );
    }

    if (frame.scaleY !== undefined && !isFiniteNumber(frame.scaleY)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'Actor frame scaleY must be a finite number when provided.',
                source,
                `${basePath}.scaleY`
            )
        );
    }

    if (frame.visible !== undefined && typeof frame.visible !== 'boolean') {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                'Actor frame visible must be a boolean when provided.',
                source,
                `${basePath}.visible`
            )
        );
    }

    if (frame.facing !== undefined && !FACINGS.has(frame.facing)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_actor_frame',
                `Actor frame facing "${String(frame.facing)}" is invalid.`,
                source,
                `${basePath}.facing`
            )
        );
    }

    if (frame.focusMarker !== undefined) {
        validateFocusMarker(frame.focusMarker, issues, source, `${basePath}.focusMarker`);
    }

    return nextPreviousT;
};

const validatePlatformFrame = (
    frame: OverlayReplayPlatformFrame,
    basePath: string,
    durationMs: number,
    previousT: number,
    issues: ValidationIssue[],
    source: string | undefined
): number => {
    const hasValidT = validateTimelinePosition(
        frame.t,
        durationMs,
        issues,
        source,
        'invalid_overlay_replay_platform_frame',
        `${basePath}.t`
    );

    let nextPreviousT = previousT;
    if (hasValidT) {
        validateFrameOrder(
            frame.t,
            previousT,
            issues,
            source,
            'invalid_overlay_replay_platform_frame',
            `${basePath}.t`
        );
        nextPreviousT = frame.t;
    }

    if (!isFiniteNumber(frame.x)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_platform_frame',
                'Platform frame x must be a finite number.',
                source,
                `${basePath}.x`
            )
        );
    }

    if (!isFiniteNumber(frame.y)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_platform_frame',
                'Platform frame y must be a finite number.',
                source,
                `${basePath}.y`
            )
        );
    }

    return nextPreviousT;
};

const validateVfxFrame = (
    frame: OverlayReplayVfxFrame,
    basePath: string,
    durationMs: number,
    previousT: number,
    issues: ValidationIssue[],
    source: string | undefined
): number => {
    const hasValidT = validateTimelinePosition(
        frame.t,
        durationMs,
        issues,
        source,
        'invalid_overlay_replay_vfx_frame',
        `${basePath}.t`
    );

    let nextPreviousT = previousT;
    if (hasValidT) {
        validateFrameOrder(
            frame.t,
            previousT,
            issues,
            source,
            'invalid_overlay_replay_vfx_frame',
            `${basePath}.t`
        );
        nextPreviousT = frame.t;
    }

    if (!isNonEmptyString(frame.vfxId)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_vfx_frame',
                'VFX frame vfxId is missing or empty.',
                source,
                `${basePath}.vfxId`
            )
        );
    }

    if (!isFiniteNumber(frame.x)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_vfx_frame',
                'VFX frame x must be a finite number.',
                source,
                `${basePath}.x`
            )
        );
    }

    if (!isFiniteNumber(frame.y)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_vfx_frame',
                'VFX frame y must be a finite number.',
                source,
                `${basePath}.y`
            )
        );
    }

    return nextPreviousT;
};

const validateScreenFrame = (
    frame: OverlayReplayScreenFrame,
    basePath: string,
    durationMs: number,
    previousT: number,
    issues: ValidationIssue[],
    source: string | undefined
): number => {
    const hasValidT = validateTimelinePosition(
        frame.t,
        durationMs,
        issues,
        source,
        'invalid_overlay_replay_screen_frame',
        `${basePath}.t`
    );

    let nextPreviousT = previousT;
    if (hasValidT) {
        validateFrameOrder(
            frame.t,
            previousT,
            issues,
            source,
            'invalid_overlay_replay_screen_frame',
            `${basePath}.t`
        );
        nextPreviousT = frame.t;
    }

    if (!isNonEmptyString(frame.effectId)) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_screen_frame',
                'Screen frame effectId is missing or empty.',
                source,
                `${basePath}.effectId`
            )
        );
    }

    return nextPreviousT;
};

export const validateOverlayReplayAsset = (
    asset: OverlayReplayAsset,
    context: OverlayReplayValidationContext
): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const source = context.authoringContext.source;

    if (!isNonEmptyString(asset.id)) {
        issues.push(
            createIssue('error', 'missing_overlay_replay_id', 'Overlay replay id is missing or empty.', source, 'id')
        );
    }

    if (asset.schemaVersion !== 1) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_schema_version',
                `Overlay replay schemaVersion must be 1, received "${String(asset.schemaVersion)}".`,
                source,
                'schemaVersion'
            )
        );
    }

    if (!isNonEmptyString(asset.sourceLevelId)) {
        issues.push(
            createIssue(
                'error',
                'missing_overlay_replay_source_level_id',
                'Overlay replay sourceLevelId is missing or empty.',
                source,
                'sourceLevelId'
            )
        );
    } else if (
        context.authoringContext.referenceIndex.levelIds.size > 0 &&
        !hasReference(context.authoringContext.referenceIndex, 'level', asset.sourceLevelId)
    ) {
        issues.push(
            createIssue(
                'warning',
                'unknown_overlay_replay_source_level_id',
                `sourceLevelId "${asset.sourceLevelId}" is not present in current level references. Playback remains independent of live level availability.`,
                source,
                'sourceLevelId'
            )
        );
    }

    if (!isFiniteNumber(asset.durationMs) || asset.durationMs <= 0) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_duration',
                'Overlay replay durationMs must be a finite number > 0.',
                source,
                'durationMs'
            )
        );
    }

    if (!isFiniteNumber(asset.fps) || asset.fps <= 0) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_fps',
                'Overlay replay fps must be a finite number > 0.',
                source,
                'fps'
            )
        );
    } else if (asset.fps !== 30) {
        issues.push(
            createIssue(
                'warning',
                'overlay_replay_non_default_fps',
                `Overlay replay fps is ${asset.fps}; default authored target is 30.`,
                source,
                'fps'
            )
        );
    }

    const viewport = asset.viewport;
    if (
        !isFiniteNumber(viewport.width) ||
        viewport.width <= 0 ||
        !isFiniteNumber(viewport.height) ||
        viewport.height <= 0 ||
        !SCALE_MODES.has(viewport.scaleMode)
    ) {
        issues.push(
            createIssue(
                'error',
                'invalid_overlay_replay_viewport',
                'Overlay replay viewport must have width/height > 0 and a valid scaleMode.',
                source,
                'viewport'
            )
        );
    }

    if (isFiniteNumber(asset.durationMs) && asset.durationMs > 0) {
        validateCameraFrames(asset, issues, source);

        const seenActorTrackIds = new Set<string>();
        asset.actorTracks.forEach((track, trackIndex) => {
            const trackPath = `actorTracks[${trackIndex}]`;
            const actorId = typeof track.actorId === 'string' ? track.actorId.trim() : '';
            if (actorId.length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'missing_overlay_replay_actor_id',
                        'Actor track actorId is missing or empty.',
                        source,
                        `${trackPath}.actorId`
                    )
                );
            } else if (seenActorTrackIds.has(actorId)) {
                issues.push(
                    createIssue(
                        'error',
                        'duplicate_overlay_replay_actor_track',
                        `Duplicate actor track actorId "${actorId}".`,
                        source,
                        `${trackPath}.actorId`
                    )
                );
            } else {
                seenActorTrackIds.add(actorId);
            }

            let previousT = -Infinity;
            track.frames.forEach((frame, frameIndex) => {
                previousT = validateActorFrame(
                    frame,
                    `${trackPath}.frames[${frameIndex}]`,
                    asset.durationMs,
                    previousT,
                    issues,
                    source
                );
            });
        });

        const seenPlatformTrackIds = new Set<string>();
        asset.platformTracks.forEach((track, trackIndex) => {
            const trackPath = `platformTracks[${trackIndex}]`;
            const platformId = typeof track.platformId === 'string' ? track.platformId.trim() : '';
            if (platformId.length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'missing_overlay_replay_platform_id',
                        'Platform track platformId is missing or empty.',
                        source,
                        `${trackPath}.platformId`
                    )
                );
            } else if (seenPlatformTrackIds.has(platformId)) {
                issues.push(
                    createIssue(
                        'error',
                        'duplicate_overlay_replay_platform_track',
                        `Duplicate platform track platformId "${platformId}".`,
                        source,
                        `${trackPath}.platformId`
                    )
                );
            } else {
                seenPlatformTrackIds.add(platformId);
            }

            let previousT = -Infinity;
            track.frames.forEach((frame, frameIndex) => {
                previousT = validatePlatformFrame(
                    frame,
                    `${trackPath}.frames[${frameIndex}]`,
                    asset.durationMs,
                    previousT,
                    issues,
                    source
                );
            });
        });

        const seenVfxTrackIds = new Set<string>();
        asset.vfxTracks.forEach((track, trackIndex) => {
            const trackPath = `vfxTracks[${trackIndex}]`;
            const trackId = typeof track.id === 'string' ? track.id.trim() : '';
            if (trackId.length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'missing_overlay_replay_vfx_track_id',
                        'VFX track id is missing or empty.',
                        source,
                        `${trackPath}.id`
                    )
                );
            } else if (seenVfxTrackIds.has(trackId)) {
                issues.push(
                    createIssue(
                        'error',
                        'duplicate_overlay_replay_vfx_track',
                        `Duplicate VFX track id "${trackId}".`,
                        source,
                        `${trackPath}.id`
                    )
                );
            } else {
                seenVfxTrackIds.add(trackId);
            }

            let previousT = -Infinity;
            track.frames.forEach((frame, frameIndex) => {
                previousT = validateVfxFrame(
                    frame,
                    `${trackPath}.frames[${frameIndex}]`,
                    asset.durationMs,
                    previousT,
                    issues,
                    source
                );
            });
        });

        const seenScreenTrackIds = new Set<string>();
        asset.screenTracks.forEach((track, trackIndex) => {
            const trackPath = `screenTracks[${trackIndex}]`;
            const trackId = typeof track.id === 'string' ? track.id.trim() : '';
            if (trackId.length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'missing_overlay_replay_screen_track_id',
                        'Screen track id is missing or empty.',
                        source,
                        `${trackPath}.id`
                    )
                );
            } else if (seenScreenTrackIds.has(trackId)) {
                issues.push(
                    createIssue(
                        'error',
                        'duplicate_overlay_replay_screen_track',
                        `Duplicate screen track id "${trackId}".`,
                        source,
                        `${trackPath}.id`
                    )
                );
            } else {
                seenScreenTrackIds.add(trackId);
            }

            let previousT = -Infinity;
            track.frames.forEach((frame, frameIndex) => {
                previousT = validateScreenFrame(
                    frame,
                    `${trackPath}.frames[${frameIndex}]`,
                    asset.durationMs,
                    previousT,
                    issues,
                    source
                );
            });
        });
    }

    return issues;
};
