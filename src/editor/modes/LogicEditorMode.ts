import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class LogicEditorMode implements EditorMode {
    public readonly id = 'logic';
    public readonly label = 'Logic';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('Logic Inspector', [
            'Logic mode placeholder (MVP Step 1).',
            'Future: scripts list and search tools.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('Logic Properties', [
            'Placeholder for script instructions and users.',
            'Script authoring is intentionally out of scope now.'
        ]);
    }
}
