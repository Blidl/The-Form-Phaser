import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class CutscenesEditorMode implements EditorMode {
    public readonly id = 'cutscenes';
    public readonly label = 'Cutscenes';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('Cutscenes Inspector', [
            'Cutscenes mode placeholder (MVP Step 1).',
            'Future: cutscene list and actor timeline tools.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('Cutscene Properties', [
            'Placeholder for cutscene settings.',
            'Cutscene editing is not implemented yet.'
        ]);
    }
}
