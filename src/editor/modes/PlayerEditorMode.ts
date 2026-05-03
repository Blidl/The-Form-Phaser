import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class PlayerEditorMode implements EditorMode {
    public readonly id = 'player';
    public readonly label = 'Player';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('Player Inspector', [
            'Player mode placeholder (MVP Step 1).',
            'Future: form tuning categories and presets.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('Player Properties', [
            'Placeholder for movement/system settings.',
            'No gameplay tuning persistence in this step.'
        ]);
    }
}
