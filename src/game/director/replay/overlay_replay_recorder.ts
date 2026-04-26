import {
    OverlayReplaySchemaVersion,
    type OverlayReplayActorTrack,
    type OverlayReplayAsset,
    type OverlayReplayCameraFrame,
    type OverlayReplayPlatformTrack,
    type OverlayReplayScreenTrack,
    type OverlayReplayVfxTrack,
    type OverlayReplayViewport
} from './overlay_replay_types';

export interface OverlayReplayRecorderSample {
    readonly t: number;
    readonly camera?: OverlayReplayCameraFrame;
    readonly actors?: readonly (OverlayReplayActorTrack['frames'][number] & { readonly actorId: string })[];
    readonly platforms?: readonly (OverlayReplayPlatformTrack['frames'][number] & { readonly platformId: string })[];
    readonly vfx?: readonly (OverlayReplayVfxTrack['frames'][number] & { readonly trackId: string })[];
    readonly screen?: readonly (OverlayReplayScreenTrack['frames'][number] & { readonly trackId: string })[];
}

export interface OverlayReplayRecorderOptions {
    readonly id: string;
    readonly displayName?: string;
    readonly sourceLevelId: string;
    readonly fps?: number;
    readonly viewport: OverlayReplayViewport;
}

export interface OverlayReplayRecorder {
    addSample(sample: OverlayReplayRecorderSample): void;
    build(): OverlayReplayAsset;
    clear(): void;
}

interface RecorderState {
    readonly cameraFrames: OverlayReplayCameraFrame[];
    readonly actorFramesById: Map<string, Array<OverlayReplayActorTrack['frames'][number]>>;
    readonly platformFramesById: Map<string, Array<OverlayReplayPlatformTrack['frames'][number]>>;
    readonly vfxFramesById: Map<string, Array<OverlayReplayVfxTrack['frames'][number]>>;
    readonly screenFramesById: Map<string, Array<OverlayReplayScreenTrack['frames'][number]>>;
}

const DEFAULT_FPS = 30;

const createState = (): RecorderState => ({
    cameraFrames: [],
    actorFramesById: new Map<string, Array<OverlayReplayActorTrack['frames'][number]>>(),
    platformFramesById: new Map<string, Array<OverlayReplayPlatformTrack['frames'][number]>>(),
    vfxFramesById: new Map<string, Array<OverlayReplayVfxTrack['frames'][number]>>(),
    screenFramesById: new Map<string, Array<OverlayReplayScreenTrack['frames'][number]>>()
});

const cloneFocusMarker = (
    marker: OverlayReplayActorTrack['frames'][number]['focusMarker']
): OverlayReplayActorTrack['frames'][number]['focusMarker'] => {
    if (marker === undefined) {
        return undefined;
    }
    return { ...marker };
};

const cloneCameraFrame = (frame: OverlayReplayCameraFrame): OverlayReplayCameraFrame => ({ ...frame });

const cloneActorFrame = (
    frame: OverlayReplayActorTrack['frames'][number]
): OverlayReplayActorTrack['frames'][number] => ({
    ...frame,
    ...(frame.focusMarker !== undefined ? { focusMarker: cloneFocusMarker(frame.focusMarker) } : {})
});

const clonePlatformFrame = (
    frame: OverlayReplayPlatformTrack['frames'][number]
): OverlayReplayPlatformTrack['frames'][number] => ({ ...frame });

const cloneVfxFrame = (frame: OverlayReplayVfxTrack['frames'][number]): OverlayReplayVfxTrack['frames'][number] => ({ ...frame });

const cloneScreenFrame = (
    frame: OverlayReplayScreenTrack['frames'][number]
): OverlayReplayScreenTrack['frames'][number] => ({
    ...frame,
    ...(frame.params !== undefined ? { params: { ...frame.params } } : {})
});

const addGroupedFrame = <TFrame>(
    map: Map<string, TFrame[]>,
    id: string,
    frame: TFrame
): void => {
    const existing = map.get(id);
    if (existing !== undefined) {
        existing.push(frame);
        return;
    }

    map.set(id, [frame]);
};

const toSortedFrames = <TFrame extends { readonly t: number }>(frames: readonly TFrame[]): readonly TFrame[] =>
    [...frames].sort((a, b) => a.t - b.t);

const toSortedTrackEntries = <TFrame extends { readonly t: number }>(
    map: ReadonlyMap<string, readonly TFrame[]>
): Array<readonly [string, readonly TFrame[]]> =>
    [...map.entries()]
        .map(([id, frames]) => [id, toSortedFrames(frames)] as const)
        .sort((a, b) => a[0].localeCompare(b[0]));

const createDurationMs = (
    cameraFrames: readonly OverlayReplayCameraFrame[],
    actorFramesById: ReadonlyMap<string, readonly OverlayReplayActorTrack['frames'][number][]>,
    platformFramesById: ReadonlyMap<string, readonly OverlayReplayPlatformTrack['frames'][number][]>,
    vfxFramesById: ReadonlyMap<string, readonly OverlayReplayVfxTrack['frames'][number][]>,
    screenFramesById: ReadonlyMap<string, readonly OverlayReplayScreenTrack['frames'][number][]>
): number => {
    let maxT = 0;

    for (const frame of cameraFrames) {
        if (frame.t > maxT) {
            maxT = frame.t;
        }
    }

    const updateFromTrackMap = <TFrame extends { readonly t: number }>(
        trackMap: ReadonlyMap<string, readonly TFrame[]>
    ): void => {
        for (const frames of trackMap.values()) {
            for (const frame of frames) {
                if (frame.t > maxT) {
                    maxT = frame.t;
                }
            }
        }
    };

    updateFromTrackMap(actorFramesById);
    updateFromTrackMap(platformFramesById);
    updateFromTrackMap(vfxFramesById);
    updateFromTrackMap(screenFramesById);

    return maxT;
};

export const createOverlayReplayRecorder = (
    options: OverlayReplayRecorderOptions
): OverlayReplayRecorder => {
    const fps = options.fps ?? DEFAULT_FPS;
    const state = createState();

    return {
        addSample(sample: OverlayReplayRecorderSample): void {
            if (sample.camera !== undefined) {
                state.cameraFrames.push(cloneCameraFrame(sample.camera));
            }

            for (const actorFrame of sample.actors ?? []) {
                addGroupedFrame(state.actorFramesById, actorFrame.actorId, cloneActorFrame(actorFrame));
            }

            for (const platformFrame of sample.platforms ?? []) {
                addGroupedFrame(state.platformFramesById, platformFrame.platformId, clonePlatformFrame(platformFrame));
            }

            for (const vfxFrame of sample.vfx ?? []) {
                addGroupedFrame(state.vfxFramesById, vfxFrame.trackId, cloneVfxFrame(vfxFrame));
            }

            for (const screenFrame of sample.screen ?? []) {
                addGroupedFrame(state.screenFramesById, screenFrame.trackId, cloneScreenFrame(screenFrame));
            }
        },

        build(): OverlayReplayAsset {
            const cameraFrames = toSortedFrames(state.cameraFrames);
            const actorTrackEntries = toSortedTrackEntries(state.actorFramesById);
            const platformTrackEntries = toSortedTrackEntries(state.platformFramesById);
            const vfxTrackEntries = toSortedTrackEntries(state.vfxFramesById);
            const screenTrackEntries = toSortedTrackEntries(state.screenFramesById);

            const durationMs = createDurationMs(
                cameraFrames,
                state.actorFramesById,
                state.platformFramesById,
                state.vfxFramesById,
                state.screenFramesById
            );

            return {
                schemaVersion: OverlayReplaySchemaVersion,
                id: options.id,
                ...(options.displayName !== undefined ? { displayName: options.displayName } : {}),
                sourceLevelId: options.sourceLevelId,
                durationMs,
                fps,
                viewport: { ...options.viewport },
                cameraTrack: {
                    frames: cameraFrames.map(cloneCameraFrame)
                },
                actorTracks: actorTrackEntries.map(([actorId, frames]) => ({
                    actorId,
                    frames: frames.map(cloneActorFrame)
                })),
                platformTracks: platformTrackEntries.map(([platformId, frames]) => ({
                    platformId,
                    frames: frames.map(clonePlatformFrame)
                })),
                vfxTracks: vfxTrackEntries.map(([id, frames]) => ({
                    id,
                    frames: frames.map(cloneVfxFrame)
                })),
                screenTracks: screenTrackEntries.map(([id, frames]) => ({
                    id,
                    frames: frames.map(cloneScreenFrame)
                }))
            };
        },

        clear(): void {
            state.cameraFrames.length = 0;
            state.actorFramesById.clear();
            state.platformFramesById.clear();
            state.vfxFramesById.clear();
            state.screenFramesById.clear();
        }
    };
};