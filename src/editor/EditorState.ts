import type { EditorModeId } from './core/EditorMode';

export interface EditorState {
    isOpen: boolean;
    activeModeId: EditorModeId;
    mouseWorldX: number | null;
    mouseWorldY: number | null;
}

export const createInitialEditorState = (): EditorState => {
    return {
        isOpen: false,
        activeModeId: 'level',
        mouseWorldX: null,
        mouseWorldY: null
    };
};
