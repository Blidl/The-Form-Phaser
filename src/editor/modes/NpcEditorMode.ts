import type { EditorMode } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';

export class NpcEditorMode implements EditorMode {
    public readonly id = 'npc';
    public readonly label = 'NPC';

    public renderLeftInspector(panel: EditorPanel): void {
        panel.setContent('NPC Inspector', [
            'NPC mode placeholder (MVP Step 1).',
            'Future: NPC list, search, and create controls.'
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        panel.setContent('NPC Properties', [
            'Placeholder for behavior and visual settings.',
            'NPC editing is not implemented yet.'
        ]);
    }
}
