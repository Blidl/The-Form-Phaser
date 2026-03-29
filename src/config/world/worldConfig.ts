export interface WorldConfig {
    readonly checkpointDebugEnabled: boolean;
    readonly hazardDebugEnabled: boolean;
}

export const WORLD_CONFIG: WorldConfig = {
    checkpointDebugEnabled: false,
    hazardDebugEnabled: false
};
