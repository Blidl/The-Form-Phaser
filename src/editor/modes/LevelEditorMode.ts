import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class LevelEditorMode implements EditorMode {
    public readonly id = 'level';
    public readonly label = 'Level';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('Level Inspector', [
            'Level mode placeholder (MVP Step 1).',
            'Future: level sequence and metadata tools.',
            'Grid and coordinates are active in shell.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('Level Properties', [
            'Placeholder fields for level settings.',
            'Save/Undo are not implemented in this step.'
        ]);
    }
}
