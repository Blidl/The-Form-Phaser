import type { EditorObjectData } from './EditorObjectData';

export interface EditorNpcData {
    id: string;
    name: string;
}

export interface EditorBackgroundData {
    id: string;
    name: string;
}

export interface EditorCutsceneData {
    id: string;
    name: string;
}

export interface LevelData {
    id: string;
    name: string;
    width: number;
    height: number;
    objects: EditorObjectData[];
    npcs: EditorNpcData[];
    backgrounds: EditorBackgroundData[];
    cutscenes: EditorCutsceneData[];
}

export interface CreateDefaultLevelOptions {
    id: string;
    name?: string;
    width?: number;
    height?: number;
}

export const createDefaultLevelData = (options: CreateDefaultLevelOptions): LevelData => {
    return {
        id: options.id,
        name: options.name ?? options.id,
        width: options.width ?? 2200,
        height: options.height ?? 900,
        objects: [],
        npcs: [],
        backgrounds: [],
        cutscenes: []
    };
};
