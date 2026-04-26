export type DirectorTimelineSchemaVersion = 2;

export const DIRECTOR_TIMELINE_SCHEMA_VERSION: DirectorTimelineSchemaVersion = 2;

export type CutsceneAssetMode = 'in_level' | 'overlay_replay';

export type DirectorTimelineTrackType =
    | 'camera'
    | 'actor'
    | 'player'
    | 'platform'
    | 'world'
    | 'event'
    | 'flag'
    | 'manpu'
    | 'focus_marker'
    | 'audio'
    | 'vfx'
    | 'screen';

export interface CutsceneAssetSettings {
    readonly lockPlayerInput: boolean;
    readonly pauseGameUnderOverlay: boolean;
    readonly restoreCameraAfterEnd: boolean;
    readonly markSeenFlagId?: string;
    readonly replayOnce?: boolean;
}

export interface DirectorTimelineClip {
    readonly id: string;
    readonly startMs: number;
    readonly durationMs: number;
    readonly actionType: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly blocking?: boolean;
}

export interface DirectorTimelineTrack {
    readonly id: string;
    readonly type: DirectorTimelineTrackType;
    readonly title?: string;
    readonly targetId?: string;
    readonly clips: readonly DirectorTimelineClip[];
}

export interface CutsceneAsset {
    readonly schemaVersion: 2;
    readonly id: string;
    readonly displayName?: string;
    readonly mode: CutsceneAssetMode;
    readonly durationMs: number;
    readonly settings: CutsceneAssetSettings;
    readonly tracks: readonly DirectorTimelineTrack[];
}

export interface DirectorTimelineMigrationIssue {
    readonly severity: 'warning' | 'info';
    readonly code: string;
    readonly message: string;
    readonly path?: string;
}

export interface DirectorTimelineMigrationResult {
    readonly asset: CutsceneAsset;
    readonly issues: readonly DirectorTimelineMigrationIssue[];
}
