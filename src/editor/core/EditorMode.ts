import type { EditorPanel } from '../ui/EditorPanel';

export type EditorModeId =
    | 'level'
    | 'player'
    | 'objects'
    | 'background'
    | 'npc'
    | 'cutscenes'
    | 'logic';

export interface EditorMode {
    readonly id: EditorModeId;
    readonly label: string;
    enter?(): void;
    exit?(): void;
    renderLeftInspector(panel: EditorPanel): void;
    renderRightInspector(panel: EditorPanel): void;
}

export const EDITOR_MODE_ORDER: readonly EditorModeId[] = [
    'level',
    'player',
    'objects',
    'background',
    'npc',
    'cutscenes',
    'logic'
] as const;

export const EDITOR_MODE_LABELS: Record<EditorModeId, string> = {
    level: 'Level',
    player: 'Player',
    objects: 'Objects',
    background: 'Background',
    npc: 'NPC',
    cutscenes: 'Cutscenes',
    logic: 'Logic'
};
