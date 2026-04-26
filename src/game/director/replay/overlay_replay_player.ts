import type {
    OverlayReplayActorFrame,
    OverlayReplayAsset,
    OverlayReplayCameraFrame,
    OverlayReplayPlatformFrame,
    OverlayReplayScreenFrame,
    OverlayReplayVfxFrame
} from './overlay_replay_types';

export type OverlayReplayPlaybackStatus = 'idle' | 'playing' | 'completed' | 'cancelled';

export interface OverlayReplayPlaybackFrame {
    readonly t: number;
    readonly camera: OverlayReplayCameraFrame | null;
    readonly actors: readonly (OverlayReplayActorFrame & { readonly actorId: string })[];
    readonly platforms: readonly (OverlayReplayPlatformFrame & { readonly platformId: string })[];
    readonly vfx: readonly (OverlayReplayVfxFrame & { readonly trackId: string })[];
    readonly screen: readonly (OverlayReplayScreenFrame & { readonly trackId: string })[];
}

export interface OverlayReplayPlayer {
    begin(): OverlayReplayPlaybackStatus;
    update(deltaMs: number): OverlayReplayPlaybackStatus;
    cancel(): void;
    seek(tMs: number): OverlayReplayPlaybackStatus;
    getStatus(): OverlayReplayPlaybackStatus;
    getTimeMs(): number;
    getFrame(): OverlayReplayPlaybackFrame;
}

type FrameWithTime = { readonly t: number };

type FramePair<TFrame> = {
    readonly previous: TFrame | null;
    readonly next: TFrame | null;
};

const cloneFocusMarker = (
    marker: OverlayReplayActorFrame['focusMarker']
): OverlayReplayActorFrame['focusMarker'] => {
    if (marker === undefined) {
        return undefined;
    }
    return { ...marker };
};

const cloneCameraFrame = (frame: OverlayReplayCameraFrame): OverlayReplayCameraFrame => ({ ...frame });

const cloneActorFrame = (frame: OverlayReplayActorFrame): OverlayReplayActorFrame => ({
    ...frame,
    ...(frame.focusMarker !== undefined ? { focusMarker: cloneFocusMarker(frame.focusMarker) } : {})
});

const clonePlatformFrame = (frame: OverlayReplayPlatformFrame): OverlayReplayPlatformFrame => ({ ...frame });

const cloneVfxFrame = (frame: OverlayReplayVfxFrame): OverlayReplayVfxFrame => ({ ...frame });

const cloneScreenFrame = (frame: OverlayReplayScreenFrame): OverlayReplayScreenFrame => ({
    ...frame,
    ...(frame.params !== undefined ? { params: { ...frame.params } } : {})
});

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};

const findFramePair = <TFrame extends FrameWithTime>(
    frames: readonly TFrame[],
    t: number
): FramePair<TFrame> => {
    if (frames.length === 0) {
        return { previous: null, next: null };
    }

    let previous: TFrame | null = null;
    let next: TFrame | null = null;

    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (frame.t <= t) {
            previous = frame;
            continue;
        }

        next = frame;
        break;
    }

    return {
        previous,
        next
    };
};

const normalizeInterpolationFactor = (
    previousT: number,
    nextT: number,
    t: number
): number => {
    if (nextT <= previousT) {
        return 0;
    }
    return clamp((t - previousT) / (nextT - previousT), 0, 1);
};

const interpolateOptionalNumber = <TFrame extends FrameWithTime>(
    previous: TFrame,
    next: TFrame | null,
    t: number,
    selector: (frame: TFrame) => number | undefined
): number | undefined => {
    const previousValue = selector(previous);
    if (previousValue === undefined) {
        return undefined;
    }

    if (next === null) {
        return previousValue;
    }

    const nextValue = selector(next);
    if (nextValue === undefined) {
        return previousValue;
    }

    const alpha = normalizeInterpolationFactor(previous.t, next.t, t);
    return previousValue + (nextValue - previousValue) * alpha;
};

const sampleCameraFrame = (
    frames: readonly OverlayReplayCameraFrame[],
    t: number
): OverlayReplayCameraFrame | null => {
    const pair = findFramePair(frames, t);
    if (pair.previous === null) {
        return null;
    }

    const previous = pair.previous;
    const next = pair.next;
    const zoom = interpolateOptionalNumber(previous, next, t, (frame) => frame.zoom);
    const rotation = interpolateOptionalNumber(previous, next, t, (frame) => frame.rotation);

    return {
        t,
        x: interpolateOptionalNumber(previous, next, t, (frame) => frame.x) ?? previous.x,
        y: interpolateOptionalNumber(previous, next, t, (frame) => frame.y) ?? previous.y,
        ...(zoom !== undefined ? { zoom } : {}),
        ...(rotation !== undefined ? { rotation } : {})
    };
};

const sampleActorFrame = (
    frames: readonly OverlayReplayActorFrame[],
    t: number
): OverlayReplayActorFrame | null => {
    const pair = findFramePair(frames, t);
    if (pair.previous === null) {
        return null;
    }

    const previous = pair.previous;
    const next = pair.next;

    const rotation = interpolateOptionalNumber(previous, next, t, (frame) => frame.rotation);
    const scaleX = interpolateOptionalNumber(previous, next, t, (frame) => frame.scaleX);
    const scaleY = interpolateOptionalNumber(previous, next, t, (frame) => frame.scaleY);

    return {
        t,
        x: interpolateOptionalNumber(previous, next, t, (frame) => frame.x) ?? previous.x,
        y: interpolateOptionalNumber(previous, next, t, (frame) => frame.y) ?? previous.y,
        ...(rotation !== undefined ? { rotation } : {}),
        ...(scaleX !== undefined ? { scaleX } : {}),
        ...(scaleY !== undefined ? { scaleY } : {}),
        ...(previous.animationId !== undefined ? { animationId: previous.animationId } : {}),
        ...(previous.facing !== undefined ? { facing: previous.facing } : {}),
        ...(previous.formId !== undefined ? { formId: previous.formId } : {}),
        ...(previous.manpuId !== undefined ? { manpuId: previous.manpuId } : {}),
        ...(previous.focusMarker !== undefined ? { focusMarker: cloneFocusMarker(previous.focusMarker) } : {}),
        ...(previous.visible !== undefined ? { visible: previous.visible } : {})
    };
};

const samplePlatformFrame = (
    frames: readonly OverlayReplayPlatformFrame[],
    t: number
): OverlayReplayPlatformFrame | null => {
    const pair = findFramePair(frames, t);
    if (pair.previous === null) {
        return null;
    }

    const previous = pair.previous;
    const next = pair.next;

    const rotation = interpolateOptionalNumber(previous, next, t, (frame) => frame.rotation);

    return {
        t,
        x: interpolateOptionalNumber(previous, next, t, (frame) => frame.x) ?? previous.x,
        y: interpolateOptionalNumber(previous, next, t, (frame) => frame.y) ?? previous.y,
        ...(rotation !== undefined ? { rotation } : {}),
        ...(previous.visible !== undefined ? { visible: previous.visible } : {})
    };
};

const sampleVfxFrame = (frames: readonly OverlayReplayVfxFrame[], t: number): OverlayReplayVfxFrame | null => {
    const pair = findFramePair(frames, t);
    if (pair.previous === null) {
        return null;
    }

    const previous = pair.previous;
    const next = pair.next;

    return {
        t,
        vfxId: previous.vfxId,
        x: interpolateOptionalNumber(previous, next, t, (frame) => frame.x) ?? previous.x,
        y: interpolateOptionalNumber(previous, next, t, (frame) => frame.y) ?? previous.y,
        ...(previous.visible !== undefined ? { visible: previous.visible } : {})
    };
};

const sampleScreenFrame = (
    frames: readonly OverlayReplayScreenFrame[],
    t: number
): OverlayReplayScreenFrame | null => {
    const pair = findFramePair(frames, t);
    if (pair.previous === null) {
        return null;
    }

    const previous = pair.previous;
    return {
        t,
        effectId: previous.effectId,
        ...(previous.params !== undefined ? { params: { ...previous.params } } : {})
    };
};

const toFiniteNonNegative = (value: number): number => {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }
    return value;
};

export const createOverlayReplayPlayer = (asset: OverlayReplayAsset): OverlayReplayPlayer => {
    let status: OverlayReplayPlaybackStatus = 'idle';
    let timeMs = 0;
    const durationMs = Math.max(0, asset.durationMs);

    return {
        begin(): OverlayReplayPlaybackStatus {
            timeMs = 0;
            status = durationMs <= 0 ? 'completed' : 'playing';
            return status;
        },

        update(deltaMs: number): OverlayReplayPlaybackStatus {
            if (status !== 'playing') {
                return status;
            }

            const safeDeltaMs = toFiniteNonNegative(deltaMs);
            timeMs = clamp(timeMs + safeDeltaMs, 0, durationMs);

            if (timeMs >= durationMs) {
                status = 'completed';
            }

            return status;
        },

        cancel(): void {
            if (status !== 'completed') {
                status = 'cancelled';
            }
        },

        seek(tMs: number): OverlayReplayPlaybackStatus {
            const targetTimeMs = Number.isFinite(tMs) ? tMs : 0;
            timeMs = clamp(targetTimeMs, 0, durationMs);

            if (status !== 'cancelled') {
                if (timeMs >= durationMs) {
                    status = 'completed';
                } else if (status === 'completed') {
                    status = 'idle';
                }
            }

            return status;
        },

        getStatus(): OverlayReplayPlaybackStatus {
            return status;
        },

        getTimeMs(): number {
            return timeMs;
        },

        getFrame(): OverlayReplayPlaybackFrame {
            const cameraSample = sampleCameraFrame(asset.cameraTrack.frames, timeMs);

            return {
                t: timeMs,
                camera: cameraSample !== null ? cloneCameraFrame(cameraSample) : null,
                actors: asset.actorTracks
                    .map((track) => {
                        const frame = sampleActorFrame(track.frames, timeMs);
                        if (frame === null) {
                            return null;
                        }
                        return {
                            actorId: track.actorId,
                            ...cloneActorFrame(frame)
                        };
                    })
                    .filter((entry): entry is OverlayReplayActorFrame & { readonly actorId: string } => entry !== null),
                platforms: asset.platformTracks
                    .map((track) => {
                        const frame = samplePlatformFrame(track.frames, timeMs);
                        if (frame === null) {
                            return null;
                        }
                        return {
                            platformId: track.platformId,
                            ...clonePlatformFrame(frame)
                        };
                    })
                    .filter(
                        (entry): entry is OverlayReplayPlatformFrame & { readonly platformId: string } => entry !== null
                    ),
                vfx: asset.vfxTracks
                    .map((track) => {
                        const frame = sampleVfxFrame(track.frames, timeMs);
                        if (frame === null) {
                            return null;
                        }
                        return {
                            trackId: track.id,
                            ...cloneVfxFrame(frame)
                        };
                    })
                    .filter((entry): entry is OverlayReplayVfxFrame & { readonly trackId: string } => entry !== null),
                screen: asset.screenTracks
                    .map((track) => {
                        const frame = sampleScreenFrame(track.frames, timeMs);
                        if (frame === null) {
                            return null;
                        }
                        return {
                            trackId: track.id,
                            ...cloneScreenFrame(frame)
                        };
                    })
                    .filter((entry): entry is OverlayReplayScreenFrame & { readonly trackId: string } => entry !== null)
            };
        }
    };
};
