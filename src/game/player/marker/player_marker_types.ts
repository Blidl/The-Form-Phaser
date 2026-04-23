export interface PlayerMarkerState {
    currentOffsetX: number;
    currentOffsetY: number;
    targetOffsetX: number;
    targetOffsetY: number;
    lastNonZeroDirectionX: -1 | 0 | 1;
    lastNonZeroDirectionY: -1 | 0 | 1;
    hasLastNonZeroDirection: boolean;
}
