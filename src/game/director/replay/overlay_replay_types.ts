/**
 * Overlay replay data is baked sampled data captured from authored content,
 * not a live simulation stream.
 */
export const OverlayReplaySchemaVersion = 1 as const;

export type OverlayReplaySchemaVersion = typeof OverlayReplaySchemaVersion;

export type OverlayReplayScaleMode = 'contain' | 'cover' | 'stretch' | 'pixel_perfect';

export interface OverlayReplayViewport {
    readonly width: number;
    readonly height: number;
    readonly scaleMode: OverlayReplayScaleMode;
}

export interface OverlayReplayPoint {
    readonly x: number;
    readonly y: number;
}

export interface OverlayReplayCameraFrame {
    readonly t: number;
    readonly x: number;
    readonly y: number;
    readonly zoom?: number;
    readonly rotation?: number;
}

export interface OverlayReplayCameraTrack {
    readonly frames: readonly OverlayReplayCameraFrame[];
}

export type OverlayReplayFacing = 'left' | 'right' | 'up' | 'down';

export interface OverlayReplayFocusMarkerFrame {
    readonly kind: 'actor' | 'point' | 'marker';
    readonly actorId?: string;
    readonly markerId?: string;
    readonly x?: number;
    readonly y?: number;
    readonly styleId?: string;
}

export interface OverlayReplayActorFrame {
    readonly t: number;
    readonly x: number;
    readonly y: number;
    readonly rotation?: number;
    readonly scaleX?: number;
    readonly scaleY?: number;
    readonly animationId?: string;
    readonly facing?: OverlayReplayFacing;
    readonly formId?: string;
    readonly manpuId?: string;
    readonly focusMarker?: OverlayReplayFocusMarkerFrame;
    readonly visible?: boolean;
}

export interface OverlayReplayActorTrack {
    readonly actorId: string;
    readonly displayName?: string;
    readonly placeholderStyleId?: string;
    readonly frames: readonly OverlayReplayActorFrame[];
}

export interface OverlayReplayPlatformFrame {
    readonly t: number;
    readonly x: number;
    readonly y: number;
    readonly rotation?: number;
    readonly visible?: boolean;
}

export interface OverlayReplayPlatformTrack {
    readonly platformId: string;
    readonly frames: readonly OverlayReplayPlatformFrame[];
}

export interface OverlayReplayVfxFrame {
    readonly t: number;
    readonly vfxId: string;
    readonly x: number;
    readonly y: number;
    readonly visible?: boolean;
}

export interface OverlayReplayVfxTrack {
    readonly id: string;
    readonly frames: readonly OverlayReplayVfxFrame[];
}

export interface OverlayReplayScreenFrame {
    readonly t: number;
    readonly effectId: string;
    readonly params?: Readonly<Record<string, unknown>>;
}

export interface OverlayReplayScreenTrack {
    readonly id: string;
    readonly frames: readonly OverlayReplayScreenFrame[];
}

/**
 * Overlay replay playback must remain independent from current source level state.
 * `sourceLevelId` is provenance metadata plus validation reference only, not a runtime dependency.
 * The default authored target is 30 fps, but replay assets store fps explicitly.
 */
export interface OverlayReplayAsset {
    readonly schemaVersion: OverlayReplaySchemaVersion;
    readonly id: string;
    readonly displayName?: string;
    readonly sourceLevelId: string;
    readonly durationMs: number;
    readonly fps: number;
    readonly viewport: OverlayReplayViewport;
    readonly cameraTrack: OverlayReplayCameraTrack;
    readonly actorTracks: readonly OverlayReplayActorTrack[];
    readonly platformTracks: readonly OverlayReplayPlatformTrack[];
    readonly vfxTracks: readonly OverlayReplayVfxTrack[];
    readonly screenTracks: readonly OverlayReplayScreenTrack[];
}
