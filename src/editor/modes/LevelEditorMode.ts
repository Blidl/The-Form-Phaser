import type { EditorMode } from '../core/EditorMode';
import type { ProjectStore } from '../data/ProjectStore';
import type { EditorPanel } from '../ui/EditorPanel';

export class LevelEditorMode implements EditorMode {
    public readonly id = 'level';
    public readonly label = 'Level';
    private readonly projectStore: ProjectStore;

    public constructor(projectStore: ProjectStore) {
        this.projectStore = projectStore;
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const project = this.projectStore.getProject();
        const activeLevel = this.projectStore.getActiveLevel();

        panel.setContent('Level Inspector', [
            'Level mode placeholder (MVP Step 1).',
            `Active: ${activeLevel.name} (${activeLevel.id})`,
            `Project levels: ${project.levels.length}`,
            `Start level: ${project.levelSequence.startLevelId}`
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        const activeLevel = this.projectStore.getActiveLevel();

        panel.setContent('Level Properties', [
            `ID: ${activeLevel.id}`,
            `Name: ${activeLevel.name}`,
            `Size: ${activeLevel.width} x ${activeLevel.height}`,
            'Save/Undo are not implemented in this step.'
        ]);
    }
}
