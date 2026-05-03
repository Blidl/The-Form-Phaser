import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class ObjectsEditorMode implements EditorMode {
    public readonly id = 'objects';
    public readonly label = 'Objects';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('Objects Inspector', [
            'Objects mode placeholder (MVP Step 1).',
            'Future: object catalog, list, and focus tools.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('Object Properties', [
            'Placeholder for selected object fields.',
            'Object editing is intentionally out of scope now.'
        ]);
    }
}
