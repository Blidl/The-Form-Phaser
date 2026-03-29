export interface PlayerMarkerOffset {
    readonly x: number;
    readonly y: number;
}

export interface PlayerMarkerConfig {
    readonly offset: PlayerMarkerOffset;
    readonly size: number;
    readonly color: number;
}

export const DEFAULT_PLAYER_MARKER_CONFIG: PlayerMarkerConfig = {
    offset: { x: 28, y: 0 },
    size: 10,
    color: 0xf97316
};
