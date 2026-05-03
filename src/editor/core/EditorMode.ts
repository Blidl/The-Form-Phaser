import type { EditorPanel } from '../ui/EditorPanel';
import type { EditorGridSettings } from '../data/ProjectData';

export interface EditorPointerEvent {
    button: number;
    worldX: number;
    worldY: number;
    shiftKey: boolean;
}

export interface EditorModeRuntimeContext {
    mouseWorldX: number | null;
    mouseWorldY: number | null;
    grid: EditorGridSettings;
}

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
    update?(context: EditorModeRuntimeContext): void;
    onPointerDown?(event: EditorPointerEvent, context: EditorModeRuntimeContext): void;
    onPointerMove?(event: EditorPointerEvent, context: EditorModeRuntimeContext): void;
    onPointerUp?(event: EditorPointerEvent, context: EditorModeRuntimeContext): void;
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
