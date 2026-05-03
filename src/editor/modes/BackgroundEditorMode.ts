import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class BackgroundEditorMode implements EditorMode {
    public readonly id = 'background';
    public readonly label = 'Background';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('Background Inspector', [
            'Background mode placeholder (MVP Step 1).',
            'Future: static/parallax asset selectors.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('Background Properties', [
            'Placeholder for layer and visual settings.',
            'No background editing logic in this step.'
        ]);
    }
}
