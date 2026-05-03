import type { LevelData } from './LevelData';

export interface LevelTransitionData {
    triggerId: string;
    targetLevelId: string;
}

export interface LevelSequenceData {
    startLevelId: string;
    transitions: LevelTransitionData[];
}

export interface EditorGridSettings {
    enabled: boolean;
    snapEnabled: boolean;
    size: number;
}

export interface ProjectData {
    schemaVersion: number;
    gameId: string;
    activeLevelId: string;
    levels: LevelData[];
    levelSequence: LevelSequenceData;
    grid: EditorGridSettings;
}
